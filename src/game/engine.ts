import * as T from 'three'
import { Models } from './models'
import { RunAudio } from './audio'
import { DemoRecorder } from './recorder'
import { ArrivalScene } from './arrival'
import { BOOST, DURATION, FAMILY_MART, FINAL_FOOD, FOODS, LANE_WIDTH, OBSTACLES, STYLES, TRUCK, avoids, canThrow, chapter, isBoost, scoreAt } from './rules'
import type { Action, ArtStyle, Phase } from './rules'

export type RunState = { phase: Phase; time: number; score: number; countdown: number; title: string; subtitle: string; toast: string; boost: boolean; food: number; collected: number[]; fps: number; thrown: boolean }
type Item = { group: T.Group; time: number; lane: number; type: string; passed: boolean; kind?: number; collected?: number }
const travel = (t: number) => t * 16 + Math.max(0, Math.min(BOOST.to - BOOST.from, t - BOOST.from)) * 24
const FOOD_NAMES = ['Bubble Tea', 'Popcorn Chicken', 'Taiwan Beer']

export class RunEngine {
  readonly audio = new RunAudio()
  private renderer: T.WebGLRenderer
  private scene = new T.Scene()
  private camera: T.PerspectiveCamera
  private models: Models
  private clock = new T.Clock()
  private frame = 0
  private observer: ResizeObserver
  private blocks: T.Group[] = []
  private strings: T.Group[] = []
  private items: Item[] = []
  private runner: T.Group
  private coach: T.Group
  private bicycle: T.Group
  private truck: T.Group
  private bag: T.Group
  private sparks: T.Group
  private familyMart: T.Group
  private martArch: T.Group
  private phase: Phase = 'preview'
  private previousPhase: Phase = 'running'
  private time = 0
  private previewTime = 0
  private animationTime = 0
  private countdownTime = 0
  private lane = 0
  private jumpAt = -10
  private duckAt = -10
  private food = 0
  private collected = [0, 0, 0]
  private bodyDuck = false
  private arrival = new ArrivalScene()
  private thrown = false
  private throwAt = -10
  private distance = 4
  private toast = ''
  private toastUntil = 0
  private lastUi = 0
  private frames = 0
  private fps = 60
  private auto = false
  private events = new Set<string>()
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private previewPaused = false
  private recorder?: DemoRecorder
  private playbackRate = 1
  private mount: HTMLElement
  private style: ArtStyle
  private onState: (s: RunState) => void
  constructor(mount: HTMLElement, style: ArtStyle, onState: (s: RunState) => void) {
    this.mount = mount; this.style = style; this.onState = onState
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6)); this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = T.PCFSoftShadowMap; this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = style === 'toon' ? 1.08 : style === 'cinema' ? 1.35 : 1.4
    this.renderer.domElement.setAttribute('aria-label', 'Taipei night market 3D runner scene')
    mount.appendChild(this.renderer.domElement)
    const art = STYLES[style]; this.scene.background = new T.Color(art.fog); this.scene.fog = new T.Fog(art.fog, 38, style === 'cinema' ? 140 : 170)
    this.camera = new T.PerspectiveCamera(art.fov, 1, .1, 240)
    this.models = new Models(style)
    const ambient = new T.HemisphereLight('#9bb7c5', '#735439', style === 'toon' ? 1.15 : art.light); this.scene.add(ambient)
    const moon = new T.DirectionalLight('#fce8ca', style === 'toon' ? 1.75 : art.light * 1.1); moon.position.set(-15, 25, 15); moon.castShadow = true
    moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -20; moon.shadow.camera.right = 20
    moon.shadow.camera.top = 25; moon.shadow.camera.bottom = -25; moon.shadow.bias = -.001; this.scene.add(moon)
    const road = this.models.box(this.scene, 8.8, .16, 280, style === 'cinema' ? '#71736c' : '#637a76', 0, -.12, -110)
    if (road.material instanceof T.MeshStandardMaterial && style === 'cinema') road.material.roughness = .22
    road.receiveShadow = true
    for (let side = -1; side <= 1; side += 2) {
      this.models.box(this.scene, .10, .025, 250, '#d4c7a4', side * 3.15, .005, -100)
      for (let i = 0; i < 18; i++) {
        const block = this.models.streetBlock(i + (side === 1 ? 3 : 0), side); block.userData.baseZ = -i * 12 - 6
        this.blocks.push(block); this.scene.add(block)
      }
    }
    for (let i = 0; i < 9; i++) {
      const string = new T.Group(); string.userData.baseZ = -i * 24 - 12; this.scene.add(string); this.strings.push(string)
      for (let k = -3; k <= 3; k++) this.models.lantern(string, k * .85, 5.5 + Math.abs(k) * .15, 0)
      this.models.bar(string, new T.Vector3(-4.7, 6.3, 0), new T.Vector3(4.7, 6.3, 0), .014, '#455452')
      this.models.bar(string, new T.Vector3(-4.7, 9, -3), new T.Vector3(4.7, 8.5, 3), .018, '#334348')
      if (i % 2 === 0) {
        const light = new T.PointLight('#ffb25c', 13, 15, 2); light.position.set(0, 5, 0); string.add(light)
      }
    }
    // The gateway is an original simplified night-market landmark, not a measured reconstruction.
    const gateway = new T.Group(); this.scene.add(gateway)
    for (const x of [-4.1, 4.1]) { this.models.cylinder(gateway, .28, .35, 7.2, '#934e38', x, 3.6, -96); this.models.box(gateway, .9, .4, .9, '#c29b57', x, .2, -96) }
    this.models.box(gateway, 8.7, 1.1, .65, '#9a452f', 0, 6.1, -96)
    this.models.text(gateway, '饒 河 夜 市', 5.2, .9, '#ffe1a0', '#94472b', 0, 6.1, -95.65)
    for (let i = 0; i < 3; i++) { const roof = this.models.box(gateway, 10 - i * 1.2, .27, 2.8 - i * .4, '#be7c3e', 0, 6.9 + i * .5, -96); roof.rotation.z = .025 }
    this.models.cylinder(gateway, .03, .03, 1.5, '#d4a65e', 0, 8.9, -96)
    this.runner = this.models.person(); this.runner.position.z = 2; this.scene.add(this.runner)
    this.coach = this.models.person(true); this.coach.position.set(1.4, 0, 6); this.scene.add(this.coach)
    this.bicycle = this.models.bike(); this.bicycle.visible = false; this.scene.add(this.bicycle)
    this.truck = this.models.truck(); this.truck.visible = false; this.scene.add(this.truck)
    this.bag = this.models.bag(); this.bag.visible = false; this.scene.add(this.bag)
    this.sparks = new T.Group(); this.scene.add(this.sparks)
    for (let i = 0; i < 12; i++) this.models.sphere(this.sparks, .055, '#eff88d', 0, 0, 0, 1, true)
    this.sparks.visible = false
    this.familyMart = this.models.familyMart(); this.familyMart.visible = false; this.scene.add(this.familyMart)
    // Street-spanning FamilyMart gantry that faces the chase camera, so the store reads from far away.
    this.martArch = new T.Group(); this.martArch.visible = false; this.scene.add(this.martArch)
    for (const x of [-4.25, 4.25]) this.models.box(this.martArch, .32, 5.6, .32, '#e9eef0', x, 2.8, 0)
    this.models.box(this.martArch, 9.1, .34, .5, '#0a66b2', 0, 4.55, 0, true)
    this.models.box(this.martArch, 9.1, 1.25, .5, '#ffffff', 0, 5.33, 0, true)
    this.models.box(this.martArch, 9.1, .34, .5, '#16a05a', 0, 6.12, 0, true)
    this.models.text(this.martArch, 'FamilyMart 全家', 6.2, 1.05, '#0a66b2', '#ffffff', 0, 5.33, .27)
    this.models.text(this.martArch, '歡迎光臨  WELCOME', 3.4, .5, '#ffffff', '#16a05a', 0, 3.9, .27)
    const archLight = new T.PointLight('#e9fbff', 22, 16, 2); archLight.position.set(0, 4.6, 2.5); this.martArch.add(archLight)
    for (const f of FOODS) { const group = this.models.food(f.kind, f.time === FINAL_FOOD); this.scene.add(group); this.items.push({ group, ...f, type: 'food', passed: false }) }
    for (const o of OBSTACLES) {
      const group = new T.Group(); this.scene.add(group)
      if (o.type === 'jump') {
        this.models.box(group, 1.65, .68, 1.1, '#b98e59', 0, .34, 0)
        for (const x of [-.65, .65]) this.models.box(group, .07, .7, 1.13, '#e2c287', x, .35, 0)
        this.models.text(group, 'JUMP', .9, .25, '#59402e', '#d9b27a', 0, .35, .57)
      } else if (o.type === 'duck') {
        for (const x of [-1, 1]) this.models.cylinder(group, .055, .055, 3.2, '#879c92', x, 1.6, 0)
        this.models.box(group, 2.1, .75, .23, '#b35b3a', 0, 2.01, 0)
        this.models.text(group, 'LOW! DUCK!', 1.8, .4, '#fff1bd', '#b85e3c', 0, 2.06, .13)
      } else { group.add(this.models.scooter('#427b78')) }
      this.items.push({ group, ...o, passed: false })
    }
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(mount); this.resize()
    document.addEventListener('visibilitychange', this.onVisibility)
    this.tick()
  }
  private resize() { const w = this.mount.clientWidth, h = this.mount.clientHeight; this.renderer.setSize(w, h); this.camera.aspect = w / Math.max(1, h); this.arrival.resize(this.camera.aspect); this.camera.updateProjectionMatrix() }
  private onVisibility = () => { if (document.hidden && (this.phase === 'running' || this.phase === 'countdown')) this.pause() }
  start(auto = false) {
    this.playbackRate = 1
    this.audio.init(); this.audio.stop(); this.audio.startMusic(); this.auto = auto; this.phase = 'countdown'; this.time = 0; this.countdownTime = 0
    this.food = 0; this.collected = [0, 0, 0]; this.bodyDuck = false; this.thrown = false; this.lane = 0; this.jumpAt = -10; this.duckAt = -10; this.throwAt = -10
    this.distance = 4; this.toast = ''; this.events.clear(); this.runner.position.set(0, 0, 2)
    this.items.forEach(i => { i.passed = false; i.collected = undefined; i.group.visible = true; i.group.scale.setScalar(i.time === FINAL_FOOD ? 3 : 1) })
    this.emit()
  }
  record(onComplete: (blob: Blob) => void) {
    this.start(true); this.playbackRate = 1.42
    this.recorder = new DemoRecorder(this.audio.stream, blob => { this.recorder = undefined; this.playbackRate = 1; onComplete(blob) })
  }
  home() { this.phase = 'preview'; this.bodyDuck = false; this.audio.stopMusic(); this.audio.stop(); this.toast = ''; this.emit() }
  pause() { if (this.phase !== 'running' && this.phase !== 'countdown') return; this.previousPhase = this.phase; this.phase = 'paused'; this.audio.pauseMusic(); this.audio.stop(); this.emit() }
  resume() { if (this.phase !== 'paused') return; this.phase = this.previousPhase; this.audio.init(); this.audio.resumeMusic(); this.emit() }
  setPreviewPaused(paused: boolean) { this.previewPaused = paused }
  setMuted(muted: boolean) { this.audio.muted = muted; if (muted) this.audio.stop() }
  action(action: Action) {
    if (this.phase !== 'running') return
    if (action === 'left') this.setLane(this.lane - 1)
    if (action === 'right') this.setLane(this.lane + 1)
    if (action === 'jump' && this.time - this.jumpAt > .86) { this.jumpAt = this.time; this.audio.jump(); this.feedback('HOO! ↑', .75) }
    if (action === 'duck' && this.time - this.duckAt > .95) { this.duckAt = this.time; this.audio.duck(); this.feedback('DUCK! Don’t spill the tea ↓', .7) }
    if (action === 'throw' && canThrow(this.time, true, this.thrown)) {
      this.thrown = true; this.throwAt = this.time; this.audio.throw(); this.feedback('PERFECT THROW! +500', 2.5); this.distance = Math.min(8, this.distance + 1.3)
    }
  }
  setLane(lane: number) { if (this.phase !== 'running' || this.auto) return; const next = Math.max(-1, Math.min(1, Math.round(lane))); if (next !== this.lane) this.audio.lane(); this.lane = next }
  setBodyDuck(active: boolean) { if (active && !this.bodyDuck && !this.auto) this.action('duck'); this.bodyDuck = active }
  // Rehearsal: ?t=35 jumps straight to that game second (earlier items are silently skipped).
  private skipTo() {
    const t = Math.min(DURATION - 1, Math.max(0, Number(new URLSearchParams(location.search).get('t')) || 0))
    if (!t) return
    this.time = t
    for (const item of this.items) if (item.time < t) { item.passed = true; item.group.visible = false }
    if (t > TRUCK.throwTo) this.thrown = true
  }
  private feedback(text: string, duration = 1.3) { this.toast = text; this.toastUntil = this.animationTime + duration }
  private event(key: string, condition: boolean, fn: () => void) { if (condition && !this.events.has(key)) { this.events.add(key); fn() } }
  private snapshot(): RunState {
    const c = chapter(this.time)
    return { phase: this.phase, time: this.time, score: scoreAt(this.time, this.food, this.thrown), countdown: 3 - Math.floor(this.countdownTime), title: c.title, subtitle: c.sub, toast: this.toast, boost: isBoost(this.time), food: this.food, collected: [...this.collected], fps: this.fps, thrown: this.thrown }
  }
  private emit() { this.onState(this.snapshot()) }
  private tick = () => {
    this.frame = requestAnimationFrame(this.tick)
    const rawDt = Math.min(this.clock.getDelta(), .25), dt = Math.min(rawDt, .05); this.animationTime += rawDt; this.frames++
    const running = this.phase === 'running', preview = this.phase === 'preview'
    if (preview && !this.previewPaused && !this.reducedMotion) this.previewTime += dt * .24
    if (this.phase === 'countdown') {
      this.countdownTime += rawDt * this.playbackRate
      if (this.countdownTime >= 3) { this.phase = 'running'; this.audio.whistle(); this.feedback('GO! RUN!', 1); this.skipTo() }
    }
    if (running) {
      this.time = Math.min(DURATION, this.time + rawDt * this.playbackRate)
      this.event('coachFood', this.time >= 4, () => this.audio.speak('Put that bubble tea down!', 'en-US'))
      this.event('coachDuck', this.time >= 14.6, () => { this.audio.bonk(); this.feedback('BONK! Coach forgot to duck.'); this.distance = 7 })
      this.event('truck', this.time >= TRUCK.appear, () => { this.audio.truck(); this.feedback('Here comes the garbage truck! 🎵', 2) })
      this.event('missedThrow', this.time > TRUCK.throwTo && !this.thrown, () => this.feedback('So close! Swing your arm next time.', 2))
      this.event('bike', this.time >= BOOST.from, () => { this.audio.bike(); this.feedback('BEEP! DING DING! BOOST!', 2) })
      this.event('familyMart', this.time >= FAMILY_MART - .4, () => { this.audio.familyMart(); this.feedback('Ding-dong! “Huān yíng guāng lín!” = Welcome!', 2.6); setTimeout(() => this.audio.speak('歡迎光臨！'), 1900) })
      this.event('finalWhistle', this.time >= FINAL_FOOD + .2, () => { this.audio.whistle(); this.audio.speak('Drop that bubble tea right now!', 'en-US') })
      if (this.time >= FINAL_FOOD - 1.2) this.lane = 0
      if (this.auto) {
        const next = this.items.filter(i => !i.passed && i.time >= this.time && i.time - this.time < .6)
        const obstacle = next.find(i => i.type !== 'food')
        if (obstacle?.type === 'jump' && obstacle.time - this.time < .3) this.action('jump')
        if (obstacle?.type === 'duck' && obstacle.time - this.time < .35) this.action('duck')
        if (obstacle?.type === 'dodge') this.lane = obstacle.lane === 0 ? -1 : 0
        else if (next[0]?.type === 'food') this.lane = next[0].lane
        if (this.time >= TRUCK.throwFrom + 1) this.action('throw')
      }
      if (this.time >= DURATION) { this.phase = 'finished'; this.audio.stopMusic(); this.audio.whistle(); this.audio.speak('Now the real workout begins!', 'en-US'); this.feedback('Now the real workout begins.', 8) }
    }
    const t = preview ? this.previewTime : this.time, distance = travel(t), boost = !preview && isBoost(t)
    const motionT = this.phase === 'paused' || this.phase === 'finished' ? t : this.animationTime
    for (const b of this.blocks) b.position.z = ((b.userData.baseZ + distance + 216) % 216) - 197
    for (const s of this.strings) s.position.z = ((s.userData.baseZ + distance + 216) % 216) - 197
    const targetX = (preview ? 0 : this.lane) * LANE_WIDTH
    this.runner.position.x = T.MathUtils.damp(this.runner.position.x, targetX, 13, dt)
    const jumpAge = this.time - this.jumpAt, jumping = !preview && jumpAge < .85 && jumpAge >= 0
    const ducking = !preview && !jumping && ((this.bodyDuck && !this.auto) || this.time - this.duckAt < .95)
    this.runner.position.y = jumping ? Math.sin(jumpAge / .85 * Math.PI) * 2.25 : boost ? .5 : 0
    this.event(`land-${this.jumpAt}`, running && jumpAge >= .85 && jumpAge < .95, () => this.audio.thump())
    this.models.animatePerson(this.runner, motionT, jumping, ducking, boost)
    const coachDistance = t > FINAL_FOOD ? Math.max(.15, (DURATION - t) * 2.6) : boost ? 15 : this.distance
    this.coach.visible = !boost || t < BOOST.from + 2
    this.coach.position.set(T.MathUtils.damp(this.coach.position.x, this.runner.position.x + 1.3, 3, dt), 0, 2 + coachDistance)
    this.models.animatePerson(this.coach, motionT + .3, false, false)
    this.coach.userData.body.rotation.z = t > FINAL_FOOD ? -.15 : .02
    this.bicycle.visible = boost; this.bicycle.position.set(this.runner.position.x, 0, 2)
    for (const item of this.items) {
      const z = 2 - (travel(item.time) - distance)
      item.group.position.set(item.lane * LANE_WIDTH, item.type === 'food' ? 1.28 + Math.sin(motionT * 3 + item.time) * .10 : 0, z)
      item.group.visible = !item.passed && z > -150 && z < 14 && !preview
      if (preview) { item.group.visible = item.type === 'food' && item.time < 15; item.group.position.z = -((item.time * 5 - distance) % 60 + 60) % 60; item.group.position.x = item.lane * LANE_WIDTH }
      if (item.type === 'food') item.group.rotation.y = motionT * .75
      if (running && !item.passed && this.time >= item.time) {
        item.passed = true
        const lane = Math.round(this.runner.position.x / LANE_WIDTH)
        if (item.type === 'food') {
          if (lane === item.lane) { this.food++; this.collected[item.kind ?? 0]++; item.collected = this.time; this.audio.ding(); this.feedback(`+100 · ${FOOD_NAMES[item.kind ?? 0]}!`, .7); this.sparks.visible = true; this.sparks.userData.at = this.time }
        } else if (!avoids({ time: item.time, lane: item.lane, type: item.type as 'jump' | 'duck' | 'dodge' }, lane, this.runner.position.y > .65, ducking)) {
          this.distance = Math.max(2.3, this.distance - 1); this.audio.bonk(); this.feedback('BONK! Coach is catching up.')
        } else if (lane === item.lane) { this.distance = Math.min(8, this.distance + .45) }
      }
      if (item.collected !== undefined && this.time - item.collected < .28) {
        const a = (this.time - item.collected) / .28; item.group.visible = true
        item.group.position.lerp(new T.Vector3(this.runner.position.x, 1.4, 2), a); item.group.scale.setScalar((item.time === FINAL_FOOD ? 3 : 1) * (1 - a))
      }
    }
    const sparkAge = this.time - (this.sparks.userData.at ?? -10)
    this.sparks.visible = running && sparkAge < .45
    this.sparks.position.set(this.runner.position.x, 1.3, 2)
    this.sparks.children.forEach((s, i) => { s.position.set(Math.sin(i * 2.4) * sparkAge * 3, Math.cos(i * 1.8) * sparkAge * 3, Math.cos(i * 2.4) * sparkAge * 3) })
    this.truck.visible = !preview && t >= TRUCK.appear && t < BOOST.from + 3
    this.truck.position.set(0, 0, t < TRUCK.throwTo ? -37 + (t - TRUCK.appear) * (26.6 / (TRUCK.throwTo - TRUCK.appear)) : -10.4 - (t - TRUCK.throwTo) * 12)
    const martZ = 2 - (travel(FAMILY_MART) - distance)
    this.familyMart.visible = !preview && martZ > -150 && martZ < 16; this.familyMart.position.set(4.6, 0, martZ)
    const archZ = martZ - 5; this.martArch.visible = !preview && archZ > -150 && archZ < 14; this.martArch.position.set(0, 0, archZ)
    const throwing = this.thrown && t - this.throwAt < .8
    this.bag.visible = !preview && t >= TRUCK.appear && t <= TRUCK.throwTo + 1 && (!this.thrown || throwing)
    this.bag.position.set(this.runner.position.x + .5, this.runner.position.y + 1.05, 1.8)
    if (throwing) { const a = (t - this.throwAt) / .8; this.bag.position.lerp(new T.Vector3(0, 1.4, this.truck.position.z + 2), a); this.bag.position.y += Math.sin(a * Math.PI) * 3; this.bag.rotation.x = a * 8; this.runner.userData.arms[1].rotation.x = -2.8 + a * 2 }
    if (this.thrown && t - this.throwAt > .8 && t - this.throwAt < 2) this.coach.userData.arms[0].rotation.z = -1.8
    else this.coach.userData.arms[0].rotation.z = 0
    this.event('throwLand', running && this.thrown && t - this.throwAt >= .8, () => { this.audio.throwHit(); this.audio.speak('Nice throw!', 'en-US') })
    this.event('afterThrowFood', running && this.thrown && t - this.throwAt >= 2, () => this.audio.speak('Why are you eating again?!', 'en-US'))
    const cameraY = this.style === 'arcade' ? 6.3 : this.style === 'cinema' ? 4.5 : 5.4
    this.camera.position.set(T.MathUtils.damp(this.camera.position.x, this.runner.position.x * .20, 2, dt), cameraY + (boost && !this.reducedMotion ? .2 : 0), 11.8)
    this.camera.lookAt(this.runner.position.x * .12, 1.9, -17)
    this.camera.fov = T.MathUtils.damp(this.camera.fov, STYLES[this.style].fov + (boost ? 12 : 0), 3, dt); this.camera.updateProjectionMatrix()
    this.audio.setMusicBoost(boost)
    if (this.phase === 'countdown') { this.arrival.update(Math.min(1, this.countdownTime / 3)); this.renderer.render(this.arrival.scene, this.arrival.camera) }
    else this.renderer.render(this.scene, this.camera)
    this.recorder?.draw(this.renderer.domElement, this.snapshot())
    if (this.animationTime > this.toastUntil) this.toast = ''
    if (this.animationTime - this.lastUi > .12) { this.fps = Math.round(this.frames / (this.animationTime - this.lastUi)); this.frames = 0; this.lastUi = this.animationTime; this.emit() }
  }
  dispose() { this.recorder?.stop(); cancelAnimationFrame(this.frame); this.observer.disconnect(); document.removeEventListener('visibilitychange', this.onVisibility); this.audio.dispose(); this.arrival.dispose(); this.models.dispose(); this.renderer.dispose(); this.renderer.domElement.remove() }
}
