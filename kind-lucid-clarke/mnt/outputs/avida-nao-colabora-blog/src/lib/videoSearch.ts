import { supabase } from './supabase'

// ─── Busca de vídeo relacionado ao ARTIGO (Admin) ─────────────────────────────
// A query é montada com os DADOS REAIS do artigo (nunca genérica), a Edge
// Function youtube-search devolve candidatos, e aqui pontuamos por relevância e
// penalizamos repetição. O admin escolhe — nunca inserimos por conta própria.

export interface VideoArticleInput {
  id?: string | null
  title?: string
  category?: string
  tags?: string          // csv
  keyword?: string
  secondary_keywords?: string // csv
  summary?: string
  emotion?: string
  emotional_themes?: string   // csv
  content?: string
}

export interface VideoCandidate {
  videoId: string
  title: string
  channel: string
  description: string
  thumbnail: string | null
  url: string
  embedUrl: string
  durationSeconds: number
  views: number
  score?: number
  relevance?: 'muito' | 'relacionado' | 'pouco'
  usedElsewhere?: boolean
}

function deburr(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const STOPWORDS = new Set([
  'a','o','os','as','de','da','do','das','dos','e','em','no','na','nos','nas','um','uma','uns','umas',
  'para','por','com','sem','que','se','ao','aos','à','às','como','mais','menos','muito','ser','ter','você',
  'voce','sua','seu','suas','seus','isso','este','esta','esse','essa','quando','onde','porque','sobre','the',
])

// Termos por tema (do briefing) — ENRIQUECEM a busca a partir de sinais do artigo,
// nunca substituem o título. Mapa: palavra-gatilho -> termos extras.
const THEME_TERMS: { match: RegExp; terms: string[] }[] = [
  { match: /cansa|esgot|exaust|render|desacel|sobrecarg|burnout|produtiv/, terms: ['cansaço emocional', 'descanso', 'desacelerar', 'esgotamento'] },
  { match: /diari|journal|escrit|escrev|registr/, terms: ['diário emocional', 'escrita terapêutica', 'journaling', 'autoconhecimento'] },
  { match: /check-?in|autoperc|nomear|como estou/, terms: ['check-in emocional', 'autopercepção', 'nomear emoções'] },
  { match: /ansied|acelerad|tens|pânico|panico|respir/, terms: ['ansiedade', 'respiração', 'regulação emocional'] },
  { match: /autocuid|pausa|descans|rotina|leve/, terms: ['autocuidado', 'pausa', 'descanso sem culpa'] },
  { match: /padr|mapa|frequen|clareza/, terms: ['padrões emocionais', 'autoconhecimento', 'mapa emocional'] },
  { match: /culpa|autocobr|perfeccion|comparaç|comparac|limit/, terms: ['autocobrança', 'culpa ao descansar', 'produtividade tóxica'] },
]

function csv(s?: string): string[] {
  return (s || '').split(/[,;]+/).map(t => t.trim()).filter(Boolean)
}

/** Palavras-chave "fortes" do artigo (para montar query e pontuar). */
function articleKeywords(a: VideoArticleInput): string[] {
  const raw = [a.title, a.keyword, a.category, ...csv(a.tags), ...csv(a.secondary_keywords), ...csv(a.emotional_themes), a.emotion]
    .filter(Boolean).join(' ')
  const words = deburr(raw).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOPWORDS.has(w))
  return [...new Set(words)]
}

/** Monta a query de busca com os DADOS REAIS do artigo (determinística). */
export function buildArticleVideoQuery(a: VideoArticleInput): string {
  const base: string[] = []
  if (a.title) base.push(a.title.trim())
  if (a.keyword) base.push(a.keyword.trim())
  const tags = csv(a.tags).slice(0, 3)
  base.push(...tags)
  if (a.category) base.push(a.category.trim())

  // Enriquece com termos do tema (a partir do título+tags+categoria+emoção).
  const signal = deburr([a.title, a.tags, a.category, a.emotion, a.keyword].filter(Boolean).join(' '))
  const extra = new Set<string>()
  for (const t of THEME_TERMS) if (t.match.test(signal)) t.terms.forEach(x => extra.add(x))

  // Dedup mantendo ordem; corta em ~12 palavras para não diluir a relevância.
  const seen = new Set<string>()
  const parts: string[] = []
  for (const chunk of [...base, ...extra]) {
    const norm = deburr(chunk)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    parts.push(chunk)
  }
  const q = parts.join(' ').split(/\s+/).slice(0, 12).join(' ')
  return `${q} em português`.trim()
}

// ─── Vídeos já usados em OUTROS artigos (anti-repetição) ─────────────────────
// Lê o conteúdo dos artigos e extrai os IDs de vídeo dos marcadores ::video[...](...).
export async function getUsedVideoIds(excludeArticleId?: string | null): Promise<Set<string>> {
  const used = new Set<string>()
  try {
    const { data } = await supabase.from('articles').select('id, content').not('content', 'is', null).limit(1000)
    for (const row of (data ?? []) as { id: string; content: string | null }[]) {
      if (excludeArticleId && row.id === excludeArticleId) continue
      const matches = (row.content || '').matchAll(/::video\[[^\]]*\]\(([^)\s]+)\)/g)
      for (const m of matches) {
        const id = youtubeIdFromUrl(m[1])
        if (id) used.add(id)
      }
    }
  } catch { /* sem dedup se falhar — não bloqueia a busca */ }
  return used
}

// ─── Pontuação de relevância ─────────────────────────────────────────────────
function scoreCandidate(c: VideoCandidate, a: VideoArticleInput, usedIds: Set<string>): { score: number; usedElsewhere: boolean } {
  const kws = articleKeywords(a)
  const text = deburr(`${c.title} ${c.description}`)
  let score = 0
  let hits = 0

  for (const w of kws) {
    if (text.includes(w)) { score += 8; hits++ }
  }
  // Título do artigo tem peso extra
  for (const w of deburr(a.title || '').split(/\s+/).filter(w => w.length >= 5 && !STOPWORDS.has(w))) {
    if (text.includes(w)) score += 3
  }
  // Categoria
  if (a.category && text.includes(deburr(a.category))) score += 6
  // Tema compatível (emoção/diário/ansiedade/rotina/cansaço/autocuidado)
  if (/autocuid|emoç|emoc|diario|diári|ansied|rotina|cansa|descans|desacel|autoconhec/.test(text)) score += 4

  // Duração: preferir 3–15 min; punir shorts e vídeos muito longos.
  if (c.durationSeconds > 0) {
    if (c.durationSeconds >= 180 && c.durationSeconds <= 900) score += 3
    else if (c.durationSeconds < 70) score -= 12
    else if (c.durationSeconds > 1800) score -= 5
  }
  // Popularidade mínima (confiança)
  if (c.views >= 5000) score += 2
  else if (c.views > 0 && c.views < 300) score -= 3

  // Sem relação clara com o tema do artigo
  if (hits === 0) score -= 50

  // Anti-repetição: já usado em outro artigo
  const usedElsewhere = usedIds.has(c.videoId)
  if (usedElsewhere) score -= 30

  return { score, usedElsewhere }
}

/** Busca candidatos para o artigo, pontua e ordena (melhor primeiro). */
export async function searchArticleVideos(a: VideoArticleInput): Promise<{ query: string; candidates: VideoCandidate[]; error?: string }> {
  const query = buildArticleVideoQuery(a)
  const [{ data, error }, usedIds] = await Promise.all([
    supabase.functions.invoke('youtube-search', { body: { query, maxResults: 12 } }),
    getUsedVideoIds(a.id),
  ])
  const out = data as { candidates?: VideoCandidate[]; error?: string } | null
  if (error || out?.error) return { query, candidates: [], error: out?.error || error?.message }
  const scored = (out?.candidates ?? []).map(c => {
    const { score, usedElsewhere } = scoreCandidate(c, a, usedIds)
    const relevance: VideoCandidate['relevance'] = score >= 18 ? 'muito' : score >= 6 ? 'relacionado' : 'pouco'
    return { ...c, score, usedElsewhere, relevance }
  }).sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
  return { query, candidates: scored }
}

// ─── URL manual: validação + normalização para embed ─────────────────────────
export function youtubeIdFromUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?[^\s]*\bv=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

/** Constrói o marcador ::video[legenda](embed) a partir de uma URL/candidato. */
export function videoMarker(idOrUrl: string, caption: string): string | null {
  const id = idOrUrl.length === 11 && /^[\w-]{11}$/.test(idOrUrl) ? idOrUrl : youtubeIdFromUrl(idOrUrl)
  if (!id) return null
  const legenda = (caption || '').replace(/[[\]]/g, '').trim() || 'Vídeo de referência'
  return `::video[${legenda}](https://www.youtube-nocookie.com/embed/${id})`
}

// ─── Vídeo relacionado dentro do CONTEÚDO (uma linha ::video no topo) ─────────
const VIDEO_LINE_RE = /^[ \t]*::video\[[^\]]*\]\([^)\s]+\)[ \t]*\r?\n?/gm

/** Id do vídeo relacionado já presente no conteúdo (ou null). */
export function currentRelatedVideoId(content: string): string | null {
  const m = (content || '').match(/::video\[[^\]]*\]\(([^)\s]+)\)/)
  return m ? youtubeIdFromUrl(m[1]) : null
}

/** Define o vídeo relacionado: remove qualquer vídeo antigo e coloca o novo no topo. */
export function setRelatedVideoInContent(content: string, marker: string): string {
  const stripped = (content || '').replace(VIDEO_LINE_RE, '').replace(/^\s+/, '')
  return `${marker}\n\n${stripped}`
}

/** Remove o(s) vídeo(s) do conteúdo. */
export function removeRelatedVideoFromContent(content: string): string {
  return (content || '').replace(VIDEO_LINE_RE, '').replace(/^\s+/, '')
}
