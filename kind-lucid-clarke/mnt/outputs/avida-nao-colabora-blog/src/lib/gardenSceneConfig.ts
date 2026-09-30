// Meu Jardim — cena viva de jardins criados pelo Admin.
//
// Os jardins do código (gardenThemes.ts) trazem a cena escrita à mão. Os jardins criados em
// Admin → Gestão de Jardins guardam a MESMA configuração em garden_catalog.scene_config
// (JSON). Como esse JSON vem do banco e alimenta uma engine de canvas que roda no navegador
// de todos os usuários, nada é usado como veio: tudo passa por sanitizeSceneConfig, que
// limita números, cores, quantidades e formatos. Dado inválido vira padrão seguro ou é
// descartado; nunca quebra a tela e nunca cria carga absurda de animação.

import type {
  AuroraConfig, BirdsConfig, DuckConfig, DustConfig, FallConfig, FallEmitter, FlyersConfig,
  GardenTheme, HawkConfig, LightConfig, MistConfig, Point, ShimmerBand, WaterConfig, WaterfallConfig,
} from './gardenThemes'

/** Tudo que o GardenTheme guarda além de identidade (slug, label) e imagens (stages). */
export type SceneConfig = Omit<GardenTheme, 'slug' | 'label' | 'stages'>

type Rect = [number, number, number, number]
type Json = unknown

export const FALL_KINDS = ['petal', 'olive', 'snow', 'maple', 'ginkgo'] as const

/** Bacia invisível: a engine exige `water`; um jardim sem água usa uma bacia minúscula e transparente. */
const NO_WATER: WaterConfig = { kind: 'basin', center: [0.5, 0.97], rx: 0.0005, ry: 0.0005, tint: '#000000' }

export const DEFAULT_SCENE: SceneConfig = {
  water: NO_WATER,
  fall: { count: 0, emitters: [] },
  flyers: {},
  birds: { kind: 'none' },
  light: { sun: [0.2, 0.1], ray: '#fbe6c2', rayAmt: 0.15, glow: [] },
}

const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: Json): v is number => typeof v === 'number' && Number.isFinite(v)

function num(v: Json, min: number, max: number, fallback: number): number {
  return isNum(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function int(v: Json, min: number, max: number, fallback: number): number {
  return Math.round(num(v, min, max, fallback))
}

function unit(v: Json, fallback: number): number {
  return num(v, -0.1, 1.1, fallback)
}

function point(v: Json): Point | null {
  return Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) ? [unit(v[0], 0.5), unit(v[1], 0.5)] : null
}

function rect(v: Json): Rect | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(isNum)) return null
  const [a, b, c, d] = v.map((n) => unit(n, 0)) as Rect
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)]
}

const HEX = /^#[0-9a-fA-F]{6}$/
function color(v: Json, fallback: string): string {
  return typeof v === 'string' && HEX.test(v) ? v : fallback
}

function colorList(v: Json, max: number): string[] {
  return Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, max) : []
}

const RGB = /^(\d{1,3}),(\d{1,3}),(\d{1,3})$/
function rgb(v: Json, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const m = v.replace(/\s/g, '').match(RGB)
  return m && [m[1], m[2], m[3]].every((n) => Number(n) <= 255) ? `${m[1]},${m[2]},${m[3]}` : fallback
}

function water(v: Json): WaterConfig {
  if (!isObj(v)) return NO_WATER
  const tint = color(v.tint, '#3d5a52')
  const common = {
    tint,
    reflect: v.reflect === true ? true : undefined,
    drip: isNum(v.drip) && v.drip > 0 ? num(v.drip, 1, 30, 5) : undefined,
    ripFrom: point(v.ripFrom) ?? undefined,
  }
  if (v.kind === 'pond' && Array.isArray(v.poly)) {
    const poly = v.poly.map(point).filter((p): p is Point => p !== null).slice(0, 40)
    if (poly.length >= 3) return { kind: 'pond', poly, ...common }
  }
  if (v.kind === 'basin') {
    const center = point(v.center)
    if (center) {
      const thread = Array.isArray(v.thread) && v.thread.length === 4 && v.thread.every(isNum)
        ? (v.thread.map((n) => unit(n, 0)) as [number, number, number, number])
        : undefined
      return { kind: 'basin', center, rx: num(v.rx, 0.0005, 0.45, 0.08), ry: num(v.ry, 0.0005, 0.3, 0.03), thread, ...common }
    }
  }
  return NO_WATER
}

function fall(v: Json): FallConfig {
  if (!isObj(v) || !Array.isArray(v.emitters)) return { count: 0, emitters: [] }
  const emitters: FallEmitter[] = []
  for (const raw of v.emitters.slice(0, 3)) {
    if (!isObj(raw)) continue
    const kind = FALL_KINDS.find((k) => k === raw.kind)
    const zone = rect(raw.zone)
    const colors = colorList(raw.colors, 8)
    if (kind && zone && colors.length) emitters.push({ kind, weight: num(raw.weight, 0.05, 1, 1), colors, zone })
  }
  return { count: emitters.length ? int(v.count, 0, 80, 30) : 0, emitters }
}

function flyers(v: Json): FlyersConfig {
  if (!isObj(v)) return {}
  const out: FlyersConfig = {}
  const counts: [keyof FlyersConfig, number][] = [['butterflies', 12], ['bees', 14], ['dragonflies', 8], ['fireflies', 40], ['hummingbirds', 4]]
  for (const [key, max] of counts) {
    const n = int(v[key], 0, max, 0)
    if (n > 0) (out as Record<string, number>)[key] = n
  }
  const hb = rect(v.hbZone)
  if (hb && out.hummingbirds) out.hbZone = hb
  const cols = colorList(v.butColors, 6)
  if (cols.length) out.butColors = cols
  return out
}

function birds(v: Json): BirdsConfig {
  if (isObj(v) && v.kind === 'swallows') {
    const count = int(v.count, 0, 10, 0)
    if (count > 0) return { kind: 'swallows', count }
  }
  return { kind: 'none' }
}

function light(v: Json): LightConfig {
  if (!isObj(v)) return DEFAULT_SCENE.light
  const glow: [number, number, number, string][] = []
  if (Array.isArray(v.glow)) {
    for (const g of v.glow.slice(0, 8)) {
      if (!Array.isArray(g) || g.length !== 4 || !isNum(g[0]) || !isNum(g[1])) continue
      glow.push([unit(g[0], 0.5), unit(g[1], 0.5), num(g[2], 4, 80, 20), rgb(g[3], '250,205,130')])
    }
  }
  return {
    sun: point(v.sun) ?? [0.2, 0.1],
    ray: color(v.ray, '#fbe6c2'),
    rayAmt: num(v.rayAmt, 0, 0.4, 0.15),
    glow,
  }
}

function waterfall(v: Json): WaterfallConfig | undefined {
  if (!isObj(v) || ![v.x0, v.x1, v.top, v.bottom].every(isNum)) return undefined
  const x0 = unit(v.x0, 0), x1 = unit(v.x1, 0), top = unit(v.top, 0), bottom = unit(v.bottom, 0)
  return { x0: Math.min(x0, x1), x1: Math.max(x0, x1), top: Math.min(top, bottom), bottom: Math.max(top, bottom), land: point(v.land) ?? undefined }
}

function mist(v: Json): MistConfig | undefined {
  if (!isObj(v) || !isNum(v.y0) || !isNum(v.y1)) return undefined
  const y0 = unit(v.y0, 0.3), y1 = unit(v.y1, 0.4)
  return { bands: int(v.bands, 1, 6, 2), y0: Math.min(y0, y1), y1: Math.max(y0, y1), amt: num(v.amt, 0.02, 0.4, 0.12) }
}

function ducks(v: Json): DuckConfig[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: DuckConfig[] = []
  for (const d of v.slice(0, 4)) {
    if (!isObj(d) || !Array.isArray(d.path) || d.path.length !== 4 || !d.path.every(isNum)) continue
    out.push({
      path: d.path.map((n: number) => unit(n, 0.5)) as Rect,
      sp: num(d.sp, 0.3, 2, 1),
      per: isNum(d.per) ? num(d.per, 8, 60, 20) : undefined,
      col: color(d.col, '#3c3a35'),
    })
  }
  return out.length ? out : undefined
}

function shimmer(v: Json): ShimmerBand[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: ShimmerBand[] = []
  for (const b of v.slice(0, 4)) {
    if (!isObj(b) || !isNum(b.y0) || !isNum(b.y1)) continue
    const y0 = unit(b.y0, 0.3), y1 = unit(b.y1, 0.4)
    out.push({
      y0: Math.min(y0, y1), y1: Math.max(y0, y1),
      x0: isNum(b.x0) ? unit(b.x0, 0) : undefined, x1: isNum(b.x1) ? unit(b.x1, 1) : undefined,
      amp: num(b.amp, 0.3, 3, 1.2), freq: isNum(b.freq) ? num(b.freq, 0.02, 0.3, 0.07) : undefined,
      speed: isNum(b.speed) ? num(b.speed, 0.2, 2, 0.8) : undefined, top: b.top === true ? true : undefined,
    })
  }
  return out.length ? out : undefined
}

function dust(v: Json): DustConfig | undefined {
  if (!isObj(v)) return undefined
  const zone = rect(v.zone)
  const count = int(v.count, 0, 60, 0)
  return zone && count > 0 ? { count, zone } : undefined
}

function hawk(v: Json): HawkConfig | undefined {
  if (!isObj(v)) return undefined
  const center = point(v.center)
  if (!center || !Array.isArray(v.r) || v.r.length !== 2 || !v.r.every(isNum)) return undefined
  return { center, r: [num(v.r[0], 0.05, 0.6, 0.3), num(v.r[1], 0.02, 0.3, 0.06)], sp: num(v.sp, 0.03, 0.4, 0.12) }
}

function stars(v: Json): [number, number, number][] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: [number, number, number][] = []
  for (const s of v.slice(0, 60)) {
    if (Array.isArray(s) && s.length === 3 && s.every(isNum)) out.push([unit(s[0], 0.5), unit(s[1], 0.1), num(s[2], 0.6, 2, 1)])
  }
  return out.length ? out : undefined
}

function aurora(v: Json): AuroraConfig | undefined {
  if (!isObj(v) || !isNum(v.x0) || !isNum(v.x1) || !Array.isArray(v.bands)) return undefined
  const bands: [number, number, string][] = []
  for (const b of v.bands.slice(0, 4)) {
    if (Array.isArray(b) && b.length === 3 && isNum(b[0]) && isNum(b[1])) {
      const a = unit(b[0], 0.05), c = unit(b[1], 0.15)
      bands.push([Math.min(a, c), Math.max(a, c), color(b[2], '#6fd9a0')])
    }
  }
  if (!bands.length) return undefined
  const x0 = unit(v.x0, 0.3), x1 = unit(v.x1, 1)
  return { x0: Math.min(x0, x1), x1: Math.max(x0, x1), bands }
}

/** Converte qualquer JSON vindo do banco em uma cena segura para a engine. */
export function sanitizeSceneConfig(raw: Json): SceneConfig {
  if (!isObj(raw)) return { ...DEFAULT_SCENE }
  const scene: SceneConfig = {
    water: water(raw.water),
    fall: fall(raw.fall),
    flyers: flyers(raw.flyers),
    birds: birds(raw.birds),
    light: light(raw.light),
  }
  const koi = int(raw.koi, 0, 12, 0)
  if (koi > 0 && scene.water.kind === 'pond') scene.koi = koi
  const extras = {
    waterfall: waterfall(raw.waterfall), mist: mist(raw.mist), ducks: ducks(raw.ducks), shimmer: shimmer(raw.shimmer),
    dust: dust(raw.dust), hawk: hawk(raw.hawk), stars: stars(raw.stars), aurora: aurora(raw.aurora),
    owl: point(raw.owl) ?? undefined, smoke: point(raw.smoke) ?? undefined,
  }
  for (const [key, value] of Object.entries(extras)) if (value !== undefined) (scene as Record<string, unknown>)[key] = value
  return scene
}

export interface CatalogSceneRow {
  slug: string
  label: string
  stage_images: unknown
  scene_config: unknown
}

/** Um jardim do catálogo só vira tema vivo se tiver slug, nome, 4 ou 6 imagens http(s)/caminho local e cena. */
export function themeFromCatalogRow(row: CatalogSceneRow): GardenTheme | null {
  if (!row || typeof row.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) return null
  if (typeof row.label !== 'string' || !row.label.trim()) return null
  if (!isObj(row.scene_config)) return null
  const images = Array.isArray(row.stage_images)
    ? row.stage_images.filter((s): s is string => typeof s === 'string' && /^(https:\/\/|\/)/.test(s.trim())).map((s) => s.trim())
    : []
  if (images.length !== 4 && images.length !== 6) return null
  return { slug: row.slug, label: row.label.trim().slice(0, 120), stages: images, ...sanitizeSceneConfig(row.scene_config) }
}

/** Cena de um jardim do código (para "começar a partir de…" no criador do Admin). */
export function sceneOf(theme: GardenTheme): SceneConfig {
  const { slug: _slug, label: _label, stages: _stages, ...scene } = theme
  void _slug; void _label; void _stages
  return JSON.parse(JSON.stringify(scene)) as SceneConfig
}
