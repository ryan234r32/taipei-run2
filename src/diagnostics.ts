const run = document.querySelector<HTMLButtonElement>('#run')!
const status = document.querySelector<HTMLElement>('#status')!
const result = document.querySelector<HTMLElement>('#result')!
type Result = { ok: boolean; totalSeconds?: number; initializationSeconds?: number; inferenceSeconds?: number; assets?: { path: string; ok: boolean; status: number; bytes: number }[]; details?: unknown; errors: string[] }
run.addEventListener('click', async () => {
  run.disabled = true; status.textContent = '驗證中……'; result.textContent = '正在載入本地資源……'
  const errors: string[] = [], started = performance.now()
  let worker: Worker | undefined, timeout = 0, finished = false
  const report: Result = { ok: false, errors }
  const finish = (ok: boolean, details: unknown) => {
    if (finished) return
    finished = true; clearTimeout(timeout); worker?.terminate(); run.disabled = false
    report.ok = ok; report.totalSeconds = Math.round((performance.now() - started) / 10) / 100; report.details = details
    status.textContent = ok ? 'PASS — 模型已載入，空白 frame 推論完成' : 'FAIL — 請查看下方診斷'
    result.textContent = JSON.stringify(report, null, 2)
    status.dataset.result = ok ? 'pass' : 'fail'
  }
  try {
    report.assets = await Promise.all(['/models/pose_landmarker_lite.task', '/wasm/vision_wasm_module_internal.js', '/wasm/vision_wasm_module_internal.wasm'].map(async path => {
      const response = await fetch(path), bytes = (await response.arrayBuffer()).byteLength
      return { path, ok: response.ok, status: response.status, bytes }
    }))
    if (report.assets.some(asset => !asset.ok || !asset.bytes)) { finish(false, '本地模型或 WASM 資源缺失'); return }
    worker = new Worker(new URL('./game/pose.worker.ts', import.meta.url), { type: 'module' })
    const initStart = performance.now()
    let frameStart = 0
    timeout = window.setTimeout(() => { errors.push('Worker timeout after 45 seconds'); finish(false, { elapsedSeconds: (performance.now() - started) / 1000 }) }, 45000)
    worker.onerror = event => { errors.push(event.message); finish(false, { stage: 'worker-runtime' }) }
    worker.onmessage = event => {
      if (event.data.type === 'error') { errors.push(event.data.message); finish(false, event.data); return }
      if (event.data.type === 'loaded') {
        report.initializationSeconds = Math.round((performance.now() - initStart) / 10) / 100
        result.textContent = '模型已載入，正在送空白 frame……'
        const canvas = new OffscreenCanvas(64, 64), context = canvas.getContext('2d')!
        context.fillStyle = '#777'; context.fillRect(0, 0, 64, 64)
        const image = canvas.transferToImageBitmap(); frameStart = performance.now()
        worker?.postMessage({ type: 'frame', image, now: frameStart }, [image])
      }
      if (event.data.type === 'pose') {
        report.inferenceSeconds = Math.round((performance.now() - frameStart) / 10) / 100
        finish(event.data.pose.ready === false && event.data.pose.tracked === false && event.data.landmarks.length === 0, event.data)
      }
    }
    worker.postMessage({ type: 'init' })
  } catch (error) { errors.push(String(error)); finish(false, { stage: 'page-bootstrap' }) }
})
