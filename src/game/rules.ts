export type ArtStyle = 'cinema' | 'toon' | 'arcade'
export type Action = 'left' | 'right' | 'jump' | 'duck' | 'throw'
export type Phase = 'preview' | 'countdown' | 'running' | 'finished' | 'paused'
// 60-second pitch cut: 3 s arrival + 48 s run (play ends at ~51 s) + 9 s ending / food bag (see docs/demo-timeline.md).
export const DURATION = 48
export const ENDING = 60 - 3 - DURATION
export const FINAL_FOOD = 46.3
export const TRUCK = { appear: 25, throwFrom: 31, throwTo: 35 }
export const BOOST = { from: 35, to: 43 }
export const FAMILY_MART = 44.5
export const LANE_WIDTH = 2.2
export const STYLES = {
  cinema: { name: 'Cinematic', en: 'CINEMATIC', caption: 'Wet reflections · warm lanterns · close camera', description: 'Semi-realistic Taipei night with muted buildings, wet asphalt and warm signs; the camera sits closer to the runner.', color: '#ecb87b', fov: 58, fog: 0x151d25, light: 2.0 },
  toon: { name: 'Stylized', en: 'STYLIZED', caption: 'Soft materials · bold proportions · big feedback', description: 'Like stepping into a Taiwanese cartoon: chunky food, bright stalls and a big-headed coach. Our chosen art direction.', color: '#e8fc86', fov: 64, fog: 0x22353c, light: 3.2 },
  arcade: { name: 'Arcade', en: 'ARCADE', caption: 'Clean low-poly · clear three lanes · strong speed', description: 'Classic endless-runner readability: higher camera, bold lanes and floating collectibles.', color: '#74e6d8', fov: 72, fog: 0x152b32, light: 2.8 },
} as const
export type Obstacle = { time: number; lane: number; type: 'jump' | 'duck' | 'dodge' }
// Game time (= recording − 3 s): 5 dodge left, 8 dodge right, 11 jump, 14 duck.
export const OBSTACLES: Obstacle[] = [
  { time: 5, lane: 0, type: 'dodge' }, { time: 8, lane: -1, type: 'dodge' },
  { time: 11, lane: -1, type: 'jump' }, { time: 11, lane: 0, type: 'jump' }, { time: 11, lane: 1, type: 'jump' },
  { time: 14, lane: -1, type: 'duck' }, { time: 14, lane: 0, type: 'duck' }, { time: 14, lane: 1, type: 'duck' },
]
type Food = { time: number; lane: number; kind: number }
const row = (from: number, count: number, gap: number, lane: number, kind: number): Food[] =>
  Array.from({ length: count }, (_, i) => ({ time: from + i * gap, lane, kind }))
// kind 0 Bubble Tea · 1 Popcorn Chicken · 2 Taiwan Beer — the 15–25 s showcase follows the pitch order.
export const FOODS: Food[] = [
  ...row(1.5, 4, .8, 0, 0), ...row(6, 2, .8, -1, 0), ...row(12.3, 1, 1, 0, 0),
  ...row(15.5, 5, .6, 0, 0), ...row(18.8, 5, .6, -1, 1), ...row(22, 5, .6, 1, 2),
  ...row(26.5, 2, 1, 0, 0),
  ...Array.from({ length: 12 }, (_, i) => ({ time: 35.6 + i * .6, lane: 0, kind: i % 3 })),
  ...row(43.6, 3, .6, 0, 1),
  { time: FINAL_FOOD, lane: 0, kind: 0 },
]
export function scoreAt(time: number, food: number, thrown: boolean) {
  return Math.floor(Math.min(DURATION, Math.max(0, time)) * 12) + food * 100 + (thrown ? 500 : 0)
}
export function avoids(obstacle: Obstacle, lane: number, jumping: boolean, ducking: boolean) {
  return lane !== obstacle.lane || (obstacle.type === 'jump' && jumping) || (obstacle.type === 'duck' && ducking)
}
export function canThrow(time: number, hasBag: boolean, thrown: boolean) {
  return time >= TRUCK.throwFrom && time <= TRUCK.throwTo && hasBag && !thrown
}
export function isBoost(time: number) { return time >= BOOST.from && time < BOOST.to }
export function chapter(time: number) {
  if (time < 4) return { title: 'Welcome to Raohe Night Market', sub: '饒河夜市 · Taipei' }
  if (time < 10) return { title: '← DODGE! →', sub: 'Lean left or right' }
  if (time < 13) return { title: 'JUMP!', sub: 'Jump for real over the crates' }
  if (time < 15.2) return { title: 'DUCK!', sub: 'Squat under the stall awning' }
  if (time < 18.6) return { title: '🧋 Bubble Tea', sub: '珍珠奶茶 · Taiwan’s iconic drink' }
  if (time < 21.8) return { title: '🍗 Popcorn Chicken', sub: '鹽酥雞 · the night-market classic' }
  if (time < TRUCK.appear) return { title: '🍺 Taiwan Beer', sub: '台灣啤酒 · cheers!' }
  if (time < TRUCK.throwFrom) return { title: 'CATCH THE GARBAGE TRUCK!', sub: 'In Taiwan, trucks play music and you run out with your trash' }
  if (time <= TRUCK.throwTo) return { title: 'THROW!', sub: 'Swing your arm to toss the bag in' }
  if (time < BOOST.to) return { title: 'YOUBIKE BOOST!', sub: 'Taipei’s public bikes · Coach? Long gone.' }
  if (time < FINAL_FOOD - .5) return { title: 'FamilyMart', sub: 'Every Taiwan convenience store greets you: “Huān yíng guāng lín!”' }
  return { title: 'PUT THE BUBBLE TEA DOWN!!!', sub: 'That whistle sounds familiar…' }
}
