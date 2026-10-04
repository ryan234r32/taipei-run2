import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, X } from 'lucide-react'
import { BODY } from './game/gestures'
import type { Landmark, PoseOutput } from './game/gestures'
import type { Action } from './game/rules'
import './BodyCamera.css'

const ACTION_LABEL: Record<Action, string> = { left: '← LEFT', right: 'RIGHT →', jump: 'JUMP ↑', duck: 'DUCK ↓', throw: 'THROW!' }
type BodyCameraProps = {
  onPose: (lane: number, action?: Action) => void
  onClose: () => void
  onReady?: (ready: boolean) => void
  onDuckChange?: (active: boolean) => void
  onTrackingChange?: (tracked: boolean) => void
}
export function BodyCamera({ onPose, onClose, onReady, onDuckChange, onTrackingChange }: BodyCameraProps) {
  const video = useRef<HTMLVideoElement>(null), canvas = useRef<HTMLCanvasElement>(null), worker = useRef<Worker | null>(null)
  const callbacks = useRef({ onPose, onReady, onDuckChange, onTrackingChange })
  useEffect(() => { callbacks.current = { onPose, onReady, onDuckChange, onTrackingChange } }, [onPose, onReady, onDuckChange, onTrackingChange])
  const [message, setMessage] = useState('Requesting camera, then loading the body-tracking model…')
  const [ready, setReady] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(false)
  const [lane, setLane] = useState(0), [aspectRatio, setAspectRatio] = useState(4 / 3)
  const [tracked, setTracked] = useState(false), [ducking, setDucking] = useState(false), [delegate, setDelegate] = useState('')
  const [flash, setFlash] = useState<{ text: string; id: number } | null>(null), [debug, setDebug] = useState('')
  const previous = useRef({ ready: false, ducking: false, tracked: false })
  const report = useRef((p: Pick<PoseOutput, 'ready' | 'ducking' | 'tracked'>) => {
    if (p.ready !== previous.current.ready) callbacks.current.onReady?.(p.ready)
    if (p.ducking !== previous.current.ducking) callbacks.current.onDuckChange?.(p.ducking)
    if (p.tracked !== previous.current.tracked) callbacks.current.onTrackingChange?.(p.tracked)
    previous.current = p
  })
  useEffect(() => {
    const reportState = report.current
    let stream: MediaStream | undefined, stopped = false, timer = 0, busy = false, lastFrame = -1, flashTimer = 0, lastLane = 0, flashId = 0
    const showFlash = (text: string) => {
      clearTimeout(flashTimer); flashId += 1; setFlash({ text, id: flashId })
      flashTimer = window.setTimeout(() => setFlash(null), 700)
    }
    const w = new Worker(new URL('./game/pose.worker.ts', import.meta.url), { type: 'module' }); worker.current = w
    const fail = (text = 'Camera failed to start. Allow camera access, or play with the keyboard.') => {
      if (stopped) return
      setError(true); setReady(false); setMessage(text)
      reportState({ ready: false, ducking: false, tracked: false })
      stream?.getTracks().forEach(t => t.stop()); clearInterval(timer); w.terminate()
    }
    const init = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { fail('Camera needs HTTPS or localhost. Use a secure URL or play with the keyboard.'); return }
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, aspectRatio: { ideal: 4 / 3 }, facingMode: 'user' }, audio: false })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        const v = video.current
        if (v) {
          v.srcObject = stream; await v.play()
          if (stopped) return
          setAspectRatio(v.videoWidth / v.videoHeight || 4 / 3)
          if (canvas.current) { canvas.current.width = v.videoWidth || 640; canvas.current.height = v.videoHeight || 480 }
        }
        setMessage('Camera is on. Loading the on-device tracking model…')
        w.postMessage({ type: 'init' })
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        if (!stopped) fail(name === 'NotAllowedError' ? 'Camera permission denied. Enable it, then reopen the camera.' : name === 'NotFoundError' ? 'No camera found. You can play with the keyboard.' : undefined)
      }
    }
    w.onmessage = e => {
      if (stopped) return
      if (e.data.type === 'error') { console.error('Body Camera:', e.data.stage, e.data.message); fail('Tracking model failed to load. Reopen the camera, or use the keyboard.'); return }
      if (e.data.type === 'loaded') {
        setMessage('Get your face and both shoulders in frame (feet not needed)'); setDelegate(e.data.delegate ?? '')
        timer = window.setInterval(async () => {
          const v = video.current
          if (busy || !v || v.readyState < 2 || v.currentTime === lastFrame || stopped) return
          busy = true; lastFrame = v.currentTime
          try {
            const image = await createImageBitmap(v)
            if (stopped) { image.close(); return }
            w.postMessage({ type: 'frame', image, now: performance.now() }, [image])
          } catch { busy = false }
        }, 50)
      }
      if (e.data.type === 'pose') {
        busy = false
        const p = e.data.pose as PoseOutput
        setReady(p.ready); setMessage(p.message); setProgress(p.progress); setLane(p.lane); setTracked(p.tracked); setDucking(p.ready && p.ducking)
        if (e.data.delegate) setDelegate(e.data.delegate)
        setDebug(p.debug ? `Height ${p.debug.rise >= 0 ? '+' : ''}${p.debug.rise.toFixed(2)} shoulders · Sway ${(-p.debug.shift).toFixed(2)}` : '')
        reportState(p)
        if (p.ready) {
          callbacks.current.onPose(p.lane, p.action)
          if (p.action) showFlash(ACTION_LABEL[p.action])
          else if (p.lane !== lastLane) showFlash(p.lane < 0 ? '← LEFT' : p.lane > 0 ? 'RIGHT →' : 'CENTER')
          lastLane = p.lane
        }
        const c = canvas.current, ctx = c?.getContext('2d')
        if (c && ctx) {
          ctx.clearRect(0, 0, c.width, c.height); ctx.strokeStyle = p.ready ? '#e8fc86' : '#f7bd74'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3
          const lm = e.data.landmarks as Landmark[]
          const d = p.ready ? p.debug : undefined
          if (d) {
            // Guide lines (raw coordinates; the canvas is mirrored with the video by CSS).
            const line = (y: number, color: string) => { ctx.strokeStyle = color; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(0, y * c.height); ctx.lineTo(c.width, y * c.height); ctx.stroke() }
            line(d.baseY - BODY.jumpRise * d.unit, '#7dfcb2'); line(d.baseY, '#ffffff'); line(d.baseY + BODY.duckDrop * d.unit, '#ffa95e')
            ctx.strokeStyle = '#ffffff80'
            for (const x of [d.baseX - d.laneEnter, d.baseX + d.laneEnter]) { ctx.beginPath(); ctx.moveTo(x * c.width, 0); ctx.lineTo(x * c.width, c.height); ctx.stroke() }
            ctx.setLineDash([]); ctx.strokeStyle = '#e8fc86'
          }
          for (const [a, b] of [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]]) {
            if (!lm[a] || !lm[b] || (lm[a].visibility ?? 1) < .4 || (lm[b].visibility ?? 1) < .4) continue
            ctx.beginPath(); ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height); ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height); ctx.stroke()
          }
          for (const i of [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28]) {
            const point = lm[i]
            if (!point || (point.visibility ?? 1) < .4) continue
            ctx.beginPath(); ctx.arc(point.x * c.width, point.y * c.height, 4, 0, Math.PI * 2); ctx.fill()
          }
        }
      }
    }
    w.onerror = () => fail('Tracking model error. Reopen the camera, or use the keyboard.')
    void init()
    return () => {
      stopped = true; clearInterval(timer); clearTimeout(flashTimer); stream?.getTracks().forEach(t => t.stop()); w.terminate(); worker.current = null
      reportState({ ready: false, ducking: false, tracked: false })
    }
  }, [])
  const recalibrate = () => {
    worker.current?.postMessage({ type: 'reset' }); setReady(false); setProgress(0); setLane(0); setMessage('Stand still for about 1 second to recalibrate…')
    report.current({ ready: false, ducking: false, tracked: false })
  }
  return <aside className={`body-camera ${ready ? 'ready' : ''}`} aria-label="Body camera, bottom right">
    <div className="camera-header"><span><Camera size={13} /> {ready ? 'BODY CONNECTED' : 'BODY SETUP'}</span><button aria-label="Close camera" onClick={onClose}><X size={15} /></button></div>
    <div className="camera-feed" style={{ aspectRatio }}><video ref={video} autoPlay playsInline muted /><canvas ref={canvas} width={640} height={480} /><span className={`camera-track ${error ? 'lost' : ready ? 'ok' : tracked ? 'calibrating' : 'lost'}`}>{error ? 'Camera error' : ready ? (ducking ? '● Ducking' : '● Tracking') : tracked ? `Calibrating ${Math.round(progress * 100)}%` : '✕ No player found'}{delegate && ` · ${delegate}`}</span>{flash && <strong key={flash.id} className="camera-flash">{flash.text}</strong>}<span className="camera-mirror-label">{ready && debug ? debug : 'Mirrored view · left/right match you'}</span>{error && <div className="camera-error"><Camera size={27} /></div>}</div>
    <div className="camera-lanes" aria-label="Current body lane">{[[-1, '← Left'], [0, 'Center'], [1, 'Right →']].map(([value, label]) => <span key={value} className={ready && lane === value ? 'active' : ''}>{label}</span>)}</div>
    <div className="camera-status" role="status"><span className="status-dot" />{message}</div>
    {!ready && !error && <div className="calibration" role="progressbar" aria-label="Body calibration" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress * 100}%` }} /></div>}
    <div className="camera-footer"><span>Video stays on your device</span><button aria-label="Recalibrate body" disabled={error} onClick={recalibrate}><RefreshCw size={12} /> Calibrate</button></div>
  </aside>
}
