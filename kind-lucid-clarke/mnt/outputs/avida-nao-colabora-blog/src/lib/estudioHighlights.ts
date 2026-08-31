// Capas de destaque do Instagram (Fase 4c) — puro.
// Um destaque é um story salvo; a capa é o círculo que aparece no perfil.
// O Estúdio gera um jogo on-brand; a organização de quais frames entram em
// cada destaque continua manual (1 toque no app).

export interface HighlightCover {
  id: string
  emoji: string
  label: string
}

export const HIGHLIGHT_SPEC = { width: 1080, height: 1920 } as const

// A área visível da capa é um círculo centralizado — o conteúdo precisa ficar
// no miolo. Fração do lado menor usada como "zona segura circular".
export const HIGHLIGHT_SAFE_FRACTION = 0.5

export const DEFAULT_HIGHLIGHTS: HighlightCover[] = [
  { id: 'comece', emoji: '🌱', label: 'Comece aqui' },
  { id: 'diario', emoji: '📓', label: 'Diário' },
  { id: 'mapa', emoji: '🗺️', label: 'Mapa' },
  { id: 'blog', emoji: '📰', label: 'Do blog' },
  { id: 'voces', emoji: '💬', label: 'Vocês contam' },
  { id: 'duvidas', emoji: '❓', label: 'Dúvidas' },
]

export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'destaque'
}

export function highlightFilename(cover: HighlightCover): string {
  return `destaque-${slugifyLabel(cover.label)}-1080x1920.png`
}

let seq = 0
export function newHighlight(): HighlightCover {
  seq += 1
  return { id: `novo-${Date.now()}-${seq}`, emoji: '✨', label: 'Novo destaque' }
}
