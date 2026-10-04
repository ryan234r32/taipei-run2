import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bike, Camera, Check, ChevronRight, Clock3, Download, Film, Info, Keyboard, LockKeyhole, Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX, X, Zap } from 'lucide-react'
import { RunEngine } from './game/engine'
import type { RunState } from './game/engine'
import { STYLES } from './game/rules'
import type { Action, ArtStyle } from './game/rules'
import { BodyCamera } from './BodyCamera'
import BoostEffect from './BoostEffect'
import FoodTrail from './FoodTrail'
import './App.css'

const INITIAL: RunState = { phase: 'preview', time: 0, score: 0, countdown: 3, title: '', subtitle: '', toast: '', boost: false, food: 0, collected: [0, 0, 0], fps: 60, thrown: false }
const locations = [
  { name: 'Raohe Night Market', zh: '饒河夜市', tag: 'Tonight, we run', type: 'raohe', number: '01' },
  { name: 'Ximending', zh: '西門町', tag: 'COMING SOON', type: 'ximen', number: '02' },
  { name: 'Xinyi / Taipei 101', zh: '信義區・台北 101', tag: 'COMING SOON', type: 'xinyi', number: '03' },
  { name: 'Jiufen', zh: '九份', tag: 'COMING SOON', type: 'jiufen', number: '04' },
]
function SceneArt({ type }: { type: string }) {
  return <svg viewBox="0 0 360 150" className={`scene-art art-${type}`} aria-hidden="true">
    <defs><linearGradient id={`sky-${type}`} x2="0" y2="1"><stop stopColor={type === 'jiufen' ? '#628587' : '#193e48'} /><stop offset="1" stopColor="#d5a076" /></linearGradient></defs>
    <rect width="360" height="150" fill={`url(#sky-${type})`} />
    {type === 'xinyi' ? <><path d="M202 145V57h8V37h4V12h3v25h5v20h7v88" fill="#2b6468" /><path d="M191 126l-4-17h54l-5 17M192 105l-4-17h51l-5 17M197 84l-4-17h42l-5 17M203 64l-3-13h27l-3 13" fill="#3b7475" /><path d="M0 150V95h40V78h29v72M83 150V105h45v45M261 150V71h36v79M307 150V100h53v50" fill="#23444b" /><path d="M151 150l18-35h17l21 35" fill="#b49370" /></> :
      type === 'jiufen' ? <><path d="M0 113L43 43l55 48 40-58 70 64 68-52 84 54v51H0" fill="#3c6466" /><path d="M0 150v-40h45V87h41v27h37v-42h41v78M215 150v-70h54v23h49v47" fill="#3e4c4a" /><path d="M38 86l31-15 31 15M107 72l36-18 37 18M202 80l38-21 39 21" stroke="#886b50" strokeWidth="8" /><path d="M162 150l16-7-9-7 18-8-10-8 18-9-10-8 19-9" fill="none" stroke="#c5a485" strokeWidth="8" />{[35, 71, 109, 142, 220, 253, 290].map((x, i) => <circle key={x} cx={x} cy={110 - (i % 3) * 12} r="5" fill="#ee8b45" />)}</> :
      <><path d="M0 150V38h38V20h31v130M82 150V61h35v89M259 150V29h46v121M318 150V47h42v103" fill="#315357" /><path d="M142 150l26-65h21l27 65" fill="#8c8070" /><path d="M0 112l124-10 14 48H0M226 150l10-54 124 14v40" fill="#284849" />{[0, 1, 2, 3].map((i) => <g key={i}><path d={`M${i * 33} 104l20-9 25 5v9`} fill={i % 2 ? '#5c8b79' : '#c0764b'} /><path d={`M${246 + i * 29} 100l10-9 28 7v11`} fill={i % 2 ? '#ac704a' : '#558777'} /></g>)}
      {type === 'raohe' ? <><path d="M117 84V56h8v28M232 84V56h8v28M108 54h140l-13-10H120z" fill="#af753e" /><rect x="124" y="57" width="109" height="16" fill="#805130" /><text x="178" y="69" fill="#efdca1" textAnchor="middle" fontSize="12" fontWeight="700">饒 河 夜 市</text><path d="M20 42Q180 100 340 42" stroke="#43564e" fill="none" />{[45, 90, 136, 182, 227, 273, 318].map((x, i) => <ellipse key={x} cx={x} cy={51 + Math.sin(i / 6 * Math.PI) * 24} rx="5" ry="7" fill="#f0924d" />)}</> : <><rect x="60" y="52" width="13" height="52" fill="#cf7d61" /><rect x="281" y="38" width="15" height="57" fill="#87b9a4" /><text transform="translate(70 57) rotate(90)" fill="#f5cc9c" fontSize="9">西門町</text><path d="M119 150l31-7M134 138l28-6M145 128l27-5" stroke="#ded3ac" strokeWidth="6" /></>}</>}
  </svg>
}

function App() {
  const mount = useRef<HTMLDivElement>(null), engine = useRef<RunEngine | null>(null)
  const [style, setStyle] = useState<ArtStyle>('toon'), [state, setState] = useState(INITIAL)
  const [dialog, setDialog] = useState<'play' | 'guide' | null>(null), [muted, setMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(false), [previewPaused, setPreviewPaused] = useState(false), [renderError, setRenderError] = useState('')
  const [auto, setAuto] = useState(false)
  const [cameraReady, setCameraReady] = useState(false), [tracked, setTracked] = useState(false), [foodTrail, setFoodTrail] = useState(false)
  const [recording, setRecording] = useState(false), [videoUrl, setVideoUrl] = useState('')
  const videoUrlRef = useRef('')
  // 60-second pitch clock: starts the moment a run starts (incl. the 3 s arrival) and keeps counting through the ending.
  const [clockStart, setClockStart] = useState<number | null>(null), [clockNow, setClockNow] = useState(0)
  const home = state.phase === 'preview', finished = state.phase === 'finished'
  // Driven by game time so the clock always matches what is on screen: 60–58 arrival, 57→9 run, 9→0 ending.
  const clockLeft = state.phase === 'countdown' ? 57 + state.countdown : state.phase === 'running' || state.phase === 'paused' ? Math.max(9, Math.ceil(57 - state.time)) : finished && clockStart !== null ? Math.max(0, 9 - Math.floor((clockNow - clockStart) / 1000)) : 60
  useEffect(() => {
    if (!mount.current) return
    try { engine.current = new RunEngine(mount.current, style, setState); if (new URLSearchParams(location.search).has('autostart')) { setAuto(true); engine.current.start(true); setClockStart(performance.now()) } }
    catch { setRenderError('This browser can\'t start 3D. Use the latest Chrome or Safari with hardware acceleration on.') }
    return () => { engine.current?.dispose(); engine.current = null }
  }, [style])
  useEffect(() => { engine.current?.setMuted(muted) }, [muted, style])
  useEffect(() => { if (state.phase === 'finished') { setClockStart(performance.now()); setClockNow(performance.now()) } }, [state.phase])
  useEffect(() => { if (clockStart === null) return; const id = setInterval(() => setClockNow(performance.now()), 200); return () => clearInterval(id) }, [clockStart])
  // Ending: auto-open the Google Maps food list so the pitch video shows it without an extra click.
  useEffect(() => { if (state.phase !== 'finished') return; const id = setTimeout(() => setFoodTrail(true), 2600); return () => clearTimeout(id) }, [state.phase])
  useEffect(() => { engine.current?.setPreviewPaused(previewPaused) }, [previewPaused, style])
  useEffect(() => {
    const keys: Record<string, Action> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'jump', ArrowUp: 'jump', w: 'jump', ArrowDown: 'duck', s: 'duck', f: 'throw' }
    const listener = (e: KeyboardEvent) => {
      if (dialog || (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName))) return
      const action = keys[e.key]
      if (action && state.phase === 'running') { e.preventDefault(); if (!e.repeat) engine.current?.action(action) }
      if (e.key === 'Escape') { if (state.phase === 'paused') engine.current?.resume(); else engine.current?.pause() }
    }
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener)
  }, [state.phase, dialog])
  useEffect(() => {
    if (!dialog) return
    const oldFocus = document.activeElement as HTMLElement | null
    const d = document.querySelector<HTMLElement>('[role="dialog"]'); d?.querySelector<HTMLElement>('button')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDialog(null)
      if (e.key === 'Tab' && d) {
        const nodes = [...d.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')], first = nodes[0], last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); oldFocus?.focus() }
  }, [dialog])
  const start = (autoplay = false) => { setClockStart(performance.now()); setClockNow(performance.now()); setDialog(null); setFoodTrail(false); setAuto(autoplay); engine.current?.start(autoplay) }
  const recordDemo = () => {
    setAuto(true); setRecording(true)
    try { engine.current?.record(blob => { URL.revokeObjectURL(videoUrlRef.current); videoUrlRef.current = URL.createObjectURL(blob); setVideoUrl(videoUrlRef.current); setRecording(false) }) }
    catch { setRecording(false); engine.current?.home(); setRenderError('This browser can\'t record video. Use Chrome, or screen-record instead.') }
  }
  const goHome = () => { setClockStart(null); engine.current?.home(); setCameraOn(false); setCameraReady(false); setFoodTrail(false); setAuto(false) }
  return <main className={`app style-${style} ${home ? 'is-home' : 'is-playing'} ${state.boost ? 'boosting' : ''}`}>
    <div className="world" ref={mount} />
    <div className="world-vignette" />
    {renderError && <div className="render-error" role="alert">{renderError}</div>}
    <header className="topbar">
      <button className="brand" onClick={goHome} aria-label="Taipei Run, back to home"><span className="brand-mark">T<span>R</span></span><span>TAIPEI RUN<small>Taipei is watching</small></span></button>
      {home && <a className="art-board-link" href="/styles.html" target="_blank" rel="noopener noreferrer">Compare 9 art styles ↗</a>}{home && <nav className="style-tabs" aria-label="Choose a 3D art direction">{(Object.keys(STYLES) as ArtStyle[]).map((s, i) => <button key={s} onClick={() => setStyle(s)} aria-pressed={style === s}><span>0{i + 1}</span>{STYLES[s].name}{s === 'toon' && <i />}</button>)}</nav>}
      <div className="top-actions">{home && <button className="guide-button" onClick={() => setDialog('guide')}><Info size={16} /><span>Direction &amp; trade-offs</span></button>}<button className="icon-button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>{!home && !finished && <button className="icon-button" aria-label="Pause game" onClick={() => engine.current?.pause()}><Pause size={18} /></button>}</div>
    </header>
    {home ? <>
      <section className="hero">
        <div className="eyebrow"><span /> A VERY TAIWANESE RUN</div>
        <h1>TAIPEI<span>RUN<span className="title-period">.</span></span></h1>
        <h2>Run it off.<span>Eat it back.</span></h2>
        <p>Your workout. Your bubble tea.<br />Plus one fitness coach about to lose it.</p>
        <div className="hero-actions"><button className="primary-button" disabled={!!renderError} onClick={() => setDialog('play')}>Start the Night Market Run <ArrowRight size={20} /></button><button className="watch-button" disabled={!!renderError} onClick={() => start(true)}><Play size={13} fill="currentColor" /> Watch full demo</button></div>
        <div className="hero-meta"><span><Clock3 size={13} /> 60-second demo run</span><span><Camera size={13} /> Body motion / keyboard</span><span><Zap size={13} /> Real-time 3D</span></div>
      </section>
      <div className="world-caption"><div className="world-caption-line" /><span className="live-dot" /><span>LIVE 3D</span><b>{STYLES[style].en}</b><button aria-label={previewPaused ? 'Play scene preview' : 'Pause scene preview'} onClick={() => setPreviewPaused(!previewPaused)}>{previewPaused ? <Play size={12} /> : <Pause size={12} />}</button><small>{STYLES[style].caption}</small></div>
      <section className="scene-selection" aria-label="Choose a run location">
        <div className="selection-header"><h3>SELECT YOUR RUN <span>Pick a route. Escape the coach.</span></h3><span className="selection-counter">01 AVAILABLE / 04 DESTINATIONS</span></div>
        <div className="scene-grid">{locations.map((place, i) => <button key={place.type} className={`scene-card ${i === 0 ? 'selected' : 'locked'}`} onClick={() => i === 0 && setDialog('play')} disabled={i > 0} aria-label={i === 0 ? 'Raohe Night Market, start trial run' : `${place.name}, coming soon`}>
          <div className="scene-image"><SceneArt type={place.type} /><span className="scene-number">{place.number}</span>{i === 0 ? <span className="play-badge"><Play size={11} fill="currentColor" /> PLAYABLE</span> : <span className="lock-badge"><LockKeyhole size={12} /> LOCKED</span>}</div>
          <div className="scene-card-info"><div><strong>{place.name}</strong><small>{place.zh}</small></div>{i === 0 ? <ArrowRight size={20} /> : <LockKeyhole size={16} />}</div>
        </button>)}</div>
      </section>
      <footer className="home-footer"><span>The happier you eat, the unhappier the coach.</span><button className="record-button" disabled={!!renderError} onClick={recordDemo}><Film size={12} /> Record 60s demo</button><span>ART DIRECTION LAB <i /> HACKATHON EDITION</span></footer>
    </> : <>
      {!finished && <><section className="game-hud"><div className="score-box"><span>SCORE</span><strong>{state.score.toLocaleString()}</strong></div><div className="run-time"><Clock3 size={14} /><span>{clockLeft.toString().padStart(2, '0')}</span><div><i style={{ width: `${clockLeft / 60 * 100}%` }} /></div></div></section><div className="chapter"><span>{auto ? 'Auto demo · not body-controlled' : cameraOn ? tracked ? 'BODY RUN' : 'BODY RUN · Back to camera center' : 'KEYBOARD RUN'}</span><h2>{state.title}</h2><p>{state.subtitle}</p></div></>}
      {state.phase === 'countdown' && <div className="countdown"><small>Coach is ready. So is the bubble tea.</small><strong key={state.countdown}>{state.countdown}</strong><span>READY TO RUN?</span></div>}
      {state.toast && state.phase === 'running' && <div className="game-toast" role="status">{state.toast}</div>}
      <BoostEffect active={state.boost && state.phase === 'running'} />
      {!finished && <div className="game-bottom"><span><span className="live-dot" /> Raohe Night Market → Streets outside</span><div className="control-buttons">{[['left', 'Left', <ArrowLeft size={18} />], ['right', 'Right', <ArrowRight size={18} />], ['jump', 'Jump', <ArrowUp size={18} />], ['duck', 'Duck', <ArrowDown size={18} />], ['throw', 'Throw trash', <span>F</span>]].map(([action, label, icon]) => <button key={String(action)} aria-label={String(label)} onClick={() => engine.current?.action(action as Action)}>{icon}<small>{label}</small></button>)}</div><button className="exit-button" onClick={goHome}>Leave run <X size={13} /></button></div>}
      {state.phase === 'paused' && <div className="modal-overlay"><section className="dialog small-dialog" role="dialog" aria-modal="true" aria-label="Game paused"><span className="eyebrow">TAKE A BREATHER</span><h2>Catch your breath.<br />Coach is paused too.</h2><button className="primary-button" onClick={() => engine.current?.resume()}>Keep running <Play size={17} /></button><button className="text-button" onClick={goHome}>Back to home</button></section></div>}
      {finished && clockStart !== null && <div className="run-time ending-clock"><Clock3 size={14} /><span>{clockLeft.toString().padStart(2, '0')}</span><div><i style={{ width: `${clockLeft / 60 * 100}%` }} /></div></div>}{finished && <div className="ending"><div className="ending-stamp">CAUGHT BY COACH</div><span className="eyebrow">THE RUN IS OVER. THE WORKOUT ISN'T.</span><h2>The bubble tea was great.<br /><span>The coach, not so much.</span></h2><div className="final-score"><span>FINAL SCORE</span><strong>{state.score.toLocaleString()}</strong></div><p>The workout starts now.</p><button className="food-passport-button" onClick={() => setFoodTrail(true)}>🧋 Open my Taiwan food passport <span>YOUR FOOD TRAIL ↗</span></button><div className="ending-actions"><button className="primary-button" onClick={() => start(auto)}><RotateCcw size={16} /> Run again</button><button className="outline-button" onClick={goHome}>Compare other styles <ArrowRight size={16} /></button></div></div>}
    </>}
    {cameraOn && <BodyCamera onPose={(lane, action) => { engine.current?.setLane(lane); if (action) engine.current?.action(action) }} onReady={setCameraReady} onTrackingChange={value => { setTracked(value); if (!value) engine.current?.setBodyDuck(false) }} onDuckChange={active => engine.current?.setBodyDuck(active)} onClose={() => { setCameraOn(false); setCameraReady(false); engine.current?.setBodyDuck(false) }} />}
    {dialog && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDialog(null) }}><section className={`dialog ${dialog === 'guide' ? 'guide-dialog' : ''}`} role="dialog" aria-modal="true" aria-label={dialog === 'play' ? 'How to play' : 'Art direction and time trade-offs'}><button className="close-dialog" aria-label="Close dialog" onClick={() => setDialog(null)}><X size={20} /></button>
      {dialog === 'play' ? <><span className="eyebrow">60 SECONDS. ZERO SELF-CONTROL.</span><h2>Move your body.<br />Grab the bubble tea.</h2><p>Your runner moves on its own. You just handle left, right, jump and duck.</p><div className="tutorial-grid"><div><ArrowLeft /><ArrowRight /><strong>LEFT / RIGHT</strong><small>Lean left / right · ← →</small></div><div><ArrowUp /><strong>JUMP</strong><small>Jump for real · Space</small></div><div><ArrowDown /><strong>DUCK</strong><small>Squat down · ↓</small></div><div><ArrowUp className="throw-icon" /><strong>THROW</strong><small>Swing your arm up · F</small></div></div><div className="play-options"><button className="primary-button" onClick={() => start(false)}><Keyboard size={17} /> {cameraOn && cameraReady ? 'Start body run' : 'Start keyboard run'} <ChevronRight size={17} /></button><button className="outline-button" onClick={() => { setCameraOn(true); setDialog(null) }}><Camera size={17} /> Open camera &amp; calibrate first</button></div><p className="dialog-note">The camera just needs your face and both shoulders in frame (stand 1–2 m away; feet can be out of shot). Hold still for about 1 second to calibrate. When "● Tracking" appears at the bottom right, press "Start body run". Every move has a sound effect, and the keyboard works at the same time.</p></> :
      <><span className="eyebrow">MAKE THE NEXT 90 MINUTES COUNT.</span><h2>Pick a style,<br />then nail one route.</h2><p>Full style proposals are in "Compare 9 art styles". The playable build uses a rounded character plus a blocky night market; the style buttons above only compare live materials and camera.</p><div className="direction-options">{(Object.keys(STYLES) as ArtStyle[]).map(s => <button key={s} onClick={() => { setStyle(s); setDialog(null) }}><span style={{ background: STYLES[s].color }} /><div><strong>{STYLES[s].name}{s === 'toon' && <b>Recommended</b>}</strong><p>{STYLES[s].description}</p></div><ArrowRight size={18} /></button>)}</div><div className="decision-note"><Check size={18} /><div><strong>Chosen: cartoon characters × blocky Raohe Night Market × three lanes</strong><p>Exaggerated moves are easy to read, stalls are reusable, and the snacks, awnings and coach gags all fit on one route. The garbage truck and YouBike connect to the streets outside.</p></div></div><div className="sprint-plan"><span><b>0–10</b>Pick style</span><span><b>10–35</b>Body control &amp; track</span><span><b>35–60</b>75-sec events</span><span><b>60–80</b>Sound &amp; visuals</span><span><b>80–90</b>Live rehearsal</span></div><p className="dialog-note">This is an art and flow prototype. Semi-realistic does not mean photo-quality, and camera tracking still needs testing under the demo's camera and lighting. Score counts only running, snacks and trash throws.</p></>}
    </section></div>}
    {home && cameraOn && <button className="camera-start primary-button" disabled={!cameraReady || !tracked} onClick={() => start(false)}>{cameraReady && tracked ? 'Start body run' : 'Hold still, calibrating…'} <ArrowRight size={17} /></button>}
    {!home && !finished && <button className="fullscreen-button" aria-label="Toggle fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.() }}><Maximize2 size={16} /></button>}
    {recording && <div className="record-status"><span className="status-dot" /> Recording 60 s · keep this tab open</div>}
    {!recording && videoUrl && <a className="video-download" href={videoUrl} download="taipei-run-demo.webm"><Download size={15} /> Download 60s demo video</a>}
    <FoodTrail counts={state.collected} open={foodTrail} onClose={() => setFoodTrail(false)} />
    {home && <span className="scene-detail"><Bike size={13} /> YOU CAN OUTRUN YOUR COACH. MAYBE.</span>}
  </main>
}
export default App
