// ─────────────────────────────────────────────────────────────────────────────
// Motor de recomendação de CONTEÚDOS GUIADOS.
//
// Casa o que o usuário ESCREVE e MARCA (diário, check-in, questionário, perfil
// emocional) com conteúdos JÁ cadastrados — nunca inventa conteúdo, nunca
// recomenda conteúdo fora do plano, nunca diagnostica.
//
// Camadas:
//   1. Mapa de palavras-chave → temas emocionais (§7)
//   2. Extração de sinais dos registros do usuário (§5)
//   3. Pontuação transparente por tema/palavra-chave/gatilho/energia/ansiedade (§8.1)
//   4. Motivo em linguagem de autopercepção (§8.2, §15)
//   5. Segurança emocional: detecção de linguagem de risco (§15)
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import { hasPlanAccess } from './officialPlans'
import type { EmotionalAnalysis } from './emotionalAnalytics'

export type Theme =
  | 'ansiedade' | 'cansaco' | 'sobrecarga' | 'autocobranca'
  | 'tristeza' | 'irritacao' | 'alimentacao' | 'sono'

interface ThemeDef {
  /** Rótulo natural usado no motivo da recomendação (§8.2). */
  label: string
  /** Palavras (radicais, sem acento) que o usuário costuma escrever/marcar. */
  userWords: string[]
  /** Valores de emotional_themes no conteúdo que satisfazem este tema. */
  contentThemes: string[]
  /** Radicais de tags/keywords/categoria do conteúdo que casam com o tema. */
  contentWords: string[]
}

// Ordem = prioridade em caso de empate.
const THEMES: Record<Theme, ThemeDef> = {
  ansiedade: {
    label: 'ansiedade',
    userWords: ['ansiedad', 'ansios', 'nervos', 'medo', 'preocupa', 'coracao acelerad', 'tensa', 'inquiet', 'crise', 'panico', 'agonia', 'aflit', 'apreensa', 'pensament acelerad', 'excesso de pensament'],
    contentThemes: ['ansiedade'],
    contentWords: ['ansiedade', 'respiracao', 'regulacao', 'pausa', 'aterramento', 'pensament', 'calma'],
  },
  cansaco: {
    label: 'cansaço e falta de energia',
    userWords: ['cansa', 'exaust', 'sem energia', 'esgota', 'fadiga', 'sem forca', 'drena', 'pesad', 'sem disposicao', 'desgast', 'sem vontade'],
    contentThemes: ['cansaco', 'sono', 'rotina', 'autocuidado'],
    contentWords: ['descanso', 'energia', 'pausa', 'rotina leve', 'autocuidado', 'sono'],
  },
  sobrecarga: {
    label: 'sobrecarga',
    userWords: ['sobrecarg', 'nao dou conta', 'nao dar conta', 'muita coisa', 'pressa', 'excesso', 'demanda', 'responsabilidad', 'cobranc', 'trabalho demais', 'acumul'],
    contentThemes: ['sobrecarga', 'limites', 'rotina'],
    contentWords: ['sobrecarga', 'limites', 'pausa', 'organizacao', 'descanso'],
  },
  autocobranca: {
    label: 'autocobrança',
    userWords: ['culpa', 'me cobro', 'autocobranc', 'fracasso', 'falhei', 'inutil', 'insuficient', 'deveria', 'nao fiz o suficient', 'perfeccion', 'compara', 'nao sou capaz'],
    contentThemes: ['autocobranca', 'autoestima', 'limites'],
    contentWords: ['autocobranca', 'autoestima', 'autocompaixao', 'comparacao', 'limites', 'escrita'],
  },
  tristeza: {
    label: 'tristeza e desânimo',
    userWords: ['triste', 'desanim', 'vazio', 'sem vontade', 'desmotiva', 'chatead', 'vontade de sumir', 'sozinh', 'solidao', 'choro', 'chorar', 'para baixo'],
    contentThemes: ['tristeza', 'autocuidado'],
    contentWords: ['tristeza', 'acolhimento', 'escrita', 'cuidado', 'apoio'],
  },
  irritacao: {
    label: 'irritação',
    userWords: ['irrita', 'raiva', 'odio', 'impacient', 'explodir', 'sem pacienc', 'estress', 'nervos a flor'],
    contentThemes: ['irritacao', 'limites'],
    contentWords: ['irritacao', 'pausa', 'regulacao', 'respiracao', 'limites'],
  },
  alimentacao: {
    label: 'a relação com a comida',
    userWords: ['compulsa', 'fome emocional', 'comi demais', 'descontar na comida', 'vontade de comer', 'culpa por comer', 'belisc', 'comer por emocao', 'ansiedade e comida'],
    contentThemes: ['alimentacao', 'autocuidado'],
    contentWords: ['fome emocional', 'compulsao', 'comida', 'alimentacao', 'culpa', 'autocuidado'],
  },
  sono: {
    label: 'sono e rotina',
    userWords: ['sono ruim', 'insonia', 'dormir mal', 'acordei cansad', 'sem rotina', 'bagunca', 'procrastina', 'sem horario', 'madrugada', 'nao consigo dormir', 'durmo mal'],
    contentThemes: ['sono', 'rotina'],
    contentWords: ['sono', 'rotina', 'descanso', 'desaceleracao', 'organizacao', 'noturn'],
  },
}

const THEME_ORDER: Theme[] = ['ansiedade', 'sobrecarga', 'cansaco', 'autocobranca', 'alimentacao', 'sono', 'irritacao', 'tristeza']

// Linguagem de risco (§15): NÃO tratar apenas com conteúdo — orientar ajuda.
const RISK_WORDS = [
  'me matar', 'suicid', 'nao quero mais viver', 'nao aguento mais viver', 'tirar minha vida',
  'acabar com tudo', 'sumir para sempre', 'me machucar', 'me cortar', 'automutil',
  'nao vejo saida', 'melhor sem mim', 'queria morrer', 'quero morrer', 'por um fim',
]

export const RISK_HELP = {
  title: 'Você não está sozinho(a) neste momento',
  message: 'Percebemos sinais de sofrimento intenso no que você registrou. Isso é sério e merece apoio de verdade — mais do que um conteúdo pode oferecer agora.',
  cvv: 'CVV — Centro de Valorização da Vida: ligue 188 (24h, gratuito e sigiloso) ou acesse cvv.org.br.',
  emergency: 'Em emergência, procure o CAPS mais próximo, um pronto-socorro ou ligue 192 (SAMU).',
}

function deburr(s: string): string {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function detectRisk(text: string | null | undefined): boolean {
  if (!text) return false
  const t = deburr(text)
  return RISK_WORDS.some(w => t.includes(w))
}

// ── Sinal do usuário ─────────────────────────────────────────────────────────
export interface Signal {
  hasData: boolean
  /** Peso por tema (quanto mais alto, mais o tema apareceu nos registros). */
  themes: Partial<Record<Theme, number>>
  /** Palavras-chave (radicais) efetivamente encontradas no que o usuário escreveu. */
  keywords: Set<string>
  avgEnergy: number | null
  avgAnxiety: number | null
  dominantEmotion: string | null
  triggers: string[]
  /** De onde veio o sinal: checkin | diario | questionario | mapa | relatorio. */
  sources: Set<string>
  risk: boolean
}

function emptySignal(): Signal {
  return { hasData: false, themes: {}, keywords: new Set(), avgEnergy: null, avgAnxiety: null, dominantEmotion: null, triggers: [], sources: new Set(), risk: false }
}

/** Casa um texto livre com os temas; devolve os temas atingidos (com contagem). */
function themeHits(text: string): { theme: Theme; hits: number; words: string[] }[] {
  const t = deburr(text)
  if (!t.trim()) return []
  const out: { theme: Theme; hits: number; words: string[] }[] = []
  for (const theme of THEME_ORDER) {
    const words: string[] = []
    for (const w of THEMES[theme].userWords) if (t.includes(w)) words.push(w)
    if (words.length) out.push({ theme, hits: words.length, words })
  }
  return out
}

function addTheme(sig: Signal, theme: Theme, weight: number) {
  sig.themes[theme] = (sig.themes[theme] ?? 0) + weight
}

interface DiarySignalRow {
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  emotional_tags?: string[] | string | null
  emotional_triggers?: string | null
  recurring_thoughts?: string | null
  emotional_need?: string | null
  free_note?: string | null
  relationships?: string | null
  habits?: string | null
  text?: string | null
  entry_type?: string | null
  created_at?: string | null
  date?: string | null
}

function rowText(e: DiarySignalRow): string {
  const tags = Array.isArray(e.emotional_tags)
    ? e.emotional_tags.join(' ')
    : (typeof e.emotional_tags === 'string' ? e.emotional_tags : '')
  return [e.mood, e.text, e.emotional_triggers, e.recurring_thoughts, e.emotional_need, e.free_note, e.relationships, e.habits, tags]
    .filter(Boolean).join(' \n ')
}

/** Constrói o sinal a partir de uma lista de registros (diário + check-in). */
export function signalFromEntries(entries: DiarySignalRow[]): Signal {
  const sig = emptySignal()
  if (!entries.length) return sig
  sig.hasData = true

  const energies: number[] = []
  const anxieties: number[] = []
  const moodCount: Record<string, number> = {}
  const combinedText: string[] = []

  for (const e of entries) {
    if (e.entry_type === 'checkin') sig.sources.add('checkin')
    else sig.sources.add('diario')

    const en = Number(e.energy); if (Number.isFinite(en) && en > 0) energies.push(en)
    const anx = Number(e.anxiety_level); if (Number.isFinite(anx) && anx > 0) anxieties.push(anx)
    const m = String(e.mood ?? '').trim()
    if (m && m !== 'null' && m !== 'undefined') moodCount[m] = (moodCount[m] ?? 0) + 1
    if (e.emotional_triggers && e.emotional_triggers.trim()) sig.triggers.push(e.emotional_triggers.trim())

    const txt = rowText(e)
    combinedText.push(txt)
    for (const h of themeHits(txt)) {
      addTheme(sig, h.theme, h.hits)
      for (const w of h.words) sig.keywords.add(w)
    }
  }

  sig.avgEnergy = energies.length ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10 : null
  sig.avgAnxiety = anxieties.length ? Math.round((anxieties.reduce((a, b) => a + b, 0) / anxieties.length) * 10) / 10 : null
  const topMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]
  sig.dominantEmotion = topMood ? topMood[0] : null

  // Sinais derivados de energia/ansiedade reforçam temas mesmo sem texto.
  if (sig.avgAnxiety != null && sig.avgAnxiety >= 4) addTheme(sig, 'ansiedade', 2)
  if (sig.avgEnergy != null && sig.avgEnergy <= 2) addTheme(sig, 'cansaco', 2)

  // Emoção dominante marcada mapeia para tema (mesmo sem texto livre).
  const moodTheme = emotionToTheme(sig.dominantEmotion)
  if (moodTheme) addTheme(sig, moodTheme, 2)

  sig.risk = combinedText.some(detectRisk)
  return sig
}

/** Sinal de um único registro recém-salvo (check-in ou diário). */
export function signalFromEntry(e: DiarySignalRow): Signal {
  return signalFromEntries([e])
}

/** Sinal a partir das tags geradas por um questionário. */
export function signalFromTags(tags: string[]): Signal {
  const sig = emptySignal()
  if (!tags.length) return sig
  sig.hasData = true
  sig.sources.add('questionario')
  for (const h of themeHits(tags.join(' '))) {
    addTheme(sig, h.theme, h.hits)
    for (const w of h.words) sig.keywords.add(w)
  }
  for (const t of tags) { const d = deburr(t).trim(); if (d) sig.keywords.add(d) }
  return sig
}

/** Sinal a partir da análise emocional agregada (Mapa / Relatórios). */
export function signalFromAnalysis(a: EmotionalAnalysis, source: 'mapa' | 'relatorio' = 'mapa'): Signal {
  const sig = emptySignal()
  const hasEntries = (a.totalEntries ?? 0) > 0
  if (!hasEntries) return sig
  sig.hasData = true
  sig.sources.add(source)
  sig.avgEnergy = a.avg?.energy || null
  sig.avgAnxiety = a.avg?.anxiety || null

  for (const em of a.topEmotions ?? []) {
    const th = emotionToTheme(em.label)
    if (th) addTheme(sig, th, em.count)
    for (const h of themeHits(em.label)) { addTheme(sig, h.theme, h.hits); for (const w of h.words) sig.keywords.add(w) }
  }
  for (const trg of a.triggers ?? []) {
    for (const h of themeHits(trg.tag)) { addTheme(sig, h.theme, h.hits); for (const w of h.words) sig.keywords.add(w) }
    const d = deburr(trg.tag).trim(); if (d) sig.keywords.add(d)
  }
  if (a.topEmotions?.[0]) sig.dominantEmotion = a.topEmotions[0].label
  if (sig.avgAnxiety != null && sig.avgAnxiety >= 4) addTheme(sig, 'ansiedade', 2)
  if (sig.avgEnergy != null && sig.avgEnergy <= 2) addTheme(sig, 'cansaco', 2)
  return sig
}

/** Emoção marcada (rótulo do humor) → tema. */
function emotionToTheme(label: string | null): Theme | null {
  if (!label) return null
  const d = deburr(label)
  if (d.includes('ansiedad')) return 'ansiedade'
  if (d.includes('sobrecarg')) return 'sobrecarga'
  if (d.includes('cansa') || d.includes('sem energia') || d.includes('desanim')) return 'cansaco'
  if (d.includes('trist')) return 'tristeza'
  if (d.includes('irrita')) return 'irritacao'
  if (d.includes('confus')) return 'ansiedade'
  return null
}

/** Combina vários sinais em um só (soma pesos, une palavras/gatilhos/fontes). */
export function mergeSignals(...signals: Signal[]): Signal {
  const out = emptySignal()
  for (const s of signals) {
    if (!s.hasData) continue
    out.hasData = true
    for (const [th, w] of Object.entries(s.themes)) addTheme(out, th as Theme, w ?? 0)
    s.keywords.forEach(k => out.keywords.add(k))
    s.sources.forEach(k => out.sources.add(k))
    out.triggers.push(...s.triggers)
    if (s.risk) out.risk = true
    if (out.avgEnergy == null && s.avgEnergy != null) out.avgEnergy = s.avgEnergy
    if (out.avgAnxiety == null && s.avgAnxiety != null) out.avgAnxiety = s.avgAnxiety
    if (!out.dominantEmotion && s.dominantEmotion) out.dominantEmotion = s.dominantEmotion
  }
  return out
}

/** Os temas mais fortes do sinal, em ordem de peso. */
export function topThemes(sig: Signal, limit = 3): Theme[] {
  return (Object.entries(sig.themes) as [Theme, number][])
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1] || THEME_ORDER.indexOf(a[0]) - THEME_ORDER.indexOf(b[0]))
    .slice(0, limit)
    .map(([t]) => t)
}

// ── Catálogo ─────────────────────────────────────────────────────────────────
export interface CatalogItem {
  id: string
  title: string
  slug: string | null
  summary: string | null
  excerpt: string | null
  category: string | null
  tags: string[] | null
  keywords: string[] | null
  emotional_themes: string[] | null
  plan_required: string | null
  content_type: string | null
  estimated_time_minutes: number | null
  read_time: number | null
  image_url: string | null
  is_recommendable: boolean | null
  published_at: string | null
}

/** Catálogo seguro (metadados, sem corpo) de todos os conteúdos guiados. */
export async function fetchGuidedCatalog(): Promise<CatalogItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_guided_catalog')
    if (error || !data) return []
    return data as CatalogItem[]
  } catch {
    return []
  }
}

// ── Pontuação (§8.1) ──────────────────────────────────────────────────────────
export interface ScoredContent {
  item: CatalogItem
  score: number
  reason: string
  matchedThemes: Theme[]
  matchedKeywords: string[]
  locked: boolean
}

function itemThemes(item: CatalogItem): Set<string> {
  return new Set((item.emotional_themes ?? []).map(deburr))
}
function itemHaystack(item: CatalogItem): string {
  return deburr([
    item.category, item.title, item.summary, item.excerpt,
    ...(item.tags ?? []), ...(item.keywords ?? []),
  ].filter(Boolean).join(' '))
}

interface ScoreOpts {
  limit?: number
  readSlugs?: Set<string>
  /** Só conteúdos acessíveis pelo plano (recomendações) — padrão true. */
  accessibleOnly?: boolean
  /** Exigir score > 0 (recomendações) — padrão true. */
  requireMatch?: boolean
}

/**
 * Pontua o catálogo contra o sinal do usuário, respeitando o plano.
 * Nunca recomenda conteúdo sem relação (score > 0) e nunca conteúdo fora do
 * plano nas recomendações (accessibleOnly). Ordena por maior score.
 */
export function scoreCatalog(
  catalog: CatalogItem[],
  sig: Signal,
  plan: string | null | undefined,
  opts: ScoreOpts = {},
): ScoredContent[] {
  const { limit = 6, readSlugs = new Set(), accessibleOnly = true, requireMatch = true } = opts
  const themesRanked = topThemes(sig, 5)
  const kw = [...sig.keywords].filter(Boolean)

  const scored = catalog
    .filter(it => it.is_recommendable !== false)
    .map(it => {
      const access = hasPlanAccess(plan, it.plan_required ?? 'free')
      const themesOf = itemThemes(it)
      const hay = itemHaystack(it)
      let score = 0
      const matchedThemes: Theme[] = []
      const matchedKeywords: string[] = []

      // +5: tema do conteúdo combina com o tema mais forte do usuário.
      for (const th of themesRanked) {
        const def = THEMES[th]
        const hitTheme = def.contentThemes.some(ct => themesOf.has(deburr(ct)))
        const hitWord = def.contentWords.some(w => hay.includes(deburr(w)))
        if (hitTheme) { score += (th === themesRanked[0] ? 5 : 3); matchedThemes.push(th) }
        else if (hitWord) { score += (th === themesRanked[0] ? 3 : 2); matchedThemes.push(th) }
      }
      // +4: palavra que o usuário escreveu casa com keywords/tags do conteúdo.
      for (const k of kw) {
        if (k.length < 3) continue
        if (hay.includes(k)) { score += 4; matchedKeywords.push(k); if (score > 40) break }
      }
      // +3: ansiedade alta e conteúdo de ansiedade.
      if (sig.avgAnxiety != null && sig.avgAnxiety >= 4 && (themesOf.has('ansiedade') || hay.includes('ansiedade'))) score += 3
      // +3: energia baixa e conteúdo de descanso/energia/sono.
      if (sig.avgEnergy != null && sig.avgEnergy <= 2 &&
          (['cansaco', 'sono', 'rotina', 'autocuidado'].some(t => themesOf.has(t)) || /descanso|energia|sono|pausa/.test(hay))) score += 3
      // -3: já lido recentemente.
      if (it.slug && readSlugs.has(it.slug)) score -= 3
      // -100: fora do plano (some das recomendações).
      if (!access) score -= 100

      return {
        item: it,
        score,
        reason: '',
        matchedThemes: [...new Set(matchedThemes)],
        matchedKeywords: [...new Set(matchedKeywords)],
        locked: !access,
      } as ScoredContent
    })

  let list = scored
  if (accessibleOnly) list = list.filter(s => !s.locked)
  if (requireMatch) list = list.filter(s => s.score > 0)

  list.sort((a, b) => b.score - a.score ||
    (b.item.published_at ?? '').localeCompare(a.item.published_at ?? ''))
  const top = list.slice(0, limit)
  for (const s of top) s.reason = buildReason(sig, s)
  return top
}

// ── Motivo (§8.2, §15) — autopercepção, nunca diagnóstico ─────────────────────
function sourcePhrase(sig: Signal): string {
  if (sig.sources.has('checkin') && sig.sources.has('diario')) return 'nos seus check-ins e no diário'
  if (sig.sources.has('checkin')) return 'nos seus check-ins'
  if (sig.sources.has('diario')) return 'no que você registrou no diário'
  if (sig.sources.has('questionario')) return 'nas respostas do seu questionário'
  if (sig.sources.has('relatorio')) return 'nos padrões do seu relatório'
  if (sig.sources.has('mapa')) return 'nos seus registros recentes'
  return 'nos seus registros recentes'
}

export function buildReason(sig: Signal, s: ScoredContent): string {
  const where = sourcePhrase(sig)
  const themeLabels = s.matchedThemes.map(t => THEMES[t].label)

  if (themeLabels.length >= 2) {
    return `Recomendado porque ${themeLabels[0]} e ${themeLabels[1]} apareceram ${where}.`
  }
  if (themeLabels.length === 1) {
    return `Recomendado porque ${themeLabels[0]} apareceu ${where}.`
  }
  if (sig.avgAnxiety != null && sig.avgAnxiety >= 4) {
    return `Recomendado porque sua ansiedade percebida ficou alta ${where}.`
  }
  if (sig.avgEnergy != null && sig.avgEnergy <= 2) {
    return `Recomendado porque sua energia ficou baixa ${where}.`
  }
  if (s.matchedKeywords.length) {
    return `Recomendado porque temas que você mencionou ${where} conversam com este conteúdo.`
  }
  return `Selecionado com base ${where}.`
}

// ── Carregamento de sinal do usuário + histórico ──────────────────────────────
const RECENT_DAYS = 14

/** Carrega registros recentes (diário + check-in) e o último questionário. */
export async function fetchUserSignal(userId: string | null | undefined, days = RECENT_DAYS): Promise<Signal> {
  if (!userId) return emptySignal()
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  try {
    const [{ data: entries }, { data: quiz }] = await Promise.all([
      supabase.from('diary_entries').select('*').eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(120),
      supabase.from('questionnaire_responses').select('generated_tags').eq('user_id', userId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const entrySig = signalFromEntries((entries ?? []) as DiarySignalRow[])
    const tags = String((quiz as { generated_tags?: string } | null)?.generated_tags ?? '')
      .split(',').map(t => t.trim()).filter(Boolean)
    const tagSig = signalFromTags(tags)
    return mergeSignals(entrySig, tagSig)
  } catch {
    return emptySignal()
  }
}

/** Slugs já lidos (para o desconto de repetição). */
export async function fetchReadSlugsForRec(userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set()
  try {
    const { data } = await supabase.from('reading_history').select('article_slug').eq('user_id', userId)
    return new Set((data ?? []).map((r: { article_slug: string }) => r.article_slug))
  } catch {
    return new Set()
  }
}

/** Registra as recomendações exibidas (best-effort; nunca quebra a UI). */
export async function logRecommendationsShown(
  userId: string | null | undefined,
  source: string,
  scored: ScoredContent[],
): Promise<void> {
  if (!userId || !scored.length) return
  try {
    const rows = scored.map(s => ({
      user_id: userId,
      content_id: s.item.id,
      content_slug: s.item.slug,
      source,
      score: s.score,
      matched_tags: s.matchedThemes,
      matched_keywords: s.matchedKeywords,
      reason: s.reason,
      status: 'shown',
    }))
    await supabase.from('content_recommendations').insert(rows)
  } catch {
    /* histórico é opcional — nunca interrompe a experiência */
  }
}

export { THEMES }
