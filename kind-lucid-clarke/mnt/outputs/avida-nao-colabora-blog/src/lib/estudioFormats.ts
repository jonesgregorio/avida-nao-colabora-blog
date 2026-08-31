// Catálogo de formatos do Instagram + validador de arte.
// Puro e sem I/O — a renderização em si fica em estudioRender.ts.
//
// Dimensões e proporções conferidas contra o que o Instagram aceita hoje:
// feed 1080×1350 (4:5) / 1080×1080 (1:1); story e reel 1080×1920 (9:16);
// carrossel na mesma proporção do feed, até 20 slides.

export interface FormatSpec {
  id: string
  label: string
  width: number
  height: number
  /** proporção-alvo (width/height) e tolerância aceita */
  ratio: number
  ratioTolerance: number
  /** zona coberta pela interface do Instagram, em fração da altura */
  safeTop?: number
  safeBottom?: number
  /** true = a grade do perfil mostra só o quadrado central (capa de reel) */
  gridCenterCrop?: boolean
  /** limite prático de peso do arquivo (bytes) */
  maxBytes: number
  /** nº de artes que este formato gera (carrossel = várias) */
  slides?: number
}

const PHOTO_MAX_BYTES = 8 * 1024 * 1024 // Instagram aceita até 30 MB; 8 é folga confortável para PNG.

export const FORMAT_SPECS: Record<string, FormatSpec> = {
  'feed-45': { id: 'feed-45', label: 'Feed · retrato', width: 1080, height: 1350, ratio: 4 / 5, ratioTolerance: 0.02, maxBytes: PHOTO_MAX_BYTES },
  'feed-11': { id: 'feed-11', label: 'Feed · quadrado', width: 1080, height: 1080, ratio: 1, ratioTolerance: 0.02, maxBytes: PHOTO_MAX_BYTES },
  carrossel: { id: 'carrossel', label: 'Carrossel', width: 1080, height: 1350, ratio: 4 / 5, ratioTolerance: 0.02, maxBytes: PHOTO_MAX_BYTES, slides: 6 },
  story: { id: 'story', label: 'Story', width: 1080, height: 1920, ratio: 9 / 16, ratioTolerance: 0.02, safeTop: 0.13, safeBottom: 0.13, maxBytes: PHOTO_MAX_BYTES },
  'reel-capa': { id: 'reel-capa', label: 'Reel · capa', width: 1080, height: 1920, ratio: 9 / 16, ratioTolerance: 0.02, safeBottom: 0.22, gridCenterCrop: true, maxBytes: PHOTO_MAX_BYTES },
  quiz: { id: 'quiz', label: 'Quiz "mito ou verdade"', width: 1080, height: 1350, ratio: 4 / 5, ratioTolerance: 0.02, maxBytes: PHOTO_MAX_BYTES, slides: 2 },
  // Capa de destaque: mesma proporção de story; o perfil só mostra o círculo central.
  destaque: { id: 'destaque', label: 'Capa de destaque', width: 1080, height: 1920, ratio: 9 / 16, ratioTolerance: 0.02, maxBytes: PHOTO_MAX_BYTES },
}

export const FORMAT_ORDER = ['feed-45', 'feed-11', 'carrossel', 'story', 'reel-capa', 'quiz'] as const

export interface AssetCheck {
  width: number
  height: number
  bytes: number
}

export interface ValidationResult {
  ok: boolean
  problems: string[]
}

export function validateAsset(spec: FormatSpec, asset: AssetCheck): ValidationResult {
  const problems: string[] = []

  if (asset.width !== spec.width || asset.height !== spec.height) {
    problems.push(`dimensão ${asset.width}×${asset.height}, esperado ${spec.width}×${spec.height}`)
  }

  const ratio = asset.width / asset.height
  if (Math.abs(ratio - spec.ratio) > spec.ratioTolerance) {
    problems.push(`proporção ${ratio.toFixed(3)} fora da faixa aceita (${spec.ratio.toFixed(3)} ± ${spec.ratioTolerance})`)
  }

  if (asset.bytes > spec.maxBytes) {
    problems.push(`arquivo ${(asset.bytes / 1024 / 1024).toFixed(1)} MB acima do limite de ${(spec.maxBytes / 1024 / 1024).toFixed(0)} MB`)
  }

  if (asset.bytes <= 0) problems.push('arquivo vazio')

  return { ok: problems.length === 0, problems }
}

/** Fração vertical utilizável (fora das zonas cobertas pela interface). */
export function safeInsets(spec: FormatSpec): { top: number; bottom: number } {
  return { top: spec.safeTop ?? 0, bottom: spec.safeBottom ?? 0 }
}
