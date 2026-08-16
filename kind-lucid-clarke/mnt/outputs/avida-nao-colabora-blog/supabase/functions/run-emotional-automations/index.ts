import { createClient } from 'npm:@supabase/supabase-js@2'

// Automação emocional (relatórios + plano). Não mistura conteúdo editorial e
// nunca recebe texto livre do diário: somente colunas analíticas agregadas.
// Espelho versionado dos contratos em src/lib/aiPrompts/emotionalPrompts.ts.
// Deno não importa o bundle React; manter tipo+versão explícitos evita prompts
// paralelos e torna cada geração auditável.
const PROMPT_VERSION: Record<'weekly_report' | 'monthly_deep_report' | 'self_care_plan', string> = {
  weekly_report: 'weekly_report_v1', monthly_deep_report: 'monthly_deep_report_v1', self_care_plan: 'self_care_plan_v2',
}
const cors = { 'Access-Control-Allow-Origin': 'https://www.avidanaocolabora.com', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const list = (v: unknown): string[] => Array.isArray(v) ? v.map(String).map(x => x.trim()).filter(Boolean) : []
const average = (values: unknown[]) => { const n = values.map(Number).filter(v => Number.isFinite(v) && v > 0); return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : 0 }
const top = (items: string[]) => Object.entries(items.reduce<Record<string, number>>((a, x) => { a[x] = (a[x] || 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count }))

type Summary = ReturnType<typeof summaryOf>
function summaryOf(rows: Record<string, unknown>[], start: string, end: string, plan: 'essential' | 'plus') {
  const days = new Set(rows.map(r => String(r.date || r.created_at || '').slice(0, 10)).filter(Boolean))
  const type = (t: string) => rows.filter(r => r.entry_type === t).length
  const diaries = rows.filter(r => r.entry_type === 'diary')
  const quality = days.size >= (end.slice(0, 7) === start.slice(0, 7) ? 3 : 3) && rows.length >= 5 ? 'medium' : 'low'
  return {
    period_start: start, period_end: end, plan, total_entries: rows.length,
    total_checkins: type('checkin'), total_main_diaries: diaries.filter(r => r.diary_kind !== 'addon').length,
    total_addons: diaries.filter(r => r.diary_kind === 'addon').length, active_days: days.size,
    dominant_emotions: top(rows.map(r => String(r.mood || '')).filter(Boolean)).map(x => ({ label: x.tag, count: x.count })),
    emotional_markers: top(rows.flatMap(r => list(r.emotional_tags))), contexts: top(rows.flatMap(r => list(r.context_tags))),
    needs: top(rows.flatMap(r => list(r.need_tags))), care_actions: top(rows.flatMap(r => list(r.care_action_tags))),
    real_triggers: plan === 'plus' ? top(rows.flatMap(r => list(r.trigger_tags))) : [],
    averages: { mood: average(rows.map(r => r.mood_score)), energy: average(rows.map(r => r.energy)), anxiety: average(rows.map(r => r.anxiety_level)), sleep: average(rows.map(r => r.sleep_quality)), stress: plan === 'plus' ? average(rows.map(r => r.stress_level)) : 0, selfEsteem: plan === 'plus' ? average(rows.map(r => r.self_esteem)) : 0 },
    data_quality: { has_enough_data: quality !== 'low', total_entries: rows.length, active_days: days.size, confidence_level: quality, message: quality === 'low' ? 'Seus registros deste período ainda são poucos, então esta leitura deve ser vista como um ponto de partida, não como conclusão.' : 'Há registros suficientes para uma leitura cuidadosa do período.' },
  }
}

function prompt(kind: 'weekly_report' | 'monthly_deep_report' | 'self_care_plan', summary: Summary) {
  const shape = kind === 'weekly_report'
    ? '{"summary":"2 a 4 frases","patterns":["até 3"],"attention_points":["até 2"],"next_steps":["até 3"],"data_quality_message":"texto"}'
    : kind === 'monthly_deep_report'
      ? '{"summary":"3 a 5 frases","patterns":["até 4"],"relations":["até 3"],"improvement_moments":["até 3"],"reflection_questions":["3 perguntas"],"data_quality_message":"texto"}'
      : '{"title":"texto","month_label":"texto","based_on_period":"texto","main_focus":"texto","why_this_focus":"texto","three_care_priorities":[{"priority":"texto","why_it_matters":"texto","small_actions":["2"]},{"priority":"texto","why_it_matters":"texto","small_actions":["2"]},{"priority":"texto","why_it_matters":"texto","small_actions":["2"]}],"weekly_rhythm":{"week_1":"texto","week_2":"texto","week_3":"texto","week_4":"texto"},"suggested_micro_actions":["3 a 5"],"recommended_guided_contents":["até 3 temas"],"gentle_reminders":["2"],"what_not_to_force":"texto","light_emotional_goal":"texto","checkin_suggestion":"texto","reflection_questions":["3"],"final_message":"texto","data_quality_message":"texto"}'
  return `Você prepara ${kind} para o aplicativo A Vida Não Colabora. Use somente os dados agregados abaixo, em português brasileiro. Não diagnostique, prescreva, prometa cura, invente fatos nem trate marcadores emocionais como gatilhos. Se houver poucos dados, reconheça a limitação. Para self_care_plan, crie um roteiro prospectivo e leve: três prioridades, um ritmo semanal e pequenas ações possíveis; não repita uma retrospectiva detalhada. Retorne exclusivamente JSON válido e sem markdown.\nDADOS: ${JSON.stringify(summary)}\nFORMATO: ${shape}`
}

async function generate(promptText: string): Promise<{ text: string; model: string }> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY não configurada')
  const model = (Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash').split(',')[0].trim()
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1800 } }) })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json(); const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || !String(text).trim()) throw new Error('Resposta de IA vazia')
  return { text: String(text).trim(), model }
}

function parse(raw: string): Record<string, unknown> | null { try { const match = raw.match(/\{[\s\S]*\}/); const obj = JSON.parse(match?.[0] || ''); return obj && typeof obj === 'object' ? obj as Record<string, unknown> : null } catch { return null } }
function texts(v: unknown, limit: number) { return Array.isArray(v) ? v.map(String).map(s => s.trim().slice(0, limit)).filter(Boolean).slice(0, 5) : [] }
function str(v: unknown, fallback: string) { return typeof v === 'string' && v.trim() ? v.trim().slice(0, 1200) : fallback }
function carePriorities(v: unknown) {
  if (!Array.isArray(v)) return []
  return v.map(item => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return { priority: str(row.priority, ''), why_it_matters: str(row.why_it_matters, ''), small_actions: texts(row.small_actions, 260) }
  }).filter(item => item.priority && item.why_it_matters && item.small_actions.length).slice(0, 3)
}
function weeklyRhythm(v: unknown) {
  const row = v && typeof v === 'object' ? v as Record<string, unknown> : {}
  return { week_1: str(row.week_1, ''), week_2: str(row.week_2, ''), week_3: str(row.week_3, ''), week_4: str(row.week_4, '') }
}

function reportContent(kind: 'weekly' | 'monthly', s: Summary, ai: Record<string, unknown> | null) {
  const markers = s.emotional_markers; const patterns = texts(ai?.patterns, 320)
  const fallback = s.data_quality.message
  if (kind === 'weekly') return {
    kind, v: 7, hasEnoughData: s.data_quality.has_enough_data, summary: str(ai?.summary, fallback), interpretation: str(ai?.summary, fallback), patterns: patterns.length ? patterns : [fallback], attentionPoints: texts(ai?.attention_points, 260), improvementMoments: texts(ai?.improvement_moments, 260).join(' ') || 'Continue observando os pequenos momentos que ajudaram.', topEmotions: s.dominant_emotions.map(x => ({ ...x, emoji: '•' })), avgEnergy: s.averages.energy, avgAnxiety: s.averages.anxiety, avgMood: s.averages.mood, emotionalMarkers: markers, topContexts: s.contexts, comparison: [], nextSteps: texts(ai?.next_steps, 260), recommendTags: markers.map(x => x.tag), energyByDay: [], anxietyByDay: [], checkinCount: s.total_checkins, diaryCount: s.total_main_diaries + s.total_addons, dominantEmotion: s.dominant_emotions[0]?.label || null, topEmotionalMarker: markers[0]?.tag || null,
  }
  return {
    kind, v: 8, hasEnoughData: s.data_quality.has_enough_data, summary: str(ai?.summary, fallback), patterns: patterns.length ? patterns : [fallback], narrative: [], relations: texts(ai?.relations, 320), avgEnergy: s.averages.energy, avgAnxiety: s.averages.anxiety, avgSleep: s.averages.sleep, topEmotions: s.dominant_emotions.map(x => ({ ...x, emoji: '•' })), topEmotionalMarkers: markers, topContexts: s.contexts, topNeeds: s.needs, energyByDay: [], anxietyByDay: [], checkinCount: s.total_checkins, diaryCount: s.total_main_diaries + s.total_addons, emotionalMarkers: markers, realTriggers: s.real_triggers, improvementMoments: texts(ai?.improvement_moments, 260).join(' '), reflectionQuestions: texts(ai?.reflection_questions, 260), attentionDays: [], monthlyComparison: [], predominantEmotions: s.dominant_emotions.map(x => x.label).join(', ') || 'Ainda não há emoção predominante', energyAnxietySleep: s.data_quality.message, emotionalMarkersText: markers.length ? `Os marcadores mais citados foram ${markers.map(x => x.tag).join(', ')}.` : 'Ainda não há marcadores emocionais suficientes para uma leitura de recorrência.', bridgeToSelfCarePlan: 'Com base nesta leitura, seu plano de autocuidado pode transformar um ponto de atenção em uma ação leve para o próximo ciclo.', bridgeToProfessionalGuidance: 'Se fizer sentido, leve um ponto deste mês para sua orientação mensal.', recommendTags: markers.map(x => x.tag),
  }
}

async function log(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) { await admin.from('ai_generation_logs').insert(row) }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: expected } = await admin.rpc('get_automation_token')
  let authorized = token && token === expected
  let actor: string | null = null
  if (!authorized && token) { const { data: u } = await admin.auth.getUser(token); if (u.user) { const { data: p } = await admin.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle(); authorized = p?.role === 'admin'; actor = authorized ? u.user.id : null } }
  if (!authorized) return json({ error: 'Não autorizado' }, 401)
  let body: { mode?: 'weekly' | 'monthly' | 'all'; userId?: string; now?: string } = {}; try { body = await req.json() } catch { /* cron */ }
  // Semana oficial: domingo a sábado, disponível no domingo seguinte. Mesmo se
  // o job atrasar para segunda, mantém o último sábado já fechado.
  const requestedNow = body.now ? new Date(body.now) : new Date()
  const now = Number.isNaN(requestedNow.getTime()) ? new Date() : requestedNow
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const weekEnd = new Date(today); weekEnd.setUTCDate(today.getUTCDate() - (today.getUTCDay() === 6 ? 7 : (today.getUTCDay() + 1) % 7))
  const weekStart = new Date(weekEnd); weekStart.setUTCDate(weekEnd.getUTCDate() - 6)
  // Mês fechado imediatamente anterior: agosto -> 01/07 a 31/07, inclusive.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  let profileQuery = admin.from('profiles').select('user_id, plan, subscription_status, unlimited_access')
    .in('plan', ['essential', 'plus', 'therapeutic', 'therapeutic-plus'])
  if (body.userId) profileQuery = profileQuery.eq('user_id', body.userId)
  const { data: candidates, error } = await profileQuery
  if (error) return json({ error: error.message }, 500)
  const results: string[] = []
  for (const profile of candidates as { user_id: string; plan: string; subscription_status?: string; unlimited_access?: boolean }[]) {
    if (!profile.unlimited_access && profile.subscription_status && !['active', 'trialing'].includes(profile.subscription_status)) continue
    const plan = ['plus', 'therapeutic', 'therapeutic-plus'].includes(profile.plan) ? 'plus' : 'essential'
    for (const job of [{ kind: 'weekly' as const, start: isoDay(weekStart), end: isoDay(weekEnd), allowed: true }, { kind: 'monthly' as const, start: isoDay(monthStart), end: isoDay(monthEnd), allowed: plan === 'plus' }]) {
      if (!job.allowed || (body.mode && body.mode !== 'all' && body.mode !== job.kind)) continue
      const { data: exists } = await admin.from('reports').select('id,status').eq('user_id', profile.user_id).eq('report_type', job.kind).eq('period_start', job.start).eq('period_end', job.end).maybeSingle()
      if (exists) { results.push(`${profile.user_id}:${job.kind}:já existe`); continue }
      const { data: rows } = await admin.from('diary_entries').select('entry_type,diary_kind,date,created_at,mood,mood_score,energy,anxiety_level,sleep_quality,stress_level,self_esteem,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags').eq('user_id', profile.user_id).gte('date', job.start).lte('date', job.end)
      const summary = summaryOf((rows || []) as Record<string, unknown>[], job.start, job.end, plan)
      let parsed: Record<string, unknown> | null = null; let model = 'deterministic-fallback'; let fallback = true; let errorMessage: string | null = null
      try { const generated = await generate(prompt(job.kind === 'weekly' ? 'weekly_report' : 'monthly_deep_report', summary)); parsed = parse(generated.text); if (!parsed) throw new Error('JSON inválido'); model = generated.model; fallback = false } catch (e) { errorMessage = e instanceof Error ? e.message : String(e) }
      const content = reportContent(job.kind, summary, parsed)
      const promptType = job.kind === 'weekly' ? 'weekly_report' : 'monthly_deep_report'
      const { error: saveError } = await admin.from('reports').insert({ user_id: profile.user_id, report_type: job.kind, plan_required: job.kind === 'weekly' ? 'essential' : 'plus', period_start: job.start, period_end: job.end, available_at: new Date().toISOString(), status: 'generated', title: job.kind === 'weekly' ? `Relatório semanal — ${job.start}` : `Relatório mensal aprofundado — ${job.start.slice(0, 7)}`, summary: content.summary, content, generated_at: new Date().toISOString(), ai_prompt_type: promptType, ai_prompt_version: PROMPT_VERSION[promptType], model_used: model, fallback_used: fallback, data_quality: summary.data_quality, error_message: errorMessage, generated_by: actor })
      if (saveError) { results.push(`${profile.user_id}:${job.kind}:erro`); continue }
      await log(admin, { user_id: profile.user_id, admin_id: actor, content_type: promptType, prompt_type: promptType, prompt_version: PROMPT_VERSION[promptType], model_used: model, fallback_used: fallback, data_quality: summary.data_quality, source_period_start: job.start, source_period_end: job.end, generation_status: fallback ? 'fallback' : 'success', status: fallback ? 'fallback' : 'success', error_msg: errorMessage })
      results.push(`${profile.user_id}:${job.kind}:ok`)
    }
    if (plan === 'plus' && (!body.mode || body.mode === 'all' || body.mode === 'monthly')) {
      const { data: existingPlan } = await admin.from('monthly_care_plans').select('id,status').eq('user_id', profile.user_id).eq('period_start', isoDay(monthStart)).eq('period_end', isoDay(monthEnd)).maybeSingle()
      if (!existingPlan) {
        const { data: rows } = await admin.from('diary_entries').select('entry_type,diary_kind,date,created_at,mood,mood_score,energy,anxiety_level,sleep_quality,stress_level,self_esteem,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags').eq('user_id', profile.user_id).gte('date', isoDay(monthStart)).lte('date', isoDay(monthEnd))
        const s = summaryOf((rows || []) as Record<string, unknown>[], isoDay(monthStart), isoDay(monthEnd), 'plus')
        let parsed: Record<string, unknown> | null = null; let model = 'deterministic-fallback'; let fallback = true; let errorMessage: string | null = null
        try { const generated = await generate(prompt('self_care_plan', s)); parsed = parse(generated.text); if (!parsed || !parsed.main_focus || carePriorities(parsed.three_care_priorities).length < 3) throw new Error('JSON do plano inválido'); model = generated.model; fallback = false } catch (e) { errorMessage = e instanceof Error ? e.message : String(e) }
        const actions = texts(parsed?.suggested_micro_actions ?? parsed?.practical_tips, 260)
        const care = { title: str(parsed?.title, 'Seu roteiro de cuidado'), month_label: str(parsed?.month_label, monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })), based_on_period: `${isoDay(monthStart)} a ${isoDay(monthEnd)}`, main_focus: str(parsed?.main_focus ?? parsed?.monthly_priority, 'Escolher um pequeno passo de cuidado possível.'), why_this_focus: str(parsed?.why_this_focus ?? parsed?.main_care, s.data_quality.message), three_care_priorities: carePriorities(parsed?.three_care_priorities), weekly_rhythm: weeklyRhythm(parsed?.weekly_rhythm), suggested_micro_actions: actions, recommended_guided_contents: texts(parsed?.recommended_guided_contents, 160), gentle_reminders: texts(parsed?.gentle_reminders, 220), what_not_to_force: str(parsed?.what_not_to_force, 'Você não precisa resolver todos os pontos de uma vez.'), light_emotional_goal: str(parsed?.light_emotional_goal, 'Perceber um sinal seu e escolher um cuidado possível.'), monthly_priority: str(parsed?.monthly_priority ?? parsed?.main_focus, 'Escolher um pequeno passo de cuidado possível.'), main_care: str(parsed?.main_care ?? parsed?.why_this_focus, s.data_quality.message), recommended_practice: actions[0] || 'Reserve alguns minutos para observar como você está, sem cobrança.', attention_point: s.data_quality.message, small_commitment: actions[1] || 'Escolha uma ação leve em um dia da semana.', checkin_suggestion: str(parsed?.checkin_suggestion, 'Faça um check-in breve quando fizer sentido.'), practical_tips: actions, reflection_questions: texts(parsed?.reflection_questions, 260), final_message: str(parsed?.final_message, 'Você não precisa resolver tudo agora.') }
        await admin.from('monthly_care_plans').insert({ user_id: profile.user_id, month_reference: isoDay(monthStart), period_start: isoDay(monthStart), period_end: isoDay(monthEnd), available_at: new Date().toISOString(), plan_required: 'plus', status: 'pending_review', records_summary: s, ai_summary: str(parsed?.data_quality_message, s.data_quality.message), ai_summary_json: { data_quality: s.data_quality }, care_plan: care, generated_by_ai: !fallback, generated_at: new Date().toISOString(), ai_prompt_type: 'self_care_plan', ai_prompt_version: PROMPT_VERSION.self_care_plan, model_used: model, fallback_used: fallback, data_quality: s.data_quality, error_message: errorMessage, generated_by: actor })
        await log(admin, { user_id: profile.user_id, admin_id: actor, content_type: 'self_care_plan', prompt_type: 'self_care_plan', prompt_version: PROMPT_VERSION.self_care_plan, model_used: model, fallback_used: fallback, data_quality: s.data_quality, source_period_start: s.period_start, source_period_end: s.period_end, generation_status: fallback ? 'fallback' : 'success', status: fallback ? 'fallback' : 'success', error_msg: errorMessage })
        results.push(`${profile.user_id}:plano:ok`)
      }
    }
  }
  return json({ ok: true, prompt_versions: PROMPT_VERSION, results })
})
