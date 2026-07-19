import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Executor de automações de conteúdo (chamado por pg_cron via pg_net) ─────
// Autenticado pelo SERVICE ROLE (só o banco/vault tem). Para cada automação de
// geração ATIVA e vencida (pela frequência), gera 1 rascunho com IA e registra
// no calendário editorial. Se o modo for 'auto_publish', publica direto.
// Nada aqui usa JWT de usuário — é um job de servidor.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

async function genAI(prompt: string): Promise<string> {
  // Ordem de failover: Gemini → Groq → OpenAI (gpt-4o-mini). Chaves só no servidor.
  const gk = Deno.env.get('GEMINI_API_KEY')
  if (gk) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gk}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      })
      if (r.ok) { const d = await r.json(); const t = d?.candidates?.[0]?.content?.parts?.[0]?.text; if (t?.trim()) return String(t).trim() }
    } catch { /* próximo provedor */ }
  }
  const qk = Deno.env.get('GROQ_API_KEY')
  if (qk) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${qk}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }] }),
      })
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content; if (t?.trim()) return String(t).trim() }
    } catch { /* próximo provedor */ }
  }
  const ok = Deno.env.get('OPENAI_API_KEY')
  if (ok) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
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
  const [dc, dd, qc, sc, ar] = await Promise.all([
    admin.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('diary_entries').select('mood, tags').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    admin.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('analytics_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('event_type', 'article_read'),
  ])
  const tagFreq: Record<string, number> = {}
  let moodSum = 0, moodCount = 0
  for (const d of (dd.data ?? []) as { tags?: unknown[]; mood?: number }[]) {
    if (Array.isArray(d.tags)) for (const t of d.tags) tagFreq[t as string] = (tagFreq[t as string] ?? 0) + 1
    if (d.mood) { moodSum += d.mood; moodCount++ }
  }
  const topMarkers = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)
  return {
    plan, task: taskKey, period: new Date().toISOString().slice(0, 7),
    diaryCount: dc.count ?? 0, topMarkers,
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

      // 2) conteúdo estruturado, no tom pedido
      const prompt = `Escreva um artigo de blog para um app de saúde emocional, com o título "${title}" (tema: ${tema}). Tom ${tone}, português brasileiro.
Estrutura: 1) introdução acolhedora; 2) explicação simples do tema; 3) um exemplo da vida real, sem nomes; 4) uma reflexão guiada; 5) um exercício prático curto; 6) uma pergunta para o diário; 7) um CTA gentil; 8) uma linha final avisando que este conteúdo não substitui acompanhamento profissional.${cfg.extra ? ' ' + cfg.extra : ''}
Não use markdown pesado, não dê diagnóstico e não prometa cura.`
      const content = await genAI(prompt)
      const publish = a.mode === 'auto_publish'
      const nowIso = new Date().toISOString()

      const { data: art, error: insErr } = await admin.from('articles').insert({
        title, slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
        content, summary: '', excerpt: '', category: a.category || null,
        plan_required: a.plan_required || 'free', content_type: tipo, origin: 'ia',
        status: publish ? 'published' : 'draft',
        published_at: publish ? nowIso : null, updated_at: nowIso,
      }).select('id').single()
      if (insErr) throw insErr

      admin.from('editorial_calendar').insert({
        article_id: (art as { id?: string } | null)?.id ?? null, title,
        content_type: tipo, plan_required: a.plan_required || 'free',
        status: publish ? 'publicado' : 'gerado_ia', origin: 'ia',
        scheduled_date: nowIso.slice(0, 10),
      }).then(() => {}, () => {})

      await admin.from('content_automations').update({
        last_run_at: nowIso, next_run_at: new Date(now + days * 86400000).toISOString(),
        last_result: `${publish ? 'Publicado' : 'Rascunho'}: ${title}`, last_error: null,
      }).eq('id', a.id)
      results.push({ id: a.id, result: `ok: ${title}` })
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
        const humor = snap.avgMood ? `humor médio ${snap.avgMood}/5` : 'sem humor registrado ainda'
        const prompt = `Escreva um conteúdo pessoal e acolhedor para UMA pessoa usuária de um app de saúde emocional, sobre "${t.task_title}".
Contexto (dados agregados, sem identificar a pessoa): plano ${t.plan_key}; ${snap.diaryCount} registros no diário; marcadores mais frequentes: ${marcadores}; ${humor}.
Fale em segunda pessoa (você), tom acolhedor, português brasileiro. Reconheça o esforço da pessoa, traga 1 reflexão e 1 ou 2 sugestões práticas simples ligadas aos marcadores. NÃO dê diagnóstico, NÃO prometa cura, NÃO afirme condição clínica. Termine com uma frase gentil. Este é um RASCUNHO que será revisado por um humano antes de enviar.`
        const body = await genAI(prompt)
        const title = t.task_title || 'Conteúdo personalizado'
        const { data: del } = await admin.from('personalized_content_deliveries').insert({
          user_id: t.user_id, created_by: null, plan_key: t.plan_key, content_type: t.content_type,
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
