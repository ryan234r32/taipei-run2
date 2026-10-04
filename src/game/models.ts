import * as T from 'three'
import type { ArtStyle } from './rules'

export class Models {
  private materials = new Map<string, T.Material>()
  private geometries = new Map<string, T.BufferGeometry>()
  textures: T.Texture[] = []
  private texCache = new Map<string, T.Texture>()
  style: ArtStyle
  constructor(style: ArtStyle) { this.style = style }
  material(color: T.ColorRepresentation, glow = false, metal = false) {
    const key = `${color}-${glow}-${metal}`
    if (!this.materials.has(key)) {
      const options = { color, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 1.4 : 0 }
      this.materials.set(key, this.style === 'toon' && !metal ? glow ? new T.MeshBasicMaterial({ color, toneMapped: false }) : new T.MeshToonMaterial(options) :
        new T.MeshStandardMaterial({ ...options, roughness: metal ? .28 : this.style === 'cinema' ? .72 : .92, metalness: metal ? .6 : 0, flatShading: this.style === 'arcade' }))
    }
    return this.materials.get(key)!
  }
  mesh(parent: T.Object3D, geometry: T.BufferGeometry, color: T.ColorRepresentation, x: number, y: number, z: number, glow = false, metal = false) {
    const m = new T.Mesh(geometry, this.material(color, glow, metal)); m.position.set(x, y, z)
    m.castShadow = !glow; m.receiveShadow = true; parent.add(m); return m
  }
  box(p: T.Object3D, w: number, h: number, d: number, c: T.ColorRepresentation, x = 0, y = 0, z = 0, glow = false, metal = false) {
    const key = `b-${w}-${h}-${d}`
    if (!this.geometries.has(key)) this.geometries.set(key, new T.BoxGeometry(w, h, d))
    return this.mesh(p, this.geometries.get(key)!, c, x, y, z, glow, metal)
  }
  sphere(p: T.Object3D, r: number, c: T.ColorRepresentation, x = 0, y = 0, z = 0, sy = 1, glow = false) {
    const key = `s-${r}`
    if (!this.geometries.has(key)) this.geometries.set(key, new T.SphereGeometry(r, this.style === 'arcade' ? 8 : 16, 10))
    const m = this.mesh(p, this.geometries.get(key)!, c, x, y, z, glow); m.scale.y = sy; return m
  }
  cylinder(p: T.Object3D, rt: number, rb: number, h: number, c: T.ColorRepresentation, x = 0, y = 0, z = 0, glow = false) {
    const key = `c-${rt}-${rb}-${h}`
    if (!this.geometries.has(key)) this.geometries.set(key, new T.CylinderGeometry(rt, rb, h, this.style === 'arcade' ? 8 : 16))
    return this.mesh(p, this.geometries.get(key)!, c, x, y, z, glow)
  }
  bar(p: T.Object3D, a: T.Vector3, b: T.Vector3, r: number, c: T.ColorRepresentation) {
    const m = this.cylinder(p, r, r, a.distanceTo(b), c)
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    return m
  }
  text(p: T.Object3D, text: string, w: number, h: number, color: string, bg: string, x: number, y: number, z: number, vertical = false) {
    // The engine builds the market gateway with this exact string; dress it up as a temple gate + Taipei skyline.
    if (text === '饒 河 夜 市') return this.gateSign(p, x, y, z)
    const cacheKey = `text-${text}-${w}-${h}-${color}-${bg}-${vertical}`
    if (this.materials.has(cacheKey)) {
      const mesh = new T.Mesh(this.geometries.get(cacheKey)!, this.materials.get(cacheKey)!)
      mesh.position.set(x, y, z); p.add(mesh); return mesh
    }
    const canvas = document.createElement('canvas'); canvas.width = vertical ? 128 : 512; canvas.height = vertical ? 512 : 128
    const c = canvas.getContext('2d')!; c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height)
    if (this.style === 'toon') {
      c.strokeStyle = color; c.lineWidth = 4; c.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)
    }
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.font = `800 ${vertical ? 88 : 74}px "PingFang TC", sans-serif`
    if (vertical) [...text].forEach((letter, i) => c.fillText(letter, 64, 64 + i * 120))
    else c.fillText(text, 256, 64, 475)
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; this.textures.push(texture)
    const geometry = new T.PlaneGeometry(w, h); this.geometries.set(cacheKey, geometry)
    const mat = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide, toneMapped: this.style !== 'toon' }); this.materials.set(cacheKey, mat)
    const mesh = new T.Mesh(geometry, mat); mesh.position.set(x, y, z); p.add(mesh); return mesh
  }
  lantern(p: T.Object3D, x: number, y: number, z: number) {
    if (this.style === 'toon') {
      this.box(p, .5, .68, .5, '#ff3a20', x, y, z, true)
      this.box(p, .6, .44, .6, '#ff5a2c', x, y, z, true)
      this.box(p, .36, .06, .36, '#ffd45e', x, y + .37, z, true)
      this.box(p, .36, .06, .36, '#ffd45e', x, y - .37, z, true)
      this.box(p, .04, .28, .04, '#ffcf5e', x, y - .53, z, true)
      return
    }
    this.sphere(p, .31, '#ee5534', x, y, z, 1.28, true)
    this.cylinder(p, .15, .15, .07, '#f6cb7d', x, y + .4, z)
    this.cylinder(p, .15, .15, .07, '#f6cb7d', x, y - .4, z)
    this.cylinder(p, .024, .024, .28, '#e6b253', x, y - .56, z)
  }
  // ---- cached helpers: canvas textures, glass, toon outline hulls, glow sprites, instanced clusters ----
  private canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
    let t = this.texCache.get(key)
    if (!t) {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      draw(canvas.getContext('2d')!)
      t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8
      if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]) }
      this.texCache.set(key, t); this.textures.push(t)
    }
    return t
  }
  private mapMat(key: string, map: T.Texture, basic = false) {
    const k = `map-${key}-${basic}`
    if (!this.materials.has(k)) this.materials.set(k, basic ? new T.MeshBasicMaterial({ map, toneMapped: false }) : this.style === 'toon' ? new T.MeshToonMaterial({ map }) : new T.MeshStandardMaterial({ map, roughness: .9 }))
    return this.materials.get(k)!
  }
  private glass(color: T.ColorRepresentation, opacity: number) {
    const key = `glass-${color}-${opacity}`
    if (!this.materials.has(key)) {
      const o = { color, transparent: true, opacity, depthWrite: false }
      this.materials.set(key, this.style === 'toon' ? new T.MeshToonMaterial(o) : new T.MeshStandardMaterial({ ...o, roughness: .2 }))
    }
    return this.materials.get(key)!
  }
  private glowPlane(color: T.ColorRepresentation, opacity: number) {
    const key = `gp-${color}-${opacity}`
    if (!this.materials.has(key)) this.materials.set(key, new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending }))
    return this.materials.get(key)!
  }
  private cyl(p: T.Object3D, rt: number, rb: number, h: number, mat: T.Material, x: number, y: number, z: number, seg = 20, open = false) {
    const key = `cg-${rt}-${rb}-${h}-${seg}-${open}`
    if (!this.geometries.has(key)) this.geometries.set(key, new T.CylinderGeometry(rt, rb, h, seg, 1, open))
    const m = new T.Mesh(this.geometries.get(key)!, mat); m.position.set(x, y, z); p.add(m); return m
  }
  private hull(p: T.Object3D, rt: number, rb: number, h: number, x: number, y: number, z: number, o = .028) {
    if (!this.materials.has('ink')) this.materials.set('ink', new T.MeshBasicMaterial({ color: '#2a1713', side: T.BackSide }))
    const key = `hull-${rt}-${rb}-${h}-${o}`
    if (!this.geometries.has(key)) this.geometries.set(key, new T.CylinderGeometry(rt + o, rb + o, h + o * 2, 20))
    const m = new T.Mesh(this.geometries.get(key)!, this.materials.get('ink')!); m.position.set(x, y, z); p.add(m); return m
  }
  private halo(color: string, size: number, opacity = .8) {
    const map = this.canvasTex('halo', 128, 128, c => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(.65, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g; c.fillRect(0, 0, 128, 128)
    })
    const key = `halo-${color}-${opacity}`
    if (!this.materials.has(key)) this.materials.set(key, new T.SpriteMaterial({ map, color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }))
    const s = new T.Sprite(this.materials.get(key) as T.SpriteMaterial); s.scale.setScalar(size); return s
  }
  private cluster(p: T.Object3D, mat: T.Material, items: { p: number[]; s: number[]; r?: number[]; c?: string }[]) {
    if (!this.geometries.has('unit-sphere')) this.geometries.set('unit-sphere', new T.SphereGeometry(1, 12, 8))
    const m = new T.InstancedMesh(this.geometries.get('unit-sphere')!, mat, items.length), d = new T.Object3D(), c = new T.Color()
    items.forEach((it, i) => {
      d.position.set(it.p[0], it.p[1], it.p[2]); d.scale.set(it.s[0], it.s[1], it.s[2]); d.rotation.set(it.r?.[0] ?? 0, it.r?.[1] ?? 0, it.r?.[2] ?? 0); d.updateMatrix()
      m.setMatrixAt(i, d.matrix); if (it.c) m.setColorAt(i, c.set(it.c))
    })
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); m.castShadow = false; p.add(m); return m
  }
  // Aspect-correct canvas sign (horizontal or vertical stacked CJK), optional bubble-tea icon.
  private labelTex(text: string, w: number, h: number, fg: string, bg: string, icon = false, vertical = false) {
    const key = `lbl-${text}-${w}-${h}-${fg}-${bg}-${icon}-${vertical}`
    const W = vertical ? 128 : Math.min(1024, Math.round(128 * w / h)), H = vertical ? Math.min(1024, Math.round(128 * h / w)) : 128
    return this.canvasTex(key, W, H, c => {
      c.fillStyle = bg; c.fillRect(0, 0, W, H)
      const lw = Math.max(4, Math.min(W, H) * .06); c.strokeStyle = fg; c.lineWidth = lw; c.strokeRect(lw / 2 + 1, lw / 2 + 1, W - lw - 2, H - lw - 2)
      c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'
      const font = (s: number) => `800 ${s}px "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif`
      if (vertical) {
        const chars = [...text], step = Math.min(H / (chars.length + (icon ? 1.4 : 0)), W * 1.1), size = Math.min(W * .74, step * .92); c.font = font(size)
        const top = icon ? (H - step * chars.length - W * .9) / 2 : (H - step * chars.length) / 2
        chars.forEach((ch, i) => c.fillText(ch, W / 2, top + step * (i + .5)))
        if (icon) this.drawTea(c, W / 2, H - W * .55, W * .8)
      } else {
        const left = icon ? H * .95 : 0; let size = H * .66; c.font = font(size)
        const avail = W - left - H * .3, mw = c.measureText(text).width; if (mw > avail) { size *= avail / mw; c.font = font(size) }
        c.fillText(text, left + (W - left) / 2, H / 2 + size * .04)
        if (icon) this.drawTea(c, H * .55, H * .5, H * .8)
      }
    })
  }
  private drawTea(c: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    c.strokeStyle = '#ff4fa0'; c.lineWidth = s * .1; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx + s * .04, cy - s * .12); c.lineTo(cx + s * .16, cy - s * .5); c.stroke()
    c.fillStyle = '#e3a865'; c.strokeStyle = '#3a2418'; c.lineWidth = s * .05; c.beginPath()
    c.moveTo(cx - s * .28, cy - s * .15); c.lineTo(cx + s * .28, cy - s * .15); c.lineTo(cx + s * .19, cy + s * .46); c.lineTo(cx - s * .19, cy + s * .46); c.closePath(); c.fill(); c.stroke()
    c.fillStyle = '#fff'; c.fillRect(cx - s * .31, cy - s * .25, s * .62, s * .1); c.strokeRect(cx - s * .31, cy - s * .25, s * .62, s * .1)
    c.fillStyle = '#2a1618'; for (const [dx, dy] of [[-.1, .36], [.02, .38], [.12, .35], [-.04, .26], [.08, .24]]) { c.beginPath(); c.arc(cx + dx * s, cy + dy * s, s * .05, 0, 7); c.fill() }
  }
  private label(text: string, w: number, h: number, fg: string, bg: string, icon = false, vertical = false) {
    const gk = `plane-${w}-${h}`; if (!this.geometries.has(gk)) this.geometries.set(gk, new T.PlaneGeometry(w, h))
    const mk = `lm-${text}-${w}-${h}-${fg}-${bg}-${icon}-${vertical}`
    if (!this.materials.has(mk)) this.materials.set(mk, new T.MeshBasicMaterial({ map: this.labelTex(text, w, h, fg, bg, icon, vertical), side: T.DoubleSide, toneMapped: false }))
    return new T.Mesh(this.geometries.get(gk)!, this.materials.get(mk)!)
  }
  private sign(p: T.Object3D, text: string, w: number, h: number, fg: string, bg: string, x: number, y: number, z: number, o: { icon?: boolean; vertical?: boolean; ry?: number } = {}) {
    const m = this.label(text, w, h, fg, bg, o.icon, o.vertical); m.position.set(x, y, z); m.rotation.y = o.ry ?? 0; p.add(m); return m
  }
  // Label wrapped around a (tapered) cup/can; front and back so it reads while the pickup spins.
  private wrap(p: T.Object3D, text: string, arcLen: number, rt: number, rb: number, h: number, fg: string, bg: string, y: number) {
    const arc = arcLen / ((rt + rb) / 2), gk = `wrap-${rt}-${rb}-${h}-${arc}`
    if (!this.geometries.has(gk)) this.geometries.set(gk, new T.CylinderGeometry(rt, rb, h, 12, 1, true, -arc / 2, arc))
    const mk = `wm-${text}-${arcLen}-${h}-${fg}-${bg}`
    if (!this.materials.has(mk)) this.materials.set(mk, new T.MeshBasicMaterial({ map: this.labelTex(text, arcLen, h, fg, bg), toneMapped: false }))
    for (const ry of [0, Math.PI]) { const m = new T.Mesh(this.geometries.get(gk)!, this.materials.get(mk)!); m.position.y = y; m.rotation.y = ry; p.add(m) }
  }
  food(kind = 0, giant = false, lite = false) {
    const g = new T.Group()
    if (kind === 0) this.bubbleTea(g, lite)
    else if (kind === 1) this.chickenCup(g, lite)
    else this.beerCan(g, lite)
    if (!lite) { const h = this.halo(['#ffc27a', '#ffb23a', '#7dffa8'][kind] ?? '#ffc27a', giant ? 2.4 : 3.1, .85); h.position.y = .1; g.add(h) }
    if (giant) g.scale.setScalar(3)
    return g
  }
  private bubbleTea(g: T.Group, lite: boolean) {
    const tea = this.material('#d79a58', true), cream = this.material('#f6dfb6', true)
    if (!lite) this.hull(g, .37, .26, .95, 0, -.025, 0)
    this.cyl(g, .345, .245, .8, tea, 0, -.07, 0)
    this.cyl(g, .352, .346, .06, cream, 0, .36, 0)
    const pearls: { p: number[]; s: number[] }[] = []
    const ring = (y: number, r: number, n: number, off: number) => { for (let i = 0; i < n; i++) pearls.push({ p: [Math.sin(i * 6.283 / n + off) * r, y, Math.cos(i * 6.283 / n + off) * r], s: [.08, .08, .08] }) }
    ring(-.39, .14, 5, 0); pearls.push({ p: [0, -.39, 0], s: [.08, .08, .08] }); ring(-.255, .17, 5, .6); pearls.push({ p: [0, -.255, .02], s: [.08, .08, .08] }); ring(-.12, .19, 4, .3)
    this.cluster(g, this.material('#2a1618'), pearls)
    this.cyl(g, .37, .26, .95, this.glass('#f4fbff', .3), 0, -.025, 0)
    this.cyl(g, .395, .385, .07, this.material('#f6f1ec'), 0, .445, 0)
    this.cyl(g, .37, .37, .015, this.glass('#ffd6e8', .7), 0, .48, 0)
    const straw = this.cyl(g, .065, .065, 1.05, this.material('#ff4f9a', true), .06, .32, 0, 12); straw.rotation.z = -.14
    if (!lite) this.wrap(g, '珍奶', .5, .345, .315, .24, '#7a3b1c', '#fff1d6', .02)
  }
  private chickenCup(g: T.Group, lite: boolean) {
    const checker = this.mapMat('checker', this.canvasTex('checker', 128, 128, c => {
      c.fillStyle = '#fff6e6'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#e3342b'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64)
    }, [4, 1.5]))
    if (!lite) this.hull(g, .4, .28, .72, 0, -.24, 0)
    this.cyl(g, .4, .28, .72, checker, 0, -.24, 0)
    this.cyl(g, .415, .405, .05, this.material('#d52c24'), 0, .12, 0)
    const cols = ['#f0b043', '#e29a2e', '#cf8120', '#f5c35a'], n: { p: number[]; s: number[]; r?: number[]; c?: string }[] = []
    for (let i = 0; i < 7; i++) { const a = i * 6.283 / 7; n.push({ p: [Math.sin(a) * .27, .17, Math.cos(a) * .27], s: [.17, .13, .15], r: [i * .7, i * 1.3, i * .4], c: cols[i % 4] }) }
    for (let i = 0; i < 5; i++) { const a = i * 6.283 / 5 + .4; n.push({ p: [Math.sin(a) * .14, .32, Math.cos(a) * .14], s: [.17, .14, .16], r: [i, i * .9, i * 1.7], c: cols[(i + 1) % 4] }) }
    n.push({ p: [.05, .46, .02], s: [.16, .13, .15], c: cols[0] }, { p: [-.08, .44, -.06], s: [.15, .12, .14], c: cols[3] }, { p: [0, .14, .39], s: [.16, .13, .15], c: cols[1] }, { p: [-.3, .1, .3], s: [.14, .12, .13], c: cols[2] })
    n.push({ p: [.1, .52, .1], s: [.13, .025, .09], r: [.2, .5, .3], c: '#3aa845' }, { p: [-.15, .42, .2], s: [.12, .025, .08], r: [.4, 1.1, -.3], c: '#2f9a3d' }, { p: [.2, .32, .26], s: [.11, .025, .08], r: [-.3, .2, .5], c: '#4cb552' })
    this.cluster(g, this.material('#ffffff'), n)
    const sk = this.cyl(g, .018, .018, .95, this.material('#e6c98a'), .16, .55, -.02, 6); sk.rotation.z = -.32
    if (!lite) this.wrap(g, '鹽酥雞', .55, .365, .325, .26, '#c42a1c', '#fff6e6', -.25)
  }
  private beerCan(g: T.Group, lite: boolean) {
    const silver = this.material('#dfe5e0')
    if (!lite) this.hull(g, .28, .28, 1.08, 0, -.02, 0, .03)
    this.cyl(g, .28, .28, 1, this.material('#17984a'), 0, -.02, 0)
    this.cyl(g, .287, .287, .4, this.material('#f6f0dc'), 0, 0, 0)
    for (const y of [.215, -.215]) this.cyl(g, .289, .289, .045, this.material('#f0b929'), 0, y, 0)
    this.cyl(g, .215, .28, .08, silver, 0, .5, 0); this.cyl(g, .225, .225, .04, silver, 0, .56, 0); this.cyl(g, .25, .28, .05, silver, 0, -.545, 0)
    this.box(g, .14, .02, .08, '#bcc4bf', 0, .585, 0)
    if (!lite) this.wrap(g, '台啤', .5, .292, .292, .34, '#13813f', '#f6f0dc', 0)
  }
  // ---- gateway dressing + distant Taipei 101 skyline (hooked from text('饒 河 夜 市')) ----
  private skyMat(color: string) {
    const key = `sky-${color}`
    if (!this.materials.has(key)) this.materials.set(key, new T.MeshBasicMaterial({ color, fog: false, toneMapped: false }))
    return this.materials.get(key)!
  }
  private gateSign(p: T.Object3D, x: number, y: number, z: number) {
    const sign = this.sign(p, '饒河街觀光夜市', 7.6, .95, '#ffe27a', '#8e1d18', x, y, z)
    const gold = '#f4c242'
    this.box(p, 8.9, .1, .75, gold, 0, 6.68, -96, true); this.box(p, 8.9, .1, .75, gold, 0, 5.52, -96, true)
    for (const px of [-4.1, 4.1]) for (const py of [.9, 3.6, 6.4]) this.cyl(p, .37, .37, .16, this.material(gold, true), px, py, -96)
    for (const px of [-4.1, 4.1]) this.box(p, .7, 5.2, .1, '#c8321f', px > 0 ? 3.3 : -3.3, 3.0, -95.55, true)
    for (const [lx, ly, s] of [[-3.2, 4.8, 2.2], [3.2, 4.8, 2.2], [-1.6, 5.0, 1.5], [1.6, 5.0, 1.5]]) { const L = new T.Group(); this.lantern(L, 0, 0, 0); L.scale.setScalar(s); L.position.set(lx, ly, -95.4); p.add(L) }
    for (const sx of [-1, 1]) { this.box(p, 1.6, .24, 3, gold, sx * 5.3, 7.2, -96, true).rotation.z = sx * .38; this.box(p, .5, .5, .5, '#d8341f', sx * 1.6, 7.45, -96, true) }
    this.sphere(p, .32, gold, 0, 9.55, -96, 1, true)
    this.taipei101(p, 0, -200)
    return sign
  }
  private taipei101(parent: T.Object3D, x: number, z: number) {
    const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(.88)
    const teal = this.skyMat('#3fcfae'), band = this.skyMat('#d6fff3'), deep = this.skyMat('#1d8a76')
    const sq = (wt: number, wb: number, h: number, mat: T.Material, y: number) => {
      const key = `sq-${wt}-${wb}-${h}`; if (!this.geometries.has(key)) this.geometries.set(key, new T.CylinderGeometry(wt * .7071, wb * .7071, h, 4))
      const m = new T.Mesh(this.geometries.get(key)!, mat); m.position.y = y; m.rotation.y = Math.PI / 4; g.add(m)
    }
    sq(30, 34, 6, deep, 3); sq(22, 26, 5, deep, 8.5)
    for (let i = 0; i < 8; i++) { const y0 = 11 + i * 8.2; sq(15.5, 11.5, 7.4, teal, y0 + 3.7); sq(15.9, 15.9, .8, band, y0 + 7.8) }
    sq(8, 13, 6.5, teal, 79.9); sq(.8, 3.2, 12, band, 89); sq(.2, .6, 8, band, 98)
    const tip = new T.Mesh(new T.SphereGeometry(.9, 8, 6), this.skyMat('#ff3b30')); tip.position.y = 102.5; g.add(tip); this.geometries.set('tip101', tip.geometry)
    // city lights: dark towers dotted with warm windows (one instanced draw)
    const rnd = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s) }
    const bg = this.skyMat('#233f4b'), boxGeo = new T.BoxGeometry(1, 1, 1), winCols = ['#ffd27a', '#ffe9a8', '#ff9d57', '#9fe8ff']
    this.geometries.set('sky-box', boxGeo)
    const wins: { p: number[]; s: number[]; c?: string }[] = []
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1, bx = side * (16 + rnd(i) * 110), w = 9 + rnd(i + 1) * 9, h = 14 + rnd(i + 2) * 36, bz = -8 - rnd(i + 3) * 12
      const b = new T.Mesh(boxGeo, bg); b.scale.set(w, h, 9); b.position.set((bx - x) / .88, h / 2, bz); g.add(b)
      for (let wy = 3; wy < h - 2; wy += 3.4) for (let wx = -w / 2 + 1.6; wx < w / 2 - 1; wx += 2.6) if (rnd(i * 31 + wy * 7 + wx * 3) > .42) wins.push({ p: [(bx - x) / .88 + wx, wy, bz + 4.6], s: [.5, .6, .1], c: winCols[Math.floor(rnd(wx + wy + i) * 4)] })
    }
    const winGeo = new T.BoxGeometry(2.6, 3, .5); this.geometries.set('sky-win', winGeo)
    const im = new T.InstancedMesh(winGeo, this.skyMat('#ffffff'), wins.length), d = new T.Object3D(), c = new T.Color()
    wins.forEach((w, i) => { d.position.set(w.p[0], w.p[1], w.p[2]); d.scale.set(w.s[0], w.s[1], w.s[2]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.set(w.c!)) })
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.frustumCulled = false; g.add(im)
    parent.add(g)
  }
  // Grey stone road tiles with warm lantern reflections, one plane per street block (left side only).
  private roadTiles(g: T.Group) {
    const map = this.canvasTex('road', 512, 640, c => {
      const pal = ['#7d8a93', '#74838c', '#84909a', '#6e7c86'], rnd = (n: number) => { const s = Math.sin(n * 91.7) * 43758.5; return s - Math.floor(s) }
      for (let r = 0; r < 10; r++) for (let q = 0; q < 8; q++) { c.fillStyle = pal[Math.floor(rnd(r * 8 + q) * 4)]; c.fillRect(q * 64, r * 64, 64, 64) }
      for (const [x, y, rad, a] of [[40, 80, 90, .42], [472, 80, 90, .42], [40, 400, 100, .4], [472, 400, 100, .4], [256, 250, 110, .3], [160, 560, 70, .25], [352, 560, 70, .25]]) {
        const gr = c.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(255,196,96,${a})`); gr.addColorStop(1, 'rgba(255,196,96,0)'); c.fillStyle = gr; c.fillRect(0, 0, 512, 640)
      }
      c.strokeStyle = 'rgba(40,48,58,.75)'; c.lineWidth = 3
      for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, 640); c.stroke() }
      for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(0, i * 64); c.lineTo(512, i * 64); c.stroke() }
    })
    if (!this.geometries.has('road-tiles')) this.geometries.set('road-tiles', new T.PlaneGeometry(8.8, 12))
    const m = new T.Mesh(this.geometries.get('road-tiles')!, this.mapMat('road', map)); m.rotation.x = -Math.PI / 2; m.position.y = -.02; m.receiveShadow = true; g.add(m)
  }
  person(coach = false) {
    if (this.style === 'toon') return this.toonPerson(coach)
    const root = new T.Group(), body = new T.Group(); root.add(body)
    const shirt = coach ? '#ec542f' : '#cef05c', pants = coach ? '#223344' : '#283e51', skin = '#edb891'
    this.cylinder(body, coach ? .42 : .27, .3, .72, shirt, 0, 1.26, 0)
    this.box(body, .58, .17, .34, pants, 0, .82, 0)
    this.sphere(body, .32, skin, 0, 1.97, -.015)
    this.sphere(body, .33, '#253239', 0, 2.09, .02, .62)
    this.box(body, .52, .065, .46, coach ? '#e64126' : '#efefdf', 0, 2.16, -.05)
    this.box(body, .43, .04, .29, coach ? '#e64126' : '#efefdf', 0, 2.14, -.33)
    for (const x of [-.105, .105]) this.sphere(body, .03, '#172a31', x, 1.99, -.30)
    this.box(body, .12, .025, .02, '#64473a', 0, 1.85, -.33)
    this.box(body, coach ? .24 : .30, .38, .035, coach ? '#fff1ce' : '#94b441', 0, 1.3, .31)
    const arms: T.Group[] = [], legs: T.Group[] = []
    for (const side of [-1, 1]) {
      const arm = new T.Group(); arm.position.set(side * (coach ? .48 : .35), 1.55, 0); body.add(arm)
      this.cylinder(arm, coach ? .17 : .1, .09, .47, skin, 0, -.23, 0)
      this.cylinder(arm, coach ? .18 : .13, .13, .19, shirt, 0, -.09, 0)
      this.sphere(arm, .115, skin, 0, -.49, -.04); arms.push(arm)
      const leg = new T.Group(); leg.position.set(side * .18, .83, 0); body.add(leg)
      this.cylinder(leg, .12, .09, .62, pants, 0, -.3, 0)
      this.box(leg, .24, .15, .4, '#f0efda', 0, -.66, -.09); legs.push(leg)
    }
    if (coach) {
      this.cylinder(body, .08, .08, .06, '#d8ccad', .16, 1.23, -.31).rotation.x = Math.PI / 2
      this.box(body, .12, .17, .04, '#293944', -.16, 1.18, -.32)
    }
    root.userData = { body, arms, legs }; if (coach) root.scale.setScalar(1.12)
    return root
  }
  private toonPerson(coach: boolean) {
    const root = new T.Group(), body = new T.Group(); root.add(body)
    const shirt = coach ? '#fa7629' : '#adf23e', pants = '#293d45', skin = '#efb987', hair = '#3d2a25'
    const round = (p: T.Object3D, r: number, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const mesh = this.sphere(p, r, color, x, y, z); mesh.scale.set(sx, sy, sz); return mesh
    }
    // Soft character silhouettes against a deliberately blocky street.
    round(body, .4, shirt, 0, 1.24, 0, coach ? 1.6 : .85, coach ? 1.15 : .95, .73)
    this.cylinder(body, coach ? .45 : .26, coach ? .39 : .24, .16, shirt, 0, .94, 0)
    round(body, .31, pants, 0, .84, .025, coach ? 1.4 : .9, .5, .8)
    this.cylinder(body, .11, .12, .16, skin, 0, 1.69, 0)
    round(body, coach ? .37 : .405, skin, 0, 2.02, -.01, 1, coach ? .98 : 1.05, .88)
    for (const side of [-1, 1]) round(body, .085, skin, side * (coach ? .36 : .39), 1.99, .01, .7, 1, 1)
    round(body, coach ? .38 : .415, hair, 0, 2.19, .08, 1, .68, .86)
    for (const side of [-1, 1]) round(body, .16, hair, side * .25, 2.2, .13, .75, 1, 1)
    for (const x of [-.11, .11]) round(body, .034, '#25282b', x, 2.04, -.33, .75, 1.15, .4)
    round(body, .047, skin, 0, 1.96, -.355, .8, .7, .8)
    this.box(body, .105, .017, .015, '#774133', 0, 1.88, -.345)
    let ponyTail: T.Group | undefined
    if (coach) {
      this.cylinder(body, .385, .385, .087, '#fff5df', 0, 2.18, .06)
      for (const x of [-.11, .11]) this.box(body, .09, .025, .025, hair, x, 2.105, -.332).rotation.z = x < 0 ? -.18 : .18
      // White dumbbell mark is readable from the chase camera.
      this.box(body, .42, .065, .027, '#fff8dd', 0, 1.34, .303)
      for (const x of [-.2, .2]) this.box(body, .07, .25, .03, '#fff8dd', x, 1.34, .31)
      for (const x of [-.31, .31]) this.box(body, .035, .21, .028, '#fff8dd', x, 1.34, .285)
      this.bar(body, new T.Vector3(-.09, 1.62, -.28), new T.Vector3(0, 1.3, -.32), .012, '#343c43')
      this.bar(body, new T.Vector3(.09, 1.62, -.28), new T.Vector3(0, 1.3, -.32), .012, '#343c43')
      this.cylinder(body, .055, .055, .08, '#ffe7a7', 0, 1.3, -.37).rotation.x = Math.PI / 2
    } else {
      // Three hair locks + a high ponytail make the girl readable from behind.
      for (const x of [-.21, 0, .21]) round(body, .15, '#4a3028', x, 2.05, .35, .76, 1.4, .6)
      ponyTail = new T.Group(); ponyTail.position.set(.16, 2.36, .23); body.add(ponyTail)
      round(ponyTail, .105, '#dcfa54', 0, 0, .03, .9, .7, .9)
      round(ponyTail, .16, hair, .04, .08, .21, .8, 1.45, 1.3)
      round(ponyTail, .125, '#4a3028', .03, -.1, .39, .9, 1.4, 1)
      // Hoodie hood, cuffs and the black running flash on her back.
      round(body, .19, '#d1f858', 0, 1.6, .14, 1.3, .6, .8)
      this.box(body, .075, .25, .02, '#284131', -.04, 1.26, .297).rotation.z = -.6
      this.box(body, .075, .18, .02, '#284131', .04, 1.17, .307).rotation.z = -.6
      this.box(body, .13, .035, .02, '#284131', -.07, 1.29, .306)
    }
    const arms: T.Group[] = [], legs: T.Group[] = []
    for (const side of [-1, 1]) {
      const arm = new T.Group(); arm.position.set(side * (coach ? .63 : .32), 1.53, 0); body.add(arm)
      if (coach) {
        round(arm, .245, skin, side * .02, -.1, 0, 1.05, 1.08, 1)
        round(arm, .205, skin, side * .02, -.3, .015, .95, 1.15, .95)
        this.cylinder(arm, .12, .12, .07, '#303a40', 0, -.48, -.02)
      } else {
        round(arm, .13, shirt, 0, -.16, 0, .9, 1.6, .94)
        this.cylinder(arm, .086, .086, .17, skin, 0, -.38, -.035)
        this.cylinder(arm, .103, .103, .06, '#345e42', 0, -.29, 0)
      }
      round(arm, coach ? .16 : .105, skin, 0, -.53, -.045, .9, 1, .85); arms.push(arm)
      const leg = new T.Group(); leg.position.set(side * (coach ? .25 : .15), .83, 0); body.add(leg)
      this.cylinder(leg, coach ? .175 : .112, coach ? .145 : .09, .48, pants, 0, -.22, 0)
      this.cylinder(leg, .09, .08, .14, '#fff5e0', 0, -.51, -.01)
      round(leg, .16, '#f3f7d8', 0, -.65, -.1, coach ? 1.2 : .9, .63, 1.45)
      round(leg, .13, coach ? '#ef8e40' : '#83bb2d', 0, -.615, -.115, 1, .55, 1.35)
      this.box(leg, coach ? .28 : .22, .045, .44, '#ecf6d9', 0, -.72, -.11)
      this.box(leg, .15, .045, .022, '#33573d', 0, -.645, .107); legs.push(leg)
    }
    root.userData = { body, arms, legs, ponyTail }
    if (coach) root.scale.setScalar(1.13)
    return root
  }
  animatePerson(root: T.Group, t: number, jumping: boolean, duck: boolean, bike = false) {
    const { body, arms, legs, ponyTail } = root.userData as { body: T.Group; arms: T.Group[]; legs: T.Group[]; ponyTail?: T.Group }
    const stride = Math.sin(t * (bike ? 19 : 13))
    body.position.y = jumping ? 0 : Math.abs(stride) * .045
    body.scale.y = duck ? .49 : 1; body.rotation.x = duck ? -.35 : bike ? -.22 : -.05
    arms[0].rotation.x = bike ? -1.3 : jumping ? -2.2 : stride * .7
    arms[1].rotation.x = bike ? -1.3 : jumping ? -2.2 : -stride * .7
    legs[0].rotation.x = bike ? stride * .4 + .5 : -stride * .8
    legs[1].rotation.x = bike ? -stride * .4 + .5 : stride * .8
    if (ponyTail) { ponyTail.rotation.x = .18 + stride * .18; ponyTail.rotation.z = stride * .18 }
  }
  scooter(color = '#b94a3b') {
    const g = new T.Group()
    this.box(g, .5, .44, 1.4, color, 0, .55, 0)
    this.box(g, .5, .16, .75, '#2b3539', 0, .83, .22)
    this.box(g, .5, .7, .23, color, 0, .7, -.6)
    for (const z of [-.6, .6]) { const m = this.cylinder(g, .25, .25, .14, '#202b30', 0, .25, z); m.rotation.z = Math.PI / 2 }
    this.box(g, .7, .07, .1, '#b8bfbb', 0, 1.11, -.53)
    this.sphere(g, .10, '#fff0ba', 0, .9, -.74, .7, true)
    return g
  }
  bike() {
    const g = new T.Group(), v = (y: number, z: number) => new T.Vector3(0, y, z)
    for (const z of [-.9, .8]) {
      const geo = new T.TorusGeometry(.58, .055, 8, 24); this.geometries.set(`bike${z}`, geo)
      const wheel = this.mesh(g, geo, '#17292c', 0, .6, z); wheel.rotation.y = Math.PI / 2
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; this.bar(g, v(.6, z), v(.6 + Math.sin(a) * .53, z + Math.cos(a) * .53), .013, '#c7d1cf') }
    }
    for (const [a, b] of [[v(.6, .8), v(1.3, .3)], [v(1.3, .3), v(.56, 0)], [v(.56, 0), v(.6, .8)], [v(.56, 0), v(1.3, -.65)], [v(1.3, -.65), v(1.3, .3)], [v(1.3, -.65), v(.6, -.9)]]) this.bar(g, a, b, .055, '#f09b23')
    this.box(g, .4, .08, .38, '#313e42', 0, 1.43, .3)
    this.box(g, .7, .3, .45, '#d7dde1', 0, 1.33, -.9)
    this.box(g, .75, .065, .08, '#d1d9d5', 0, 1.6, -.6)
    this.box(g, .14, .06, 1.0, '#f09b23', 0, 1.24, .8); this.box(g, .1, .1, .06, '#ff2a2a', 0, 1.2, 1.32, true)
    return g
  }
  truck() {
    // Taiwan garbage truck: yellow compactor body, cab at -z, rear hopper (+z faces the chase camera) with a dark open mouth + bags.
    const g = new T.Group(), yellow = '#f4b21c', dark = '#d68a12'
    this.box(g, 2.7, .4, 6.2, '#2b3236', 0, .72, -.7)
    this.box(g, 2.9, 2.1, 4, yellow, 0, 1.6, -.4)
    for (const x of [-1.47, 1.47]) for (let k = 0; k < 5; k++) this.box(g, .05, 1.9, .08, dark, x, 1.6, -2.2 + k * .9)
    this.box(g, 2.9, .22, 4.02, '#2e8b57', 0, .78, -.4)
    this.box(g, 2.9, 1.7, 1.55, '#ffc93a', 0, 1.4, -3.1)
    this.box(g, 2.6, .75, .04, '#425e69', 0, 1.8, -3.9)
    for (const x of [-1.47, 1.47]) this.box(g, .04, .6, 1.1, '#425e69', x, 1.85, -3.1)
    this.sphere(g, .2, '#ff8a1f', 0, 2.42, -3.0, 1, true)
    this.box(g, .5, .3, .4, '#e8e4d8', .6, 2.4, -2.7); this.cylinder(g, .25, .1, .3, '#e8e4d8', -.5, 2.42, -2.7).rotation.x = Math.PI / 2
    // rear hopper with open loading mouth and blue/white bags poking out
    this.box(g, 2.9, 1.1, 1.3, yellow, 0, 1.0, 2.25)
    this.box(g, 2.4, .08, 1.0, '#202225', 0, 1.58, 2.25)
    for (const sx of [-1, 1]) this.box(g, .16, .5, 1.3, dark, sx * 1.42, 1.75, 2.25)
    this.box(g, 2.9, .2, .14, dark, 0, 1.68, 2.88)
    this.sphere(g, .34, '#3aa0e8', -.55, 1.78, 2.2, .8); this.sphere(g, .3, '#f1f1ea', .25, 1.82, 2.45, .85); this.sphere(g, .28, '#2a2a2e', .72, 1.72, 2.05, .8)
    this.box(g, 2.6, 1.0, .06, '#202225', 0, 1.0, 2.92)
    this.box(g, 2.9, .28, .3, '#2b3236', 0, .5, 2.85)
    for (let k = 0; k < 8; k++) this.box(g, .2, .26, .32, '#f4d21c', -1.2 + k * .34, .5, 2.86).rotation.z = .5
    this.sign(g, '垃圾不落地', 2.4, .5, '#fff3b0', '#2e8b57', 0, 2.15, 1.63)
    this.sign(g, '清潔隊', 1.0, .4, '#2e8b57', '#ffffff', -1.48, 1.6, -.4, { ry: -Math.PI / 2 }); this.sign(g, '清潔隊', 1.0, .4, '#2e8b57', '#ffffff', 1.48, 1.6, -.4, { ry: Math.PI / 2 })
    this.sign(g, 'KLA-8168', .6, .22, '#1c2a30', '#fdfcf4', 0, .82, 2.94)
    for (const x of [-1.42, 1.42]) for (const z of [-2.8, .9, 2.0]) { const m = this.cylinder(g, .43, .43, .25, '#182b30', x, .48, z); m.rotation.z = Math.PI / 2; this.cylinder(g, .2, .2, .27, '#b8c0bc', x, .48, z).rotation.z = Math.PI / 2 }
    for (const x of [-1.2, 1.2]) { this.box(g, .26, .3, .08, '#ff2a1c', x, 1.0, 2.95, true); this.box(g, .2, .16, .08, '#ffb21c', x, .72, 2.95, true) }
    return g
  }
  familyMart() {
    // Convenience-store front (green / white / blue fascia), lit interior with shelves, glass doors, plus a pole sign that faces the chase camera.
    const g = new T.Group(), f = new T.Group(); f.rotation.y = -Math.PI / 2; g.add(f)
    const green = '#1fae5f', blue = '#0d68b5', alu = '#e6ebe8'
    this.box(f, 10, 3.6, .6, '#f3f5f1', 0, 1.8, -.2)
    this.box(f, 9.7, 2.3, .05, '#fff6dc', 0, 1.4, .13, true)
    const cols = ['#ff5a4f', '#ffcf3a', '#3fb6e8', '#7bd36b', '#ff9bd0', '#ffffff', '#ff8f2e', '#a98cf0']
    for (const side of [-1, 1]) for (let s = 0; s < 4; s++) {
      const y = .55 + s * .5
      this.box(f, 3.3, .06, .42, '#f4f6f2', side * 3.05, y, .34)
      for (let i = 0; i < 8; i++) this.box(f, .28, .22 + ((i + s) % 3) * .08, .28, cols[(i * 3 + s * 2 + (side > 0 ? 1 : 0)) % 8], side * (1.55 + i * .4), y + .17 + ((i + s) % 3) * .04, .34, true)
    }
    this.box(f, 1.9, 2.3, .04, '#ffffff', 0, 1.4, .14, true)
    this.box(f, 9.7, 2.3, .03, '#cfeeff', 0, 1.4, .56).material = this.glass('#bfeaff', .16)
    for (const x of [-4.85, -3.2, -1.6, -.95, 0, .95, 1.6, 3.2, 4.85]) this.box(f, .07, 2.4, .08, alu, x, 1.4, .57)
    for (const y of [.2, 2.58]) this.box(f, 9.9, .1, .1, alu, 0, y, .57)
    for (const x of [-.12, .12]) this.box(f, .04, .5, .05, '#3a4046', x, 1.1, .62)
    this.sign(f, '歡迎光臨', 1.5, .3, green, '#ffffff', 0, 2.38, .6)
    this.box(f, 10.4, .34, .9, green, 0, 3.74, -.05); this.box(f, 10.4, .74, .9, '#ffffff', 0, 3.2, -.05, true); this.box(f, 10.4, .34, .9, blue, 0, 2.7, -.05)
    this.sign(f, 'FamilyMart', 3.6, .62, blue, '#ffffff', -1.3, 3.2, .42); this.sign(f, '全家', 1.6, .62, green, '#ffffff', 2.2, 3.2, .42)
    this.box(f, 10.5, .2, 1.0, '#e4e8e2', 0, 4.0, -.05)
    // pole sign facing the camera (local +x = world +z)
    this.cylinder(f, .08, .08, 5.6, '#c9d0cc', 5.5, 2.8, .9)
    this.box(f, .24, 1.9, 1.7, '#ffffff', 5.5, 5.3, .9, true); this.box(f, .26, .38, 1.76, green, 5.5, 6.1, .9, true); this.box(f, .26, .38, 1.76, blue, 5.5, 4.5, .9, true)
    this.sign(f, '全家', 1.3, .7, green, '#ffffff', 5.64, 5.5, .9, { ry: Math.PI / 2 }); this.sign(f, 'FamilyMart', 1.5, .3, blue, '#ffffff', 5.64, 4.95, .9, { ry: Math.PI / 2 })
    const sh = this.halo('#fff2b0', 4.6, .5); sh.position.set(5.9, 5.3, .9); f.add(sh)
    const pool = new T.Mesh(new T.PlaneGeometry(9.6, 2.4), this.glowPlane('#ffd27a', .22)); this.geometries.set('mart-pool', pool.geometry); pool.rotation.x = -Math.PI / 2; pool.position.set(0, .04, 1.5); f.add(pool)
    const light = new T.PointLight('#fff1c9', 22, 13, 2); light.position.set(0, 2.4, 2.2); f.add(light)
    this.batchStaticMeshes(g)
    return g
  }
  bag() { const g = new T.Group(); this.sphere(g, .38, '#3e5145', 0, 0, 0, 1.2); this.cylinder(g, .06, .14, .17, '#536b59', 0, .44, 0); return g }
  streetBlock(index: number, side: number) {
    const toon = this.style === 'toon'
    const g = new T.Group(), palette = this.style === 'cinema' ? ['#696461', '#626c67', '#80796c', '#5a686d'] : toon ? ['#c27b45', '#a97f66', '#8fa18b', '#c9a56d'] : ['#688481', '#bd9375', '#728c88', '#c6ad87']
    const height = 7 + (index % 4) * 1.8, x = side * 7.8
    this.box(g, 5.6, height, 11.6, palette[index % 4], x, height / 2, 0)
    this.box(g, 2.2, .18, 11.9, toon ? '#947f69' : '#94968b', side * 4.45, .14, 0)
    if (toon) {
      for (const z of [-5.5, -1.8, 1.8, 5.5]) this.box(g, .16, height, .18, '#74533e', side * 4.92, height / 2, z)
      for (const y of [3.35, 5.75, 8.1]) this.box(g, .16, .16, 11.7, '#d6ad78', side * 4.93, y, 0)
      this.box(g, .16, .32, 11.7, '#5d5148', side * 4.91, .38, 0)
    }
    for (let floor = 0; floor < 3; floor++) for (let k = 0; k < 3; k++) {
      const wy = 4.3 + floor * 2.1, wz = -3.7 + k * 3.5
      const lit = toon ? (index + k + floor) % 5 !== 0 : (index + k + floor) % 4 === 0
      this.box(g, .09, 1.2, 1.5, lit ? toon ? ['#ffd06a', '#ffbf55', '#ffe28f'][(index + k * 2 + floor) % 3] : '#d4b66c' : toon ? '#3a5058' : '#29434b', side * 4.96, wy, wz, lit)
      this.box(g, .10, .05, 1.6, '#b5beb1', side * 4.88, wy, wz)
      this.box(g, .7, .35, 1.5, '#566b68', side * 4.7, wy - .63, wz)
      if ((k + floor) % 2 === 0) { this.box(g, .5, .5, .68, '#b6b9ad', side * 4.68, wy -.35, wz + 1.1); for (let j = 0; j < 4; j++) this.box(g, .012, .035, .53, '#5c6b67', side * 4.41, wy - .52 + j * .1, wz + 1.1) }
    }
    this.cylinder(g, .045, .045, height, '#3d5653', side * 4.94, height / 2, 4.9)
    const awningColor = (toon ? ['#e43a2c', '#d92f2a', '#e84a2f', '#cf2f33'] : ['#c95438', '#3a9085', '#dea54d', '#416682'])[index % 4]
    const roof = this.box(g, 2.9, .13, 7.2, awningColor, side * 4.5, 2.65, 0); roof.rotation.z = side * .13
    for (let k = 0; k < 9; k++) {
      this.box(g, 2.9, .035, toon ? .37 : .13, '#f6e6ba', side * 4.5, 2.72, -3.4 + k * .8).rotation.z = side * .13
      if (toon) this.box(g, .085, .23, .78, k % 2 ? '#f5e6c3' : awningColor, side * 3.055, 2.43, -3.2 + k * .8)
    }
    this.box(g, .12, 2.65, .12, '#b7c2b5', side * 3.15, 1.34, -3.4)
    this.box(g, .12, 2.65, .12, '#b7c2b5', side * 3.15, 1.34, 3.4)
    const stall = new T.Group(); g.add(stall); stall.position.set(side * 4.3, 0, 0)
    this.box(stall, 1.3, .9, 3.9, toon ? '#b77243' : '#b4c2b3', 0, .75, 0, false, !toon)
    this.box(stall, 1.5, .1, 4.1, toon ? '#e9cb93' : '#b9b9a9', 0, 1.24, 0, false, !toon)
    this.box(stall, .05, .58, 3.7, toon ? ['#e75936', '#40958a', '#ce9735'][index % 3] : '#5d8570', -side * .68, .8, 0)
    for (let k = 0; k < 4; k++) { const food = this.food((index + k) % 3, false, true); food.position.set(0, 1.62, -1.5 + k); food.scale.setScalar(.5); stall.add(food) }
    const vendor = toon ? this.stallVendor(index) : this.person(); vendor.position.set(side * (toon ? .62 : .1), 0, toon ? 1.4 : 2.25); vendor.scale.setScalar(.8); vendor.rotation.y = toon ? side * Math.PI / 2 : 0; stall.add(vendor)
    const hs = toon ? [['台灣小吃', '#c42a1c', '#ffd23f'], ['珍珠奶茶', '#a1281c', '#fff7e8'], ['鹽酥雞', '#ffe08a', '#d6281f'], ['蚵仔煎', '#c42a1c', '#fff7e8']][index % 4] : undefined
    const words = ['胡椒餅', '珍珠奶茶', '臭豆腐', '台灣香腸', '豆花', '雞排', '蚵仔煎', '好吃熱炒']
    const signFrame = toon ? this.box(g, 3.78, .79, .15, '#ffba46', side * 4.8, 2.87, 3.65, true) : undefined
    const sign = hs ? this.sign(g, hs[0], 3.6, .66, hs[1], hs[2], side * 4.8, 2.87, 3.76, { icon: index % 4 === 1 }) : this.text(g, words[index % words.length], 3.6, .66, '#fff0c6', ['#a2422d', '#225f54', '#754c32'][index % 3], side * 4.8, 2.87, 3.76)
    sign.rotation.y = side === 1 ? -.3 : .3
    if (signFrame) signFrame.rotation.y = sign.rotation.y
    this.box(g, .9, 3.4, .15, toon ? '#ffad46' : '#364d47', side * 3.5, 4.6, 3.75, toon)
    if (toon) { const vs = [['夜市', '#fff1b8', '#d6281f', false], ['台灣小吃', '#c42a1c', '#ffd23f', false], ['鹽酥雞', '#fff1b8', '#d6281f', false], ['珍珠奶茶', '#1c3a8a', '#fffaf0', true]][(index + 1) % 4] as [string, string, string, boolean]; this.sign(g, vs[0], .74, 3.1, vs[1], vs[2], side * 3.5, 4.6, 3.85, { vertical: true, icon: vs[3] }) }
    else this.text(g, ['夜市美食', '珍珠奶茶', '台灣小吃'][index % 3], .62, 2.9, index % 2 ? '#d9ee87' : '#ffca84', '#304740', side * 3.5, 4.6, 3.85, true)
    this.lantern(g, side * 3.4, 3.7, -3.5); this.lantern(g, side * 3.4, 3.7, 1.5)
    if (toon) {
      for (const z of [-2.5, 0, 2.5]) this.lantern(g, side * 3.3, 2.25, z)
      this.box(g, .55, .68, .55, '#a84c2e', side * 3.32, .45, -4.7)
      for (const [dx, y, dz] of [[0, 1.15, 0], [.18, 1.02, .12], [-.15, .94, -.13]]) this.box(g, .42, .4, .42, '#47754c', side * 3.32 + dx, y, -4.7 + dz)
      this.box(g, .48, .38, .48, '#da4c31', side * 3.18, .32, 4.6)
      this.box(g, .51, .08, .51, '#ef754b', side * 3.18, .55, 4.6)
    }
    if (index % 3 === 0) { const scooter = this.scooter(); scooter.position.set(side * 3.4, 0, 4.8); scooter.rotation.y = side * .55; g.add(scooter) }
    if (index % 3 === 1) { this.box(g, .6, .65, .65, '#af875a', side * 3.4, .35, 4.8); this.box(g, .63, .10, .70, '#c6a879', side * 3.4, .70, 4.8) }
    if (toon && side === -1) this.roadTiles(g)
    if (toon) this.batchStaticMeshes(g)
    return g
  }
  private batchStaticMeshes(group: T.Group) {
    // Each street block moves as a whole; its repeating details can share draws.
    const buckets = new Map<string, T.Mesh[]>()
    group.updateMatrixWorld(true)
    group.traverse(object => {
      if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh || Array.isArray(object.material)) return
      const key = `${object.geometry.uuid}-${object.material.uuid}-${object.castShadow}`
      const bucket = buckets.get(key) ?? []; bucket.push(object); buckets.set(key, bucket)
    })
    for (const bucket of buckets.values()) {
      if (bucket.length < 3) continue
      const first = bucket[0], batch = new T.InstancedMesh(first.geometry, first.material, bucket.length)
      batch.castShadow = first.castShadow; batch.receiveShadow = true
      bucket.forEach((mesh, index) => { batch.setMatrixAt(index, mesh.matrixWorld); mesh.removeFromParent() })
      batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); group.add(batch)
    }
  }
  private stallVendor(index: number) {
    const g = new T.Group(), shirt = ['#e95936', '#3f9696', '#ebad39'][index % 3]
    this.cylinder(g, .24, .21, .65, shirt, 0, 1.15, 0)
    this.box(g, .37, .46, .27, '#263b41', 0, .62, 0)
    this.sphere(g, .3, '#efbb8d', 0, 1.75, 0, 1.04)
    this.sphere(g, .31, '#392d29', 0, 1.9, .03, .45)
    this.box(g, .5, .08, .38, shirt, 0, 1.96, 0)
    this.box(g, .25, .42, .025, '#fff0c7', 0, 1.13, -.235)
    for (const side of [-1, 1]) { this.sphere(g, .11, '#efbb8d', side * .26, 1.1, -.2); this.sphere(g, .025, '#293334', side * .095, 1.77, -.28) }
    return g
  }
  dispose() { this.materials.forEach(m => m.dispose()); this.geometries.forEach(g => g.dispose()); this.textures.forEach(t => t.dispose()) }
}
