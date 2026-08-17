import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Executor de automações de conteúdo (chamado por pg_cron via pg_net) ─────
// Autenticado pelo SERVICE ROLE (só o banco/vault tem). Para cada automação de
// geração ATIVA e vencida (pela frequência), gera 1 rascunho com IA e registra
// no calendário editorial. Se o modo for 'auto_publish', só publica após a
// validação editorial determinística (tamanho, SEO e imagem); caso contrário fica rascunho.
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
const GEN_TYPES = ['generate_daily', 'generate_weekly_package', 'generate_pauta', 'monthly_pauta']

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 72)
}
// Resumo curto p/ card do blog — 1º parágrafo substancial do conteúdo gerado,
// sem chamar a IA de novo (evita custo/latência extra por artigo).
function excerptFrom(content: string): string {
  const firstPara = content.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#') && l.length > 40) || ''
  return firstPara.replace(/[*_`]/g, '').slice(0, 200)
}
const MIN_AUTO_PUBLISH_WORDS = 1000
function wordCount(text: string): number { return text.trim().split(/\s+/).filter(Boolean).length }
function cleanText(value: unknown, max = 10000): string { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function stringList(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return []
  return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, max)
}
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

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-flash-latest']
const AI_TIMEOUT_MS = 45_000

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), AI_TIMEOUT_MS)
  try { return await fetch(url, { ...init, signal: c.signal }) }
  finally { clearTimeout(t) }
}

async function genAI(prompt: string): Promise<string> {
  // Ordem de failover: Gemini (lista de modelos) → Groq → OpenAI. Chaves só no servidor.
  const gk = Deno.env.get('GEMINI_API_KEY')
  if (gk) {
    for (const model of GEMINI_MODELS) {
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
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }] }),
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
async function buildSnapshot(admin: ReturnType<typeof createClient>, userId: string, plan: string, taskKey: string) {
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

  for (const a of autos ?? []) {
    const days = FREQ_DAYS[a.frequency] ?? 7
    const last = a.last_run_at ? new Date(a.last_run_at).getTime() : 0
    // "Gerar agora" (forceOne) ignora o intervalo; o cron respeita a frequência.
    if (!forceOne && last && now - last < days * 86400000) continue // ainda não venceu

    try {
      const cfg = (a.config ?? {}) as { themes?: string[]; tone?: string; extra?: string }
      const themes = Array.isArray(cfg.themes) && cfg.themes.length ? cfg.themes : [a.category || 'saúde emocional']
      const tema = themes[Math.floor(Math.random() * themes.length)]
      const tone = cfg.tone || 'acolhedor'
      const tipo = 'article'

      // 1) título próprio (não usa o tema cru como título)
      let title = tema
      try {
        const rawTitle = await genAI(`Crie UM título curto, humano e acolhedor (máx 8 palavras, sem aspas, sem markdown) para um artigo de blog sobre "${tema}". Responda apenas com o título.`)
        const clean = rawTitle.split('\n')[0].replace(/^["'#\s\-*]+|["'\s]+$/g, '').trim()
        if (clean) title = clean.slice(0, 120)
      } catch { /* mantém o tema como título */ }

      // 2) pacote editorial completo. A IA produz texto + metadados; números e
      // validação de publicação continuam determinísticos no servidor.
      const articlePrompt = `Você escreve para o blog A Vida Não Colabora. Produza um artigo original em português brasileiro, acolhedor, humano, não clínico e útil.
Título: "${title}". Tema: "${tema}". Tom: ${tone}.
O CORPO precisa ter entre 1100 e 1500 palavras, com introdução, explicação simples, exemplo de vida real sem nomes, reflexão guiada, exercício prático curto, pergunta para diário, CTA gentil e aviso final de que o conteúdo não substitui acompanhamento profissional.
Não diagnostique, não prescreva, não prometa cura, não invente pesquisas nem use markdown pesado.
Retorne SOMENTE JSON válido neste formato:
{
  "content":"corpo completo do artigo",
  "excerpt":"resumo entre 120 e 190 caracteres",
  "seo_title":"título SEO entre 35 e 60 caracteres",
  "seo_description":"descrição SEO entre 120 e 155 caracteres",
  "keyword":"palavra-chave principal",
  "secondary_keywords":["3 a 6 palavras-chave"],
  "tags":["3 a 6 tags"],
  "emotional_themes":["até 4 temas emocionais"],
  "image_query":"busca curta em inglês ou português para uma foto real, sem texto",
  "image_alt":"texto alternativo descritivo em português",
  "diary_question":"uma pergunta curta para o diário",
  "cta_text":"CTA curto e gentil"
}
${cfg.extra ? `Instrução adicional: ${cfg.extra}` : ''}`
      const rawPackage = await genAI(articlePrompt)
      const pkg = parseJsonObject(rawPackage) ?? {}
      let content = cleanText(pkg.content, 50000)

      // Se o modelo respondeu curto, tenta uma única expansão antes de decidir que
      // o artigo não está apto a publicação automática.
      if (content && wordCount(content) < MIN_AUTO_PUBLISH_WORDS) {
        try {
          content = await genAI(`Amplie o artigo abaixo para pelo menos 1100 palavras, preservando título, tom acolhedor, estrutura e segurança. Não invente dados clínicos. Responda somente com o corpo final do artigo.\n\n${content}`)
        } catch { /* validação abaixo impedirá auto-publicação */ }
      }
      if (!content) content = rawPackage

      const excerpt = cleanText(pkg.excerpt, 200) || excerptFrom(content)
      const seoTitle = cleanText(pkg.seo_title, 60) || title.slice(0, 60)
      const seoDescription = cleanText(pkg.seo_description, 155) || excerpt.slice(0, 155)
      const keyword = cleanText(pkg.keyword, 120) || tema.slice(0, 120)
      const secondaryKeywords = stringList(pkg.secondary_keywords, 6)
      const tags = stringList(pkg.tags, 6)
      const emotionalThemes = stringList(pkg.emotional_themes, 4)
      const imageQuery = cleanText(pkg.image_query, 120) || `${tema} wellbeing lifestyle`
      const cover = await searchPexelsCover(imageQuery)
      const imageAlt = cleanText(pkg.image_alt, 180) || cover?.alt || ''
      const diaryQuestion = cleanText(pkg.diary_question, 260)
      const ctaText = cleanText(pkg.cta_text, 180)

      const validationErrors: string[] = []
      if (wordCount(content) < MIN_AUTO_PUBLISH_WORDS) validationErrors.push(`menos de ${MIN_AUTO_PUBLISH_WORDS} palavras`)
      if (excerpt.length < 80) validationErrors.push('resumo curto/ausente')
      if (seoTitle.length < 25) validationErrors.push('SEO title ausente/curto')
      if (seoDescription.length < 90) validationErrors.push('meta description ausente/curta')
      if (!keyword || secondaryKeywords.length < 2) validationErrors.push('palavras-chave insuficientes')
      if (!cover?.url) validationErrors.push('imagem de capa ausente')
      if (!imageAlt) validationErrors.push('texto alternativo da imagem ausente')

      const wantsAutoPublish = a.mode === 'auto_publish'
      const publish = wantsAutoPublish && validationErrors.length === 0
      const nowIso = new Date().toISOString()
      const readTime = Math.max(1, Math.ceil(wordCount(content) / 200))
      const internalNotes = wantsAutoPublish && !publish
        ? `Auto-publicação bloqueada pela validação: ${validationErrors.join('; ')}.`
        : null

      const { data: art, error: insErr } = await admin.from('articles').insert({
        title, slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
        content, summary: excerpt, excerpt, category: a.category || 'Geral',
        plan_required: a.plan_required || 'free', content_type: 'article', origin: 'ia',
        status: publish ? 'published' : 'draft', published_at: publish ? nowIso : null, updated_at: nowIso,
        seo_title: seoTitle, seo_description: seoDescription, keyword,
        secondary_keywords: secondaryKeywords.join(', '), keywords: [keyword, ...secondaryKeywords].filter(Boolean),
        tags, emotional_themes: emotionalThemes, image_url: cover?.url || null, cover_image: cover?.url || null,
        cover_image_url: cover?.url || null, image_alt: imageAlt || null, og_image: cover?.url || null,
        diary_question: diaryQuestion || null, cta_text: ctaText || null, read_time: readTime,
        is_guided_content: false, is_recommendable: true, internal_notes: internalNotes, ai_prompt: articlePrompt,
      }).select('id').single()
      if (insErr) throw insErr

      admin.from('editorial_calendar').insert({
        article_id: (art as { id?: string } | null)?.id ?? null, title,
        content_type: 'article', plan_required: a.plan_required || 'free',
        status: publish ? 'publicado' : 'gerado_ia', origin: 'ia',
        scheduled_date: nowIso.slice(0, 10),
      }).then(() => {}, () => {})

      const resultLabel = publish
        ? `Publicado: ${title}`
        : wantsAutoPublish && validationErrors.length
          ? `Rascunho: ${title} (auto-publicação bloqueada: ${validationErrors.join(', ')})`
          : `Rascunho: ${title}`
      await admin.from('content_automations').update({
        last_run_at: nowIso, next_run_at: new Date(now + days * 86400000).toISOString(),
        last_result: resultLabel, last_error: null,
      }).eq('id', a.id)
      results.push({ id: a.id, result: `ok: ${resultLabel}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin.from('content_automations').update({ last_run_at: new Date().toISOString(), last_error: msg }).eq('id', a.id)
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
  try {
    const { data: tasks } = await admin.from('user_personalization_tasks')
      .select('id, user_id, task_key, task_title, plan_key, content_type, target_area')
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
      } catch { /* pula esta tarefa e segue */ }
    }
  } catch { /* tabela indisponível */ }

  return json({ ran: results.length, personalized_drafts: persDrafts, results })
})
