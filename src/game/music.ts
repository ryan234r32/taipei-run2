/** Original 144 BPM runner groove. No samples, assets or runtime dependencies. */
export class RunMusic {
  private mix: GainNode
  /** Sidechain-style duck: sound effects briefly pull this down so they always sit in front. */
  private ducker: GainNode
  private duckDepth = 1
  private duckUntil = 0
  private timer?: ReturnType<typeof setInterval>
  private sources = new Set<AudioScheduledSourceNode>()
  private noise: AudioBuffer
  private startedAt = 0
  private elapsed = 0
  private nextStep = 0
  private boost = false
  private disposed = false
  private status: 'stopped' | 'playing' | 'paused' = 'stopped'
  private readonly stepSeconds = 60 / 144 / 4
  private readonly context: AudioContext

  constructor(context: AudioContext, output: AudioNode) {
    this.context = context
    this.mix = context.createGain()
    // Quiet enough to leave the action sounds and coach in front of the music.
    this.mix.gain.value = .17
    this.ducker = context.createGain()
    this.mix.connect(this.ducker).connect(output)
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const samples = this.noise.getChannelData(0)
    let seed = 18473
    for (let i = 0; i < samples.length; i++) {
      seed = seed * 16807 % 2147483647
      samples[i] = seed / 1073741824 - 1
    }
  }

  get state() { return this.status }

  start() {
    if (this.disposed) return
    this.stop()
    this.resetDuck()
    this.status = 'playing'
    this.startedAt = this.context.currentTime + .035
    this.nextStep = 0
    this.schedule()
    this.timer = setInterval(() => this.schedule(), 25)
  }

  setBoost(value: boolean) { this.boost = value }

  /** Dip the music to `depth` (0-1) after `delay`, hold, then ease back over ~`release` seconds. */
  duck(depth = .4, hold = .3, release = .5, delay = 0) {
    if (this.disposed) return
    const gain = this.ducker.gain, t = this.context.currentTime + delay
    // Overlapping effects keep the deeper dip and the later recovery instead of cutting each other short.
    const active = t < this.duckUntil
    this.duckDepth = active ? Math.min(depth, this.duckDepth) : depth
    this.duckUntil = Math.max(active ? this.duckUntil : 0, t + hold)
    gain.cancelScheduledValues(t)
    gain.setTargetAtTime(this.duckDepth, t, .02)
    gain.setTargetAtTime(1, this.duckUntil, release / 3)
  }

  pause() {
    if (this.status !== 'playing') return
    this.elapsed = Math.max(0, this.context.currentTime - this.startedAt)
    this.status = 'paused'
    this.clearScheduled()
  }

  resume() {
    if (this.disposed || this.status !== 'paused') return
    this.status = 'playing'
    this.startedAt = this.context.currentTime - this.elapsed
    this.nextStep = Math.ceil(this.elapsed / this.stepSeconds)
    this.schedule()
    this.timer = setInterval(() => this.schedule(), 25)
  }

  stop() {
    this.clearScheduled()
    this.status = 'stopped'
    this.elapsed = 0
    this.nextStep = 0
  }

  private resetDuck() {
    this.duckDepth = 1; this.duckUntil = 0
    this.ducker.gain.cancelScheduledValues(0)
    this.ducker.gain.setValueAtTime(1, this.context.currentTime)
  }

  private clearScheduled() {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    for (const source of this.sources) {
      try { source.stop() } catch { /* A note may have just ended. */ }
    }
    this.sources.clear()
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
      nodes.forEach(node => node.disconnect())
    }
  }

  private note(midi: number, at: number, length: number, volume: number, type: OscillatorType = 'triangle', cutoff = 2200) {
    const c = this.context, oscillator = c.createOscillator(), filter = c.createBiquadFilter(), envelope = c.createGain()
    oscillator.type = type
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
    filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = .6
    envelope.gain.setValueAtTime(.0001, at)
    envelope.gain.exponentialRampToValueAtTime(volume, at + .008)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + length)
    oscillator.connect(filter).connect(envelope).connect(this.mix)
    this.track(oscillator, [filter, envelope])
    oscillator.start(at); oscillator.stop(at + length + .01)
  }

  private kick(at: number, hard: boolean) {
    const c = this.context, oscillator = c.createOscillator(), envelope = c.createGain()
    oscillator.frequency.setValueAtTime(hard ? 165 : 135, at)
    oscillator.frequency.exponentialRampToValueAtTime(42, at + .16)
    envelope.gain.setValueAtTime(.0001, at)
    envelope.gain.exponentialRampToValueAtTime(hard ? .68 : .53, at + .003)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + .22)
    oscillator.connect(envelope).connect(this.mix)
    this.track(oscillator, [envelope]); oscillator.start(at); oscillator.stop(at + .23)
  }

  private percussion(at: number, hat: boolean, strong: boolean) {
    const c = this.context, source = c.createBufferSource(), filter = c.createBiquadFilter(), envelope = c.createGain()
    const length = hat ? .055 : .12
    source.buffer = this.noise
    filter.type = hat ? 'highpass' : 'bandpass'
    filter.frequency.value = hat ? 7200 : 1850
    filter.Q.value = hat ? .6 : .8
    envelope.gain.setValueAtTime(.0001, at)
    envelope.gain.exponentialRampToValueAtTime(hat ? (strong ? .16 : .1) : .3, at + .003)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + length)
    source.connect(filter).connect(envelope).connect(this.mix)
    this.track(source, [filter, envelope]); source.start(at); source.stop(at + length + .01)
    if (!hat) this.note(50, at, .09, .14, 'triangle', 950)
  }

  private schedule() {
    if (this.status !== 'playing' || this.disposed) return
    const now = this.context.currentTime
    // Resume a throttled tab at its current beat rather than firing old notes at once.
    if (this.startedAt + this.nextStep * this.stepSeconds < now - .08) {
      this.nextStep = Math.ceil((now - this.startedAt) / this.stepSeconds)
    }
    while (this.startedAt + this.nextStep * this.stepSeconds < now + .12) {
      const index = this.nextStep++, step = index % 16, bar = Math.floor(index / 16)
      const at = Math.max(now, this.startedAt + index * this.stepSeconds)
      const roots = [48, 45, 41, 43]
      const root = roots[Math.floor(bar / 2) % roots.length]
      const minor = root === 45
      if (this.boost ? step % 4 === 0 : step === 0 || step === 8) this.kick(at, this.boost)
      if (step === 4 || step === 12) this.percussion(at, false, true)
      if (this.boost ? step % 2 === 0 : step % 4 === 2) this.percussion(at, true, this.boost && step % 4 === 2)
      if (step % 4 === 0) this.note(root - 12 + (step === 8 ? 7 : 0), at, .25, .3, 'triangle', 900)
      // Original pentatonic/chord-tone motif, alternating each bar to avoid a loop seam.
      const melody = bar % 2 === 0 ? [12, 16, 19, 21, 19, 16, 14, 19] : [19, 16, 12, 14, 16, 19, 21, 16]
      if (step % 2 === 0) {
        let offset = melody[step / 2]
        if (minor && offset === 16) offset = 15
        this.note(root + offset, at, this.boost ? .16 : .2, this.boost ? .2 : .14, 'square', this.boost ? 3500 : 1900)
      }
      if (this.boost && step % 2 === 1) {
        const arpeggio = [12, minor ? 15 : 16, 19, 24]
        this.note(root + arpeggio[Math.floor(step / 2) % 4], at, .08, .085, 'triangle', 4000)
      }
    }
  }

  dispose() {
    this.stop(); this.disposed = true; this.mix.disconnect(); this.ducker.disconnect()
  }
}
