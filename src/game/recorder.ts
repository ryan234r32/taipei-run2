import type { RunState } from './engine'
import { FOOD_GUIDE } from './food-guide'

export class DemoRecorder {
  private canvas = document.createElement('canvas')
  private context: CanvasRenderingContext2D
  private recorder: MediaRecorder
  private chunks: Blob[] = []
  private startAt = performance.now()
  private stream: MediaStream
  private boostStartedAt = -1
  private wasBoosting = false
  private logo = new Image()
  private logoReady = false

  constructor(audio: MediaStream, onComplete: (blob: Blob) => void) {
    this.canvas.width = 1280; this.canvas.height = 720; this.context = this.canvas.getContext('2d')!
    this.logo.onload = () => { this.logoReady = this.logo.naturalWidth > 0 }
    this.logo.onerror = () => { this.logoReady = false }
    this.logo.src = '/branding/youbike-logo.svg'
    this.stream = this.canvas.captureStream(30); audio.getAudioTracks().forEach(t => this.stream.addTrack(t))
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t))
    if (!mimeType) throw new Error('This browser does not support video recording. Please use Chrome.')
    this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data) }
    this.recorder.onstop = () => { onComplete(new Blob(this.chunks, { type: mimeType })); this.stream.getVideoTracks().forEach(t => t.stop()) }
    this.recorder.start(1000)
  }

  private drawBoost(seconds: number) {
    const c = this.context, elapsed = Math.max(0, seconds - this.boostStartedAt)
    c.save(); c.globalCompositeOperation = 'screen'
    for (let index = 0; index < 28; index++) {
      const angle = index / 28 * Math.PI * 2
      const phase = (elapsed / (0.65 + index % 5 * 0.075) + index * 0.137) % 1
      const radius = 150 + phase * 680, length = 65 + phase * 115
      const x = 640 + Math.cos(angle) * radius, y = 372 + Math.sin(angle) * radius
      const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length
      const streak = c.createLinearGradient(x, y, ex, ey)
      streak.addColorStop(0, '#eaffcf00'); streak.addColorStop(0.7, index % 3 ? '#eaffcfc4' : '#7affe0a8'); streak.addColorStop(1, '#eaffcf00')
      c.globalAlpha = Math.sin(phase * Math.PI) * 0.48; c.strokeStyle = streak; c.lineWidth = index % 3 ? 2 : 4
      c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke()
    }
    if (elapsed < 1.2) {
      const phase = elapsed / 1.2, radius = 35 + Math.pow(phase, 0.65) * 880
      c.globalAlpha = (1 - phase) * 0.74; c.strokeStyle = '#d4ff9a'; c.lineWidth = 5 * (1 - phase) + 1
      c.beginPath(); c.arc(640, 372, radius, 0, Math.PI * 2); c.stroke()
      c.globalAlpha = (1 - phase) * 0.55; c.strokeStyle = '#72ffe2'; c.lineWidth = 2
      c.beginPath(); c.arc(640, 372, radius * 0.72, 0, Math.PI * 2); c.stroke()
      // One soft activation flash; no repeating or alternating full-screen flash.
      if (elapsed < 0.48) {
        const flash = c.createRadialGradient(640, 372, 0, 640, 372, 620)
        flash.addColorStop(0, '#fff8c8'); flash.addColorStop(0.38, '#d5ff73'); flash.addColorStop(1, '#d5ff7300')
        c.globalAlpha = Math.sin(elapsed / 0.48 * Math.PI) * 0.24; c.fillStyle = flash; c.fillRect(0, 0, 1280, 720)
      }
    }
    c.restore()
    if (elapsed < 1.2) {
      c.save(); c.translate(640, 358); c.rotate(-0.08)
      c.globalAlpha = Math.min(1, elapsed / 0.12) * Math.min(1, (1.2 - elapsed) / 0.2)
      c.textAlign = 'center'; c.shadowColor = '#173a22'; c.shadowBlur = 15; c.shadowOffsetY = 5
      c.fillStyle = '#f7ffb4'; c.font = 'italic 1000 94px system-ui, sans-serif'; c.fillText('BOOST!', 0, 0)
      c.shadowOffsetY = 0; c.font = '800 23px "Noto Sans TC", sans-serif'; c.fillText('See ya, Coach!', 0, 43)
      c.restore()
    }
  }

  private drawBoostBadge() {
    const c = this.context
    c.save(); c.fillStyle = '#f0ff9b'; c.shadowColor = '#1a3825'; c.shadowBlur = 14
    c.beginPath(); c.roundRect(485, 26, 310, 65, 10); c.fill(); c.shadowBlur = 0
    if (this.logoReady) c.drawImage(this.logo, 506, 37, 128, 43)
    else { c.fillStyle = '#247a39'; c.textAlign = 'left'; c.font = '900 27px system-ui, sans-serif'; c.fillText('YouBike', 505, 67) }
    c.fillStyle = '#204825'; c.fillRect(650, 39, 1, 37)
    c.textAlign = 'left'; c.font = 'italic 1000 28px system-ui, sans-serif'; c.fillText('BOOST', 669, 57)
    c.font = '800 12px "Noto Sans TC", sans-serif'; c.fillText('Turbo mode', 672, 77); c.restore()
  }

  private drawFoodIcon(kind: number, x: number, y: number) {
    const c = this.context
    c.save(); c.translate(x, y)
    if (kind === 0) {
      c.strokeStyle = '#faffdd'; c.lineWidth = 6; c.beginPath(); c.moveTo(9, -25); c.lineTo(15, -46); c.stroke()
      c.fillStyle = '#e3bf87'; c.beginPath(); c.moveTo(-23, -24); c.lineTo(23, -24); c.lineTo(17, 32); c.lineTo(-17, 32); c.closePath(); c.fill()
      c.fillStyle = '#fcf2cf'; c.beginPath(); c.ellipse(0, -24, 24, 6, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#292824'
      for (const [px, py] of [[-9, 17], [1, 23], [10, 16], [-10, 27], [10, 28], [0, 12]]) { c.beginPath(); c.arc(px, py, 4.5, 0, Math.PI * 2); c.fill() }
    } else if (kind === 1) {
      c.fillStyle = '#cbe6cd'; c.beginPath(); c.ellipse(0, 22, 39, 12, 0, 0, Math.PI * 2); c.fill()
      for (const [px, py] of [[-29, -9], [-3, 0], [-11, -23]]) {
        c.fillStyle = '#d89745'; c.beginPath(); c.roundRect(px, py, 30, 29, 5); c.fill()
        c.fillStyle = '#ffc86c'; c.beginPath(); c.roundRect(px + 2, py, 26, 17, 4); c.fill()
        c.strokeStyle = '#598943'; c.lineWidth = 3; c.beginPath(); c.moveTo(px + 6, py + 6); c.lineTo(px + 18, py + 10); c.stroke()
      }
    } else {
      c.fillStyle = '#d69a4e'; c.beginPath(); c.ellipse(0, 7, 35, 29, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#f1c078'; c.beginPath(); c.ellipse(-3, 0, 32, 22, -0.1, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#bd7839'; c.lineWidth = 3
      for (let index = -1; index <= 1; index++) { c.beginPath(); c.arc(index * 8 - 2, -2, 10, 0.1, 2.2); c.stroke() }
      c.fillStyle = '#ffefd0'
      for (const [px, py] of [[-17, -4], [4, -11], [17, 0], [-1, 8], [-13, 9]]) c.fillRect(px, py, 3, 2)
    }
    c.restore()
  }

  private drawPassport(state: RunState) {
    const c = this.context
    c.save(); c.fillStyle = '#081a14d9'; c.fillRect(0, 105, 1280, 545)
    const panel = c.createLinearGradient(80, 115, 80, 645); panel.addColorStop(0, '#203927f5'); panel.addColorStop(1, '#0b221ef5')
    c.fillStyle = panel; c.strokeStyle = '#beef8266'; c.lineWidth = 1
    c.beginPath(); c.roundRect(80, 115, 1120, 530, 22); c.fill(); c.stroke()
    c.textAlign = 'center'; c.fillStyle = '#eaff9d'; c.font = '900 34px system-ui, sans-serif'; c.fillText('YOUR TAIWAN FOOD PASSPORT', 640, 170)
    c.fillStyle = '#eaf1de'; c.font = '800 25px "Noto Sans TC", sans-serif'; c.fillText('Your night market haul from this run.', 640, 210)
    FOOD_GUIDE.forEach((food, index) => {
      const raw = state.collected[food.kind], count = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
      const x = 127 + index * 350, y = 253
      c.fillStyle = count ? '#35533b' : '#243b30'; c.strokeStyle = count ? '#c5f77c8c' : '#55715a80'
      c.beginPath(); c.roundRect(x, y, 326, 231, 16); c.fill(); c.stroke()
      this.drawFoodIcon(food.kind, x + 61, y + 66)
      c.textAlign = 'right'; c.fillStyle = count ? '#e5ff94' : '#809787'; c.font = '900 42px system-ui, sans-serif'; c.fillText(`× ${count}`, x + 293, y + 64)
      c.font = '700 11px system-ui, sans-serif'; c.fillText(count ? 'COLLECTED IN THIS RUN' : 'NOT COLLECTED YET', x + 293, y + 86)
      c.textAlign = 'left'; c.fillStyle = '#f6f8e9'; c.font = '800 26px "Noto Sans TC", sans-serif'; c.fillText(food.nameZh, x + 23, y + 135)
      c.fillStyle = '#bdcfb2'; c.font = '600 17px system-ui, sans-serif'; c.fillText(food.nameEn, x + 23, y + 162)
      c.fillStyle = '#e0fa91'; c.font = '800 12px system-ui, sans-serif'; c.fillText('FIND ON GOOGLE MAPS  ↗', x + 23, y + 206)
    })
    c.textAlign = 'center'; c.fillStyle = '#eff5dd'; c.font = '800 25px "Noto Sans TC", sans-serif'; c.fillText('Coach: "The workout starts now!"', 640, 533)
    c.fillStyle = '#b6cfb3'; c.font = '500 14px "Noto Sans TC", sans-serif'; c.fillText('Only foods actually collected in this run are listed. Maps search and HTML download are at the end of the web game.', 640, 565)
    c.fillStyle = '#ddf49a'; c.font = '700 12px system-ui, sans-serif'; c.fillText('SEARCH LINKS + DOWNLOADABLE FOOD LIST IN THE WEB GAME · VIDEO IS NOT INTERACTIVE', 640, 598)
    c.restore()
  }

  draw(scene: HTMLCanvasElement, state: RunState) {
    const c = this.context, seconds = (performance.now() - this.startAt) / 1000
    // Capture the actual renderer output, including the ArrivalScene countdown.
    c.drawImage(scene, 0, 0, 1280, 720)
    if (state.boost && !this.wasBoosting) this.boostStartedAt = seconds
    this.wasBoosting = state.boost
    if (state.boost && state.phase !== 'finished') this.drawBoost(seconds)
    const top = c.createLinearGradient(0, 0, 0, 250); top.addColorStop(0, '#112c35e8'); top.addColorStop(1, '#112c3500'); c.fillStyle = top; c.fillRect(0, 0, 1280, 260)
    const bottom = c.createLinearGradient(0, 500, 0, 720); bottom.addColorStop(0, '#112c3500'); bottom.addColorStop(1, '#112c35e8'); c.fillStyle = bottom; c.fillRect(0, 500, 1280, 220)
    c.fillStyle = '#e8fc86'; c.textAlign = 'left'; c.font = '900 37px "Barlow Condensed", sans-serif'; c.fillText('TAIPEI RUN.', 45, 56)
    c.fillStyle = '#dddcc6'; c.font = '600 13px "Noto Sans TC", sans-serif'; c.fillText('75-second Taiwan runner | Web 3D demo', 45, 84)
    if (seconds < 5) { c.fillStyle = '#eaf4d0'; c.font = '600 17px system-ui, sans-serif'; c.fillText('Move your body. Discover Taiwan.', 45, 112) }
    c.textAlign = 'right'; c.font = '700 15px "Barlow Condensed", sans-serif'; c.fillText(state.phase === 'finished' ? 'FINAL SCORE' : 'SCORE', 1230, 43)
    c.fillStyle = '#e8fc86'; c.font = '800 51px "Barlow Condensed", sans-serif'; c.fillText(state.score.toLocaleString(), 1230, 98)
    if (state.phase === 'finished') this.drawPassport(state)
    else {
      if (state.boost) this.drawBoostBadge()
      c.textAlign = 'center'; c.fillStyle = '#e8fc86'; c.font = '800 38px "Noto Sans TC", sans-serif'
      c.fillText(state.phase === 'countdown' ? 'READY TO RUN?' : state.title, 640, 141, 910)
      c.fillStyle = '#e6e9d1'; c.font = '500 17px "Noto Sans TC", sans-serif'; c.fillText(state.subtitle, 640, 175, 970)
      if (state.phase === 'countdown') { c.font = '900 190px "Barlow Condensed", sans-serif'; c.fillStyle = '#e8fc86'; c.fillText(String(state.countdown), 640, 437) }
      if (state.toast && state.phase === 'running') { c.fillStyle = '#e8fc86'; c.font = '800 28px "Noto Sans TC", sans-serif'; c.fillText(state.toast, 640, 557, 1000) }
    }
    c.textAlign = 'center'; c.fillStyle = '#dee7d1'; c.font = '500 13px "Noto Sans TC", sans-serif'; c.fillText('Real 3D gameplay · Sped-up auto demo · Not a body-control test', 640, 677)
    c.fillStyle = '#e8fc86'; c.fillRect(0, 715, 1280 * Math.min(1, seconds / 60), 5)
    if (seconds >= 60) this.stop()
  }
  stop() { if (this.recorder.state === 'recording') this.recorder.stop() }
}
