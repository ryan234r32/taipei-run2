export interface FoodSpot {
  nameEn: string
  nameZh: string
  mapsUrl: string
}

export interface FoodMetadata {
  kind: 0 | 1 | 2
  nameZh: string
  nameEn: string
  /** Short display name for tight sign layouts. */
  shortEn: string
  icon: string
  /** One-line descriptions, English first. */
  descriptionZh: string
  descriptionEn: string
  /** Well-known places to try it. These are Google Maps *searches* by place name, never made-up addresses. */
  spots: readonly FoodSpot[]
  mapsQuery: string
  mapsUrl: string
  sourceUrl: string
}

const mapsSearch = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
const spot = (nameEn: string, nameZh: string, query: string): FoodSpot => ({ nameEn, nameZh, mapsUrl: mapsSearch(query) })

const RAOHE = spot('Raohe Night Market', '饒河街觀光夜市', '饒河街觀光夜市 Raohe Street Night Market Taipei')

/** One Maps search that covers all three snacks: a single night market street. */
export const FOOD_TOUR = {
  nameEn: RAOHE.nameEn,
  nameZh: RAOHE.nameZh,
  mapsUrl: RAOHE.mapsUrl,
} as const

export const FOOD_GUIDE: readonly FoodMetadata[] = [
  {
    kind: 0, nameZh: '珍珠奶茶', nameEn: 'Bubble Tea', shortEn: 'Bubble Tea', icon: '🧋',
    descriptionEn: 'Born in Taiwan: sweet milk tea with chewy tapioca pearls.',
    descriptionZh: '台灣誕生的手搖飲代表，奶茶配上 Q 彈珍珠。',
    spots: [
      spot('Chun Shui Tang', '春水堂', 'Chun Shui Tang 春水堂 Taipei'),
      spot('Chen San Ding', '陳三鼎青蛙撞奶', '陳三鼎青蛙撞奶 公館 Taipei'),
    ],
    mapsQuery: '珍珠奶茶 饒河街觀光夜市 台北 Raohe Night Market Taipei Bubble tea',
    mapsUrl: mapsSearch('珍珠奶茶 饒河街觀光夜市 台北 Raohe Night Market Taipei Bubble tea'),
    sourceUrl: 'https://www.travel.taipei/en/must-visit/tasterguide',
  },
  {
    kind: 1, nameZh: '鹽酥雞', nameEn: 'Taiwanese Popcorn Chicken', shortEn: 'Popcorn Chicken', icon: '🍗',
    descriptionEn: 'Bite-size fried chicken with pepper salt and crispy basil. The late-night classic.',
    descriptionZh: '一口大小的炸雞，撒上胡椒鹽與九層塔，宵夜首選。',
    spots: [
      spot('Shilin Night Market', '士林夜市', '士林夜市 Shilin Night Market Taipei'),
      spot('Ningxia Night Market', '寧夏夜市', '寧夏夜市 Ningxia Night Market Taipei'),
    ],
    mapsQuery: '鹽酥雞 台北 Taiwanese popcorn chicken Taipei',
    mapsUrl: mapsSearch('鹽酥雞 台北 Taiwanese popcorn chicken Taipei'),
    sourceUrl: 'https://www.travel.taipei/en/must-visit/tasterguide',
  },
  {
    kind: 2, nameZh: '台灣啤酒', nameEn: 'Taiwan Beer', shortEn: 'Taiwan Beer', icon: '🍺',
    descriptionEn: 'The everyday lager of Taiwan, a classic with popcorn chicken and stir-fry.',
    descriptionZh: '台灣的國民啤酒，配鹽酥雞和熱炒剛剛好。',
    spots: [
      spot('Taipei Brewery', '台北啤酒工場', '台北啤酒工場 Taipei Brewery Taiwan Beer'),
      RAOHE,
    ],
    mapsQuery: '台北啤酒工場 Taipei Brewery Taiwan Beer',
    mapsUrl: mapsSearch('台北啤酒工場 Taipei Brewery Taiwan Beer'),
    sourceUrl: 'https://www.travel.taipei/en/attraction/details/1691',
  },
]

/** The game uses kind 0/1/2; missing, invalid and zero counts never become collected food. */
export function getCollectedFoods(counts: readonly number[]) {
  return FOOD_GUIDE.flatMap(food => {
    const value = counts[food.kind]
    const count = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
    return count > 0 ? [{ ...food, count }] : []
  })
}

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!))

/** Standalone, script-free export styled like the in-game night-market Food Map (awning, lanterns, stall signs). */
export function buildFoodTrailHtml(counts: readonly number[]) {
  const foods = getCollectedFoods(counts)
  const total = foods.reduce((sum, food) => sum + food.count, 0)
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const cards = foods.map((food, index) => `<article class="card t${food.kind}" style="--r:${[-8, 6, -5][index % 3]}deg"><div class="top"><div class="emoji">${food.icon}</div><div class="name"><h2>${escapeHtml(food.shortEn)}</h2><span lang="zh-Hant">${escapeHtml(food.nameZh)}</span></div><div class="stamp"><b>×${food.count}</b><span>TASTED</span></div></div><p class="desc">${escapeHtml(food.descriptionEn)}</p><div class="where"><div class="label">WHERE TO TRY</div>${food.spots.map(s => `<a href="${escapeHtml(s.mapsUrl)}" target="_blank" rel="noopener noreferrer"><span>📍 <b>${escapeHtml(s.nameEn)}</b></span><em>↗</em></a>`).join('')}</div></article>`).join('\n')
  const empty = '<p class="empty">No food yet. Run again!</p>'
  const lanterns = Array.from({ length: 12 }, (_, i) => `<i style="margin-top:${[2, 8, 14][i % 3]}px"></i>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Taipei Food Map</title><style>
@import url('https://fonts.googleapis.com/css2?family=Bungee&family=Noto+Sans+TC:wght@500;700;900&display=swap');
:root{--red:#d7261e;--gold:#ffcf4a;--cream:#fff3d6;--navy:#12193a;--teal:#35d0c8;--ol:#1c0d08;--brown:#3a1608;--notch:-4px 0 0 var(--ol),4px 0 0 var(--ol),0 -4px 0 var(--ol),0 4px 0 var(--ol);--glow:0 0 34px 6px #ffb02e66;--display:'Bungee','Arial Black',Impact,sans-serif}
*{box-sizing:border-box}body{margin:0;padding:0 0 40px;color:var(--cream);font-family:'Noto Sans TC','PingFang TC',system-ui,Arial,sans-serif;font-weight:700;line-height:1.5;background:radial-gradient(circle at 50% 0,#3a2a5a 0,#12193a 45%,#2a1008 100%) fixed}
[lang=zh-Hant]{font-weight:700}
.awning{height:36px;background:repeating-linear-gradient(90deg,var(--red) 0 44px,var(--cream) 44px 88px);border-bottom:4px solid var(--ol);box-shadow:0 6px 22px #000a;position:relative}
.awning::after{content:'';position:absolute;left:0;right:0;top:calc(100% + 4px);height:10px;background:inherit;-webkit-mask:repeating-linear-gradient(90deg,#000 0 36px,transparent 36px 44px);mask:repeating-linear-gradient(90deg,#000 0 36px,transparent 36px 44px)}
.lanterns{display:flex;justify-content:space-around;height:48px;margin-top:13px;padding:0 18px}
.lanterns i{position:relative;display:block;width:20px;height:26px;border-radius:44%;background:radial-gradient(circle at 35% 28%,#ff8a66,var(--red) 55%,#8f120d);box-shadow:0 0 16px 5px #ff8a2a99,inset 0 -4px 0 #00000033}
.lanterns i::before{content:'';position:absolute;left:50%;bottom:100%;width:2px;height:14px;margin-left:-1px;background:var(--ol)}.lanterns i::after{content:'';position:absolute;left:5px;right:5px;top:-3px;height:5px;background:var(--gold)}
main{max-width:1160px;margin:0 auto;padding:0 20px}
header{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin:6px 0 12px}
h1{display:flex;flex-wrap:wrap;gap:10px;margin:0}
h1 .en{padding:9px 20px;background:var(--red);color:var(--cream);font:400 clamp(22px,4vw,34px)/1.15 var(--display);box-shadow:var(--notch),var(--glow),inset 0 4px 0 #ffffff33;text-shadow:0 0 14px #ffb02e}
.total{display:flex;flex-direction:column;align-items:center;justify-content:center;width:104px;height:84px;background:var(--cream);color:var(--red);box-shadow:var(--notch),var(--glow);transform:rotate(-4deg);line-height:1}.total b{font:400 36px/1 var(--display)}.total span{margin-top:3px;font:400 8px/1 var(--display);letter-spacing:1px;color:var(--navy)}
.sub{margin:0 0 22px;color:var(--cream);font-size:14px;text-shadow:0 2px 6px #000}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:26px}
.card{padding:16px 17px 15px;box-shadow:var(--notch),0 0 34px 6px #ffb02e55,inset 0 5px 0 #ffffff55,inset 0 -6px 0 #00000022;background:var(--bg);color:var(--fg);display:flex;flex-direction:column}
.t0{--bg:#fffaf0;--fg:#14275e;--fg2:#3b4d80;--ac:#d7261e;--pbg:#14275e14;--pbd:#14275e;--rule:#14275e44}
.t1{--bg:#d7261e;--fg:#fff3d6;--fg2:#ffe9c9;--ac:#ffcf4a;--pbg:#00000030;--pbd:#fff3d6;--rule:#fff3d666}
.t2{--bg:#ffcf4a;--fg:#3a1608;--fg2:#62401c;--ac:#b3150f;--pbg:#3a160818;--pbd:#3a1608;--rule:#3a160855}
.top{display:flex;align-items:center;gap:12px}.emoji{flex:none;display:grid;place-items:center;width:78px;height:78px;border-radius:50%;background:radial-gradient(circle,#fffbe8 0,#ffe27a 30%,#ffb02ecc 58%,transparent 74%);font-size:50px;line-height:1;filter:drop-shadow(0 3px 0 #0003)}
.name{flex:1;min-width:0}h2{margin:0;font:400 20px/1.15 var(--display)}.name span{display:block;margin-top:3px;font-size:16px;line-height:1.2;opacity:.85}
.stamp{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:70px;height:70px;border-radius:50%;border:3px solid var(--red);background:var(--cream);color:var(--red);box-shadow:inset 0 0 0 3px var(--cream),inset 0 0 0 4.5px var(--red),0 3px 0 #0003;transform:rotate(var(--r));line-height:1}.stamp b{font:400 24px/1 var(--display)}.stamp span{margin-top:3px;font:400 7px/1 var(--display);letter-spacing:1px}
.desc{margin:12px 0 14px;font-size:15px;line-height:1.5}
.where{margin-top:auto;padding-top:8px;border-top:2px dashed var(--rule)}.label{margin:8px 0 6px;font:400 11.5px/1 var(--display);letter-spacing:1px;color:var(--ac)}.t0 .label{color:#14275e}
.where a{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding:8px 11px;background:var(--pbg);border:2px solid var(--pbd);color:var(--fg);font-size:14px;text-decoration:none}.where a:hover{background:#ffffff55}.where a em{font-style:normal;font-weight:900}
.cta{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:30px;padding:16px 20px;background:var(--gold);color:var(--brown);text-align:center;text-decoration:none;box-shadow:var(--notch),0 0 40px 8px #ffcf4acc,inset 0 5px 0 #ffffff66,inset 0 -6px 0 #00000026}.cta b{font:400 22px/1.15 var(--display)}.cta span{font-size:13px}
.empty{padding:34px;background:var(--red);color:var(--cream);text-align:center;font:400 28px/1.3 var(--display);box-shadow:var(--notch),var(--glow)}
footer{margin-top:20px;padding:8px 12px;background:#12193acc;color:#e9ddc0;font-size:12px}footer a{color:var(--gold)}
@media print{body{background:#fff}}
</style></head><body>
<div class="awning"></div><div class="lanterns" aria-hidden="true">${lanterns}</div>
<main>
<header><h1><span class="en">YOUR TAIPEI FOOD MAP</span></h1>${foods.length ? `<div class="total" aria-label="${total} foods eaten"><b>${total}</b><span>FOODS EATEN</span></div>` : ''}</header>
<p class="sub">Stamped ${escapeHtml(date)}. Every snack you ate on the run. Now go taste it for real!</p>
${foods.length ? `<section class="cards">${cards}</section>` : empty}
<a class="cta" href="${escapeHtml(FOOD_TOUR.mapsUrl)}" target="_blank" rel="noopener noreferrer"><b>Open all in Google Maps</b><span>${escapeHtml(FOOD_TOUR.nameEn)}: bubble tea, popcorn chicken and beer on one street</span></a>
<footer>Links open Google Maps searches for well-known places; they are not paid endorsements, and opening hours vary. This is a downloadable HTML file, not a Google saved list.<br>Culture notes: <a href="https://www.travel.taipei/en/must-visit/tasterguide" target="_blank" rel="noopener noreferrer">Taipei Travel</a>.</footer>
</main></body></html>`
}
