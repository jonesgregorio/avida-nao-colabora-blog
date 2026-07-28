import { supabase } from './supabase'

// ─── Vídeo relacionado ao ARTIGO — foco em RELEVÂNCIA (Admin) ─────────────────
// Fluxo: extrai a INTENÇÃO real do artigo → gera queries específicas e
// desambiguadas → busca candidatos (youtube-search) → pontua 0–100 → REJEITA
// vídeos fora do tema → mostra só os ≥65, com o MOTIVO. Nunca insere sozinho,
// nunca usa fallback fixo. A query é 100% derivada dos dados do artigo.

export interface VideoArticleInput {
  id?: string | null
  title?: string
  category?: string
  tags?: string
  keyword?: string
  secondary_keywords?: string
  summary?: string
  emotion?: string
  emotional_themes?: string
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
  reason?: string
  usedInArticleTitle?: string | null
}

function deburr(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
const STOPWORDS = new Set(['a','o','os','as','de','da','do','das','dos','e','em','no','na','nos','nas','um','uma','para','por','com','sem','que','se','ao','à','às','como','mais','sua','seu','isso','este','esta','esse','essa','quando','onde','porque','sobre','the','voce','você','dia','todo','nao','não'])

// ─── Temas do blog: termos fortes, negativos e desambiguação ─────────────────
interface Theme {
  id: string
  match: RegExp                 // detecta o tema a partir do artigo
  mainTopic: string
  strong: string[]              // termos fortes (mustHave/niceToHave)
  ambiguous?: RegExp            // palavra ambígua que precisa de contexto emocional
  context: RegExp               // contexto emocional que valida a palavra ambígua
  reject?: RegExp               // termos que, para ESTE tema, indicam vídeo errado
}
const EMO_CTX = /emoc|emoç|sentiment|autoconhec|autoperc|saude emocional|saúde emocional|humor(?!ist)|bem-?estar/

const THEMES: Theme[] = [
  { id: 'diario', match: /di[áa]rio|journal|escrit|escrev|registr/, mainTopic: 'diário emocional',
    strong: ['diário emocional','journaling','escrita terapêutica','escrever sentimentos','escrita guiada','registro emocional','autoconhecimento'],
    ambiguous: /di[áa]rio/, context: /emoc|emoç|sentiment|journal|autoconhec/,
    reject: /viagem|vlog|escolar|aliment|di[áa]rio de bordo|rotina di[áa]ria/ },
  { id: 'checkin', match: /check-?in|autoperc|nomear|como estou|registrar emoç/, mainTopic: 'check-in emocional',
    strong: ['check-in emocional','autopercepção','nomear emoções','registrar emoções','observar sentimentos','como estou hoje','pausa emocional'],
    ambiguous: /check-?in/, context: /emoc|emoç|sentiment|autoperc|humor|saude emocional|saúde emocional/,
    reject: /hotel|viagem|aeroporto|hospedagem|embarque|presenç|evento|voo|reserva|passagem/ },
  { id: 'mapa', match: /padr[õo]|mapa emocional|frequen|recorrent|clareza/, mainTopic: 'padrões emocionais',
    strong: ['padrões emocionais','emoções recorrentes','acompanhar emoções','autoconhecimento','clareza emocional','diário emocional'],
    ambiguous: /padr[õo]/, context: /emoc|emoç|sentiment|autoconhec/,
    reject: /matem[áa]tic|programa[çc]|design pattern|costura|modelagem|estat[íi]stic|planilha|croch|tric[ôo]/ },
  { id: 'cansaco', match: /cansa|esgot|exaust|render|desacel|sobrecarg|burnout|energia baixa|desanim/, mainTopic: 'cansaço emocional',
    strong: ['cansaço emocional','esgotamento','sobrecarga','descanso','desacelerar','pausa','energia baixa'],
    context: EMO_CTX,
    reject: /finan[çc]|estudo|academia|gym|treino|dinheiro|motiva[çc][ãa]o para trabalhar|alta performance/ },
  { id: 'autocobranca', match: /autocobr|culpa|perfeccion|compara[çc]|cobran[çc]a|produtividade t[óo]xica/, mainTopic: 'culpa ao descansar e autocobrança',
    strong: ['autocobrança','culpa ao descansar','produtividade tóxica','descanso sem culpa','perfeccionismo','cobrança interna'],
    context: EMO_CTX,
    reject: /religi|gospel|louvor|rotina de sucesso|alta performance|academia|finan[çc]|coach/ },
  { id: 'ansiedade', match: /ansied|acelerad|tens[ãa]o|p[âa]nico|preocupa[çc]|respira/, mainTopic: 'ansiedade e sobrecarga',
    strong: ['ansiedade','pensamentos acelerados','sobrecarga mental','tensão emocional','respiração','regulação emocional'],
    context: EMO_CTX,
    reject: /rem[ée]dio|medica|diagn[óo]stic|cl[íi]nic/ },
  { id: 'autocuidado', match: /autocuid|cuidado emocional|rotina leve|pausa|descans/, mainTopic: 'autocuidado na vida real',
    strong: ['autocuidado','cuidado emocional','pausa','descanso','rotina leve','autocuidado possível'],
    context: EMO_CTX,
    reject: /skincare|beleza|maquiagem|spa|academia|dieta|emagrec/ },
  { id: 'relatorios', match: /relat[óo]rio|revis[ãa]o semanal|reflex[ãa]o semanal|semana|acompanhamento/, mainTopic: 'reflexão e organização emocional',
    strong: ['reflexão semanal','organização emocional','autoconhecimento','acompanhamento emocional','revisão da semana'],
    context: EMO_CTX,
    reject: /relat[óo]rio financeiro|trabalho|vendas|excel/ },
]

// Rejeição GLOBAL — vídeos que quase nunca têm relação com o blog.
const GLOBAL_REJECT = /m[úu]sica|clipe|playlist|louvor|ora[çc][ãa]o|culto|gospel|sermão|serm[ãa]o|coach\b|alta performance|ganhar dinheiro|concurso|prova\b|academia|emagrec|dieta|astrolog|tarot|previs[ãa]o|hor[óo]scopo|fofoca|pol[íi]tic|not[íi]cia|policial|\blive\b|stand.?up|com[ée]dia|piada|reels? de|status whats/

function csv(s?: string): string[] {
  return (s || '').split(/[,;]+/).map(t => t.trim()).filter(Boolean)
}

// ─── Intenção real do artigo ─────────────────────────────────────────────────
export interface ArticleVideoIntent {
  mainTopic: string
  strongTerms: string[]
  titleTerms: string[]
  themes: Theme[]
  searchIntent: string
}
export function extractArticleVideoIntent(a: VideoArticleInput): ArticleVideoIntent {
  const signal = deburr([a.title, a.tags, a.category, a.emotion, a.keyword, a.emotional_themes].filter(Boolean).join(' '))
  const themes = THEMES.filter(t => t.match.test(signal))
  const titleTerms = deburr(a.title || '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOPWORDS.has(w))
  const strongTerms = [...new Set([
    ...themes.flatMap(t => t.strong),
    ...(a.keyword ? [a.keyword] : []),
    ...csv(a.tags), ...csv(a.emotional_themes),
  ])].filter(Boolean)
  const mainTopic = themes[0]?.mainTopic || a.keyword?.trim() || (a.title || '').trim()
  return { mainTopic, strongTerms, titleTerms, themes, searchIntent: `vídeo sobre ${mainTopic}` }
}

// ─── Queries específicas (várias variações, com desambiguação) ───────────────
export function generateArticleVideoQueries(a: VideoArticleInput, intent?: ArticleVideoIntent): string[] {
  const it = intent ?? extractArticleVideoIntent(a)
  const disambig = it.themes.flatMap(t => t.ambiguous ? [it.themes[0]?.mainTopic ?? '', 'emoções', 'sentimentos'] : [])
  const q1 = [a.title, ...it.strongTerms.slice(0, 2), ...disambig].filter(Boolean).join(' ')
  const q2 = [it.mainTopic, ...it.strongTerms.slice(0, 3)].filter(Boolean).join(' ')
  const q3 = [it.mainTopic, ...(a.keyword ? [a.keyword] : []), ...csv(a.tags).slice(0, 2), ...disambig].filter(Boolean).join(' ')
  const seen = new Set<string>()
  const norm = (q: string) => `${q.split(/\s+/).slice(0, 12).join(' ').trim()} em português`
  return [q1, q2, q3].map(norm).filter(q => { const k = deburr(q); if (!k || seen.has(k)) return false; seen.add(k); return true }).slice(0, 3)
}

// ─── Vídeos já usados em OUTROS artigos (id -> título do artigo) ─────────────
export async function getUsedVideoMap(excludeArticleId?: string | null): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data } = await supabase.from('articles').select('id, title, content').not('content', 'is', null).limit(1000)
    for (const row of (data ?? []) as { id: string; title: string; content: string | null }[]) {
      if (excludeArticleId && row.id === excludeArticleId) continue
      for (const m of (row.content || '').matchAll(/::video\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const id = youtubeIdFromUrl(m[1])
        if (id && !map.has(id)) map.set(id, row.title)
      }
    }
  } catch { /* sem dedup se falhar */ }
  return map
}

// ─── Pontuação de relevância (0–100) + motivo/rejeição ───────────────────────
function scoreVideo(a: VideoArticleInput, intent: ArticleVideoIntent, c: VideoCandidate, usedMap: Map<string, string>): VideoCandidate {
  const text = deburr(`${c.title} ${c.description}`)
  const titleText = deburr(c.title)
  const usedTitle = usedMap.get(c.videoId) ?? null

  // 1) Rejeições duras → score 0 (não aparece).
  const reject = (): VideoCandidate => ({ ...c, score: 0, relevance: 'pouco', reason: '', usedInArticleTitle: usedTitle })
  if (GLOBAL_REJECT.test(text)) return reject()
  for (const t of intent.themes) {
    if (t.reject && t.reject.test(text)) return reject()
    // desambiguação: palavra ambígua presente SEM contexto emocional → rejeita
    if (t.ambiguous && t.ambiguous.test(text) && !t.context.test(text)) return reject()
  }

  // 2) Termos fortes do tema encontrados no vídeo.
  const matched = intent.strongTerms.filter(term => text.includes(deburr(term)))
  const titleMatched = intent.titleTerms.filter(w => titleText.includes(w))

  let score = 0
  if (text.includes(deburr(intent.mainTopic))) score += 25
  if (matched.length >= 1) score += 20
  if (matched.length >= 2) score += 15
  if (EMO_CTX.test(text)) score += 10                       // é sobre emoção/autocuidado
  if (titleMatched.length >= 2) score += 10                 // ecoa o título do artigo
  if (/[ãõáéíóúâêô]/.test(c.title) || /\b(como|voc[êe]|sentiment|emoç)/.test(titleText)) score += 8 // aparenta pt-BR
  if (c.durationSeconds >= 150 && c.durationSeconds <= 1200) score += 5
  else if (c.durationSeconds > 0 && c.durationSeconds < 70) score -= 10

  // 3) Sem NENHUM termo forte nem eco do título → não tem relação clara.
  if (matched.length === 0 && titleMatched.length === 0) score -= 50

  // 4) Anti-repetição.
  if (usedTitle) score -= 70

  score = Math.max(0, Math.min(100, score))
  const relevance: VideoCandidate['relevance'] = score >= 80 ? 'muito' : score >= 65 ? 'relacionado' : 'pouco'
  const termosMotivo = [...new Set([...matched, ...(titleMatched.length ? [a.title!.trim()] : [])])].slice(0, 3)
  const reason = termosMotivo.length
    ? `Relacionado porque o vídeo fala sobre ${termosMotivo.join(', ')} — o tema deste artigo (${intent.mainTopic}).`
    : ''
  return { ...c, score, relevance, reason, usedInArticleTitle: usedTitle }
}

export interface VideoSearchResult {
  query: string
  queries: string[]
  candidates: VideoCandidate[]
  belowThreshold: number
  error?: string
}

// Busca (várias queries), pontua, filtra os ≥65. `customQuery` ignora as queries
// automáticas (para o admin editar a busca).
export async function searchArticleVideos(a: VideoArticleInput, customQuery?: string): Promise<VideoSearchResult> {
  const intent = extractArticleVideoIntent(a)
  const queries = customQuery?.trim() ? [customQuery.trim()] : generateArticleVideoQueries(a, intent)

  const [usedMap, results] = await Promise.all([
    getUsedVideoMap(a.id),
    Promise.all(queries.map(q => supabase.functions.invoke('youtube-search', { body: { query: q, maxResults: 12 } }))),
  ])

  const seen = new Set<string>()
  const raw: VideoCandidate[] = []
  let firstError: string | undefined
  for (const r of results) {
    const out = r as { data?: { candidates?: VideoCandidate[]; error?: string }; error?: { message?: string } | null }
    if (out.error || out.data?.error) { firstError = firstError || out.data?.error || out.error?.message; continue }
    for (const c of (out.data?.candidates ?? [])) { if (!seen.has(c.videoId)) { seen.add(c.videoId); raw.push(c) } }
  }
  if (raw.length === 0 && firstError) return { query: queries[0], queries, candidates: [], belowThreshold: 0, error: firstError }

  const scored = raw.map(c => scoreVideo(a, intent, c, usedMap)).filter(c => (c.score ?? 0) > 0)
  const approved = scored.filter(c => (c.score ?? 0) >= 65).sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
  const belowThreshold = scored.filter(c => (c.score ?? 0) < 65).length
  return { query: queries[0], queries, candidates: approved, belowThreshold }
}

// ─── URL manual + helpers de conteúdo ────────────────────────────────────────
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
export function videoMarker(idOrUrl: string, caption: string): string | null {
  const id = /^[\w-]{11}$/.test(idOrUrl) ? idOrUrl : youtubeIdFromUrl(idOrUrl)
  if (!id) return null
  const legenda = (caption || '').replace(/[[\]]/g, '').trim() || 'Vídeo de referência'
  return `::video[${legenda}](https://www.youtube-nocookie.com/embed/${id})`
}
const VIDEO_LINE_RE = /^[ \t]*::video\[[^\]]*\]\([^)\s]+\)[ \t]*\r?\n?/gm
export function currentRelatedVideoId(content: string): string | null {
  const m = (content || '').match(/::video\[[^\]]*\]\(([^)\s]+)\)/)
  return m ? youtubeIdFromUrl(m[1]) : null
}
export function setRelatedVideoInContent(content: string, marker: string): string {
  const stripped = (content || '').replace(VIDEO_LINE_RE, '').replace(/^\s+/, '')
  return `${marker}\n\n${stripped}`
}
export function removeRelatedVideoFromContent(content: string): string {
  return (content || '').replace(VIDEO_LINE_RE, '').replace(/^\s+/, '')
}
