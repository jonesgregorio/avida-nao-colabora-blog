// Meu Jardim — motor de movimento sobre as imagens fotorrealistas.
//
// Uma engine única (canvas 2D) reaproveitada pelos 8 jardins: só a configuração
// (GardenTheme, em gardenThemes.ts) muda. Ela recebe os elementos DOM já montados pelo
// componente React (LivingGarden.tsx), roda seu próprio loop de animação e devolve uma
// função de limpeza para ser chamada no unmount / troca de jardim.
//
// Espaço de cena fixo (pixels da imagem-base) — todas as coordenadas normalizadas da
// configuração são convertidas para este espaço antes de desenhar.
import type { FallEmitter, GardenTheme } from './gardenThemes'

const VW = 1672
const VH = 941

interface FallParticle {
  kind: FallEmitter['kind']
  colors: string[]
  x: number
  y: number
  vy: number
  sway: number
  sw: number
  rot: number
  rs: number
  size: number
  ci: number
  inWater: boolean
  life: number
  depth: number
}

type FlyerType = 'butterfly' | 'bee' | 'dragonfly' | 'firefly' | 'hummingbird'
interface Flyer {
  type: FlyerType
  x: number
  y: number
  ph: number
  sp: number
  amp: number
  baseY: number
  hue: number
  size: number
  depth: number
}

interface SwallowBird { ph: number; sp: number; y0: number; amp: number }
interface Koi { cx: number; cy: number; rx: number; ry: number; sp: number; ph: number; sc: number; kind: string }
interface Drip { t0: number }
interface DustMote { x: number; y: number; vx: number; vy: number; size: number; a: number; life: number; maxLife: number; depth: number }
interface SmokePuff { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number }

export interface GardenEngineHandles {
  scene: HTMLDivElement
  images: HTMLImageElement[]
  water: HTMLCanvasElement
  air: HTMLCanvasElement
}

function rnd(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function rgba(c: string, a: number): string {
  if (c[0] !== '#') return c
  const n = parseInt(c.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

const KOI_KINDS = ['kohaku', 'ogon', 'showa', 'kohaku']

export function startGardenEngine(
  handles: GardenEngineHandles,
  theme: GardenTheme,
  getProgress: () => number,
  getReduced: () => boolean,
  onStageIndex?: (index: number) => void,
): () => void {
  const { scene, images, water: cW, air: cA } = handles
  const wxCtx = cW.getContext('2d')
  const axCtx = cA.getContext('2d')
  if (!wxCtx || !axCtx) return () => {}
  // Rebindados com tipo explícito não-nulo: o guard acima garante o valor em tempo de
  // execução, mas o TypeScript não propaga esse narrowing para dentro das funções
  // aninhadas declaradas abaixo (cada uma introduz seu próprio flow container). Anotar
  // o tipo aqui resolve isso sem precisar de `!` em cada um dos ~80 usos.
  const wx: CanvasRenderingContext2D = wxCtx
  const ax: CanvasRenderingContext2D = axCtx

  let destroyed = false
  let t = 0
  let last = performance.now()
  let prog = getProgress()
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

  // preload plain Image() objects (independent from the visible <img> crossfade layer)
  // so the water/shimmer resampling always has pixel data to read from.
  const imgObjs: HTMLImageElement[] = theme.stages.map((src) => {
    const o = new Image()
    o.src = src
    return o
  })

  function fit() {
    const r = scene.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    for (const c of [cW, cA]) {
      c.width = Math.max(2, Math.round(r.width * dpr))
      c.height = Math.max(2, Math.round(r.height * dpr))
    }
    wx.setTransform(cW.width / VW, 0, 0, cW.height / VH, 0, 0)
    ax.setTransform(cA.width / VW, 0, 0, cA.height / VH, 0, 0)
  }
  window.addEventListener('resize', fit)
  fit()

  // ---------- fauna / partículas ----------
  let fall: FallParticle[] = []
  let flyers: Flyer[] = []
  let swallows: SwallowBird[] = []
  let koi: Koi[] = []
  let drips: Drip[] = []
  let dust: DustMote[] = []
  let smoke: SmokePuff[] = []

  function pickEmitter(r: number): FallEmitter {
    const em = theme.fall.emitters
    let acc = 0
    let tot = 0
    for (const e of em) tot += e.weight
    const x = r * tot
    for (const e of em) { acc += e.weight; if (x <= acc) return e }
    return em[em.length - 1]
  }
  function newFall(R: () => number, spread: boolean): FallParticle {
    const e = theme.fall.emitters.length ? pickEmitter(R()) : { kind: 'petal' as const, colors: ['#fff'], zone: [0, 0, 0, 0] as [number, number, number, number], weight: 1 }
    const z = e.zone
    return {
      kind: e.kind, colors: e.colors,
      x: VW * (z[0] + R() * (z[2] - z[0])), y: spread ? VH * R() * 0.55 : VH * (z[1] - R() * 0.15),
      vy: 20 + R() * 16, sway: R() * 6.28, sw: 1.0 + R() * 1.3, rot: R() * 6.28, rs: (R() - 0.5) * 2.8,
      size: (e.kind === 'olive' ? 3.4 : 4) + R() * 3, ci: (R() * e.colors.length) | 0,
      inWater: false, life: 0, depth: 0.55 + R() * 0.6,
    }
  }
  function newFlyer(R: () => number, type: FlyerType): Flyer {
    const zone = (type === 'hummingbird' && theme.flyers.hbZone) ? theme.flyers.hbZone : [0.05, 0.38, 0.95, 0.72]
    const baseY = VH * (zone[1] + R() * (zone[3] - zone[1]))
    return {
      type,
      x: VW * (zone[0] + R() * (zone[2] - zone[0])), y: baseY, ph: R() * 6.28,
      sp: (type === 'bee' ? 0.9 : type === 'hummingbird' ? 1.3 : type === 'dragonfly' ? 0.5 : 0.3) * (0.7 + R() * 0.7),
      amp: (type === 'bee' ? 14 : type === 'hummingbird' ? 22 : 34) + R() * 46,
      baseY, hue: (R() * 3) | 0,
      size: (type === 'bee' ? 2.2 : type === 'dragonfly' ? 7 : 6) + R() * 3, depth: 0.6 + R() * 0.5,
    }
  }
  function newDust(R: () => number, spread: boolean): DustMote {
    const z = theme.dust!.zone
    return {
      x: VW * (z[0] + R() * (z[2] - z[0])), y: spread ? VH * (z[1] + R() * (z[3] - z[1])) : VH * z[3],
      vx: (R() - 0.3) * 8, vy: -(4 + R() * 6), size: 0.8 + R() * 1.6, a: 0.25 + R() * 0.35,
      life: R() * 8, maxLife: 6 + R() * 6, depth: 0.5 + R() * 0.5,
    }
  }
  function newSmoke(R: () => number, spread: boolean): SmokePuff {
    const S = theme.smoke!
    return {
      x: S[0] * VW + (R() - 0.5) * 4, y: spread ? S[1] * VH - R() * 160 : S[1] * VH,
      vx: (R() - 0.3) * 6, vy: -(14 + R() * 10), size: 3 + R() * 4,
      life: spread ? R() * 10 : 0, maxLife: 8 + R() * 6,
    }
  }

  function seed() {
    const R = rnd(11)
    fall = []
    for (let i = 0; i < theme.fall.count; i++) fall.push(newFall(R, true))
    flyers = []
    const f = theme.flyers
    for (let i = 0; i < (f.butterflies || 0); i++) flyers.push(newFlyer(R, 'butterfly'))
    for (let i = 0; i < (f.bees || 0); i++) flyers.push(newFlyer(R, 'bee'))
    for (let i = 0; i < (f.dragonflies || 0); i++) flyers.push(newFlyer(R, 'dragonfly'))
    for (let i = 0; i < (f.fireflies || 0); i++) flyers.push(newFlyer(R, 'firefly'))
    for (let i = 0; i < (f.hummingbirds || 0); i++) flyers.push(newFlyer(R, 'hummingbird'))
    swallows = []
    if (theme.birds.kind === 'swallows') {
      for (let i = 0; i < (theme.birds.count || 0); i++) {
        swallows.push({ ph: R() * 10, sp: 0.7 + R() * 0.5, y0: VH * (0.10 + R() * 0.16), amp: VH * (0.05 + R() * 0.06) })
      }
    }
    koi = []
    if (theme.koi) {
      const b = waterBounds()
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2 + 40
      const rx = (b[2] - b[0]) * 0.30, ry = (b[3] - b[1]) * 0.26
      for (let i = 0; i < theme.koi; i++) {
        koi.push({
          cx: cx + (R() - 0.5) * 90, cy: cy + (R() - 0.5) * 70, rx: rx * (0.45 + R() * 0.7), ry: ry * (0.45 + R() * 0.7),
          sp: 0.09 + R() * 0.11, ph: R() * 6.28, sc: 0.9 + R() * 0.6, kind: KOI_KINDS[i % KOI_KINDS.length],
        })
      }
    }
    drips = []
    dust = theme.dust ? Array.from({ length: theme.dust.count }, () => newDust(R, true)) : []
    smoke = theme.smoke ? Array.from({ length: 10 }, () => newSmoke(R, true)) : []
  }

  // ---------- água: bacia (elipse) OU lago (polígono) ----------
  function waterClip(ctx: CanvasRenderingContext2D): [number, number, number, number] {
    const w = theme.water
    if (w.poly) {
      ctx.beginPath()
      w.poly.forEach((p, i) => { const x = p[0] * VW, y = p[1] * VH; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
      ctx.closePath()
      const a = [1e9, 1e9, -1e9, -1e9]
      w.poly.forEach((p) => {
        a[0] = Math.min(a[0], p[0] * VW); a[1] = Math.min(a[1], p[1] * VH)
        a[2] = Math.max(a[2], p[0] * VW); a[3] = Math.max(a[3], p[1] * VH)
      })
      return [(a[0] + a[2]) / 2, (a[1] + a[3]) / 2, (a[2] - a[0]) / 2, (a[3] - a[1]) / 2]
    }
    const cx = w.center![0] * VW, cy = w.center![1] * VH, rx = w.rx! * VW, ry = w.ry! * VH
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.283); ctx.closePath()
    return [cx, cy, rx, ry]
  }
  function waterBounds(): [number, number, number, number] {
    // mesma lógica de waterClip mas sem desenhar (usada para semear os koi antes do 1º frame)
    const w = theme.water
    if (w.poly) {
      const a = [1e9, 1e9, -1e9, -1e9]
      w.poly.forEach((p) => {
        a[0] = Math.min(a[0], p[0] * VW); a[1] = Math.min(a[1], p[1] * VH)
        a[2] = Math.max(a[2], p[0] * VW); a[3] = Math.max(a[3], p[1] * VH)
      })
      return a as [number, number, number, number]
    }
    const cx = w.center![0] * VW, cy = w.center![1] * VH, rx = w.rx! * VW, ry = w.ry! * VH
    return [cx - rx, cy - ry, cx + rx, cy + ry]
  }
  function inWaterZone(x: number, y: number): boolean {
    const w = theme.water
    if (w.poly) {
      let inside = false
      const pts = w.poly
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0] * VW, yi = pts[i][1] * VH, xj = pts[j][0] * VW, yj = pts[j][1] * VH
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }
    const c = w.center!
    return Math.abs(x - c[0] * VW) < w.rx! * VW && Math.abs(y - c[1] * VH) < w.ry! * VH
  }
  function currentImg(): HTMLImageElement {
    return imgObjs[Math.max(0, Math.min(3, Math.round(prog * 3)))]
  }
  function drawKoi(k: Koi, alpha: number) {
    const a = t * k.sp + k.ph
    const x = k.cx + Math.cos(a) * k.rx, y = k.cy + Math.sin(a * 1.2) * k.ry
    const x2 = k.cx + Math.cos(a + 0.06) * k.rx, y2 = k.cy + Math.sin((a + 0.06) * 1.2) * k.ry
    const hd = Math.atan2(y2 - y, x2 - x), w = Math.sin(t * 7 + k.ph) * 3
    wx.save(); wx.translate(x, y); wx.rotate(hd); wx.scale(k.sc, k.sc); wx.globalAlpha = alpha * 0.8
    const base = k.kind === 'ogon' ? '#e4bd57' : '#f2ead9'
    wx.beginPath()
    wx.moveTo(19, 0); wx.quadraticCurveTo(5, -8, -10, -4 + w * 0.3)
    wx.quadraticCurveTo(-19, 0 + w, -10, 4 + w * 0.3); wx.quadraticCurveTo(5, 8, 19, 0); wx.closePath()
    wx.fillStyle = base; wx.fill()
    wx.beginPath()
    wx.moveTo(-10, -4 + w * 0.3); wx.quadraticCurveTo(-25, -10 + w * 1.3, -32, -3 + w)
    wx.quadraticCurveTo(-23, 0 + w, -32, 3 + w); wx.quadraticCurveTo(-25, 10 + w * 1.3, -10, 4 + w * 0.3)
    wx.fillStyle = 'rgba(240,232,216,.45)'; wx.fill()
    if (k.kind === 'kohaku') {
      wx.fillStyle = '#c14e28'; wx.beginPath(); wx.ellipse(6, -1, 6, 3, 0, 0, 6.283); wx.fill()
    } else if (k.kind === 'showa') {
      wx.fillStyle = '#2a2622'; wx.beginPath(); wx.ellipse(0, 0, 7, 3.4, 0, 0, 6.283); wx.fill()
      wx.fillStyle = '#c14e28'; wx.beginPath(); wx.ellipse(8, -1, 3.4, 2, 0, 0, 6.283); wx.fill()
    }
    wx.restore()
    wx.globalAlpha = alpha * 0.5
    wx.beginPath(); wx.ellipse(x, y, 15, 6, hd, 0, 6.283); wx.strokeStyle = 'rgba(255,255,255,.10)'; wx.lineWidth = 1.3; wx.stroke()
    wx.globalAlpha = 1
  }

  function drawWater(mi: number, reduced: boolean) {
    wx.clearRect(0, 0, VW, VH)
    wx.save()
    const [cx, cy, rx, ry] = waterClip(wx)
    wx.clip()
    const w = theme.water
    const ox = w.ripFrom ? w.ripFrom[0] * VW : cx
    const oy = w.ripFrom ? w.ripFrom[1] * VH : cy
    const g = wx.createLinearGradient(cx, cy - ry, cx, cy + ry)
    g.addColorStop(0, rgba(w.tint, 0.30)); g.addColorStop(1, rgba(w.tint, 0))
    wx.fillStyle = g; wx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)

    if (!reduced && w.reflect) {
      const img = currentImg()
      if (img.complete) {
        const ry0 = Math.max(0, cy - ry), ry1 = Math.min(VH, cy + ry)
        const rx0 = Math.max(0, cx - rx), rw = Math.min(VW, cx + rx) - rx0
        const amp = 1.4 + 1.4 * mi
        for (let yy = ry0; yy < ry1; yy += 3) {
          const dep = (yy - ry0) / Math.max(1, ry1 - ry0)
          const off = (Math.sin(yy * 0.045 + t * 1.2) + Math.sin(yy * 0.11 - t * 1.9) * 0.5) * amp * (0.4 + dep)
          try { wx.drawImage(img, rx0, yy, rw, 3, rx0 + off, yy, rw, 3) } catch { /* image not decoded yet */ }
        }
      }
    }
    if (theme.koi) for (let i = 0; i < koi.length; i++) if (i < 2 + Math.round(mi * 5)) drawKoi(koi[i], 1)

    if (!reduced) {
      const rmax = w.poly ? Math.max(rx, ry) * 0.5 : rx
      for (let k = 0; k < 5; k++) {
        const rr = ((t * 0.5 + k * 0.7) % 3.4) / 3.4
        wx.globalAlpha = 0.18 * (1 - rr)
        wx.strokeStyle = rgba(w.tint, 1); wx.lineWidth = 1.4
        wx.beginPath(); wx.ellipse(ox, oy, Math.abs(rmax * rr * (w.poly ? 1.6 : 1)), Math.abs(w.poly ? ry * rr * 1.1 : ry * rr), 0, 0, 6.283); wx.stroke()
      }
      wx.globalAlpha = 1
      if (t - (drips[drips.length - 1]?.t0 ?? -Infinity) > (w.drip || 3)) drips.push({ t0: t })
      drips = drips.filter((d) => t - d.t0 < 2.6)
      drips.forEach((d) => {
        const a = (t - d.t0) / 2.6
        wx.globalAlpha = 0.42 * (1 - a)
        wx.strokeStyle = 'rgba(255,255,255,1)'; wx.lineWidth = 1.6
        wx.beginPath(); wx.ellipse(ox, oy, Math.abs(rmax * a * (w.poly ? 1.6 : 0.9)), Math.abs(w.poly ? ry * a : ry * a * 0.9), 0, 0, 6.283); wx.stroke()
      })
      wx.globalAlpha = 1
      for (let s = 0; s < 6; s++) {
        const gx = cx - rx + ((s * 211 + t * 16) % (rx * 2))
        const gy = cy + Math.sin(s * 1.7 + t * 0.6) * ry * 0.6
        wx.globalAlpha = 0.34 * Math.max(0, Math.sin(t * 2 + s * 1.5))
        wx.fillStyle = '#fff5e0'
        wx.beginPath(); wx.ellipse(gx, gy, 4, 1.1, 0, 0, 6.283); wx.fill()
      }
      wx.globalAlpha = 1
    }
    wx.restore()

    if (!reduced && w.thread) {
      const T = w.thread
      wx.save(); wx.globalAlpha = 0.5; wx.strokeStyle = '#eef4f2'; wx.lineWidth = 2.2; wx.lineCap = 'round'
      wx.beginPath()
      const [x0, y0, x1, y1] = [T[0] * VW, T[1] * VH, T[2] * VW, T[3] * VH]
      for (let yy = 0; yy <= 1; yy += 0.12) {
        const xx = x0 + (x1 - x0) * yy + Math.sin(t * 9 + yy * 8) * 1.4
        wx.lineTo(xx, y0 + (y1 - y0) * yy)
      }
      wx.stroke(); wx.restore()
    }
    if (theme.waterfall) drawWaterfall(reduced)
    if (theme.ducks && !reduced) { wx.save(); waterClip(wx); wx.clip(); drawDucks(); wx.restore() }
    if (theme.shimmer && !reduced) drawShimmerBands()
  }

  function drawShimmerBands() {
    const img = currentImg()
    if (!img.complete) return
    theme.shimmer!.forEach((b, bi) => {
      const y0 = b.y0 * VH, y1 = b.y1 * VH, x0 = (b.x0 ?? 0) * VW, x1 = (b.x1 ?? 1) * VW
      wx.save(); wx.beginPath(); wx.rect(x0, y0, x1 - x0, y1 - y0); wx.clip()
      for (let yy = y0; yy < y1; yy += 3) {
        const depth = (yy - y0) / Math.max(1, y1 - y0)
        const reach = b.top ? 1 - depth : 1
        const off = Math.sin(yy * (b.freq ?? 0.06) + t * (b.speed ?? 0.6) + bi) * b.amp * reach
        try { wx.drawImage(img, x0, yy, x1 - x0, 3, x0 + off, yy, x1 - x0, 3) } catch { /* image not decoded yet */ }
      }
      wx.restore()
    })
  }
  function drawWaterfall(reduced: boolean) {
    const F = theme.waterfall!
    const x0 = F.x0 * VW, x1 = F.x1 * VW, top = F.top * VH, bot = F.bottom * VH
    wx.save()
    for (let s = 0; s < 14; s++) {
      const fx = x0 + (x1 - x0) * (s / 13)
      wx.globalAlpha = reduced ? 0.5 : 0.45 + 0.35 * Math.sin(s * 1.7)
      wx.strokeStyle = '#f2f6f5'; wx.lineWidth = 1.4 + (s % 2)
      wx.beginPath()
      for (let yy = 0; yy <= 1; yy += 0.1) {
        const wob = reduced ? 0 : Math.sin(yy * 10 + t * 8 + s) * 2
        wx.lineTo(fx + wob + yy * yy * 6, top + (bot - top) * yy)
      }
      wx.stroke()
    }
    wx.fillStyle = '#ffffff'
    for (let f = 0; f < 9; f++) {
      const lx = x0 + (x1 - x0) * (f / 8)
      const pf = 0.4 + 0.4 * Math.sin(t * 4 + f * 1.3)
      wx.globalAlpha = 0.55 * pf
      wx.beginPath(); wx.ellipse(lx, top + 2 + Math.sin(t * 6 + f) * 1.5, 3 + (f % 3), 2, 0, 0, 6.283); wx.fill()
    }
    const lp = F.land || [F.x1, F.bottom]
    const lpx = lp[0] * VW, lpy = lp[1] * VH
    for (let b = 0; b < 12; b++) {
      const ph = b * 0.9, cyc = ((t * 1.6 + ph) % 1.4) / 1.4
      wx.globalAlpha = 0.5 * (1 - cyc)
      wx.beginPath(); wx.ellipse(lpx + Math.sin(ph * 3) * 32, lpy + 8 - cyc * 22, 4 + (b % 4), 3, 0, 0, 6.283); wx.fill()
    }
    if (!reduced) {
      const mg = wx.createLinearGradient(0, bot - 40, 0, bot - 120)
      mg.addColorStop(0, 'rgba(255,255,255,0.28)'); mg.addColorStop(1, 'rgba(255,255,255,0)')
      wx.fillStyle = mg; wx.fillRect(lpx - 70, bot - 130, 150, 110)
    }
    wx.restore()
  }
  function drawMist(reduced: boolean) {
    const M = theme.mist
    if (!M) return
    for (let i = 0; i < M.bands; i++) {
      const y = VH * (M.y0 + (M.y1 - M.y0) * (i / (M.bands - 1)))
      const drift = reduced ? 0 : ((t * (6 + i * 3)) % (VW * 2)) - VW * 0.5
      const g = ax.createLinearGradient(0, y - 40, 0, y + 40)
      g.addColorStop(0, 'rgba(236,240,238,0)')
      g.addColorStop(0.5, `rgba(236,240,238,${M.amt * (0.6 + 0.4 * Math.sin(i + t * 0.3))})`)
      g.addColorStop(1, 'rgba(236,240,238,0)')
      ax.save(); ax.translate(drift * 0.15, 0)
      ax.fillStyle = g; ax.fillRect(-VW * 0.3, y - 40, VW * 1.6, 80)
      ax.restore()
    }
  }

  // ---------- ar ----------
  function drawFall(p: FallParticle) {
    const px = p.x + Math.sin(p.sway) * 10 + pointer.tx * 8 * p.depth
    const py = p.y + pointer.ty * 5 * p.depth
    ax.save(); ax.translate(px, py); ax.rotate(p.rot)
    ax.globalAlpha = p.inWater ? 0.65 : 0.94
    const cols = p.colors
    if (p.kind === 'petal') {
      ax.fillStyle = cols[p.ci % cols.length]
      const s = p.size
      ax.beginPath()
      ax.moveTo(0, -s); ax.bezierCurveTo(s * 1.1, -s * 0.9, s * 0.9, s * 0.7, 0, s)
      ax.bezierCurveTo(-s * 0.9, s * 0.7, -s * 1.1, -s * 0.9, 0, -s)
      ax.fill()
    } else if (p.kind === 'olive') {
      const flip = Math.cos(p.rot * 1.7) > 0
      ax.fillStyle = flip ? cols[3] : cols[p.ci % 2]
      ax.beginPath(); ax.ellipse(0, 0, p.size * 0.4, p.size * 1.5, 0, 0, 6.283); ax.fill()
    } else if (p.kind === 'snow') {
      ax.fillStyle = cols[p.ci % cols.length]
      ax.beginPath(); ax.arc(0, 0, p.size * 0.5, 0, 6.283); ax.fill()
    } else if (p.kind === 'ginkgo') {
      ax.fillStyle = cols[p.ci % cols.length]
      ax.beginPath()
      ax.moveTo(0, 0); ax.quadraticCurveTo(-p.size * 1.3, -p.size * 1.0, -p.size * 0.2, -p.size * 1.6)
      ax.quadraticCurveTo(0, -p.size * 1.3, p.size * 0.2, -p.size * 1.6)
      ax.quadraticCurveTo(p.size * 1.3, -p.size * 1.0, 0, 0)
      ax.fill()
    } else { // maple (e qualquer outro tipo de folha)
      ax.fillStyle = cols[p.ci % cols.length]
      ax.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -1.3 + i * 0.65
        ax.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size - p.size * 0.4)
        ax.lineTo(Math.cos(a + 0.3) * p.size * 0.4, Math.sin(a + 0.3) * p.size * 0.4)
      }
      ax.closePath(); ax.fill()
    }
    if (p.inWater) {
      ax.globalAlpha = 0.18; ax.beginPath(); ax.ellipse(0, 0, p.size * 1.7, p.size * 0.7, 0, 0, 6.283)
      ax.strokeStyle = '#dff0e6'; ax.lineWidth = 1; ax.stroke()
    }
    ax.restore()
  }
  function drawFlyer(q: Flyer) {
    const x = q.x + pointer.tx * 13 * q.depth, y = q.y + pointer.ty * 9 * q.depth
    if (q.type === 'bee') {
      const bz = Math.sin(t * 20 + q.ph) * 1.4
      ax.save(); ax.globalAlpha = 0.9; ax.fillStyle = '#d9a52e'
      ax.beginPath(); ax.ellipse(x, y + bz, q.size, q.size * 0.7, 0, 0, 6.283); ax.fill()
      ax.fillStyle = 'rgba(30,22,12,.8)'; ax.fillRect(x - 1, y + bz - q.size * 0.7, 2, q.size * 1.4)
      ax.globalAlpha = 0.3; ax.fillStyle = '#fff'
      ax.beginPath(); ax.ellipse(x, y + bz - 1, q.size * 1.5, q.size * 0.6, 0, 0, 6.283); ax.fill()
      ax.restore(); return
    }
    if (q.type === 'firefly') {
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2 + q.ph))
      ax.save(); ax.globalAlpha = pulse
      const gg = ax.createRadialGradient(x, y, 0, x, y, q.size * 3)
      gg.addColorStop(0, '#fbf1a8'); gg.addColorStop(1, 'rgba(251,241,168,0)')
      ax.fillStyle = gg; ax.beginPath(); ax.arc(x, y, q.size * 3, 0, 6.283); ax.fill(); ax.restore(); return
    }
    if (q.type === 'hummingbird') {
      const hb = Math.sin(t * 4 + q.ph)
      ax.save(); ax.translate(x, y + hb * 3); ax.globalAlpha = 0.9
      ax.fillStyle = '#2f6f4e'; ax.beginPath(); ax.ellipse(0, 0, 5, 2.4, 0.2, 0, 6.283); ax.fill()
      ax.fillStyle = '#b0402f'; ax.beginPath(); ax.ellipse(4, -0.5, 1.8, 1.4, 0, 0, 6.283); ax.fill()
      ax.strokeStyle = '#3a3a3a'; ax.lineWidth = 1; ax.beginPath(); ax.moveTo(5, -0.5); ax.lineTo(11, -1.5); ax.stroke()
      ax.globalAlpha = 0.28; ax.fillStyle = '#cfe6d8'
      ax.beginPath(); ax.ellipse(-1, -1, 6, 3, 0.5 * Math.sin(t * 30), 0, 6.283); ax.fill()
      ax.restore(); return
    }
    const flap = Math.sin(t * (q.type === 'dragonfly' ? 26 : 12) + q.ph)
    ax.save(); ax.translate(x, y); ax.globalAlpha = 0.92
    if (q.type === 'butterfly') {
      const cols = theme.flyers.butColors || ['#f0f0f0', '#e8894d', '#c85f86']
      const c = cols[q.hue % cols.length]
      const w = 4 + Math.abs(flap) * 4
      ax.fillStyle = c
      ax.beginPath(); ax.ellipse(-w * 0.6, -1, w, 6, 0.3, 0, 6.283); ax.fill()
      ax.beginPath(); ax.ellipse(w * 0.6, -1, w, 6, -0.3, 0, 6.283); ax.fill()
      ax.fillStyle = 'rgba(30,20,15,.5)'; ax.fillRect(-0.8, -4, 1.6, 9)
    } else {
      ax.strokeStyle = 'rgba(90,120,110,.85)'; ax.lineWidth = 1.6
      ax.beginPath(); ax.moveTo(-8, 0); ax.lineTo(9, 0); ax.stroke()
    }
    ax.restore()
  }
  function drawDucks() {
    theme.ducks!.forEach((d, di) => {
      const pth = d.path, per = d.per ?? 16
      const u = ((t * d.sp + di * 5) % per) / per
      const x = (pth[0] + (pth[2] - pth[0]) * u) * VW
      const y = (pth[1] + (pth[3] - pth[1]) * u) * VH + Math.sin(t * 1.5 + di) * 2
      const dx = pth[2] - pth[0], dy = pth[3] - pth[1]
      const dl = Math.hypot(dx, dy) || 1
      const bx = -dx / dl, by = -dy / dl
      const px = -by, py = bx
      wx.save(); wx.strokeStyle = 'rgba(255,255,255,1)'
      for (let w = 1; w <= 9; w++) {
        const back = 16 * w, spread = 5 * w
        wx.globalAlpha = 0.22 * (1 - w / 10); wx.lineWidth = 1.3
        wx.beginPath()
        wx.moveTo(x, y); wx.lineTo(x + bx * back + px * spread, y + by * back + py * spread)
        wx.moveTo(x, y); wx.lineTo(x + bx * back - px * spread, y + by * back - py * spread)
        wx.stroke()
      }
      wx.restore()
      wx.save(); wx.globalAlpha = 0.92; wx.fillStyle = d.col || '#3f3d38'
      wx.beginPath(); wx.ellipse(x, y, 11, 5.2, Math.atan2(dy, dx), 0, 6.283); wx.fill()
      const hx = x - bx * 10, hy = y - by * 10 - 4
      wx.beginPath(); wx.ellipse(hx, hy, 3.6, 3.2, 0, 0, 6.283); wx.fill()
      wx.restore()
    })
  }
  function drawSwallows() {
    swallows.forEach((s) => {
      const span = VW + 300
      const x = ((t * 120 * s.sp + s.ph * 400) % span) - 150
      const y = s.y0 + Math.sin(x * 0.006 + s.ph) * s.amp + Math.sin(t * 2 + s.ph) * 6
      const dir = Math.cos(x * 0.006 + s.ph) >= 0 ? 1 : -1
      const flap = Math.sin(t * 14 + s.ph)
      ax.save(); ax.translate(x, y); ax.scale(dir, 1); ax.globalAlpha = 0.82
      ax.fillStyle = '#2b2f2c'
      ax.beginPath()
      ax.moveTo(6, 0)
      ax.quadraticCurveTo(-2, -2 - 4 * Math.abs(flap), -12, -2 - 8 * flap)
      ax.quadraticCurveTo(-4, 0, -12, 2 + 8 * flap)
      ax.quadraticCurveTo(-2, 2 + 4 * Math.abs(flap), 6, 0)
      ax.fill()
      ax.beginPath(); ax.moveTo(-4, 0); ax.lineTo(-11, -3); ax.lineTo(-8, 0); ax.lineTo(-11, 3); ax.closePath(); ax.fill()
      ax.restore()
    })
  }
  function drawHawk() {
    const H = theme.hawk!
    const cx = H.center[0] * VW, cy = H.center[1] * VH, rx = H.r[0] * VW, ry = H.r[1] * VH
    const a = t * H.sp
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry
    const x2 = cx + Math.cos(a + 0.05) * rx, y2 = cy + Math.sin(a + 0.05) * ry
    const hd = Math.atan2(y2 - y, x2 - x)
    ax.save(); ax.translate(x, y); ax.rotate(hd); ax.globalAlpha = 0.55
    ax.fillStyle = '#3a3128'
    ax.beginPath()
    ax.moveTo(6, 0)
    ax.quadraticCurveTo(0, -1, -16, -6)
    ax.quadraticCurveTo(-6, -1, 0, 0)
    ax.quadraticCurveTo(-6, 1, -16, 6)
    ax.quadraticCurveTo(0, 1, 6, 0)
    ax.fill()
    ax.restore()
  }
  function drawDust() {
    dust.forEach((p) => {
      ax.save(); ax.globalAlpha = p.a * Math.max(0, Math.sin((p.life / p.maxLife) * 3.14))
      ax.fillStyle = '#f2d8a3'
      ax.beginPath(); ax.arc(p.x + pointer.tx * 6 * p.depth, p.y + pointer.ty * 4 * p.depth, p.size, 0, 6.283); ax.fill()
      ax.restore()
    })
  }
  function drawOwl() {
    const [ox, oy] = theme.owl!
    const x = ox * VW, y = oy * VH
    const blink = (t * 0.3) % 5 < 0.12
    ax.save(); ax.translate(x, y); ax.globalAlpha = 0.88
    ax.fillStyle = '#2a2622'
    ax.beginPath(); ax.ellipse(0, 4, 9, 12, 0, 0, 6.283); ax.fill()
    ax.beginPath(); ax.arc(0, -6, 7, 0, 6.283); ax.fill()
    if (!blink) {
      ax.fillStyle = '#e8c65a'
      ax.beginPath(); ax.arc(-2.6, -6, 1.6, 0, 6.283); ax.fill()
      ax.beginPath(); ax.arc(2.6, -6, 1.6, 0, 6.283); ax.fill()
    }
    ax.restore()
  }
  function drawStars() {
    theme.stars!.forEach((s, i) => {
      const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.2 + i * 2.1))
      ax.save(); ax.globalAlpha = tw * 0.9; ax.fillStyle = '#fdf8e6'
      ax.beginPath(); ax.arc(s[0] * VW, s[1] * VH, s[2], 0, 6.283); ax.fill()
      ax.restore()
    })
  }
  function drawSmoke() {
    smoke.forEach((p) => {
      const a = Math.max(0, 1 - p.life / p.maxLife)
      ax.save(); ax.globalAlpha = a * 0.30; ax.filter = 'blur(2px)'
      ax.fillStyle = '#dfe6ea'
      ax.beginPath(); ax.arc(p.x, p.y, p.size, 0, 6.283); ax.fill()
      ax.restore()
    })
  }
  function drawAurora(reduced: boolean) {
    const A = theme.aurora!
    ax.save(); ax.globalCompositeOperation = 'screen'; ax.filter = 'blur(5px)'
    A.bands.forEach((b, bi) => {
      const y0 = b[0] * VH, y1 = b[1] * VH, col = b[2]
      ax.beginPath()
      ax.moveTo(A.x0 * VW, y0)
      for (let x = A.x0 * VW; x <= A.x1 * VW; x += 24) {
        const yy = y0 + Math.sin(x * 0.008 + t * 0.22 + bi * 1.7) * 10 + Math.sin(x * 0.019 - t * 0.14) * 5
        ax.lineTo(x, yy)
      }
      for (let x = A.x1 * VW; x >= A.x0 * VW; x -= 24) {
        const yy = y1 + Math.sin(x * 0.008 + t * 0.22 + bi * 1.7) * 10 + Math.sin(x * 0.019 - t * 0.14) * 5
        ax.lineTo(x, yy)
      }
      ax.closePath()
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.18 + bi)
      ax.fillStyle = rgba(col, reduced ? 0.045 : 0.025 + 0.035 * pulse)
      ax.fill()
    })
    ax.restore()
  }
  function drawLight(mi: number, reduced: boolean) {
    const L = theme.light
    if (!reduced && L.rayAmt > 0) {
      ax.save(); ax.globalCompositeOperation = 'screen'; ax.filter = 'blur(16px)'
      const sx = L.sun[0] * VW, sy = L.sun[1] * VH
      for (let i = 0; i < 3; i++) {
        const a = -0.28 + i * 0.14 + Math.sin(t * 0.16 + i) * 0.014
        const pulse = L.rayAmt * (0.5 + 0.35 * Math.sin(t * 0.5 + i * 1.6))
        ax.save(); ax.translate(sx, sy); ax.rotate(a)
        const rg = ax.createLinearGradient(0, 0, 0, VH * 1.2)
        rg.addColorStop(0, rgba(L.ray, pulse)); rg.addColorStop(0.7, rgba(L.ray, pulse * 0.25)); rg.addColorStop(1, rgba(L.ray, 0))
        ax.fillStyle = rg; ax.fillRect(-80, 0, 160, VH * 1.2); ax.restore()
      }
      ax.filter = 'none'; ax.restore()
    }
    if (L.glow.length) {
      ax.save(); ax.globalCompositeOperation = 'screen'
      L.glow.forEach((p, idx) => {
        const fl = 0.55 + 0.45 * Math.sin(t * (1.1 + idx * 0.3)) + (reduced ? 0 : Math.sin(t * 7 + idx) * 0.06)
        const x = p[0] * VW, y = p[1] * VH, rad = p[2] * 2.6
        const g = ax.createRadialGradient(x, y, 2, x, y, rad)
        g.addColorStop(0, `rgba(${p[3]},${(0.5 * fl).toFixed(3)})`)
        g.addColorStop(1, `rgba(${p[3]},0)`)
        ax.fillStyle = g; ax.beginPath(); ax.arc(x, y, rad, 0, 6.283); ax.fill()
      })
      ax.restore()
    }
  }

  // ---------- cross-fade dos 4 estágios ----------
  function applyProgress(p: number) {
    prog = p
    const f = p * 3
    images[0].style.opacity = '1'
    images[1].style.opacity = String(Math.max(0, Math.min(1, f)))
    images[2].style.opacity = String(Math.max(0, Math.min(1, f - 1)))
    images[3].style.opacity = String(Math.max(0, Math.min(1, f - 2)))
    onStageIndex?.(Math.round(Math.max(0, Math.min(3, f))))
  }

  // ---------- loop ----------
  let rafId = 0
  function frame(now: number) {
    if (destroyed) return
    try {
      const reduced = getReduced()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!reduced) t += dt
      pointer.tx += (pointer.x - pointer.tx) * 0.06
      pointer.ty += (pointer.y - pointer.ty) * 0.06

      applyProgress(getProgress())
      const mi = 0.22 + 0.78 * prog

      const z = reduced ? 1.03 : 1.03 + Math.sin(t * 0.03) * 0.016
      const pxp = reduced ? 0 : Math.sin(t * 0.05) * 0.7 + pointer.tx * -1.3
      const pyp = reduced ? 0 : Math.cos(t * 0.04) * 0.5 + pointer.ty * -0.9
      const tf = `scale(${z}) translate(${pxp}%,${pyp}%)`
      for (const img of images) img.style.transform = tf

      drawWater(mi, reduced)

      ax.clearRect(0, 0, VW, VH)
      drawMist(reduced)
      if (!reduced) {
        const lc = Math.round(Math.pow(prog, 1.3) * fall.length)
        for (let l = 0; l < fall.length; l++) {
          const p = fall[l]
          if (l >= lc) continue
          if (p.inWater) {
            if (p.kind === 'snow') {
              Object.assign(p, newFall(rnd((l * 97 + 1) | 0), false))
            } else {
              p.x += Math.sin(p.sway) * 3 * dt; p.sway += dt * 0.5; p.rot += dt * 0.15
              p.life += dt
              if (p.life > 7) Object.assign(p, newFall(rnd((l * 97 + 1) | 0), false))
            }
          } else {
            const isSnow = p.kind === 'snow'
            const vyMax = isSnow ? 15 : 26, wind = isSnow ? 3 : 8
            p.vy = Math.min(p.vy + 7 * dt, vyMax); p.sway += dt * (isSnow ? 1.1 : 2.0); p.rot += p.rs * dt
            p.x += (Math.sin(p.sway) * p.sw * (isSnow ? 7 : 12) + wind) * dt; p.y += p.vy * dt
            if (inWaterZone(p.x, p.y)) { p.inWater = true; p.vy = 0; p.life = 0 }
            else if (p.y > VH + 40 || p.x > VW + 50) Object.assign(p, newFall(rnd((l * 131 + 3) | 0), false))
          }
          drawFall(p)
        }
        const bc = Math.round((0.3 + 0.7 * prog) * flyers.length)
        for (let f = 0; f < flyers.length; f++) {
          if (f >= bc) continue
          const q = flyers[f]
          q.ph += dt * q.sp * 2
          q.x += (q.type === 'bee' ? Math.sin(q.ph * 3) * 30 : 15 * q.sp + Math.sin(q.ph * 0.7) * 7) * dt
          q.y = q.baseY + Math.sin(q.ph) * (q.type === 'bee' ? q.amp : q.amp * 0.5) + (q.type === 'bee' ? Math.cos(q.ph * 2.3) * 10 : 0)
          if (q.x > VW + 40) q.x = -40
          if (q.x < -60) q.x = VW + 40
          drawFlyer(q)
        }
        drawSwallows()
        if (theme.hawk) drawHawk()
        if (theme.dust) {
          dust.forEach((p) => {
            p.x += p.vx * dt; p.y += p.vy * dt; p.life += dt
            if (p.life > p.maxLife) Object.assign(p, newDust(rnd((p.x * 13 + 7) | 0), false))
          })
          drawDust()
        }
        if (theme.stars) drawStars()
        if (theme.owl) drawOwl()
        if (theme.smoke) {
          smoke.forEach((p) => {
            p.x += p.vx * dt; p.y += p.vy * dt; p.size += dt * 2.2; p.life += dt
            if (p.life > p.maxLife) Object.assign(p, newSmoke(rnd((p.x * 17 + 11) | 0), false))
          })
          drawSmoke()
        }
      }
      if (theme.aurora && !reduced) drawAurora(reduced)
      drawLight(mi, reduced)
    } catch (err) {
      if (window.console) console.error('gardenEngine frame()', err)
    }
    rafId = requestAnimationFrame(frame)
  }

  function onPointerMove(e: PointerEvent) {
    const r = scene.getBoundingClientRect()
    pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2
    pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2
  }
  function onPointerLeave() { pointer.x = 0; pointer.y = 0 }
  function onOrientation(e: DeviceOrientationEvent) {
    if (e.gamma == null || e.beta == null) return
    pointer.x = Math.max(-1, Math.min(1, e.gamma / 30))
    pointer.y = Math.max(-1, Math.min(1, (e.beta - 40) / 30))
  }
  scene.addEventListener('pointermove', onPointerMove)
  scene.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('deviceorientation', onOrientation)

  seed()
  rafId = requestAnimationFrame(frame)

  return function destroy() {
    destroyed = true
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', fit)
    window.removeEventListener('deviceorientation', onOrientation)
    scene.removeEventListener('pointermove', onPointerMove)
    scene.removeEventListener('pointerleave', onPointerLeave)
  }
}
