import * as THREE from 'three'

// Deliberately simplified continent silhouettes, not a geographic data layer.
// Longitude/latitude coordinates are only an illustrative fly-in to Taipei.
const CONTINENTS = [
  [[-168, 69], [-135, 71], [-114, 56], [-88, 50], [-60, 48], [-79, 25], [-96, 17], [-110, 31], [-126, 46], [-153, 57]],
  [[-81, 11], [-59, 9], [-35, -7], [-49, -24], [-59, -41], [-72, -55], [-78, -24]],
  [[-17, 34], [9, 37], [35, 30], [50, 12], [40, -13], [24, -35], [11, -30], [-1, -8], [-14, 8]],
  [[-10, 36], [-8, 58], [25, 71], [45, 64], [73, 75], [123, 68], [162, 61], [140, 45], [124, 35], [120, 23], [109, 9], [99, 5], [89, 24], [73, 8], [58, 24], [42, 40], [25, 36]],
  [[113, -22], [127, -12], [145, -15], [154, -29], [143, -39], [119, -35]],
  [[-52, 60], [-26, 70], [-37, 82], [-61, 78]],
  [[47, -13], [50, -18], [47, -26], [44, -21]],
  [[130, 31], [135, 34], [141, 41], [145, 44], [140, 37]],
] as const

const TAIPEI = { longitude: 121.56, latitude: 25.03 }
const PLANET_RADIUS = 2.4
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

function surfacePoint(longitude: number, latitude: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(longitude + 180)
  const theta = THREE.MathUtils.degToRad(90 - latitude)
  return new THREE.Vector3(-radius * Math.cos(phi) * Math.sin(theta), radius * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta))
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Arrival texture requires a 2D canvas context')
  return { canvas, ctx }
}

function globeTexture() {
  const { canvas, ctx } = makeCanvas(1024, 512)
  ctx.fillStyle = '#073d65'; ctx.fillRect(0, 0, 1024, 512)
  ctx.strokeStyle = '#237987'; ctx.lineWidth = 0.65
  for (let x = 0; x <= 1024; x += 1024 / 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke() }
  for (let y = 0; y <= 512; y += 512 / 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke() }
  const project = (longitude: number, latitude: number) => [(longitude + 180) / 360 * 1024, (90 - latitude) / 180 * 512]
  ctx.fillStyle = '#51bca1'; ctx.strokeStyle = '#9af1cf'; ctx.lineWidth = 1.3
  for (const outline of CONTINENTS) {
    ctx.beginPath()
    outline.forEach(([longitude, latitude], index) => { const [x, y] = project(longitude, latitude); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  const [x, y] = project(TAIPEI.longitude, 23.8)
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.28)
  ctx.fillStyle = '#fbf69a'; ctx.shadowColor = '#d7ff47'; ctx.shadowBlur = 8
  ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function labelTexture() {
  const { canvas, ctx } = makeCanvas(640, 170)
  ctx.textAlign = 'center'
  ctx.shadowColor = '#031411'; ctx.shadowBlur = 12
  ctx.fillStyle = '#faffb6'; ctx.font = '900 78px system-ui, sans-serif'; ctx.fillText('TAIWAN', 320, 86)
  ctx.fillStyle = '#c5ffe8'; ctx.font = '700 28px system-ui, sans-serif'; ctx.fillText('TAIPEI  /  RAOHE', 320, 137)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A three-second schematic space -> Taiwan fly-in, replacing the countdown view. */
export class ArrivalScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private readonly earth = new THREE.Group()
  private readonly focus = surfacePoint(TAIPEI.longitude, TAIPEI.latitude, PLANET_RADIUS + 0.018)
  private readonly target = new THREE.Vector3()
  private readonly direction = this.focus.clone().normalize()
  private readonly glowMaterial: THREE.MeshBasicMaterial
  private readonly ringMaterial: THREE.MeshBasicMaterial
  private readonly label: THREE.Sprite
  private readonly fadeMaterial: THREE.MeshBasicMaterial
  private readonly ring: THREE.Mesh
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly textures: THREE.Texture[] = []

  constructor(aspect = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(49, aspect > 0 ? aspect : 16 / 9, 0.05, 150)
    this.scene.background = new THREE.Color('#020914')
    this.scene.add(this.earth, this.camera, new THREE.AmbientLight('#82c1df', 1.1))
    const light = new THREE.DirectionalLight('#fffae0', 3.2)
    light.position.copy(this.direction).multiplyScalar(8).add(new THREE.Vector3(-2, 4, 0))
    this.scene.add(light)

    const globeMap = globeTexture(); this.textures.push(globeMap)
    const globeGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 48, 32)
    const globeMaterial = new THREE.MeshStandardMaterial({ map: globeMap, roughness: 0.9, metalness: 0.05, emissive: '#042c31', emissiveIntensity: 0.42 })
    this.geometries.push(globeGeometry); this.materials.push(globeMaterial)
    this.earth.add(new THREE.Mesh(globeGeometry, globeMaterial))

    const atmosphereGeometry = new THREE.SphereGeometry(PLANET_RADIUS * 1.04, 40, 24)
    const atmosphereMaterial = new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){ vec4 view=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-view.xyz); gl_Position=projectionMatrix*view; }',
      fragmentShader: 'varying vec3 vNormal; varying vec3 vView; void main(){ float glow=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.0); gl_FragColor=vec4(0.18,0.72,1.0,glow*0.62); }',
    })
    this.geometries.push(atmosphereGeometry); this.materials.push(atmosphereMaterial)
    this.earth.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial))

    const positions = new Float32Array(220 * 3)
    let seed = 142857
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let index = 0; index < 220; index++) {
      const azimuth = random() * Math.PI * 2, vertical = random() * 2 - 1
      const radial = Math.sqrt(1 - vertical * vertical), distance = 24 + random() * 38
      positions[index * 3] = Math.cos(azimuth) * radial * distance
      positions[index * 3 + 1] = vertical * distance
      positions[index * 3 + 2] = Math.sin(azimuth) * radial * distance
    }
    const starsGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const starsMaterial = new THREE.PointsMaterial({ color: '#c7eaff', size: 0.08, transparent: true, opacity: 0.85, depthWrite: false })
    this.geometries.push(starsGeometry); this.materials.push(starsMaterial)
    this.scene.add(new THREE.Points(starsGeometry, starsMaterial))

    const pinGeometry = new THREE.SphereGeometry(0.034, 12, 8)
    this.glowMaterial = new THREE.MeshBasicMaterial({ color: '#f2ff7a', transparent: true, opacity: 0 })
    this.geometries.push(pinGeometry); this.materials.push(this.glowMaterial)
    const pin = new THREE.Mesh(pinGeometry, this.glowMaterial)
    pin.position.copy(this.focus); this.earth.add(pin)

    const ringGeometry = new THREE.RingGeometry(0.069, 0.08, 36)
    this.ringMaterial = new THREE.MeshBasicMaterial({ color: '#c9ff63', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    this.geometries.push(ringGeometry); this.materials.push(this.ringMaterial)
    this.ring = new THREE.Mesh(ringGeometry, this.ringMaterial)
    this.ring.position.copy(this.focus).addScaledVector(this.direction, 0.025)
    this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.direction)
    this.earth.add(this.ring)

    const captionMap = labelTexture(); this.textures.push(captionMap)
    const captionMaterial = new THREE.SpriteMaterial({ map: captionMap, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    this.materials.push(captionMaterial)
    this.label = new THREE.Sprite(captionMaterial)
    this.label.position.copy(this.focus).add(new THREE.Vector3(0, 0.31, 0))
    this.label.scale.set(1.14, 0.303, 1); this.label.renderOrder = 10
    this.earth.add(this.label)

    // A single fade-to-black at the cut avoids strobing and does not require CSS.
    const fadeGeometry = new THREE.PlaneGeometry(5, 5)
    this.fadeMaterial = new THREE.MeshBasicMaterial({ color: '#020914', transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    this.geometries.push(fadeGeometry); this.materials.push(this.fadeMaterial)
    const fade = new THREE.Mesh(fadeGeometry, this.fadeMaterial)
    fade.position.z = -0.12; fade.renderOrder = 100
    this.camera.add(fade)
    this.update(0)
  }

  resize(aspect: number) {
    if (aspect > 0) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix() }
  }

  update(progress: number) {
    const p = clamp(Number.isFinite(progress) ? progress : 0)
    const approach = smooth(p / 0.86), focusIn = smooth((p - 0.38) / 0.38)
    this.earth.rotation.y = -0.65 * (1 - smooth(p / 0.62))
    const distance = THREE.MathUtils.lerp(11.6, 2.83, approach)
    this.camera.position.copy(this.direction).multiplyScalar(distance)
    this.camera.position.y += 0.7 * (1 - approach)
    this.target.copy(this.focus).multiplyScalar(focusIn * 0.94)
    this.camera.lookAt(this.target)
    this.camera.fov = THREE.MathUtils.lerp(49, 38, approach); this.camera.updateProjectionMatrix()
    this.glowMaterial.opacity = focusIn
    this.ringMaterial.opacity = focusIn * (1 - smooth((p - 0.79) / 0.1))
    this.ring.scale.setScalar(1 + Math.sin(p * Math.PI * 2) * 0.16 + focusIn * 1.1)
    this.label.material.opacity = focusIn * (1 - smooth((p - 0.8) / 0.09))
    this.fadeMaterial.opacity = smooth((p - 0.88) / 0.12)
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
    this.scene.clear()
  }
}

/** Optional recorder fallback. This is also a schematic, not a precise map. */
export function drawArrival2D(ctx: CanvasRenderingContext2D, progress: number, width: number, height: number) {
  const p = clamp(Number.isFinite(progress) ? progress : 0)
  const zoom = smooth(p / 0.86), focusIn = smooth((p - 0.38) / 0.38)
  ctx.save(); ctx.fillStyle = '#020914'; ctx.fillRect(0, 0, width, height)
  for (let index = 0; index < 90; index++) {
    const x = ((index * 397 + 29) % 997) / 997 * width, y = ((index * 181 + 71) % 991) / 991 * height
    ctx.globalAlpha = 0.35 + (index % 5) * 0.1; ctx.fillStyle = '#c7eaff'
    ctx.fillRect(x, y, index % 7 === 0 ? 2 : 1, index % 7 === 0 ? 2 : 1)
  }
  ctx.globalAlpha = 1
  const radius = Math.min(width, height) * THREE.MathUtils.lerp(0.28, 1.22, zoom)
  const cx = width * (0.5 - zoom * 0.14), cy = height * (0.5 + zoom * 0.2)
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.94, cx, cy, radius * 1.1)
  glow.addColorStop(0, '#45aaff00'); glow.addColorStop(0.4, '#52c9ff66'); glow.addColorStop(1, '#52c9ff00')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.1, 0, Math.PI * 2); ctx.fill()
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip()
  const ocean = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, 0, cx, cy, radius)
  ocean.addColorStop(0, '#218996'); ocean.addColorStop(0.72, '#074d74'); ocean.addColorStop(1, '#03172e')
  ctx.fillStyle = ocean; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
  ctx.strokeStyle = '#72dcc33b'; ctx.lineWidth = 1
  for (let line = -3; line <= 3; line++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * Math.max(0.02, Math.cos(line * Math.PI / 8)), radius, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(cx, cy + line * radius / 4, radius, radius * 0.12, 0, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.fillStyle = '#69c2a7'
  // Illustrative East Asia/Australia silhouettes only, intentionally low detail.
  ctx.beginPath(); ctx.moveTo(cx - radius * 0.98, cy - radius * 0.53)
  for (const [x, y] of [[-0.64, -0.9], [0.2, -0.76], [0.6, -0.4], [0.43, -0.16], [0.29, 0.02], [0.05, 0.2], [-0.05, -0.08], [-0.26, 0.11], [-0.47, -0.2], [-0.93, -0.11]]) ctx.lineTo(cx + x * radius, cy + y * radius)
  ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.ellipse(cx + radius * 0.41, cy + radius * 0.58, radius * 0.22, radius * 0.14, -0.2, 0, Math.PI * 2); ctx.fill()
  const tx = cx + radius * 0.35, ty = cy - radius * 0.01
  ctx.fillStyle = '#eeff92'; ctx.beginPath(); ctx.ellipse(tx, ty, radius * 0.016, radius * 0.048, 0.25, 0, Math.PI * 2); ctx.fill()
  if (focusIn > 0) {
    ctx.strokeStyle = `rgba(207,255,97,${focusIn})`; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(tx, ty, radius * 0.067, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = focusIn * (1 - smooth((p - 0.8) / 0.09))
  ctx.textAlign = 'center'; ctx.fillStyle = '#efffc4'; ctx.shadowColor = '#031a15'; ctx.shadowBlur = 12
  ctx.font = `900 ${Math.max(22, width * 0.045)}px system-ui, sans-serif`; ctx.fillText('TAIWAN', width * 0.5, height * 0.18)
  ctx.font = `700 ${Math.max(12, width * 0.018)}px system-ui, sans-serif`; ctx.fillText('TAIPEI  /  RAOHE', width * 0.5, height * 0.235)
  ctx.globalAlpha = smooth((p - 0.88) / 0.12); ctx.shadowBlur = 0; ctx.fillStyle = '#020914'; ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
