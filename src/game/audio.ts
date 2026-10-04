import { RunMusic } from './music'

const MASTER_GAIN = .9
/** Semitone offsets of the coin-combo staircase (major pentatonic-ish, capped at one octave). */
const DING_STEPS = [0, 2, 4, 7, 9, 12]
/** Pickups closer together than this chain into a combo and raise the DING pitch. */
const DING_COMBO_WINDOW = 1.5

/** Original layered arcade SFX + three CC0 Kenney foley samples.
 * Every effect passes through the same output bus used by the video recorder:
 * sources -> bus (glue compressor) -> limiter -> master -> speakers + recorder.
 * Background music joins the same bus and is ducked briefly under big effects.
 */
export class RunAudio {
  private context?: AudioContext
  private recording?: MediaStreamAudioDestinationNode
  private master?: GainNode
  private bus?: DynamicsCompressorNode
  private limiter?: DynamicsCompressorNode
  private music?: RunMusic
  private sources = new Set<AudioScheduledSourceNode>()
  private samples = new Map<string, AudioBuffer>()
  private loading?: Promise<void>
  private noiseBuffer?: AudioBuffer
  private driveCurve?: Float32Array<ArrayBuffer>
  private combo = 0
  private lastDing = -10
  private _muted = false
  private disposed = false

  get muted() { return this._muted }
  set muted(value: boolean) {
    this._muted = value
    if (this.context && this.master) this.master.gain.setTargetAtTime(value ? 0 : MASTER_GAIN, this.context.currentTime, .015)
  }

  init() {
    if (this.disposed) return
    if (!this.context) {
      const c = this.context = new AudioContext()
      this.recording = c.createMediaStreamDestination()
      this.master = c.createGain()
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN
      // Glue compressor: lets the click of each transient through, then pulls stacked layers together.
      this.bus = c.createDynamicsCompressor()
      this.bus.threshold.value = -6
      this.bus.knee.value = 6
      this.bus.ratio.value = 2.5
      this.bus.attack.value = .006
      this.bus.release.value = .15
      // Brick-wall style limiter so even five stacked big layers never clip the output or the recording.
      this.limiter = c.createDynamicsCompressor()
      this.limiter.threshold.value = -1.5
      this.limiter.knee.value = 0
      this.limiter.ratio.value = 20
      this.limiter.attack.value = .001
      this.limiter.release.value = .08
      this.bus.connect(this.limiter)
      this.limiter.connect(this.master)
      this.music = new RunMusic(c, this.bus)
      this.master.connect(c.destination)
      this.master.connect(this.recording)
      this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
      const values = this.noiseBuffer.getChannelData(0)
      let seed = 48371
      for (let i = 0; i < values.length; i++) {
        seed = (seed * 16807) % 2147483647
        values[i] = seed / 1073741824 - 1
      }
      // Soft-clip curve that gives the shouted HOO its strained, throaty edge.
      this.driveCurve = new Float32Array(1024)
      for (let i = 0; i < 1024; i++) this.driveCurve[i] = Math.tanh(2.6 * (i / 511.5 - 1))
      this.loading = Promise.all(['landing', 'bonk', 'trash-hit'].map(async name => {
        try {
          const response = await fetch(`/audio/${name}.wav`)
          if (!response.ok) return
          const buffer = await c.decodeAudioData(await response.arrayBuffer())
          if (!this.disposed) this.samples.set(name, buffer)
        } catch { /* Synth layers remain playable if a local sample cannot load. */ }
      })).then(() => undefined)
    }
    void this.context.resume().catch(() => undefined)
  }

  get stream() { this.init(); return this.recording!.stream }
  get ready() { this.init(); return this.loading ?? Promise.resolve() }
  get loadedSamples() { return this.samples.size }
  get musicState() { return this.music?.state ?? 'stopped' }
  startMusic() { this.init(); this.music?.setBoost(false); this.music?.start() }
  setMusicBoost(value: boolean) { this.music?.setBoost(value) }
  pauseMusic() { this.music?.pause() }
  resumeMusic() { this.init(); this.music?.resume() }
  stopMusic() { this.music?.stop() }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
      nodes.forEach(node => node.disconnect())
    }
  }

  /** Pull the background music under a big effect, then let it swell back. */
  private dipMusic(depth: number, hold: number, release = .45, delay = 0) {
    if (this.muted) return
    this.music?.duck(depth, hold, release, delay)
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = .12, delay = 0, endFreq = freq, attack = .008) {
    if (this.muted || !this.context || !this.bus) return
    const c = this.context, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), t + duration)
    g.gain.setValueAtTime(.0001, t)
    g.gain.exponentialRampToValueAtTime(volume, t + Math.min(attack, duration / 4))
    g.gain.exponentialRampToValueAtTime(.0001, t + duration)
    o.connect(g).connect(this.bus)
    this.track(o, [g])
    o.start(t); o.stop(t + duration + .01)
  }

  /** Filtered noise burst. `attack` is the time to peak: a short one is a crack, a long one a swoosh. */
  private noise(duration: number, volume: number, freq = 1200, endFreq = freq, delay = 0, type: BiquadFilterType = 'bandpass', q = .7, attack = Math.min(.025, duration / 3)) {
    if (this.muted || !this.context || !this.noiseBuffer || !this.bus) return
    const c = this.context, source = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + delay
    source.buffer = this.noiseBuffer; source.loop = true
    filter.type = type; filter.Q.value = q
    filter.frequency.setValueAtTime(freq, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + duration)
    g.gain.setValueAtTime(.0001, t)
    g.gain.exponentialRampToValueAtTime(volume, t + Math.min(attack, duration * .8))
    g.gain.exponentialRampToValueAtTime(.0001, t + duration)
    source.connect(filter).connect(g).connect(this.bus)
    this.track(source, [filter, g])
    // Random read offset so repeated effects do not play the exact same noise grain.
    source.start(t, Math.random() * 1.4); source.stop(t + duration + .01)
  }

  /** A few milliseconds of bright noise: the transient that makes an impact or tick feel crisp. */
  private click(volume: number, delay = 0, freq = 3000) {
    this.noise(.014, volume, freq, freq, delay, 'highpass', .7, .001)
  }

  private sample(name: string, volume = .7, rate = 1, delay = 0) {
    if (this.muted || !this.context || !this.bus) return
    const buffer = this.samples.get(name)
    if (!buffer) return
    const c = this.context, source = c.createBufferSource(), g = c.createGain()
    source.buffer = buffer; source.playbackRate.value = rate; g.gain.value = volume
    source.connect(g).connect(this.bus)
    this.track(source, [g]); source.start(c.currentTime + delay)
  }

  /** Struck metal bell: beating pair of fundamentals plus inharmonic partials and a strike click. */
  private bell(freq: number, delay: number, volume: number, ring = 1) {
    this.click(volume * .3, delay, 6500)
    this.tone(freq, .75 * ring, 'sine', volume, delay, freq, .002)
    this.tone(freq * 1.004, .7 * ring, 'sine', volume * .7, delay, freq * 1.004, .002)
    this.tone(freq * 2.76, .32 * ring, 'sine', volume * .32, delay, freq * 2.76, .002)
    this.tone(freq * 5.4, .14 * ring, 'sine', volume * .16, delay, freq * 5.4, .002)
  }

  /** Door-chime note: soft sine body, shimmer partner, octave, bell strike, and a quiet echo. */
  private chime(freq: number, delay: number, duration: number, volume: number) {
    this.tone(freq, duration, 'sine', volume, delay, freq, .004)
    this.tone(freq * 1.004, duration, 'sine', volume * .5, delay, freq * 1.004, .004)
    this.tone(freq * 2, duration * .55, 'sine', volume * .26, delay, freq * 2, .003)
    this.tone(freq * 4.1, .08, 'sine', volume * .1, delay, freq * 4.1, .002)
    this.click(.035, delay, 6500)
    this.tone(freq, duration * .6, 'sine', volume * .2, delay + .17, freq, .01)
  }

  /** A shouted "HOO!": breath attack, chest-heavy strained vowel gliding /o/ -> /u/, rising then falling pitch. */
  private hoo() {
    if (this.muted || !this.context || !this.bus || !this.driveCurve) return
    const c = this.context, t = c.currentTime + .01, v = t + .03
    const voice = c.createGain(), drive = c.createGain(), shaper = c.createWaveShaper(), envelope = c.createGain()
    voice.gain.value = 1; drive.gain.value = .55
    shaper.curve = this.driveCurve; shaper.oversample = '2x'
    // Shout envelope: fast push, a leaning-in plateau, a rounded release.
    envelope.gain.setValueAtTime(.0001, v)
    envelope.gain.exponentialRampToValueAtTime(.95, v + .035)
    envelope.gain.exponentialRampToValueAtTime(.72, v + .17)
    envelope.gain.exponentialRampToValueAtTime(.0001, v + .46)
    voice.connect(drive).connect(shaper).connect(envelope).connect(this.bus)
    const nodes: AudioNode[] = [voice, drive, shaper, envelope]
    // Glottal source: two slightly detuned saws (a throatier, fatter pulse) plus a chest sine.
    const saws: OscillatorNode[] = []
    for (const detune of [-11, 11]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'; o.detune.value = detune
      o.frequency.setValueAtTime(128, v)
      o.frequency.exponentialRampToValueAtTime(248, v + .085)
      o.frequency.exponentialRampToValueAtTime(150, v + .44)
      saws.push(o)
    }
    const chest = c.createOscillator(), chestLevel = c.createGain()
    chest.type = 'sine'; chestLevel.gain.value = .3
    chest.frequency.setValueAtTime(128, v)
    chest.frequency.exponentialRampToValueAtTime(248, v + .085)
    chest.frequency.exponentialRampToValueAtTime(150, v + .44)
    chest.connect(chestLevel).connect(voice)
    nodes.push(chestLevel)
    // Vowel formants sweep from "ho" (open) to "oo" (closed) while the shout decays.
    const formants: [number, number, number, number][] = [
      [470, 320, 6, 1], [980, 780, 7, .55], [2500, 2350, 9, .2], [3500, 3300, 9, .1],
    ]
    for (const [start, end, q, gain] of formants) {
      const filter = c.createBiquadFilter(), level = c.createGain()
      filter.type = 'bandpass'; filter.Q.value = q
      filter.frequency.setValueAtTime(start, v)
      filter.frequency.exponentialRampToValueAtTime(end, v + .42)
      level.gain.value = gain * 2.2
      saws.forEach(o => o.connect(filter))
      filter.connect(level).connect(voice)
      nodes.push(filter, level)
    }
    saws.forEach((o, i) => { this.track(o, i === 0 ? nodes : []); o.start(v); o.stop(v + .47) })
    this.track(chest, []); chest.start(v); chest.stop(v + .47)
    // The "H": aspirated breath through vowel-ish resonances right before the voice kicks in.
    this.noise(.12, .55, 1900, 800, 0, 'bandpass', 1.1, .02)
  }

  /** Coin pickup. Rapid consecutive pickups climb a scale so a run of food feels like a combo. */
  ding() {
    const now = this.context?.currentTime ?? 0
    this.combo = now - this.lastDing < DING_COMBO_WINDOW ? Math.min(this.combo + 1, DING_STEPS.length - 1) : 0
    this.lastDing = now
    const a = 987.77 * 2 ** (DING_STEPS[this.combo] / 12), b = a * 4 / 3
    // Two-note "ba-DING": a short grace note, then a long ringing top note with metal partials.
    this.click(.13, 0, 7000)
    this.tone(a, .1, 'sine', .34, 0, a, .002)
    this.tone(a * 2, .08, 'triangle', .06, 0, a * 2, .002)
    this.tone(b, .62, 'sine', .4, .065, b, .002)
    this.tone(b * 1.004, .55, 'sine', .17, .065, b * 1.004, .002)
    this.tone(b * 2, .36, 'sine', .12, .065, b * 2, .002)
    this.tone(b * 2.76, .2, 'sine', .06, .065, b * 2.76, .002)
    this.tone(b * 5.4, .1, 'sine', .03, .065, b * 5.4, .002)
    if (this.combo >= 3) { this.tone(b * 3, .3, 'sine', .05, .09, b * 3, .002); this.click(.06, .065, 8000) }
  }
  whistle() {
    this.tone(2380, .82, 'sine', .18, 0, 2510)
    this.tone(2440, .75, 'sine', .085, .03, 2570)
    this.noise(.63, .05, 3700, 3100, .04)
    this.dipMusic(.5, .6, .4)
  }
  lane() {
    // Quick body swoosh: bandpass sweeps up with a mid-peak, bright air on top, tiny tick at the start.
    this.click(.07, 0, 4500)
    this.noise(.17, 1.05, 900, 3800, 0, 'bandpass', 1.8, .06)
    this.noise(.12, .28, 4500, 8500, .02, 'highpass', .7, .04)
    this.tone(300, .12, 'triangle', .09, 0, 720, .02)
  }
  jump() {
    this.hoo()
    // Springy lift under the voice: rising air plus a little coil-spring zip.
    this.noise(.3, .3, 650, 3200, .03, 'bandpass', 1.2, .12)
    this.tone(210, .2, 'triangle', .15, .03, 520, .02)
    this.dipMusic(.55, .3, .35)
  }
  thump() {
    this.sample('landing', .9, .85)
    this.click(.2, 0, 1800)
    this.tone(125, .3, 'sine', .58, 0, 38, .003)
    this.tone(210, .1, 'triangle', .2, 0, 70, .002)
    this.noise(.18, .32, 500, 110, 0, 'lowpass', .7, .004)
    this.dipMusic(.55, .08, .25)
  }
  bonk() {
    this.sample('bonk', .95, .82)
    this.click(.2, 0, 2000)
    this.tone(240, .3, 'sine', .5, 0, 58, .003)
    this.tone(430, .24, 'triangle', .3, 0, 150, .002)
    this.noise(.07, .35, 1700, 1500, 0, 'bandpass', 8, .002)
    // Cartoon "boing" wobble after the hit.
    this.tone(680, .4, 'sine', .1, .06, 250, .01)
    this.dipMusic(.35, .3, .4)
  }
  whoosh() {
    this.noise(.5, 1.1, 400, 3600, 0, 'bandpass', 1.2, .16)
    this.noise(.38, .3, 3000, 7000, .04, 'highpass', .7, .12)
    this.tone(180, .3, 'triangle', .08, 0, 700, .1)
  }
  duck() {
    // Falling slide swoosh with a scuff of fabric on the floor and a soft tuck at the end.
    this.noise(.44, 1, 4200, 280, 0, 'bandpass', 1.3, .05)
    this.noise(.3, .26, 6500, 2500, 0, 'highpass', .7, .04)
    this.noise(.26, .45, 1800, 600, .1, 'bandpass', .8, .04)
    this.tone(230, .34, 'triangle', .14, 0, 62, .02)
    this.tone(95, .16, 'sine', .3, .26, 48, .005)
  }
  throw() {
    // Big rising whoosh peaking mid-flight, airy top, an effort thrust underneath.
    this.click(.1, 0, 2500)
    this.noise(.55, 1.35, 350, 5200, 0, 'bandpass', 1.3, .2)
    this.noise(.4, .34, 3000, 8000, .08, 'highpass', .7, .16)
    this.tone(240, .4, 'triangle', .12, .02, 1100, .15)
    this.tone(120, .22, 'sine', .22, 0, 260, .05)
    this.dipMusic(.5, .4, .4)
  }
  throwHit() {
    this.sample('trash-hit', .95, .8)
    // THUNK: transient + sub body + low rattle of the truck bed.
    this.click(.3, 0, 2200)
    this.tone(130, .34, 'sine', .55, 0, 40, .003)
    this.noise(.24, .34, 650, 150, 0, 'lowpass', .8, .004)
    // Metallic ring of a dented bin: inharmonic partials with slight pitch sag.
    const partials: [number, number, number][] = [[520, .1, .5], [803, .08, .4], [1330, .06, .3], [2080, .04, .2]]
    for (const [f, volume, duration] of partials) this.tone(f, duration, 'sine', volume, 0, f * .99, .002)
    for (let i = 0; i < 4; i++) this.noise(.05, .16, 2400 + i * 600, 1800, .05 + i * .045, 'bandpass', 3, .002)
    // Reward sparkle: rising bell arpeggio, then an applause-like crackle and a crowd "yay" swell.
    ;[784, 988, 1318.5, 1568].forEach((f, i) => {
      this.tone(f, .45, 'sine', .13, .17 + i * .07, f, .003)
      this.tone(f * 2, .25, 'sine', .04, .17 + i * .07, f * 2, .003)
    })
    for (let i = 0; i < 16; i++) this.noise(.03, .07 + Math.random() * .06, 2000 + Math.random() * 3200, 1800, .3 + Math.random() * .55, 'bandpass', 1.5, .002)
    this.noise(.7, .12, 1700, 2300, .25, 'bandpass', .6, .25)
    this.dipMusic(.35, .9, .5)
  }
  /** Special-move launch: charge-up riser, sub-boom with crack, then a long rush of wind. */
  private boostAt(delay: number) {
    const boom = delay + .24
    this.noise(.26, .22, 300, 4200, delay, 'bandpass', 1.4, .12)
    this.tone(70, .28, 'sawtooth', .1, delay, 520, .1)
    this.click(.3, boom, 2500)
    this.tone(140, .8, 'sine', .55, boom, 30, .004)
    this.tone(300, .14, 'triangle', .22, boom, 80, .002)
    this.noise(.6, .45, 6000, 140, boom, 'lowpass', .7, .004)
    this.noise(1.7, .36, 600, 3800, boom + .05, 'bandpass', 1.1, .35)
    this.noise(1.2, .15, 3500, 7500, boom + .08, 'highpass', .7, .3)
    this.tone(110, .9, 'triangle', .07, boom + .05, 1400, .2)
    ;[220, 277.2, 329.6, 440].forEach((f, i) => this.tone(f, .52, 'triangle', .08, boom + .08 + i * .055, f * 2))
    this.dipMusic(.3, 1.1, .8, delay)
  }
  boost() { this.boostAt(0) }
  bike() {
    // Card-tap "bee", then a two-strike bicycle bell, with the boost charging under the second ring.
    this.click(.1, 0, 5000)
    this.tone(2350, .13, 'sine', .3, 0, 2350, .003)
    this.tone(2350, .13, 'square', .07, 0, 2350, .003)
    this.tone(4700, .06, 'sine', .04, 0, 4700, .002)
    this.bell(2480, .17, .3)
    this.bell(2540, .37, .32)
    this.boostAt(.34)
  }
  truck() {
    // Own synthesized performance of the Für Elise opening that real Taiwanese garbage trucks play.
    // [midi note, length in steps]
    const notes: [number, number][] = [
      [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 3],
      [60, 1], [64, 1], [69, 1], [71, 3], [64, 1], [68, 1], [71, 1], [72, 4],
    ]
    const step = .15
    let at = 0
    for (const [midi, length] of notes) {
      const f = 440 * 2 ** ((midi - 69) / 12), d = length * step + .12
      // Chirpy electronic-music-box timbre: square body, triangle octave, tiny click.
      this.tone(f, d, 'square', .2, at, f, .004)
      this.tone(f * 2, d * .7, 'triangle', .13, at, f * 2, .004)
      this.tone(f * .5, d * .8, 'sine', .16, at, f * .5, .006)
      this.click(.05, at, 5000)
      at += length * step
    }
    // Diesel idle rumbling under the tune.
    this.noise(at + .3, .3, 150, 110, 0, 'lowpass', .8, .3)
    this.tone(55, at + .3, 'sawtooth', .04, 0, 50, .3)
    this.dipMusic(.35, at, .6)
  }
  familyMart() {
    // Convenience-store door chime: E C G C D G — D E D G C (own sine synthesis, bell-like).
    const notes: [number, number][] = [[659, .3], [523, .3], [392, .3], [523, .3], [587, .3], [784, .6], [587, .3], [659, .3], [587, .3], [392, .3], [523, .7]]
    let at = 0
    for (const [f, d] of notes) { this.chime(f, at, d + .4, .3); at += d * .62 }
    this.dipMusic(.4, at, .6)
  }
  speak(text: string, lang = 'zh-TW', rate = 1.1) {
    // Browser speech is live-only. Jump's HOO and all action SFX use the recordable bus.
    if (this.muted || !('speechSynthesis' in window) || window.speechSynthesis.speaking) return
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate; u.volume = .8
    window.speechSynthesis.speak(u)
  }
  stop() {
    window.speechSynthesis?.cancel()
    for (const source of this.sources) { try { source.stop() } catch { /* Already ended. */ } }
    this.sources.clear()
    this.combo = 0; this.lastDing = -10
  }
  dispose() {
    this.stop(); this.music?.dispose(); this.disposed = true
    void this.context?.close()
    this.samples.clear()
  }
}
