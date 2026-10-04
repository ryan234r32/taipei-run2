import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FOOD_TOUR, buildFoodTrailHtml, getCollectedFoods } from './game/food-guide'
import './FoodTrail.css'

export interface FoodTrailProps {
  counts: number[]
  open: boolean
  onClose: () => void
}

type Step = 'tally' | 'bag' | 'reveal' | 'list'
type Vars = CSSProperties & Record<`--${string}`, string | number>

/** Slightly different ink angles so the stamps feel hand-pressed. */
const STAMP_ANGLES = [-8, 6, -5]
const LANTERNS = Array.from({ length: 14 }, (_, i) => i)
/** Twinkling star positions around a glowing food item (percent of the orb box). */
const SPARKLES = [
  { x: -8, y: 14, s: 18, t: 0 }, { x: 92, y: 4, s: 13, t: .4 }, { x: 104, y: 52, s: 20, t: .8 },
  { x: -14, y: 62, s: 12, t: .6 }, { x: 10, y: 98, s: 15, t: .2 }, { x: 84, y: 96, s: 17, t: 1 },
]
const CONFETTI_COLORS = ['#d7261e', '#ffcf4a', '#fff3d6', '#35d0c8']
/** Deterministic burst so renders are stable (no Math.random in render). */
const CONFETTI = Array.from({ length: 34 }, (_, i) => {
  const angle = i * 2.399, radius = 170 + ((i * 47) % 260)
  return { x: Math.round(Math.cos(angle) * radius * 1.55), y: Math.round(Math.sin(angle) * radius * .85 - 120), r: (i * 67) % 360, d: (i % 9) * .035, c: CONFETTI_COLORS[i % 4] }
})
const ITEM_PITCH = 278 // item width + gap, used to aim each item at the bag
/** Focus without letting the browser scroll the stage (the burst art is larger than the stage). */
const focusOnMount = (el: HTMLElement | null) => el?.focus({ preventScroll: true })

function Bag({ icons, className = '' }: { icons: string[]; className?: string }) {
  return <>
    <span className="bag-peeks" aria-hidden="true">{icons.map((icon, i) => <span key={i} style={{ '--i': i } as Vars}>{icon}</span>)}</span>
    <span className={`bag-body ${className}`}>
      <span className="bag-fold" />
      <span className="bag-label"><b>FOOD BAG</b></span>
    </span>
  </>
}

export function FoodTrail({ counts, open, onClose }: FoodTrailProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const foods = getCollectedFoods(counts)
  const total = foods.reduce((sum, food) => sum + food.count, 0)
  const icons = foods.map(food => food.icon)
  const [step, setStep] = useState<Step>('tally')
  const [prevOpen, setPrevOpen] = useState(open)
  // Restart the story every time the dialog re-opens (derived during render, no effect needed).
  if (open !== prevOpen) { setPrevOpen(open); if (open) setStep('tally') }
  const shown: Step | 'empty' = foods.length ? step : 'empty'

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) { element.showModal(); element.focus({ preventScroll: true }) }
    if (!open && element.open) element.close()
  }, [open])

  // Step 1 -> 2 automatically (~3 s); reduced motion skips straight to the bag.
  const foodCount = foods.length
  useEffect(() => {
    if (!open || step !== 'tally' || !foodCount) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(() => setStep('bag'), reduce ? 0 : 1400 + foodCount * 600)
    return () => clearTimeout(id)
  }, [open, step, foodCount])

  function downloadList() {
    if (!foods.length) return
    const url = URL.createObjectURL(new Blob([buildFoodTrailHtml(counts)], { type: 'text/html;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'taipei-run-food-map.html'
    document.body.append(link); link.click(); link.remove()
    // Keep the object URL alive briefly so the browser can finish starting the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <dialog ref={dialog} className="food-trail" data-step={shown} tabIndex={-1} aria-label="Your Taipei Food Map" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="food-trail-bg" aria-hidden="true" />
    <div className="food-trail-awning"><span className="food-trail-tag">TAIPEI RUN <i aria-hidden="true">·</i> RAOHE NIGHT MARKET</span><button className="food-trail-close" type="button" onClick={onClose} aria-label="Close">×</button></div>
    <div className="food-trail-lanterns" aria-hidden="true">{LANTERNS.map(i => <i key={i} style={{ '--k': i } as Vars} />)}</div>

    <div className="food-trail-stage">
      {shown === 'empty' && <section className="food-trail-empty-wrap"><div className="food-trail-empty"><span aria-hidden="true">🧋</span><h2>No food yet. Run again!</h2><p>Eat something on the way and your food map fills up.</p></div></section>}

      {(shown === 'tally' || shown === 'bag') && <section className="food-trail-play" data-step={shown} onClick={shown === 'tally' ? () => setStep('bag') : undefined}>
        <h2 key={shown} className="food-trail-callout">{shown === 'tally' ? <>YOU ATE</> : <>INTO THE FOOD BAG</>}</h2>
        <div className="food-trail-tally" data-flying={shown === 'bag' ? '' : undefined}>
          {foods.map((food, i) => <div className={`food-trail-tally-item food-trail-theme-${food.kind}`} key={food.kind} style={{ '--i': i, '--to': food.count, '--dx': `${-(i - (foods.length - 1) / 2) * ITEM_PITCH}px` } as Vars}>
            <div className="food-trail-orb" aria-hidden="true">
              <span className="food-trail-halo" />
              <span className="food-trail-emoji">{food.icon}</span>
              {SPARKLES.map((sp, k) => <i key={k} className="food-trail-spark" style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: sp.s, height: sp.s, '--t': `${sp.t}s` } as Vars} />)}
            </div>
            <div className="food-trail-plate">
              <b className="food-trail-en">{food.shortEn}</b>
              <span className="food-trail-zh" lang="zh-Hant">{food.nameZh}</span>
              <span className="food-trail-sr">× {food.count}</span>
              <div className="food-trail-count" aria-hidden="true">×<b className="food-trail-count-num" /></div>
            </div>
          </div>)}
        </div>
        {shown === 'bag' && <div className="food-trail-bagzone" style={{ '--n': foods.length } as Vars}>
          <button className="food-trail-bag" type="button" ref={focusOnMount} onClick={() => setStep('reveal')} aria-label="Tap to open your food bag"><Bag icons={icons} /></button>
          <span className="food-trail-tap" aria-hidden="true">TAP TO OPEN</span>
        </div>}
      </section>}

      {shown === 'reveal' && <section className="food-trail-reveal">
        <div className="food-trail-rays" aria-hidden="true" />
        <div className="food-trail-flash" aria-hidden="true" />
        <div className="food-trail-confetti" aria-hidden="true">{CONFETTI.map((c, i) => <i key={i} style={{ '--x': `${c.x}px`, '--y': `${c.y}px`, '--r': `${c.r}deg`, '--d': `${c.d}s`, '--c': c.c } as Vars} />)}</div>
        <div className="food-trail-bag food-trail-bag--open" aria-hidden="true"><Bag icons={icons} /></div>
        <div className="food-trail-map-sign">
          <div className="food-trail-map-kicker">{total} SNACKS COLLECTED</div>
          <h2>YOUR TAIPEI FOOD MAP</h2>
          <div className="food-trail-map-icons" aria-hidden="true">{icons.map((icon, i) => <span key={i}>{icon}</span>)}</div>
          <button className="food-trail-map-btn" type="button" ref={focusOnMount} onClick={() => setStep('list')}>Open in Google Maps ↗</button>
        </div>
      </section>}

      {shown === 'list' && <section className="food-trail-list">
        <header className="food-trail-head">
          <h2 className="food-trail-title"><span className="food-trail-title-en">YOUR TAIPEI FOOD MAP</span></h2>
          <div className="food-trail-total"><span className="food-trail-sr">{total} foods eaten</span><div className="food-trail-total-stamp" aria-hidden="true"><b>{total}</b><span>FOODS EATEN</span></div></div>
        </header>
        <p className="food-trail-intro">Tap a place to open it in Google Maps, then go taste it for real.</p>
        <div className="food-trail-items">{foods.map((food, index) => <article className={`food-trail-item food-trail-theme-${food.kind}`} key={food.kind} style={{ '--i': index, '--r': `${STAMP_ANGLES[index % STAMP_ANGLES.length]}deg` } as Vars}>
          <div className="food-trail-card-top">
            <div className="food-trail-icon" aria-hidden="true"><span className="food-trail-halo" /><span className="food-trail-emoji">{food.icon}</span></div>
            <div className="food-trail-name"><h3>{food.shortEn}</h3><span lang="zh-Hant">{food.nameZh}</span></div>
            <div className="food-trail-stamp"><b>×{food.count}</b><span>TASTED</span></div>
          </div>
          <p className="food-trail-description">{food.descriptionEn}</p>
          <div className="food-trail-where">
            <div className="food-trail-where-label">WHERE TO TRY</div>
            <ul>{food.spots.map(place => <li key={place.nameEn}><a href={place.mapsUrl} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">📍</span><b>{place.nameEn}</b><em aria-hidden="true">↗</em></a></li>)}</ul>
          </div>
        </article>)}</div>
        <div className="food-trail-actions">
          <a className="food-trail-maps" href={FOOD_TOUR.mapsUrl} target="_blank" rel="noopener noreferrer">
            <span className="food-trail-maps-pin" aria-hidden="true">📍</span>
            <span className="food-trail-maps-text"><b>Open all in Google Maps</b><small>{FOOD_TOUR.nameEn}: bubble tea, popcorn chicken and beer on one street</small></span>
            <span className="food-trail-maps-go" aria-hidden="true">↗</span>
          </a>
          <button className="food-trail-download" type="button" onClick={downloadList}><b>↓ Download my food map (HTML)</b><small>Save it to keep or share</small></button>
        </div>
        <p className="food-trail-note">Links open Google Maps searches for well-known places, not paid endorsements. Hours vary. <a href="https://www.travel.taipei/en/must-visit/tasterguide" target="_blank" rel="noopener noreferrer">Source: Taipei Travel ↗</a></p>
      </section>}
    </div>
  </dialog>
}

export default FoodTrail
