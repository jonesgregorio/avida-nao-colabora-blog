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
const dayOf = (row: Record<string, unknown>) => String(row.date || row.created_at || '').slice(0, 10)
const metricByDay = (rows: Record<string, unknown>[], field: string) => Object.entries(rows.reduce<Record<string, number[]>>((out, row) => {
  const day = dayOf(row); const value = Number(row[field])
  if (day && Number.isFinite(value) && value > 0) (out[day] ||= []).push(value)
  return out
}, {})).sort(([a], [b]) => a.localeCompare(b)).map(([day, values]) => ({ day, value: average(values) }))
const markersByDay = (rows: Record<string, unknown>[]) => Object.entries(rows.reduce<Record<string, string[]>>((out, row) => {
  const day = dayOf(row); if (day) (out[day] ||= []).push(...list(row.emotional_tags)); return out
}, {})).sort(([a], [b]) => a.localeCompare(b)).map(([day, tags]) => ({ day, markers: top(tags) }))
const weeksOf = (rows: Record<string, unknown>[], field: string) => Object.entries(rows.reduce<Record<string, number[]>>((out, row) => {
  const day = dayOf(row); const value = Number(row[field]); if (!day || !Number.isFinite(value) || value <= 0) return out
  const d = new Date(`${day}T00:00:00Z`); const key = `${d.getUTCFullYear()}-S${Math.ceil(((d.getUTCDate() + new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).getUTCDay()) / 7))}`
  ;(out[key] ||= []).push(value); return out
}, {})).sort(([a], [b]) => a.localeCompare(b)).map(([week, values]) => ({ week, value: average(values) }))
// §5/§9 do audit: dias que pedem mais atenção, linha do tempo real do mês e a
// relação energia/ansiedade/sono precisam ser calculados a partir dos registros
// reais — nunca texto genérico fixo.
function attentionDaysOf(rows: Record<string, unknown>[]) {
  const byDay = rows.reduce<Record<string, Record<string, unknown>[]>>((out, row) => { const day = dayOf(row); if (day) (out[day] ||= []).push(row); return out }, {})
  const days = Object.entries(byDay).map(([day, dayRows]) => {
    const anxiety = average(dayRows.map(r => r.anxiety_level)); const energy = average(dayRows.map(r => r.energy))
    const sleep = average(dayRows.map(r => r.sleep_quality)); const overload = average(dayRows.map(r => r.overload))
    const reasons: string[] = []
    if (anxiety >= 4) reasons.push('ansiedade alta')
    if (energy > 0 && energy <= 2) reasons.push('energia baixa')
    if (sleep > 0 && sleep <= 2) reasons.push('sono ruim')
    if (overload >= 4) reasons.push('sobrecarga alta')
    return { day, reasons, markers: top(dayRows.flatMap(r => list(r.emotional_tags))).slice(0, 3).map(x => x.tag) }
  }).filter(d => d.reasons.length)
  return days.sort((a, b) => a.day.localeCompare(b.day)).slice(0, 6).map(d => ({ date: d.day, reason: d.reasons.join(' e '), markers: d.markers }))
}
function monthTimelineOf(rows: Record<string, unknown>[], start: string, end: string) {
  const startDay = Number(start.slice(8, 10)); const endDay = Number(end.slice(8, 10))
  const span = Math.max(1, endDay - startDay + 1); const third = Math.max(1, Math.ceil(span / 3))
  const parts: Record<'beginning' | 'middle' | 'end', Record<string, unknown>[]> = { beginning: [], middle: [], end: [] }
  for (const row of rows) {
    const day = dayOf(row); if (!day) continue
    const d = Number(day.slice(8, 10)); const idx = Math.min(2, Math.floor((d - startDay) / third))
    parts[idx === 0 ? 'beginning' : idx === 1 ? 'middle' : 'end'].push(row)
  }
  const describe = (part: Record<string, unknown>[], phrase: string) => {
    if (!part.length) return `Não houve registros suficientes ${phrase} para essa leitura.`
    const marker = top(part.flatMap(r => list(r.emotional_tags)))[0]
    const energy = average(part.map(r => r.energy))
    const bits: string[] = []
    if (marker) bits.push(`"${marker.tag}" apareceu com frequência`)
    if (energy > 0) bits.push(`a energia média foi ${energy}`)
    return bits.length ? `Nesse período, ${bits.join(' e ')}.` : `Houve poucos registros com indicadores ${phrase}.`
  }
  return { beginning: describe(parts.beginning, 'no início do mês'), middle: describe(parts.middle, 'no meio do mês'), end: describe(parts.end, 'no fim do mês') }
}
function energyAnxietySleepRelationship(rows: Record<string, unknown>[]) {
  const byDay = rows.reduce<Record<string, Record<string, unknown>[]>>((out, row) => { const day = dayOf(row); if (day) (out[day] ||= []).push(row); return out }, {})
  const days = Object.values(byDay).map(dayRows => ({ energy: average(dayRows.map(r => r.energy)), anxiety: average(dayRows.map(r => r.anxiety_level)) })).filter(d => d.energy > 0 && d.anxiety > 0)
  if (days.length < 4) return 'Ainda não há dados suficientes de energia e ansiedade juntos para observar uma relação com segurança.'
  const low = days.filter(d => d.energy <= 2); const rest = days.filter(d => d.energy > 2)
  if (low.length < 2) return 'A energia se manteve relativamente estável ao longo do mês, sem muitos dias de queda acentuada.'
  const anxietyLow = average(low.map(d => d.anxiety)); const anxietyRest = rest.length ? average(rest.map(d => d.anxiety)) : anxietyLow
  if (anxietyLow > anxietyRest + 0.4) return 'Nos dias em que a energia apareceu mais baixa, a ansiedade também apareceu com mais frequência.'
  if (anxietyLow < anxietyRest - 0.4) return 'Nos dias de energia mais baixa, a ansiedade percebida apareceu mais suave — talvez tenham sido dias de mais pausa.'
  return 'Energia e ansiedade variaram sem uma relação muito marcada neste mês. Continuar registrando ajuda a perceber conexões mais claras.'
}
function compareSummaries(curr: Summary, prev: Summary | null): { available: boolean; message: string; changes: string[] } {
  if (!prev || prev.total_entries === 0) return { available: false, message: 'Ainda não há mês anterior com registros suficientes para comparar.', changes: [] }
  const changes: string[] = []
  if (curr.active_days !== prev.active_days) changes.push(`Dias ativos: ${prev.active_days} → ${curr.active_days}`)
  const currTop = curr.dominant_emotions[0]?.label; const prevTop = prev.dominant_emotions[0]?.label
  if (currTop && prevTop && currTop !== prevTop) changes.push(`Emoção predominante: ${prevTop} → ${currTop}`)
  if (Math.abs(curr.averages.energy - prev.averages.energy) >= 0.4) changes.push(`Energia média: ${prev.averages.energy || '—'} → ${curr.averages.energy || '—'}`)
  if (Math.abs(curr.averages.anxiety - prev.averages.anxiety) >= 0.4) changes.push(`Ansiedade média: ${prev.averages.anxiety || '—'} → ${curr.averages.anxiety || '—'}`)
  const message = changes.length ? `Comparado ao mês anterior: ${changes[0].toLowerCase()}${changes.length > 1 ? ', entre outras mudanças.' : '.'}` : 'Este mês teve um padrão parecido com o anterior, sem grandes mudanças nos números gerais.'
  return { available: true, message, changes }
}

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
    averages: { mood: average(rows.map(r => r.mood_score)), energy: average(rows.map(r => r.energy)), anxiety: average(rows.map(r => r.anxiety_level)), sleep: average(rows.map(r => r.sleep_quality)), stress: plan === 'plus' ? average(rows.map(r => r.stress_level)) : 0, selfEsteem: plan === 'plus' ? average(rows.map(r => r.self_esteem)) : 0, irritability: plan === 'plus' ? average(rows.map(r => r.irritability)) : 0, overload: plan === 'plus' ? average(rows.map(r => r.overload)) : 0 },
    data_quality: { has_enough_data: quality !== 'low', total_entries: rows.length, active_days: days.size, confidence_level: quality, message: quality === 'low' ? 'Seus registros deste período ainda são poucos, então esta leitura deve ser vista como um ponto de partida, não como conclusão.' : 'Há registros suficientes para uma leitura cuidadosa do período.' },
  }
}

function prompt(kind: 'weekly_report' | 'monthly_deep_report' | 'self_care_plan', summary: Summary) {
  const shape = kind === 'weekly_report'
    ? '{"summary":"2 a 4 frases","patterns":["até 3"],"attention_points":["até 2"],"next_steps":["até 3"],"data_quality_message":"texto"}'
    : kind === 'monthly_deep_report'
      ? '{"summary":"3 a 5 frases","patterns":["até 4"],"relations":["até 3"],"improvement_moments":["até 3"],"reflection_questions":["3 perguntas"],"data_quality_message":"texto"}'
      : '{"title":"texto","month_label":"texto","based_on_period":"texto","main_focus":"texto","why_this_focus":"texto","three_care_priorities":[{"priority":"texto","why_it_matters":"texto","small_actions":["2"]},{"priority":"texto","why_it_matters":"texto","small_actions":["2"]},{"priority":"texto","why_it_matters":"texto","small_actions":["2"]}],"weekly_rhythm":{"week_1":"texto","week_2":"texto","week_3":"texto","week_4":"texto"},"suggested_micro_actions":["3 a 5"],"recommended_guided_contents":["até 3 temas"],"gentle_reminders":["2"],"what_not_to_force":"texto","light_emotional_goal":"texto","checkin_suggestion":"texto","reflection_questions":["3"],"final_message":"texto","data_quality_message":"texto"}'
  return `Você prepara ${kind} para o aplicativo A Vida Não Colabora. Use somente os dados agregados abaixo, em português brasileiro. Seja acolhedora, simples, humana e não clínica. Não diagnostique, prescreva, prometa cura, invente fatos, transforme correlação em causa nem trate marcadores emocionais como gatilhos. Use "seus registros sugerem", "vale observar" e "pode ser interessante". Marcadores emocionais, contextos, necessidades, ações de cuidado e gatilhos reais são categorias diferentes e não devem ser misturados. Se houver poucos dados, reconheça a limitação sem criar padrões. O relatório semanal responde como foi a semana; o mensal é retrospectivo e não contém plano completo nem orientação; self_care_plan é prospectivo, leve e não repete o relatório. Retorne exclusivamente JSON válido e sem markdown.\nDADOS: ${JSON.stringify(summary)}\nFORMATO: ${shape}`
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

function reportContent(kind: 'weekly' | 'monthly', s: Summary, ai: Record<string, unknown> | null, rows: Record<string, unknown>[], prevSummary: Summary | null = null) {
  const markers = s.emotional_markers; const patterns = texts(ai?.patterns, 320)
  const fallback = s.data_quality.message
  const quality = { ...s.data_quality, fallback_used: !ai }
  const daily = { energy: metricByDay(rows, 'energy'), anxiety: metricByDay(rows, 'anxiety_level'), sleep: metricByDay(rows, 'sleep_quality'), mood: metricByDay(rows, 'mood_score'), markers: markersByDay(rows) }
  const distributions = { contexts: s.contexts, needs: s.needs, care_actions: s.care_actions, markers, triggers: s.real_triggers }
  if (kind === 'weekly') return {
    kind, v: 8, title: 'Sua leitura semanal', report_type: 'weekly', period_start: s.period_start, period_end: s.period_end, period_label: `${s.period_start} a ${s.period_end}`, short_summary: str(ai?.summary, fallback), week_in_numbers: { active_days: s.active_days, checkins_count: s.total_checkins, diaries_count: s.total_main_diaries, addons_count: s.total_addons, total_entries: s.total_entries }, dominant_emotions: s.dominant_emotions, emotional_markers: markers, main_contexts: s.contexts, main_needs: s.needs, care_actions_used: s.care_actions, energy_anxiety_sleep_summary: `Energia média ${s.averages.energy || '—'}, ansiedade média ${s.averages.anxiety || '—'} e sono médio ${s.averages.sleep || '—'}.`, energy_by_day: daily.energy, anxiety_by_day: daily.anxiety, sleep_by_day: daily.sleep, mood_by_day: daily.mood, markers_by_day: daily.markers, context_distribution: distributions.contexts, need_distribution: distributions.needs, care_action_distribution: distributions.care_actions, observed_patterns: patterns.length ? patterns : [fallback], attention_points: texts(ai?.attention_points, 260), gentle_next_steps: texts(ai?.next_steps, 260), recommended_contents: markers.map(x => x.tag), data_quality_notice: s.data_quality.message, data_quality: quality, fallback_used: !ai, closing_message: 'Você não precisa resolver tudo agora; um pequeno registro já pode ajudar a perceber o seu ritmo.', summary: str(ai?.summary, fallback), interpretation: str(ai?.summary, fallback), patterns: patterns.length ? patterns : [fallback], attentionPoints: texts(ai?.attention_points, 260), improvementMoments: texts(ai?.improvement_moments, 260).join(' ') || 'Continue observando os pequenos momentos que ajudaram.', topEmotions: s.dominant_emotions.map(x => ({ ...x, emoji: '•' })), avgEnergy: s.averages.energy, avgAnxiety: s.averages.anxiety, avgMood: s.averages.mood, emotionalMarkers: markers, topContexts: s.contexts, comparison: [], nextSteps: texts(ai?.next_steps, 260), recommendTags: markers.map(x => x.tag), energyByDay: daily.energy, anxietyByDay: daily.anxiety, checkinCount: s.total_checkins, diaryCount: s.total_main_diaries + s.total_addons, dominantEmotion: s.dominant_emotions[0]?.label || null, topEmotionalMarker: markers[0]?.tag || null,
  }
  const comparison = compareSummaries(s, prevSummary)
  const comparisonLines = comparison.available ? (comparison.changes.length ? comparison.changes : [comparison.message]) : [comparison.message]
  return {
    kind, v: 9, title: 'Seu relatório mensal aprofundado', report_type: 'monthly_deep', month_label: s.period_start.slice(0, 7), period_start: s.period_start, period_end: s.period_end, executive_summary: str(ai?.summary, fallback), month_timeline: monthTimelineOf(rows, s.period_start, s.period_end), emotional_patterns: patterns.length ? patterns : [fallback], main_emotional_markers: markers, dominant_emotions: s.dominant_emotions, recurring_contexts: s.contexts, recurring_needs: s.needs, care_actions_observed: s.care_actions, real_triggers: s.real_triggers, advanced_indicators: { stress: s.averages.stress, self_esteem: s.averages.selfEsteem, irritability: s.averages.irritability, overload: s.averages.overload }, energy_anxiety_sleep_relationship: energyAnxietySleepRelationship(rows), energy_by_week: weeksOf(rows, 'energy'), anxiety_by_week: weeksOf(rows, 'anxiety_level'), sleep_by_week: weeksOf(rows, 'sleep_quality'), mood_by_week: weeksOf(rows, 'mood_score'), marker_distribution: distributions.markers, context_distribution: distributions.contexts, need_distribution: distributions.needs, care_action_distribution: distributions.care_actions, trigger_distribution: distributions.triggers, attention_days: attentionDaysOf(rows), improvement_signals: texts(ai?.improvement_moments, 260), comparison_with_previous_month: comparisonLines, reflection_questions: texts(ai?.reflection_questions, 260), bridge_to_self_care_plan: 'Este relatório pode ajudar seu plano de autocuidado a escolher um ponto de atenção e uma ação leve para o próximo ciclo.', bridge_to_professional_guidance: 'Se fizer sentido, você pode levar um ponto deste relatório para sua orientação mensal.', data_quality_notice: s.data_quality.message, data_quality: quality, fallback_used: !ai, closing_message: 'Este é um retrato de autopercepção; vá no seu tempo.', hasEnoughData: s.data_quality.has_enough_data, summary: str(ai?.summary, fallback), patterns: patterns.length ? patterns : [fallback], narrative: [], relations: texts(ai?.relations, 320), avgEnergy: s.averages.energy, avgAnxiety: s.averages.anxiety, avgSleep: s.averages.sleep, topEmotions: s.dominant_emotions.map(x => ({ ...x, emoji: '•' })), topEmotionalMarkers: markers, topContexts: s.contexts, topNeeds: s.needs, energyByDay: daily.energy, anxietyByDay: daily.anxiety, checkinCount: s.total_checkins, diaryCount: s.total_main_diaries + s.total_addons, emotionalMarkers: markers, realTriggers: s.real_triggers, improvementMoments: texts(ai?.improvement_moments, 260).join(' '), reflectionQuestions: texts(ai?.reflection_questions, 260), attentionDays: attentionDaysOf(rows), monthlyComparison: comparisonLines, predominantEmotions: s.dominant_emotions.map(x => x.label).join(', ') || 'Ainda não há emoção predominante', energyAnxietySleep: energyAnxietySleepRelationship(rows), emotionalMarkersText: markers.length ? `Os marcadores mais citados foram ${markers.map(x => x.tag).join(', ')}.` : 'Ainda não há marcadores emocionais suficientes para uma leitura de recorrência.', bridgeToSelfCarePlan: 'Este relatório pode ajudar seu plano de autocuidado a escolher um ponto de atenção e uma ação leve para o próximo ciclo.', bridgeToProfessionalGuidance: 'Se fizer sentido, você pode levar um ponto deste relatório para sua orientação mensal.', recommendTags: markers.map(x => x.tag),
  }
}

async function log(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  // Auditoria não pode impedir que um relatório já salvo chegue à pessoa.
  try { await admin.from('ai_generation_logs').insert(row) } catch { /* best effort */ }
}

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
  // Mês anterior ao mês fechado, usado só para comparison_with_previous_month.
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1))
  const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 0))
  const DIARY_COLUMNS = 'entry_type,diary_kind,date,created_at,mood,mood_score,energy,anxiety_level,sleep_quality,stress_level,self_esteem,irritability,overload,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags'
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
      const { data: rows } = await admin.from('diary_entries').select(DIARY_COLUMNS).eq('user_id', profile.user_id).gte('date', job.start).lte('date', job.end)
      const summary = summaryOf((rows || []) as Record<string, unknown>[], job.start, job.end, plan)
      let prevSummary: Summary | null = null
      if (job.kind === 'monthly') {
        const { data: prevRows } = await admin.from('diary_entries').select(DIARY_COLUMNS).eq('user_id', profile.user_id).gte('date', isoDay(prevMonthStart)).lte('date', isoDay(prevMonthEnd))
        prevSummary = summaryOf((prevRows || []) as Record<string, unknown>[], isoDay(prevMonthStart), isoDay(prevMonthEnd), plan)
      }
      let parsed: Record<string, unknown> | null = null; let model = 'deterministic-fallback'; let fallback = true; let errorMessage: string | null = null
      try { const generated = await generate(prompt(job.kind === 'weekly' ? 'weekly_report' : 'monthly_deep_report', summary)); parsed = parse(generated.text); if (!parsed) throw new Error('JSON inválido'); model = generated.model; fallback = false } catch (e) { errorMessage = e instanceof Error ? e.message : String(e) }
      const content = reportContent(job.kind, summary, parsed, (rows || []) as Record<string, unknown>[], prevSummary)
      const promptType = job.kind === 'weekly' ? 'weekly_report' : 'monthly_deep_report'
      const { error: saveError } = await admin.from('reports').insert({ user_id: profile.user_id, report_type: job.kind, plan_required: job.kind === 'weekly' ? 'essential' : 'plus', period_start: job.start, period_end: job.end, available_at: new Date().toISOString(), status: 'generated', title: job.kind === 'weekly' ? `Relatório semanal — ${job.start}` : `Relatório mensal aprofundado — ${job.start.slice(0, 7)}`, summary: content.summary, content, generated_at: new Date().toISOString(), ai_prompt_type: promptType, ai_prompt_version: PROMPT_VERSION[promptType], model_used: model, fallback_used: fallback, data_quality: summary.data_quality, error_message: errorMessage, generated_by: actor })
      if (saveError) { results.push(`${profile.user_id}:${job.kind}:erro`); continue }
      await log(admin, { user_id: profile.user_id, admin_id: actor, content_type: promptType, prompt_type: promptType, prompt_version: PROMPT_VERSION[promptType], model_used: model, fallback_used: fallback, data_quality: summary.data_quality, source_period_start: job.start, source_period_end: job.end, generation_status: fallback ? 'fallback' : 'success', status: fallback ? 'fallback' : 'success', error_msg: errorMessage })
      results.push(`${profile.user_id}:${job.kind}:ok`)
    }
    if (plan === 'plus' && (!body.mode || body.mode === 'all' || body.mode === 'monthly')) {
      const { data: existingPlan } = await admin.from('monthly_care_plans').select('id,status').eq('user_id', profile.user_id).eq('period_start', isoDay(monthStart)).eq('period_end', isoDay(monthEnd)).maybeSingle()
      if (!existingPlan) {
        const { data: rows } = await admin.from('diary_entries').select(DIARY_COLUMNS).eq('user_id', profile.user_id).gte('date', isoDay(monthStart)).lte('date', isoDay(monthEnd))
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
