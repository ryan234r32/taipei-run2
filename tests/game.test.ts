import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avoids, canThrow, isBoost, scoreAt } from '../src/game/rules.ts'
import { GestureTracker } from '../src/game/gestures.ts'
import type { Landmark } from '../src/game/gestures.ts'
function pose() {
  const l: Landmark[] = Array.from({ length: 33 }, () => ({ x: .5, y: .2, z: 0, visibility: 1 }))
  for (const [left, right, y] of [[11, 12, .33], [23, 24, .57], [25, 26, .76], [27, 28, .95]]) {
    l[left] = { x: .42, y, z: 0, visibility: 1 }; l[right] = { x: .58, y, z: 0, visibility: 1 }
  }
  l[15].y = .65; l[16].y = .65; return l
}
function calibrated() { const g = new GestureTracker(); for (let i = 0; i < 30; i++) g.update(pose(), i * 50); return g }
test('score only accumulates time, food and one successful throw', () => {
  assert.equal(scoreAt(10, 3, false), 420); assert.equal(scoreAt(10, 3, true), 920)
  assert.equal(scoreAt(100, 0, false), 576); assert.equal(scoreAt(-1, 0, false), 0)
})
test('jump, duck and a different lane actually avoid their corresponding obstacles', () => {
  assert.equal(avoids({ time: 20, lane: 0, type: 'jump' }, 0, false, true), false)
  assert.equal(avoids({ time: 20, lane: 0, type: 'jump' }, 0, true, false), true)
  assert.equal(avoids({ time: 31, lane: 0, type: 'duck' }, 0, false, true), true)
  assert.equal(avoids({ time: 13, lane: 0, type: 'dodge' }, -1, false, false), true)
})
test('throw has a real timing window and cannot score twice', () => {
  assert.equal(canThrow(30.5, true, false), false); assert.equal(canThrow(33, true, false), true)
  assert.equal(canThrow(33, false, false), false); assert.equal(canThrow(33, true, true), false)
  assert.equal(canThrow(35.5, true, false), false)
})
test('YouBike only boosts in its scripted section', () => { assert.equal(isBoost(34.9), false); assert.equal(isBoost(35), true); assert.equal(isBoost(42.9), true); assert.equal(isBoost(43), false) })
test('calibration works with only face and shoulders visible', () => {
  const g = new GestureTracker(), l = pose(); for (const i of [23, 24, 25, 26, 27, 28]) l[i].visibility = .05
  let ready = false; for (let i = 0; i < 25; i++) ready = g.update(l, i * 50).ready
  assert.equal(ready, true)
  const noFace = new GestureTracker(), m = pose(); m[0].visibility = .1
  for (let i = 0; i < 35; i++) assert.equal(noFace.update(m, i * 50).ready, false)
})
test('mirrored body movement maps to the player own left and right', () => {
  const g = calibrated(), l = pose(); for (const p of l) p.x += .15; assert.equal(g.update(l, 2000).lane, -1)
  for (const p of l) p.x -= .3; assert.equal(g.update(l, 2100).lane, 1)
})
test('raising arms is not a jump; a quick whole-body rise is', () => {
  const g = calibrated(), l = pose(); l[15].y = .1; assert.notEqual(g.update(l, 2000).action, 'jump')
  for (const p of l) p.y -= .08
  assert.equal(g.update(l, 3000).action, 'jump'); assert.notEqual(g.update(l, 3050).action, 'jump')
})
test('duck fires when the upper body drops', () => {
  const g = calibrated(), l = pose(); for (const p of l) p.y += .1
  assert.equal(g.update(l, 3000).action, 'duck')
})
