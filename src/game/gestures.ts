import type { Action } from './rules'
export type Landmark = { x: number; y: number; z: number; visibility?: number }
export type PoseDebug = { baseY: number; baseX: number; unit: number; rise: number; shift: number; laneEnter: number }
export type PoseOutput = { ready: boolean; tracked: boolean; progress: number; lane: number; ducking: boolean; action?: Action; message: string; debug?: PoseDebug }

// Upper-body, toolkit-style detection: compare the shoulder midpoint with the
// calibrated standing position. Every vertical distance is expressed in
// calibrated shoulder widths, so the same thresholds work at 1 m (chest-up
// framing) and at 2–3 m (full body). Hips, knees and ankles are never required.
export const BODY = {
  calibrationMs: 1000, calibrationFrames: 6, calibrationGapMs: 600, calibrationTolerance: .2,
  jumpRise: .35, jumpRelease: .15, jumpQuickRise: .25, jumpWindowMs: 600, jumpCooldownMs: 450,
  duckDrop: .5, duckRelease: .25, duckAfterJumpMs: 650,
  laneFactor: .6, laneMin: .06, laneMax: .12, laneExit: .6,
  throwWindowMs: 1000, throwCooldownMs: 800,
  lostGraceMs: 450, adaptMs: 4000, stuckJumpMs: 1500, stuckDuckMs: 5000,
} as const
const mean = (a: number, b: number) => (a + b) / 2
const visible = (p?: Landmark, confidence = .5) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= confidence
const finite = (p?: Landmark) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y)
const shouldersOf = (l: Landmark[]) => visible(l[11]) && visible(l[12]) ? { x: mean(l[11].x, l[12].x), y: mean(l[11].y, l[12].y) } : undefined
const widthOf = (l: Landmark[], aspect: number) => Math.hypot((l[11].x - l[12].x) * aspect, l[11].y - l[12].y)

/** Pick one person from several detections: stay with the tracked person, else the largest and most central. */
export function pickPose(poses: Landmark[][], focusX?: number, aspect = 1): Landmark[] {
  let best: Landmark[] = poses[0] ?? [], bestScore = -Infinity
  for (const l of poses) {
    const s = l.length >= 33 ? shouldersOf(l) : undefined
    if (!s) continue
    const score = focusX !== undefined ? -Math.abs(s.x - focusX) : widthOf(l, aspect) - .5 * Math.abs(s.x - .5)
    if (score > bestScore) { best = l; bestScore = score }
  }
  return best
}

type Sample = { x: number; y: number; nose: number; noseDx: number; unit: number }
type Baseline = Sample
export class GestureTracker {
  private samples: Sample[] = []
  private calibrationStartedAt?: number
  private lastCalibrationAt?: number
  private baseline?: Baseline
  private lastSeenAt?: number
  private lastFrameAt?: number
  private lastJump = -10000
  private lastThrow = -10000
  private wristLowAt: Partial<Record<15 | 16, number>> = {}
  private history: { t: number; rise: number }[] = []
  private lane = 0
  private ducking = false
  private jumpArmed = true
  private risingSince?: number
  private duckSince?: number
  private suppressNextAction = false
  private lastX?: number
  /** Horizontal position of the tracked person, used to ignore other people in the frame. */
  get focusX() { return this.lastX ?? this.baseline?.x }
  private clearCalibration() {
    this.samples = []; this.calibrationStartedAt = undefined; this.lastCalibrationAt = undefined
  }
  reset() {
    this.clearCalibration(); this.baseline = undefined; this.wristLowAt = {}; this.history = []
    this.ducking = false; this.jumpArmed = true; this.risingSince = undefined; this.duckSince = undefined; this.suppressNextAction = false
    this.lastJump = -10000; this.lastThrow = -10000; this.lane = 0; this.lastSeenAt = undefined; this.lastFrameAt = undefined; this.lastX = undefined
  }
  private idle(message: string, tracked = false, progress = 0): PoseOutput {
    return { ready: false, tracked, progress, lane: this.lane, ducking: false, message }
  }
  update(l: Landmark[], now: number, aspect = 1): PoseOutput {
    if (!Number.isFinite(aspect) || aspect <= 0) aspect = 1
    const shoulders = l.length >= 33 ? shouldersOf(l) : undefined
    const nose = l.length >= 33 && visible(l[0]) ? l[0] : undefined
    if (!this.baseline) {
      if (!shoulders || !nose) { this.clearCalibration(); return this.idle('Get your face and both shoulders in frame (feet not needed)') }
      const unit = widthOf(l, aspect)
      const pose: Sample = { x: shoulders.x, y: shoulders.y, nose: nose.y, noseDx: nose.x - shoulders.x, unit }
      const first = this.samples[0], tol = BODY.calibrationTolerance * (first?.unit ?? unit)
      const stale = this.lastCalibrationAt !== undefined && (now < this.lastCalibrationAt || now - this.lastCalibrationAt > BODY.calibrationGapMs)
      if (stale || first && (Math.abs(pose.x - first.x) > tol || Math.abs(pose.y - first.y) > tol || Math.abs(pose.nose - first.nose) > tol)) this.clearCalibration()
      if (this.calibrationStartedAt === undefined) this.calibrationStartedAt = now
      this.lastCalibrationAt = now
      this.samples.push(pose)
      const progress = Math.min(1, this.samples.length / BODY.calibrationFrames, Math.max(0, now - this.calibrationStartedAt) / BODY.calibrationMs)
      if (progress < 1) return this.idle('Hold still for ~1 s, calibrating…', true, progress)
      const b = { ...pose }
      for (const key of Object.keys(pose) as (keyof Sample)[]) b[key] = this.samples.reduce((n, s) => n + s[key], 0) / this.samples.length
      this.baseline = b; this.lastSeenAt = now; this.lastFrameAt = now; this.lastX = b.x; this.history = []
    }
    const b = this.baseline
    // Reference point = shoulder midpoint; when the shoulders leave the frame
    // (deep duck at close range) estimate it from the nose.
    const ref = shoulders ?? (nose ? { x: nose.x - b.noseDx, y: nose.y + (b.y - b.nose) } : undefined)
    if (!ref) {
      if (this.lastSeenAt !== undefined && now >= this.lastSeenAt && now - this.lastSeenAt <= BODY.lostGraceMs) {
        return { ready: true, tracked: true, progress: 1, lane: this.lane, ducking: this.ducking, message: 'Tracking…' }
      }
      this.ducking = false; this.history = []; this.suppressNextAction = true; this.risingSince = undefined; this.duckSince = undefined
      return this.idle('Can’t see your upper body. Step back to the center')
    }
    const dt = this.lastFrameAt !== undefined && now > this.lastFrameAt ? Math.min(250, now - this.lastFrameAt) : 0
    this.lastSeenAt = now; this.lastFrameAt = now; this.lastX = ref.x
    const unit = b.unit
    const rise = (b.y - ref.y) / unit
    const noseDrop = nose ? (nose.y - b.nose) / unit : 0
    const drop = Math.max(-rise, noseDrop)
    const shift = ref.x - b.x
    const enter = Math.min(BODY.laneMax, Math.max(BODY.laneMin, b.unit * BODY.laneFactor)), exit = enter * BODY.laneExit
    // Input landmarks are unmirrored; the preview is mirrored. A player stepping
    // to their own left appears at larger x, which selects the left lane (-1).
    if (shift > enter) this.lane = -1
    else if (shift < -enter) this.lane = 1
    else if (Math.abs(shift) < exit) this.lane = 0

    // Duck: shoulders or nose drop clearly; ignore the landing dip after a jump.
    if (!this.ducking && drop > BODY.duckDrop && now - this.lastJump > BODY.duckAfterJumpMs) this.ducking = true
    else if (this.ducking && drop < BODY.duckRelease) this.ducking = false
    const duckStarted = this.ducking && this.duckSince === undefined
    this.duckSince = this.ducking ? this.duckSince ?? now : undefined

    // Jump: a quick rise above the standing line (slow drift is not a jump).
    this.history = this.history.filter(h => now - h.t <= BODY.jumpWindowMs && h.t <= now)
    const recentMin = this.history.length ? this.history.reduce((m, h) => Math.min(m, h.rise), Infinity) : 0
    let jumpFired = false
    if (rise < BODY.jumpRelease) this.jumpArmed = true
    if (this.jumpArmed && !this.ducking && rise > BODY.jumpRise && rise - recentMin > BODY.jumpQuickRise) {
      this.jumpArmed = false
      if (now - this.lastJump > BODY.jumpCooldownMs) jumpFired = true
    }
    this.history.push({ t: now, rise })

    // Throw: a hand goes from below the shoulders to above the nose quickly.
    let throwGesture = false
    const headY = nose ? nose.y : ref.y - .8 * unit
    for (const index of [15, 16] as const) {
      const wrist = l[index]
      if (!finite(wrist)) continue
      if (wrist.y > ref.y) this.wristLowAt[index] = now
      else if (visible(wrist) && wrist.y < headY) {
        const lowAt = this.wristLowAt[index]
        if (lowAt !== undefined && now - lowAt <= BODY.throwWindowMs) throwGesture = true
      }
    }

    // Re-adapt slowly while standing still in the neutral zone; re-base when a
    // new posture is held (stood up after calibrating low, sat down, moved).
    const neutral = !this.ducking && Math.abs(rise) < BODY.jumpRelease && drop < BODY.duckRelease
    if (dt && neutral) {
      const a = dt / BODY.adaptMs
      b.y += (ref.y - b.y) * a
      if (nose) b.nose += (nose.y - b.nose) * a
      if (shoulders) b.unit += (widthOf(l, aspect) - b.unit) * a
      if (this.lane === 0 && Math.abs(shift) < exit) b.x += (ref.x - b.x) * a
    }
    this.risingSince = rise > BODY.jumpRelease ? this.risingSince ?? now : undefined
    const stuck = (this.risingSince !== undefined && now - this.risingSince > BODY.stuckJumpMs) || (this.duckSince !== undefined && now - this.duckSince > BODY.stuckDuckMs)
    if (stuck) {
      b.y = ref.y; if (nose) b.nose = nose.y
      this.ducking = false; this.jumpArmed = true; this.risingSince = undefined; this.duckSince = undefined; this.history = []
    }

    let action: Action | undefined
    if (!this.suppressNextAction) {
      if (jumpFired) { action = 'jump'; this.lastJump = now }
      else if (duckStarted) action = 'duck'
      else if (throwGesture && !this.ducking && now - this.lastThrow > BODY.throwCooldownMs) { action = 'throw'; this.lastThrow = now; this.wristLowAt = {} }
    }
    this.suppressNextAction = false
    const ducking = this.ducking
    return {
      ready: true, tracked: true, progress: 1, lane: this.lane, ducking, action,
      message: action === 'jump' ? 'Jump ↑' : action === 'throw' ? 'Throw!' : ducking ? 'Ducking ↓' : this.lane < 0 ? 'Left ←' : this.lane > 0 ? 'Right →' : 'Ready',
      debug: { baseY: b.y, baseX: b.x, unit, rise, shift, laneEnter: enter },
    }
  }
}
