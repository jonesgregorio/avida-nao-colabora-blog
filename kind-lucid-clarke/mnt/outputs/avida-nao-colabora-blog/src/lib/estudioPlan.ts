// Plano da semana do Estúdio (Fase 2b) — puro, sem I/O.
// Tipos do contexto do blog + montagem/parse do pedido à IA.
// O fetch real do contexto fica em estudioBlogContext.ts.

export interface CategoryCoverage {
  categoria: string
  artigos: number
  views: number
  ultimoPost: string | null // ISO
  diasSemPost: number | null
}

export interface BlogContext {
  cobertura: CategoryCoverage[]
  geradoEm: string
}

export interface PlanItem {
  diaOffset: number // 0 = hoje, 1 = amanhã…
  formato: string // id de FORMAT_SPECS
  temaCategoria: string
  ideia: string
  objetivo: string
}

const FORMATOS_VALIDOS = new Set(['feed-45', 'feed-11', 'carrossel', 'story', 'reel-capa', 'quiz'])

/** Resumo curto e legível da cobertura, para injetar no prompt da IA. */
export function coberturaResumo(ctx: BlogContext): string {
  return ctx.cobertura
    .slice(0, 12)
    .map(c => {
      const gap = c.diasSemPost === null ? 'sem post' : `${c.diasSemPost}d sem post`
      return `- ${c.categoria}: ${c.artigos} artigos, ${c.views} views, ${gap}`
    })
    .join('\n')
}

export function buildWeekPlanRequest(ctx: BlogContext): string {
  return [
    'Você é editor de social media de uma marca de saúde emocional ("A Vida Não Colabora").',
    'Monte um plano de 1 semana para o Instagram (4 a 5 posts), equilibrando alcance e conversão.',
    'Priorize temas que estão há mais tempo sem post, sem abandonar os que mais engajam.',
    'Varie os formatos: carrossel para conteúdo que converte, reel para topo de funil, story para relação.',
    'Tom acolhedor, adulto, sem clichê de autoajuda. Português brasileiro.',
    '',
    'Cobertura atual do blog por tema:',
    coberturaResumo(ctx) || '(sem dados de cobertura)',
    '',
    'Formatos possíveis: feed-45, feed-11, carrossel, story, reel-capa, quiz.',
    '',
    'Retorne SOMENTE um JSON válido, sem markdown:',
    '{',
    '  "posts": [',
    '    { "dia_offset": 0, "formato": "carrossel", "tema_categoria": "Sono", "ideia": "…", "objetivo": "salvar" }',
    '  ]',
    '}',
    'dia_offset: inteiro de 0 a 6. objetivo: um de salvar, compartilhar, comentar, blog, alcance.',
  ].join('\n')
}

export function parseWeekPlan(json: Record<string, unknown>): PlanItem[] {
  const posts = Array.isArray(json.posts) ? (json.posts as unknown[]) : []
  return posts
    .map((p): PlanItem | null => {
      const o = p as Record<string, unknown>
      const formato = String(o.formato ?? '').trim()
      if (!FORMATOS_VALIDOS.has(formato)) return null
      const diaOffsetRaw = Number(o.dia_offset)
      const diaOffset = Number.isFinite(diaOffsetRaw) ? Math.min(6, Math.max(0, Math.round(diaOffsetRaw))) : 0
      const ideia = String(o.ideia ?? '').trim()
      if (ideia.length < 6) return null
      return {
        diaOffset,
        formato,
        temaCategoria: String(o.tema_categoria ?? '').trim(),
        ideia,
        objetivo: String(o.objetivo ?? 'salvar').trim(),
      }
    })
    .filter((x): x is PlanItem => x !== null)
    .sort((a, b) => a.diaOffset - b.diaOffset)
}

/** Data ISO a partir do offset em dias, marcada às 19h locais. */
export function offsetToDate(diaOffset: number, base = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() + diaOffset)
  d.setHours(19, 0, 0, 0)
  return d.toISOString()
}
