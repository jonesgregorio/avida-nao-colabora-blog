// Meu Jardim — configuração dos 8 jardins fotorrealistas.
//
// Cada jardim é 4 imagens (recém-plantado / pegando / maduro / completo) geradas a partir do
// brief em docs (câmera, paleta e composição fixas) + uma camada de movimento em canvas que lê
// esta configuração. A engine (livingGardenEngine.ts) é a mesma para os 8 — só isto muda.
//
// Todas as coordenadas normalizadas (poly, zone, center, sun, glow, etc.) são frações 0..1 do
// quadro 1672×941 da imagem base, não pixels de tela.

export type Point = [number, number]

export interface WaterConfig {
  kind: 'basin' | 'pond'
  /** Espelha a imagem do estágio atual dentro da água, com leve ondulação (reflexo tremendo). */
  reflect?: boolean
  tint: string
  /** Segundos entre "gotejos" (anel branco que se expande e desaparece). */
  drip?: number
  // basin: elipse
  center?: Point
  rx?: number
  ry?: number
  // pond: polígono livre
  poly?: Point[]
  /** De onde as marolas partem; padrão é o centro/centroide. */
  ripFrom?: Point
  /** Fio d'água caindo de um pedestal: [x0,y0,x1,y1]. */
  thread?: [number, number, number, number]
}

export interface FallEmitter {
  kind: 'petal' | 'olive' | 'snow' | 'maple' | 'ginkgo'
  weight: number
  colors: string[]
  /** [x0,y0,x1,y1] normalizado — de onde a partícula pode nascer. */
  zone: [number, number, number, number]
}

export interface FallConfig {
  count: number
  emitters: FallEmitter[]
}

export interface FlyersConfig {
  butterflies?: number
  bees?: number
  dragonflies?: number
  fireflies?: number
  hummingbirds?: number
  /** Zona [x0,y0,x1,y1] onde beija-flores preferem ficar (perto das flores). */
  hbZone?: [number, number, number, number]
  butColors?: string[]
}

export interface BirdsConfig {
  kind: 'swallows' | 'none'
  count?: number
}

export interface WaterfallConfig {
  x0: number
  x1: number
  top: number
  bottom: number
  land?: Point
}

export interface MistConfig {
  bands: number
  y0: number
  y1: number
  amt: number
}

export interface DuckConfig {
  /** [x0,y0,x1,y1] — início e fim do trajeto na água. */
  path: [number, number, number, number]
  sp: number
  per?: number
  col?: string
}

export interface ShimmerBand {
  y0: number
  y1: number
  x0?: number
  x1?: number
  amp: number
  freq?: number
  speed?: number
  /** Balança mais perto do topo da faixa (gramínea) em vez de uniforme (calor). */
  top?: boolean
}

export interface DustConfig {
  count: number
  zone: [number, number, number, number]
}

export interface HawkConfig {
  center: Point
  r: [number, number]
  sp: number
}

export interface LightConfig {
  sun: Point
  ray: string
  rayAmt: number
  /** [x, y, raio, "r,g,b"] — lanternas, janelas, fogo. */
  glow: [number, number, number, string][]
}

export interface AuroraConfig {
  x0: number
  x1: number
  bands: [number, number, string][]
}

export interface GardenTheme {
  slug: string
  label: string
  /** As 4 imagens do jardim, na ordem recém-plantado → completo. */
  stages: [string, string, string, string]
  water: WaterConfig
  fall: FallConfig
  flyers: FlyersConfig
  birds: BirdsConfig
  light: LightConfig
  /** Número de carpas — só o jardim japonês tem lago de koi. */
  koi?: number
  waterfall?: WaterfallConfig
  mist?: MistConfig
  ducks?: DuckConfig[]
  shimmer?: ShimmerBand[]
  dust?: DustConfig
  hawk?: HawkConfig
  stars?: [number, number, number][]
  owl?: Point
  smoke?: Point
  aurora?: AuroraConfig
}

function stagesFor(slug: string): [string, string, string, string] {
  return [
    `/gardens/${slug}/01.webp`,
    `/gardens/${slug}/23.webp`,
    `/gardens/${slug}/45.webp`,
    `/gardens/${slug}/6.webp`,
  ]
}

export const GARDEN_THEMES: GardenTheme[] = [
  {
    slug: 'japones',
    label: 'Jardim japonês · outono',
    stages: stagesFor('japones'),
    water: {
      kind: 'pond', reflect: true, tint: '#33564c', drip: 6,
      poly: [
        [0.410, 0.475], [0.520, 0.445], [0.625, 0.442], [0.755, 0.470], [0.880, 0.445],
        [0.980, 0.485], [1.001, 0.605], [1.001, 1.001], [0.575, 1.001], [0.470, 0.880],
        [0.420, 0.680], [0.408, 0.520],
      ],
    },
    koi: 7,
    fall: {
      count: 48,
      emitters: [
        { kind: 'maple', weight: 0.78, colors: ['#b5401f', '#8f2f18', '#c9662f', '#7a2415'], zone: [0.46, 0.0, 0.86, 0.5] },
        { kind: 'ginkgo', weight: 0.22, colors: ['#d9a838', '#c48f2b'], zone: [0.46, 0.0, 0.86, 0.5] },
      ],
    },
    flyers: { butterflies: 5, butColors: ['#e8894d', '#c85f86', '#5f79c0'] },
    birds: { kind: 'swallows', count: 5 },
    light: {
      sun: [0.20, 0.02], ray: '#f8e4be', rayAmt: 0.16,
      glow: [[0.386, 0.492, 26, '248,199,120'], [0.902, 0.205, 30, '240,180,106']],
    },
  },
  {
    slug: 'cottage',
    label: 'Cottage inglês · verão',
    stages: stagesFor('cottage'),
    water: { kind: 'basin', center: [0.930, 0.778], rx: 0.074, ry: 0.027, tint: '#cfe0e6', drip: 5.5 },
    fall: {
      count: 50,
      emitters: [{ kind: 'petal', weight: 1, colors: ['#f4c4d4', '#eaa9c0', '#fbdce6', '#e493ae', '#f7d0b8'], zone: [0.44, -0.06, 0.82, 0.55] }],
    },
    flyers: { butterflies: 3, bees: 8 },
    birds: { kind: 'swallows', count: 3 },
    light: { sun: [0.16, 0.12], ray: '#fbe6c2', rayAmt: 0.20, glow: [[0.936, 0.188, 26, '246,206,140']] },
  },
  {
    slug: 'mediterraneo',
    label: 'Mediterrâneo · fim de tarde',
    stages: stagesFor('mediterraneo'),
    water: {
      kind: 'basin', center: [0.755, 0.855], rx: 0.165, ry: 0.062, tint: '#cdd8d0', drip: 3.4,
      ripFrom: [0.86, 0.80], thread: [0.865, 0.70, 0.865, 0.82],
    },
    fall: {
      count: 46,
      emitters: [
        { kind: 'olive', weight: 0.68, colors: ['#9fb191', '#b9c6ab', '#8a9d7e', '#cdd4c2'], zone: [0.50, -0.05, 0.90, 0.52] },
        { kind: 'petal', weight: 0.32, colors: ['#c9337e', '#d94f97', '#b8286f', '#e06fac'], zone: [0.00, -0.06, 0.20, 0.36] },
      ],
    },
    flyers: { butterflies: 3, bees: 10 },
    birds: { kind: 'swallows', count: 4 },
    light: { sun: [0.16, 0.15], ray: '#fcdcb4', rayAmt: 0.24, glow: [[0.205, 0.315, 30, '250,210,150']] },
  },
  {
    slug: 'mata-atlantica',
    label: 'Mata atlântica · amanhecer',
    stages: stagesFor('mata-atlantica'),
    water: {
      kind: 'pond', tint: '#4a6a63', drip: 2.8, ripFrom: [0.885, 0.78],
      poly: [
        [0.42, 0.775], [0.50, 0.755], [0.63, 0.745], [0.78, 0.735], [0.90, 0.755],
        [0.955, 0.83], [0.95, 1.001], [0.55, 1.001], [0.47, 0.90], [0.425, 0.80],
      ],
    },
    waterfall: { x0: 0.855, x1: 0.945, top: 0.50, bottom: 0.755, land: [0.895, 0.77] },
    mist: { bands: 3, y0: 0.22, y1: 0.44, amt: 0.16 },
    fall: {
      count: 48,
      emitters: [{ kind: 'petal', weight: 1, colors: ['#e879a8', '#e05f97', '#f29ec2', '#d84f8c', '#f7c0d8'], zone: [0.62, -0.05, 1.02, 0.30] }],
    },
    flyers: { butterflies: 3, hummingbirds: 2, hbZone: [0.02, 0.30, 0.48, 0.66], butColors: ['#3a6fce', '#2f5bb0', '#dfa0c6'] },
    birds: { kind: 'none' },
    light: { sun: [0.27, 0.16], ray: '#eef0c8', rayAmt: 0.22, glow: [[0.27, 0.17, 40, '250,232,190']] },
  },
  {
    slug: 'giverny',
    label: 'Giverny · fim de primavera',
    stages: stagesFor('giverny'),
    water: {
      kind: 'pond', reflect: true, tint: '#93a8a2', drip: 5, ripFrom: [0.52, 0.62],
      poly: [[0.27, 0.455], [0.46, 0.415], [0.68, 0.40], [0.88, 0.40], [1.001, 0.42], [1.001, 1.001], [0.30, 1.001], [0.255, 0.72]],
    },
    ducks: [{ path: [0.78, 0.52, 0.42, 0.66], sp: 1.0, per: 20, col: '#3c3a35' }],
    mist: { bands: 2, y0: 0.30, y1: 0.40, amt: 0.10 },
    fall: {
      count: 44,
      emitters: [{ kind: 'petal', weight: 1, colors: ['#c9b8e0', '#b7a2d6', '#d9cce9', '#a98fc9', '#e6def0'], zone: [0.60, 0.14, 1.0, 0.42] }],
    },
    flyers: { butterflies: 2, dragonflies: 4, butColors: ['#f2f0e8', '#e0d070', '#8fb0d8'] },
    birds: { kind: 'none' },
    light: { sun: [0.5, 0.05], ray: '#f0f0e8', rayAmt: 0.05, glow: [] },
  },
  {
    slug: 'deserto',
    label: 'Deserto · amanhecer',
    stages: stagesFor('deserto'),
    water: {
      kind: 'pond', reflect: true, tint: '#5c6f78', drip: 6,
      poly: [[0.632, 0.625], [1.001, 0.605], [1.001, 1.001], [0.70, 1.001], [0.655, 0.83]],
    },
    shimmer: [
      { y0: 0.30, y1: 0.40, x0: 0, x1: 1, amp: 1.4, freq: 0.09, speed: 0.7 },
      { y0: 0.55, y1: 0.74, x0: 0, x1: 0.56, amp: 1.1, freq: 0.05, speed: 0.9, top: true },
    ],
    dust: { count: 26, zone: [0.05, 0.45, 0.95, 0.92] },
    hawk: { center: [0.5, 0.12], r: [0.30, 0.055], sp: 0.12 },
    fall: { count: 0, emitters: [] },
    flyers: { butterflies: 2, hummingbirds: 1, hbZone: [0.55, 0.55, 0.92, 0.78], butColors: ['#e8c34d', '#d98a3c', '#f2ede0'] },
    birds: { kind: 'none' },
    light: { sun: [0.10, 0.16], ray: '#ffd9a8', rayAmt: 0.20, glow: [[0.365, 0.365, 16, '250,190,120']] },
  },
  {
    slug: 'noturno',
    label: 'Jardim noturno · lua cheia',
    stages: stagesFor('noturno'),
    water: {
      kind: 'pond', reflect: true, tint: '#3a4a63', drip: 8,
      poly: [[0.42, 0.62], [0.60, 0.585], [0.80, 0.58], [1.001, 0.60], [1.001, 1.001], [0.46, 1.001], [0.42, 0.78]],
    },
    stars: [
      [0.15, 0.08, 1.2], [0.25, 0.05, 1], [0.35, 0.12, 1.3], [0.55, 0.06, 1], [0.65, 0.15, 1.2],
      [0.75, 0.04, 1], [0.90, 0.10, 1.4], [0.20, 0.20, 1], [0.46, 0.18, 1.1], [0.95, 0.22, 1],
    ],
    owl: [0.305, 0.285],
    fall: {
      count: 14,
      emitters: [{ kind: 'petal', weight: 1, colors: ['#f5f2e6', '#eae4d0', '#fbfaf3'], zone: [0.55, 0.30, 1.0, 0.60] }],
    },
    flyers: { butterflies: 3, fireflies: 34, butColors: ['#efe9da', '#e6ddc6', '#f4f0e4'] },
    birds: { kind: 'none' },
    light: {
      sun: [0.83, 0.09], ray: '#c9d6ee', rayAmt: 0,
      glow: [
        [0.835, 0.095, 58, '222,230,250'], [0.020, 0.660, 20, '250,196,120'], [0.090, 0.585, 18, '250,196,120'],
        [0.115, 0.475, 16, '250,196,120'], [0.500, 0.635, 14, '250,196,120'], [0.565, 0.265, 15, '250,205,130'],
      ],
    },
  },
  {
    slug: 'nordico',
    label: 'Inverno nórdico · hora azul',
    stages: stagesFor('nordico'),
    water: {
      kind: 'pond', reflect: true, tint: '#2c3a4a', drip: 3.2,
      poly: [
        [0.42, 0.565], [0.58, 0.55], [0.75, 0.565], [0.92, 0.60], [1.001, 0.66],
        [1.001, 1.001], [0.28, 1.001], [0.34, 0.82], [0.40, 0.65],
      ],
    },
    aurora: { x0: 0.30, x1: 1.02, bands: [[0.03, 0.11, '#6fd9a0'], [0.08, 0.17, '#9db8e8'], [0.13, 0.22, '#5fcf95']] },
    smoke: [0.377, 0.238],
    stars: [
      [0.20, 0.06, 1.1], [0.30, 0.03, 1], [0.12, 0.10, 1.2], [0.42, 0.05, 1], [0.06, 0.16, 1],
      [0.24, 0.14, 1.1], [0.35, 0.09, 1],
    ],
    fall: {
      count: 70,
      emitters: [{ kind: 'snow', weight: 1, colors: ['#ffffff', '#eef3f7', '#e3ebf1'], zone: [0.0, -0.06, 1.0, 0.15] }],
    },
    flyers: {},
    birds: { kind: 'none' },
    light: {
      sun: [0.5, 0.05], ray: '#dfe8f2', rayAmt: 0,
      glow: [[0.335, 0.335, 14, '246,206,140'], [0.06, 0.62, 18, '250,196,120'], [0.115, 0.565, 16, '250,196,120'], [0.155, 0.51, 15, '250,196,120']],
    },
  },
]

/** Nomes dos 4 estágios visuais, na ordem das imagens (para alt text e acessibilidade). */
export const GARDEN_STAGE_NAMES = ['recém-plantado', 'pegando', 'maduro', 'completo'] as const

/**
 * Progresso contínuo (0..1) dentro do jardim atual, alinhado aos limiares de estágio do
 * modelo de crescimento em supabase/migrations/20260909123000_garden_balanced_growth_v4.sql
 * (garden_progress vai de 0 a 59; estágios 0+1 → imagem 0, 2+3 → imagem 1, 4+5 → imagem 2,
 * 6 → imagem 3). Se a fórmula de estágios mudar, estes limiares precisam acompanhar.
 */
export function gardenVisualProgress(gardenProgress: number): number {
  // 3 transições cobrindo as 4 imagens (img0→1 até gp=10, 1→2 até 28, 2→3 até 50). A partir
  // de 50 não há uma 5ª imagem para onde ir — o jardim maduro fica em img3 pura (progress=1)
  // até o ciclo virar. O `return 1` após o laço cobre exatamente essa cauda (gp 50..59).
  const breakpoints = [0, 10, 28, 50]
  const clamped = Math.max(0, Math.min(59, gardenProgress))
  for (let i = 0; i < 3; i++) {
    const lo = breakpoints[i]
    const hi = breakpoints[i + 1]
    if (clamped <= hi) {
      const span = hi - lo
      const local = span > 0 ? (clamped - lo) / span : 1
      return (i + Math.max(0, Math.min(1, local))) / 3
    }
  }
  return 1
}

export function gardenThemeFor(gardenIndex: number): GardenTheme {
  const i = ((gardenIndex % GARDEN_THEMES.length) + GARDEN_THEMES.length) % GARDEN_THEMES.length
  return GARDEN_THEMES[i]
}
