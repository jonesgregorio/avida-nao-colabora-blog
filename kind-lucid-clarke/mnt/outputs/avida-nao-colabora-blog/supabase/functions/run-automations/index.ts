import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveAiModels } from '../_shared/aiModels.ts'
import {
  SUPPORTED_EDITORIAL_AUTOMATION_TYPES,
  clampAutomationQuantity,
  isEditorialAutomationType,
  plannedDateForIdea,
  type EditorialAutomationConfig,
  type EditorialAutomationType,
} from '../_shared/editorialAutomationContracts.ts'
import {
  MIN_ARTICLE_WORDS,
  articleExcerptFrom,
  articleWordCount,
  buildArticleExpansionPrompt,
  buildArticleGenerationPrompt,
  parseArticlePackages,
  validateArticlePackage,
  type ArticleAIContract,
} from '../_shared/articleGenerationContract.ts'

// ─── Executor de automações de conteúdo (chamado por pg_cron via pg_net) ─────
// Autenticado pelo SERVICE ROLE (só o banco/vault tem). Para cada automação de
// geração ATIVA e vencida (pela frequência), executa o comportamento do tipo:
// artigo, pacote de artigos, pauta quinzenal ou pauta mensal. Artigos são
// registrados no calendário editorial e, em auto_publish, só publicam após a
// validação determinística de tamanho, SEO e imagem.
// Nada aqui usa JWT de usuário — é um job de servidor.

// Chamada só por pg_cron/pg_net (server-to-server) — nunca por navegador.
// Origem restrita por consistência com as demais funções, mesmo sem risco de CORS real aqui.
const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])
function resolveOrigin(origin: string | null): string {
  if (origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))) return origin
  return Deno.env.get('SITE_URL') || 'https://avidanaocolabora.com'
}
const corsHeaders = {
  'Access-Control-Allow-Origin': resolveOrigin(null),
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
const FREQ_DAYS: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }

function nextRunAt(frequency: string, from = new Date()): string {
  const next = new Date(from)
  if (frequency === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1)
  } else {
    next.setUTCDate(next.getUTCDate() + (FREQ_DAYS[frequency] ?? 7))
  }
  return next.toISOString()
}
const GEN_TYPES = SUPPORTED_EDITORIAL_AUTOMATION_TYPES

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 72)
}

// §9.3 da MISSÃO GERAL: instruir o prompt a evitar "tom de ChatGPT" não é
// suficiente sozinho — a IA às vezes ignora a instrução. Guarda determinística:
// se o corpo do artigo usar essas frases-clichê, a auto-publicação é bloqueada
// (vira rascunho para revisão humana), em vez de confiar cegamente no prompt.
const AI_CLICHE_PHRASES = [
  'em conclusão', 'é importante ressaltar', 'é importante destacar', 'em suma',
  'não podemos esquecer que', 'em um mundo cada vez mais', 'convido você a refletir',
  'ao longo deste artigo, vamos explorar', 'sem sombra de dúvida', 'é fundamental destacar',
]
function detectAiCliches(content: string): string[] {
  const lower = content.toLowerCase()
  return AI_CLICHE_PHRASES.filter(phrase => lower.includes(phrase))
}
function cleanText(value: unknown, max = 10000): string { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try { const value = JSON.parse(cleaned); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null }
  catch {
    const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}')
    if (a >= 0 && b > a) { try { return JSON.parse(cleaned.slice(a, b + 1)) as Record<string, unknown> } catch { /* noop */ } }
    return null
  }
}
async function searchPexelsCover(query: string): Promise<{ url: string; alt: string } | null> {
  const key = Deno.env.get('PEXELS_API_KEY')
  if (!key || !query.trim()) return null
  try {
    const endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape&size=large`
    const res = await withTimeout(endpoint, { headers: { Authorization: key } })
    if (!res.ok) return null
    const data = await res.json()
    const photos = Array.isArray(data?.photos) ? data.photos : []
    if (!photos.length) return null
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 5))]
    const url = photo?.src?.landscape || photo?.src?.large || photo?.src?.original
    return url ? { url: String(url), alt: cleanText(photo?.alt || query, 180) || query } : null
  } catch { return null }
}

const AI_TIMEOUT_MS = 45_000
const GROQ_TPM_SAFE_BUDGET = 7600

function groqOutputBudget(prompt: string): number {
  const estimatedInputTokens = Math.ceil(prompt.length / 3)
  return Math.min(6000, Math.max(512, GROQ_TPM_SAFE_BUDGET - estimatedInputTokens))
}

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), AI_TIMEOUT_MS)
  try { return await fetch(url, { ...init, signal: c.signal }) }
  finally { clearTimeout(t) }
}

async function genAI(prompt: string): Promise<string> {
  // Ordem de failover: Gemini → Groq → OpenAI. Chaves só no servidor.
  const cfg = await resolveAiModels()
  const gk = Deno.env.get('GEMINI_API_KEY')
  if (gk) {
    for (const model of [cfg.gemini]) {
      try {
        const r = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gk}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        })
        if (r.ok) { const d = await r.json(); const t = d?.candidates?.[0]?.content?.parts?.[0]?.text; if (t?.trim()) return String(t).trim() }
      } catch { /* tenta próximo modelo */ }
    }
  }
  const qk = Deno.env.get('GROQ_API_KEY')
  if (qk) {
    try {
      const r = await withTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${qk}` },
        body: JSON.stringify({ model: cfg.groq, messages: [{ role: 'user', content: prompt }], max_completion_tokens: groqOutputBudget(prompt) }),
      })
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content; if (t?.trim()) return String(t).trim() }
    } catch { /* próximo provedor */ }
  }
  const ok = Deno.env.get('OPENAI_API_KEY')
  if (ok) {
    try {
      const r = await withTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ok}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
      })
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content; if (t?.trim()) return String(t).trim() }
    } catch { /* fim da cadeia */ }
  }
  throw new Error('Nenhum provedor de IA respondeu')
}

// Snapshot agregado do usuário (mesmos dados da tela de Recomendações IA).
async function buildSnapshot(admin: AdminClient, userId: string, plan: string, taskKey: string) {
  const [dc, dd, qc, sc, ar, profileRes] = await Promise.all([
    admin.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('diary_entries').select('mood,mood_score,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    admin.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('analytics_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('event', 'article_view'),
    admin.from('profiles').select('plan,unlimited_access,unlimited_access_until').eq('user_id', userId).maybeSingle(),
  ])
  const freq = (rows: Record<string, unknown>[], field: string, limit = 5) => {
    const counts: Record<string, number> = {}
    for (const row of rows) {
      const values = Array.isArray(row[field]) ? row[field] as unknown[] : []
      for (const raw of values) {
        const value = String(raw || '').trim()
        if (value) counts[value] = (counts[value] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value]) => value)
  }
  const diaryRows = (dd.data ?? []) as Record<string, unknown>[]
  let moodSum = 0, moodCount = 0
  for (const d of diaryRows) {
    const mood = Number(d.mood_score ?? d.mood)
    if (Number.isFinite(mood) && mood > 0) { moodSum += mood; moodCount++ }
  }
  const profile = (profileRes.data ?? {}) as { plan?: string | null; unlimited_access?: boolean | null; unlimited_access_until?: string | null }
  const basePlan = profile.plan || plan || 'free'
  const unlimitedUntil = profile.unlimited_access_until ? Date.parse(profile.unlimited_access_until) : Number.POSITIVE_INFINITY
  const unlimitedActive = profile.unlimited_access === true && Number.isFinite(unlimitedUntil)
    ? unlimitedUntil > Date.now()
    : profile.unlimited_access === true && !profile.unlimited_access_until
  const normalizedPlan = unlimitedActive
    ? 'plus'
    : ['plus','therapeutic','therapeutic-plus','therapeutic_plus'].includes(basePlan) ? 'plus' : basePlan
  const topMarkers = freq(diaryRows, 'emotional_tags')
  const topContexts = freq(diaryRows, 'context_tags')
  const topNeeds = freq(diaryRows, 'need_tags')
  const topCareActions = freq(diaryRows, 'care_action_tags')
  const topTriggers = normalizedPlan === 'plus' ? freq(diaryRows, 'trigger_tags') : []
  return {
    plan: normalizedPlan, task: taskKey, period: new Date().toISOString().slice(0, 7),
    diaryCount: dc.count ?? 0, topMarkers, topContexts, topNeeds, topCareActions, topTriggers,
    avgMood: moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : null,
    questionnaireCount: qc.count ?? 0, articlesRead: ar.count ?? 0, savedCount: sc.count ?? 0,
  }
}


// Banco sem Database types gerados: mantém o client administrativo flexível nesta Edge Function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any
type AutomationRow = {
  id: string
  name?: string | null
  type: string
  frequency: string
  category?: string | null
  plan_required?: string | null
  mode?: string | null
  config?: EditorialAutomationConfig | null
  last_run_at?: string | null
  next_run_at?: string | null
}

type GeneratedArticlePackage = ArticleAIContract

function ideaItems(raw: Record<string, unknown>): Record<string, unknown>[] {
  const items = Array.isArray(raw.ideas) ? raw.ideas : []
  return items.filter(v => v && typeof v === 'object' && !Array.isArray(v)) as Record<string, unknown>[]
}

function uniqueThemes(config: EditorialAutomationConfig, fallback: string): string[] {
  const themes = Array.isArray(config.themes) ? config.themes.map(v => String(v || '').trim()).filter(Boolean) : []
  return [...new Set(themes.length ? themes : [fallback])].slice(0, 12)
}

function normalizedPlan(value: unknown, fallback = 'free'): string {
  const raw = String(value || fallback).trim().toLowerCase()
  if (raw === 'essential') return 'essential'
  if (['plus', 'therapeutic', 'therapeutic-plus', 'therapeutic_plus'].includes(raw)) return 'plus'
  return 'free'
}

async function persistArticle(
  admin: AdminClient,
  automation: AutomationRow,
  pkg: GeneratedArticlePackage,
  fallbackTheme: string,
  prompt: string,
  allowExpansion: boolean,
): Promise<{ title: string; published: boolean; validationErrors: string[] }> {
  const title = cleanText(pkg.title, 120) || fallbackTheme.slice(0, 120)
  let content = cleanText(pkg.content, 50000)
  // Etapa 5.1: no máximo UMA tentativa de expansão por artigo.
  if (allowExpansion && content && articleWordCount(content) < MIN_ARTICLE_WORDS) {
    try {
      const expanded = await genAI(buildArticleExpansionPrompt(content))
      if (expanded.trim()) content = expanded.trim()
    } catch { /* a validação compartilhada mantém como rascunho */ }
  }
  if (!content) throw new Error(`Artigo “${title}” retornou sem conteúdo.`)

  const excerpt = cleanText(pkg.excerpt, 200) || articleExcerptFrom(content) || title.slice(0, 200)
  const seoTitle = cleanText(pkg.seo_title, 60) || title.slice(0, 60)
  const seoDescription = cleanText(pkg.seo_description, 155) || excerpt.slice(0, 155)
  const keyword = cleanText(pkg.keyword, 120) || fallbackTheme.slice(0, 120)
  const secondaryKeywords = pkg.secondary_keywords.slice(0, 6)
  const tags = pkg.tags.slice(0, 6)
  const emotionalThemes = pkg.emotional_themes.slice(0, 4)
  const imageQuery = cleanText(pkg.image_query, 120)
  const cover = await searchPexelsCover(imageQuery)
  const imageAlt = cleanText(pkg.image_alt, 180) || cover?.alt || ''
  const diaryQuestion = cleanText(pkg.diary_question, 260)
  const ctaText = cleanText(pkg.cta_text, 180)
  const category = cleanText(pkg.category, 120) || automation.category || 'Geral'

  const validatedPackage: ArticleAIContract = {
    ...pkg,
    title,
    content,
    excerpt,
    seo_title: seoTitle,
    seo_description: seoDescription,
    keyword,
    secondary_keywords: secondaryKeywords,
    tags,
    emotional_themes: emotionalThemes,
    category,
    image_query: imageQuery,
    image_alt: imageAlt,
    diary_question: diaryQuestion,
    cta_text: ctaText,
  }
  const validationErrors = validateArticlePackage(validatedPackage, { imageUrl: cover?.url })
  const cliches = detectAiCliches(content)
  if (cliches.length > 0) validationErrors.push(`tom genérico de IA detectado ("${cliches.join('", "')}")`)

  // Trava de duplicidade: "gerar agora" (forceOne) ignora o gating por
  // next_run_at/last_run_at, então nada impedia rodar a mesma automação duas
  // vezes seguidas e publicar dois artigos com o mesmo título. Bloqueia
  // apenas a auto-publicação (o rascunho ainda é criado, nada se perde).
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: dupe } = await admin.from('articles')
    .select('id').eq('origin', 'ia').ilike('title', title).gte('created_at', since24h).limit(1)
  if (dupe && dupe.length > 0) validationErrors.push('título idêntico já publicado/gerado nas últimas 24h')

  const wantsAutoPublish = automation.mode === 'auto_publish'
  const publish = wantsAutoPublish && validationErrors.length === 0
  const nowIso = new Date().toISOString()
  const readTime = Math.max(1, Math.ceil(articleWordCount(content) / 200))
  const internalNotes = validationErrors.length
    ? `${wantsAutoPublish ? 'Auto-publicação bloqueada' : 'Rascunho mantido'} pela validação: ${validationErrors.join('; ')}.`
    : null

  const { data: art, error: insErr } = await admin.from('articles').insert({
    title, slug: `${slugify(title)}-${Date.now().toString(36).slice(-5)}-${Math.random().toString(36).slice(2, 5)}`,
    content, summary: excerpt, excerpt, category,
    plan_required: normalizedPlan(automation.plan_required), content_type: 'article', origin: 'ia',
    status: publish ? 'published' : 'draft', published_at: publish ? nowIso : null, updated_at: nowIso,
    seo_title: seoTitle, seo_description: seoDescription, keyword,
    secondary_keywords: secondaryKeywords.join(', '), keywords: [keyword, ...secondaryKeywords].filter(Boolean),
    tags, emotional_themes: emotionalThemes, image_url: cover?.url || null, cover_image: cover?.url || null,
    cover_image_url: cover?.url || null, image_alt: imageAlt || null, og_image: cover?.url || null,
    diary_question: diaryQuestion || null, cta_text: ctaText || null, read_time: readTime,
    is_guided_content: false, is_recommendable: true, internal_notes: internalNotes, ai_prompt: prompt,
  }).select('id').single()
  if (insErr) throw insErr

  const { error: calendarErr } = await admin.from('editorial_calendar').insert({
    article_id: (art as { id?: string } | null)?.id ?? null,
    title, content_type: 'article', category,
    plan_required: normalizedPlan(automation.plan_required),
    status: publish ? 'publicado' : 'gerado_ia', origin: 'ia', scheduled_date: nowIso.slice(0, 10),
    notes: automation.type === 'generate_weekly_package' ? `Gerado automaticamente pelo pacote “${automation.name || 'semanal'}”.` : null,
  })
  if (calendarErr) console.warn('Falha ao registrar artigo no calendário editorial:', calendarErr.message)

  return { title, published: publish, validationErrors }
}

async function executeArticleAutomation(
  admin: AdminClient,
  automation: AutomationRow,
  type: EditorialAutomationType,
  config: EditorialAutomationConfig,
): Promise<string> {
  const quantity = clampAutomationQuantity(type, config.quantity)
  const themes = uniqueThemes(config, automation.category || 'saúde emocional')
  const tone = config.tone || 'acolhedor'
  const prompt = buildArticleGenerationPrompt({
    quantity,
    themes,
    tone,
    category: automation.category || 'saúde emocional',
    extraInstructions: config.extra || undefined,
  })
  const raw = await genAI(prompt)
  const packages = parseArticlePackages(raw, themes, automation.category || '').slice(0, quantity)
  if (packages.length === 0) throw new Error('IA não retornou nenhum artigo válido no contrato editorial.')

  // Pexels e persistência podem rodar em paralelo. A geração textual já ocorreu em
  // uma única chamada, evitando multiplicar a latência do cron semanal.
  // A expansão é limitada a UMA tentativa por artigo pelo persistArticle.
  const results = await Promise.all(packages.map((pkg, index) =>
    persistArticle(admin, automation, pkg, themes[index % themes.length], prompt, true),
  ))
  const published = results.filter(r => r.published).length
  const drafts = results.length - published
  if (quantity === 1) {
    const first = results[0]
    return first.published
      ? `Publicado: ${first.title}`
      : `Rascunho: ${first.title}${first.validationErrors.length ? ` (validação: ${first.validationErrors.join(', ')})` : ''}`
  }
  return `Pacote: ${results.length} artigos gerados (${published} publicado(s), ${drafts} rascunho(s)).`
}

async function executePautaAutomation(
  admin: AdminClient,
  automation: AutomationRow,
  type: EditorialAutomationType,
  config: EditorialAutomationConfig,
): Promise<string> {
  const quantity = clampAutomationQuantity(type, config.quantity)
  const themes = uniqueThemes(config, automation.category || 'saúde emocional')
  const { data: existing } = await admin.from('editorial_calendar')
    .select('title').gte('scheduled_date', new Date().toISOString().slice(0, 10)).limit(120)
  const existingTitles = (existing ?? []).map((row: { title?: string | null }) => row.title).filter(Boolean).slice(0, 80)
  const periodInstruction = type === 'monthly_pauta'
    ? 'Planeje o PRÓXIMO mês inteiro, equilibrando temas ao longo das semanas.'
    : 'Planeje as próximas duas semanas.'
  const prompt = `Atue como estrategista editorial do A Vida Não Colabora. ${periodInstruction}
Crie exatamente ${quantity} ideias de conteúdo úteis, humanas, não clínicas e não repetitivas.
Temas prioritários: ${themes.join(' | ')}. Categoria-base: ${automation.category || 'saúde emocional'}.
Plano-alvo da regra: ${normalizedPlan(automation.plan_required)}.
Evite títulos já planejados: ${existingTitles.join(' | ') || 'nenhum'}.
Não diagnostique, não prometa cura e não use linguagem terapêutica como se fosse atendimento clínico.
Retorne SOMENTE JSON válido:
{"ideas":[{"title":"título curto","category":"categoria","content_type":"article","angle":"ângulo específico","notes":"2 a 3 frases de briefing"}]}
${config.extra ? `Instrução adicional: ${config.extra}` : ''}`
  const raw = await genAI(prompt)
  const parsed = parseJsonObject(raw)
  if (!parsed) throw new Error('IA não retornou JSON válido para a pauta.')
  const ideas = ideaItems(parsed).slice(0, quantity)
  if (!ideas.length) throw new Error('IA não retornou ideias de pauta.')

  const normalizedExisting = new Set(existingTitles.map((v: unknown) => slugify(String(v))))
  const rows: Record<string, unknown>[] = []
  for (const idea of ideas) {
    const title = cleanText(idea.title, 140)
    if (!title || normalizedExisting.has(slugify(title)) || rows.some(r => slugify(String(r.title)) === slugify(title))) continue
    const angle = cleanText(idea.angle, 300)
    const notes = cleanText(idea.notes, 1000)
    rows.push({
      title,
      content_type: cleanText(idea.content_type, 40) || 'article',
      category: cleanText(idea.category, 120) || automation.category || 'Geral',
      plan_required: normalizedPlan(automation.plan_required),
      status: 'ideia', origin: 'ia',
      scheduled_date: plannedDateForIdea(type, rows.length, quantity),
      notes: [angle ? `Ângulo: ${angle}` : '', notes].filter(Boolean).join('\n'),
    })
  }
  if (!rows.length) throw new Error('Todas as ideias retornadas já estavam planejadas ou eram inválidas.')
  const { error } = await admin.from('editorial_calendar').insert(rows)
  if (error) throw error
  return type === 'monthly_pauta'
    ? `Pauta mensal: ${rows.length} ideias adicionadas ao Calendário Editorial.`
    : `Pauta: ${rows.length} ideias adicionadas ao Calendário Editorial.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

  // Token interno auto-gerado no banco (migration 070), lido via RPC — os dois
  // lados (cron e função) pegam o MESMO valor, então batem sozinhos, sem o admin
  // configurar nada. Também aceita CRON_SECRET ou o service role, como alternativas.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  let internalToken: string | null = null
  try {
    const { data } = await admin.rpc('get_automation_token')
    if (typeof data === 'string') internalToken = data
  } catch { /* RPC ainda não migrou */ }
  const allowed = [internalToken, Deno.env.get('CRON_SECRET'), serviceKey].filter(Boolean) as string[]

  // "Gerar agora" no admin: além do token de cron, aceita o JWT de um ADMIN
  // autenticado. Assim o botão dispara a geração na hora, sem depender do vault.
  let isAdmin = false
  if (!allowed.includes(token)) {
    try {
      const { data: { user } } = await admin.auth.getUser(token)
      if (user) {
        const { data: prof } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
        isAdmin = (prof as { role?: string } | null)?.role === 'admin'
      }
    } catch { /* token inválido */ }
    if (!isAdmin) return json({ error: 'Não autorizado' }, 401)
  }

  // Disparo manual de UMA regra específica (force = ignora a checagem de "vencida").
  let body: { automationId?: string; force?: boolean } = {}
  try { body = await req.json() } catch { /* cron chama sem body */ }
  const forceOne = isAdmin && !!body.automationId

  let query = admin.from('content_automations')
    .select('*').eq('status', 'active').in('type', GEN_TYPES)
  if (forceOne) query = query.eq('id', body.automationId!)
  const { data: autos, error } = await query
  if (error) return json({ error: error.message }, 500)

  const now = Date.now()
  const results: { id: string; result: string }[] = []

  for (const rawAutomation of autos ?? []) {
    const a = rawAutomation as AutomationRow
    const days = FREQ_DAYS[a.frequency] ?? 7
    const last = a.last_run_at ? new Date(a.last_run_at).getTime() : 0
    const next = a.next_run_at ? new Date(a.next_run_at).getTime() : 0
    if (!forceOne && next && now < next) continue
    if (!forceOne && !next && last && now - last < days * 86400000) continue

    try {
      if (!isEditorialAutomationType(a.type)) throw new Error(`Tipo de automação sem executor: ${a.type}`)
      const cfg = (a.config ?? {}) as EditorialAutomationConfig
      const resultLabel = a.type === 'generate_daily' || a.type === 'generate_weekly_package'
        ? await executeArticleAutomation(admin, a, a.type, cfg)
        : await executePautaAutomation(admin, a, a.type, cfg)
      const nowIso = new Date().toISOString()
      await admin.from('content_automations').update({
        last_run_at: nowIso,
        next_run_at: nextRunAt(a.frequency, new Date(now)),
        last_result: resultLabel,
        last_error: null,
      }).eq('id', a.id)
      results.push({ id: a.id, result: `ok: ${resultLabel}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Falhas não contam como execução concluída: preserva last_run_at e agenda
      // uma nova tentativa para o próximo ciclo horário do cron.
      await admin.from('content_automations').update({
        last_error: msg,
        next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }).eq('id', a.id)
      results.push({ id: a.id, result: 'erro: ' + msg })
    }
  }

  // "Gerar agora": devolve só o resultado desta regra, sem rodar o bloco de
  // personalização por usuário (que é trabalho do cron completo).
  if (forceOne) {
    const r = results[0]
    if (!r) return json({ ok: false, error: 'Regra não encontrada ou inativa.' }, 200)
    const erro = r.result.startsWith('erro:')
    return json({ ok: !erro, message: r.result.replace(/^ok:\s*/, '').replace(/^erro:\s*/, ''), error: erro ? r.result.slice(6) : undefined })
  }

  // ── Personalização por usuário: gera RASCUNHOS para tarefas pendentes ──
  // NUNCA envia — só cria o rascunho (status 'draft') na fila de revisão do
  // admin (Conteúdos → Recomendações IA). O envio continua sendo manual.
  let persDrafts = 0
  const MAX_PERSONALIZATION_ATTEMPTS = 5 // depois disso, para de tentar e vira 'cancelled' (não trava a fila)
  try {
    const { data: tasks } = await admin.from('user_personalization_tasks')
      .select('id, user_id, task_key, task_title, plan_key, content_type, target_area, attempts')
      .eq('status', 'pending').limit(10)
    for (const t of tasks ?? []) {
      try {
        const snap = await buildSnapshot(admin, t.user_id, t.plan_key, t.task_key)
        const marcadores = snap.topMarkers.length ? snap.topMarkers.join(', ') : 'ainda poucos registros'
        const contextos = snap.topContexts.length ? snap.topContexts.join(', ') : 'sem contextos recorrentes suficientes'
        const necessidades = snap.topNeeds.length ? snap.topNeeds.join(', ') : 'sem necessidades recorrentes suficientes'
        const cuidados = snap.topCareActions.length ? snap.topCareActions.join(', ') : 'sem ações de cuidado recorrentes suficientes'
        const gatilhos = snap.topTriggers.length ? snap.topTriggers.join(', ') : 'sem gatilhos reais suficientes'
        const humor = snap.avgMood ? `humor médio ${snap.avgMood}/5` : 'sem humor registrado ainda'
        const prompt = `Escreva um conteúdo pessoal e acolhedor para UMA pessoa usuária de um app de saúde emocional, sobre "${t.task_title}".
Contexto (somente dados agregados, sem identificar a pessoa): plano efetivo ${snap.plan}; ${snap.diaryCount} registros no diário; marcadores emocionais: ${marcadores}; contextos: ${contextos}; necessidades: ${necessidades}; ações de cuidado: ${cuidados}; ${snap.plan === 'plus' ? `gatilhos reais: ${gatilhos}; ` : ''}${humor}.
Fale em segunda pessoa (você), tom acolhedor, português brasileiro. Reconheça o esforço da pessoa, traga 1 reflexão e 1 ou 2 sugestões práticas simples ligadas aos marcadores. NÃO dê diagnóstico, NÃO prometa cura, NÃO afirme condição clínica. Termine com uma frase gentil. Este é um RASCUNHO que será revisado por um humano antes de enviar.`
        const body = await genAI(prompt)
        const title = t.task_title || 'Conteúdo personalizado'
        const { data: del } = await admin.from('personalized_content_deliveries').insert({
          user_id: t.user_id, created_by: null, plan_key: snap.plan, content_type: t.content_type,
          title, body, target_area: t.target_area ?? 'my_evolution', data_snapshot: snap,
          ai_generated: true, status: 'draft', task_id: t.id,
        }).select('id').single()
        await admin.from('user_personalization_tasks').update({
          status: 'draft', delivery_id: (del as { id?: string } | null)?.id ?? null,
          generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', t.id)
        persDrafts++
      } catch (err) {
        // Registra a falha (visível no Admin) em vez de só pular silenciosamente.
        // Depois de MAX_PERSONALIZATION_ATTEMPTS, cancela a tarefa para não
        // ocupar uma vaga por hora indefinidamente se o erro for determinístico.
        const attempts = ((t as { attempts?: number }).attempts ?? 0) + 1
        const last_error = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500)
        await admin.from('user_personalization_tasks').update({
          attempts, last_error, last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(attempts >= MAX_PERSONALIZATION_ATTEMPTS ? { status: 'cancelled' } : {}),
        }).eq('id', t.id)
      }
    }
  } catch { /* tabela indisponível */ }

  return json({ ran: results.length, personalized_drafts: persDrafts, results })
})