import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GestureTracker, pickPose } from '../src/game/gestures.ts'
import type { Landmark } from '../src/game/gestures.ts'
// Shoulder width = .16, so 1 "unit" below = .16 of frame height.
const standing = (): Landmark[] => {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: .5, y: .2, z: 0, visibility: 1 }))
  for (const [left, right, y] of [[11, 12, .33], [23, 24, .57], [25, 26, .76], [27, 28, .95]]) {
    landmarks[left] = { x: .42, y, z: 0, visibility: 1 }; landmarks[right] = { x: .58, y, z: 0, visibility: 1 }
  }
  landmarks[15].y = .65; landmarks[16].y = .65
  return landmarks
}
// Laptop webcam at ~1 m: only face and shoulders are in frame.
const upperBodyOnly = () => { const l = standing(); for (const i of [15, 16, 23, 24, 25, 26, 27, 28]) l[i].visibility = .05; return l }
const calibrated = (make = standing) => {
  const tracker = new GestureTracker()
  for (let i = 0; i < 30; i++) tracker.update(make(), i * 50)
  return tracker
}
const moved = (delta: number, make = standing) => { const l = make(); for (const point of l) point.x += delta; return l }
const lifted = (dy: number, make = standing) => { const l = make(); for (const point of l) point.y -= dy; return l }
const jumped = (make = standing) => lifted(.08, make) // .5 shoulder widths
const crouched = (make = standing) => lifted(-.1, make) // .625 shoulder widths down

test('body calibration completes after ~1 s of stable upper body', () => {
  const tracker = new GestureTracker()
  for (let i = 0; i < 10; i++) assert.equal(tracker.update(standing(), i * 100).ready, false)
  const p = tracker.update(standing(), 1000)
  assert.equal(p.ready, true); assert.equal(p.tracked, true); assert.equal(p.progress, 1)
})
test('body calibration also needs six samples even when 1000 ms has elapsed', () => {
  const tracker = new GestureTracker()
  for (let i = 0; i < 5; i++) assert.equal(tracker.update(standing(), i * 200).ready, false)
  assert.equal(tracker.update(standing(), 1000).ready, true)
})
test('body a stalled calibration cannot count unobserved time as stable', () => {
  const tracker = new GestureTracker()
  for (let i = 0; i < 7; i++) tracker.update(standing(), i * 100)
  assert.equal(tracker.update(standing(), 2000).progress, 0)
  for (let i = 1; i < 7; i++) assert.equal(tracker.update(standing(), 2000 + i * 150).ready, false)
  assert.equal(tracker.update(standing(), 3000).ready, true)
})
test('body calibrates with only face and shoulders visible (no hips, knees, ankles, hands)', () => {
  const tracker = new GestureTracker()
  let p = tracker.update(upperBodyOnly(), 0)
  assert.equal(p.tracked, true)
  for (let i = 1; i <= 20; i++) p = tracker.update(upperBodyOnly(), i * 50)
  assert.equal(p.ready, true)
})
test('body missing face or a shoulder cannot pass calibration', () => {
  for (const index of [0, 11]) {
    const tracker = new GestureTracker(), l = standing(); l[index].visibility = .2
    for (let i = 0; i < 35; i++) { const p = tracker.update(l, i * 50); assert.equal(p.ready, false); assert.equal(p.tracked, false) }
  }
})
test('body calibration restarts after a large movement', () => {
  const tracker = new GestureTracker()
  for (let i = 0; i < 15; i++) tracker.update(standing(), i * 50)
  assert.equal(tracker.update(moved(.15), 750).progress, 0)
})
test('body slow drift during calibration also restarts stable-frame counting', () => {
  const tracker = new GestureTracker()
  for (let i = 0; i < 35; i++) assert.equal(tracker.update(moved(i * .004), i * 50).ready, false)
})
test('body mirrored preview left maps to lane -1, right to +1, centre to zero', () => {
  for (const make of [standing, upperBodyOnly]) {
    const tracker = calibrated(make)
    assert.equal(tracker.update(moved(.15, make), 2000).lane, -1)
    assert.equal(tracker.update(moved(-.15, make), 2050).lane, 1)
    assert.equal(tracker.update(make(), 2100).lane, 0)
  }
})
test('body lane hysteresis prevents jitter near the switching boundary', () => {
  const tracker = calibrated()
  assert.equal(tracker.update(moved(.12), 2000).lane, -1)
  assert.equal(tracker.update(moved(.07), 2050).lane, -1)
  assert.equal(tracker.update(moved(.03), 2100).lane, 0)
  assert.equal(tracker.update(moved(.08), 2150).lane, 0) // .6 x .16 = .096 to enter
})
test('body jump fires on a quick shoulder rise in upper-body-only framing', () => {
  const tracker = calibrated(upperBodyOnly)
  assert.notEqual(tracker.update(lifted(.048, upperBodyOnly), 2000).action, 'jump') // .30 widths
  assert.equal(tracker.update(lifted(.064, upperBodyOnly), 2050).action, 'jump') // .40 widths
})
test('body slow upward drift is not a jump', () => {
  const tracker = calibrated()
  let fired = false
  for (let i = 0; i <= 40; i++) if (tracker.update(lifted(i * .0025), 2000 + i * 50).action === 'jump') fired = true
  assert.equal(fired, false)
})
test('body jump only fires once per airborne period and respects cooldown', () => {
  const tracker = calibrated()
  assert.equal(tracker.update(jumped(), 2000).action, 'jump')
  assert.notEqual(tracker.update(jumped(), 2100).action, 'jump')
  tracker.update(standing(), 2150)
  assert.equal(tracker.update(jumped(), 2600).action, 'jump')
  tracker.update(standing(), 2650)
  assert.notEqual(tracker.update(jumped(), 2700).action, 'jump')
})
test('body sustained duck remains active without repeated duck actions', () => {
  const tracker = calibrated()
  assert.equal(tracker.update(crouched(), 2000).action, 'duck')
  for (let t = 2050; t < 4500; t += 50) {
    const p = tracker.update(crouched(), t); assert.equal(p.ducking, true); assert.equal(p.action, undefined)
  }
  assert.equal(tracker.update(standing(), 4500).ducking, false)
})
test('body duck threshold is half a shoulder width', () => {
  const small = calibrated(); assert.equal(small.update(lifted(-.072), 2000).ducking, false) // .45
  const big = calibrated(); assert.equal(big.update(lifted(-.088), 2000).action, 'duck') // .55
})
test('body duck still works when the shoulders leave the bottom of the frame (nose only)', () => {
  const tracker = calibrated(upperBodyOnly), l = crouched(upperBodyOnly); l[11].visibility = .1; l[12].visibility = .1
  const p = tracker.update(l, 2000)
  assert.equal(p.tracked, true); assert.equal(p.action, 'duck')
})
test('body landing dip right after a jump is not a duck, a later duck is', () => {
  const tracker = calibrated()
  assert.equal(tracker.update(jumped(), 2000).action, 'jump')
  assert.equal(tracker.update(crouched(), 2300).ducking, false)
  tracker.update(standing(), 2400)
  assert.equal(tracker.update(crouched(), 2800).action, 'duck')
})
test('body a short tracking dropout keeps the player tracked', () => {
  const tracker = calibrated()
  const p = tracker.update([], 1500)
  assert.equal(p.tracked, true); assert.equal(p.ready, true)
  assert.equal(tracker.update(jumped(), 1600).action, 'jump')
})
test('body long tracking loss clears held duck and suppresses phantom reacquisition actions', () => {
  const tracker = calibrated(); tracker.update(crouched(), 2000)
  tracker.update([], 2050)
  const missing = tracker.update([], 2600)
  assert.equal(missing.ready, false); assert.equal(missing.ducking, false); assert.equal(missing.tracked, false)
  const back = tracker.update(jumped(), 2650)
  assert.equal(back.ready, true); assert.equal(back.action, undefined)
  tracker.update(standing(), 2700)
  assert.equal(tracker.update(jumped(), 3400).action, 'jump')
})
test('body held raised posture re-bases instead of staying stuck', () => {
  const tracker = calibrated()
  for (let t = 2000; t <= 3700; t += 50) tracker.update(lifted(.1), t)
  assert.equal(tracker.update(lifted(.1), 3750).debug?.rise.toFixed(2), '0.00')
})
test('body reset requires a fresh calibration and clears earlier action cooldowns', () => {
  const tracker = calibrated(); tracker.update(jumped(), 2000); tracker.reset()
  assert.equal(tracker.update(standing(), 2050).ready, false)
  for (let i = 1; i <= 7; i++) tracker.update(standing(), 2050 + i * 150)
  assert.equal(tracker.update(jumped(), 3300).action, 'jump')
})
test('body throw: a visible hand moving quickly from below the shoulders to above the nose', () => {
  const tracker = calibrated(), low = standing(), high = standing()
  tracker.update(low, 2000); high[15].y = .1
  assert.equal(tracker.update(high, 2300).action, 'throw')
  assert.equal(tracker.update(high, 2350).action, undefined)
  const invisible = calibrated(); high[15].visibility = .1
  invisible.update(low, 2000)
  assert.notEqual(invisible.update(high, 2100).action, 'throw')
})
test('body throw works when the resting hand is below the frame (upper-body framing)', () => {
  const tracker = calibrated(upperBodyOnly), l = upperBodyOnly(); l[16].y = 1.2
  tracker.update(l, 2000)
  l[16] = { x: .6, y: .1, z: 0, visibility: .9 }
  assert.equal(tracker.update(l, 2200).action, 'throw')
})
test('body a hand already held up, or raised slowly, does not throw', () => {
  const up = () => { const l = standing(); l[15].y = .1; return l }
  const tracker = calibrated(up)
  assert.notEqual(tracker.update(up(), 2000).action, 'throw')
  const slow = calibrated()
  assert.notEqual(slow.update(up(), 2600).action, 'throw')
})
test('body malformed coordinates are rejected without crashing', () => {
  const tracker = calibrated(), l = standing(); l[11].x = NaN; l[0].x = NaN
  assert.equal(tracker.update(l, 2000).ready, false)
})
test('body pickPose prefers the largest central person, then sticks to the tracked one', () => {
  const player = standing(), bystander = moved(.4); for (const i of [11, 12]) bystander[i].x = .9 + (i - 11) * .06
  assert.equal(pickPose([bystander, player]), player)
  assert.equal(pickPose([player, bystander], .93), bystander)
  assert.deepEqual(pickPose([]), [])
})
