import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { GestureTracker, pickPose } from './gestures'
let model: PoseLandmarker | undefined
let delegateUsed: 'GPU' | 'CPU' = 'CPU'
let create: ((delegate: 'GPU' | 'CPU') => Promise<PoseLandmarker>) | undefined
const tracker = new GestureTracker()
// MediaPipe's loader first tries importScripts, then self.import in a module
// worker. Fetch the local ES module as a Blob so Vite does not reinterpret a
// /public WASM loader as an application source import during development.
;(self as unknown as { import: (path: string) => Promise<void> }).import = async path => {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`WASM loader ${response.status}: ${path}`)
  const moduleUrl = URL.createObjectURL(new Blob([await response.text()], { type: 'text/javascript' }))
  try { await import(/* @vite-ignore */ moduleUrl) }
  finally { URL.revokeObjectURL(moduleUrl) }
}
self.onmessage = async (e: MessageEvent) => {
  if (e.data.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks('/wasm', true)
      // numPoses 2: a bystander at the frame edge must not steal tracking; pickPose keeps the player.
      create = (delegate: 'GPU' | 'CPU') => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate }, runningMode: 'VIDEO', numPoses: 2, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5 })
      try { model = await create('GPU'); delegateUsed = 'GPU' } catch (gpuError) { console.warn('Pose GPU delegate unavailable, using CPU', gpuError); model = await create('CPU'); delegateUsed = 'CPU' }
      self.postMessage({ type: 'loaded', delegate: delegateUsed })
    } catch (error) { self.postMessage({ type: 'error', stage: 'model-init', message: String(error) }) }
  }
  if (e.data.type === 'reset') tracker.reset()
  if (e.data.type === 'frame') {
    const image: ImageBitmap = e.data.image
    try {
      if (!model) return
      const aspect = image.width / image.height
      const result = model.detectForVideo(image, e.data.now)
      const landmarks = pickPose(result.landmarks, tracker.focusX, aspect)
      self.postMessage({ type: 'pose', pose: tracker.update(landmarks, e.data.now, aspect), landmarks, delegate: delegateUsed })
    } catch (error) {
      // GPU can initialise yet fail on the first frame; fall back to CPU once instead of giving up.
      if (delegateUsed === 'GPU' && create) {
        try {
          console.warn('Pose GPU inference failed, switching to CPU', error)
          model?.close(); model = undefined; delegateUsed = 'CPU'; model = await create('CPU')
          self.postMessage({ type: 'pose', pose: tracker.update([], e.data.now), landmarks: [], delegate: delegateUsed })
          return
        } catch { /* report below */ }
      }
      self.postMessage({ type: 'error', stage: 'inference', message: String(error) })
    }
    finally { image.close() }
  }
  if (e.data.type === 'stop') { model?.close(); self.close() }
}
