import { createClient } from 'npm:@supabase/supabase-js@2'
import { EMOTIONAL_AI_SAFETY_TEXT, EMOTIONAL_NARRATIVE_SHAPES, EMOTIONAL_PROMPT_VERSIONS } from '../_shared/emotionalPromptContracts.ts'

// Automação emocional (relatórios + plano). Não mistura conteúdo editorial e
// nunca recebe texto livre do diário: somente colunas analíticas agregadas.
// Versões e regras de segurança vêm do módulo compartilhado com os prompts do frontend.
const PROMPT_VERSION = EMOTIONAL_PROMPT_VERSIONS
const cors = { 'Access-Control-Allow-Origin': 'https://www.avidanaocolabora.com', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const calendarYmd = (value: string | Date | null | undefined): string | null => {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value
  const y = get('year'), m = get('month'), day = get('day')
  return y && m && day ? `${y}-${m}-${day}` : d.toISOString().slice(0, 10)
}
const clampStartToActivation = (fullStart: string, end: string, activation: string | null | undefined): string | null => {
  const act = calendarYmd(activation)
  if (!act) return fullStart
  if (act > end) return null
  return act > fullStart ? act : fullStart
}
function hasActiveUnlimitedAccess(profile: { unlimited_access?: boolean; unlimited_access_until?: string | null }, now: Date): boolean {
  if (!profile.unlimited_access) return false
  if (!profile.unlimited_access_until) return true
  const until = new Date(profile.unlimited_access_until)
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime()
}
const list = (v: unknown): string[] => Array.isArray(v) ? v.map(String).map(x => x.trim()).filter(Boolean) : []
const average = (values: unknown[]) => { const n = values.map(Number).filter(v => Number.isFinite(v) && v > 0); return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : 0 }
// §7 do audit: indicadores avançados (stress/self_esteem/irritability/overload)
// não podem gravar 0 quando o dado simplesmente não foi informado — 0 pareceria
// um valor real na escala 1-5. Só esses 4 campos usam essa versão nullable.
const averageOrNull = (values: unknown[]) => { const n = values.map(Number).filter(v => Number.isFinite(v) && v > 0); return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : null }
// Lê o primeiro nome de coluna válido (>0) entre alternativas conhecidas. O
// schema atual usa stress_level/self_esteem/irritability/overload, mas esta
// função protege a automação caso uma migration futura renomeie/duplique um
// desses campos (ex.: self_esteem_level) sem que a leitura quebre em silêncio.
function valueOf(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) { const v = Number(row[key]); if (Number.isFinite(v) && v > 0) return v }
  return null
}
const valuesOf = (rows: Record<string, unknown>[], keys: string[]) => rows.map(r => valueOf(r, keys))
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
function summaryOf(rows: Record<string, unknown>[], start: string, end: string, plan: 'essential' | 'plus', periodKind: 'weekly' | 'monthly' = 'weekly') {
  const days = new Set(rows.map(r => String(r.date || r.created_at || '').slice(0, 10)).filter(Boolean))
  const type = (t: string) => rows.filter(r => r.entry_type === t).length
  const diaries = rows.filter(r => r.entry_type === 'diary')
  // O mensal aprofundado precisa de mais evidência do que a leitura semanal.
  // Com poucos dados ele ainda pode existir, mas assume explicitamente baixa confiança.
  const minActiveDays = periodKind === 'monthly' ? 8 : 3
  const minEntries = periodKind === 'monthly' ? 12 : 5
  const quality = days.size >= minActiveDays && rows.length >= minEntries ? 'medium' : 'low'
  const lowMessage = periodKind === 'monthly'
    ? 'Este mês teve poucos registros para uma leitura aprofundada. O que aparece abaixo é um ponto de partida, não uma conclusão sobre seus padrões.'
    : 'Seus registros desta semana ainda são poucos, então esta leitura deve ser vista como um ponto de partida, não como conclusão.'
  return {
    period_start: start, period_end: end, plan, total_entries: rows.length,
    total_checkins: type('checkin'), total_main_diaries: diaries.filter(r => r.diary_kind !== 'addon').length,
    total_addons: diaries.filter(r => r.diary_kind === 'addon').length, active_days: days.size,
    dominant_emotions: top(rows.map(r => String(r.mood || '')).filter(Boolean)).map(x => ({ label: x.tag, count: x.count })),
    emotional_markers: top(rows.flatMap(r => list(r.emotional_tags))), contexts: top(rows.flatMap(r => list(r.context_tags))),
    needs: top(rows.flatMap(r => list(r.need_tags))), care_actions: top(rows.flatMap(r => list(r.care_action_tags))),
    real_triggers: plan === 'plus' ? top(rows.flatMap(r => list(r.trigger_tags))) : [],
    averages: { mood: average(rows.map(r => r.mood_score)), energy: average(rows.map(r => r.energy)), anxiety: average(rows.map(r => r.anxiety_level)), sleep: average(rows.map(r => r.sleep_quality)), stress: plan === 'plus' ? averageOrNull(valuesOf(rows, ['stress_level', 'stress'])) : null, selfEsteem: plan === 'plus' ? averageOrNull(valuesOf(rows, ['self_esteem', 'self_esteem_level'])) : null, irritability: plan === 'plus' ? averageOrNull(valuesOf(rows, ['irritability', 'irritability_level'])) : null, overload: plan === 'plus' ? averageOrNull(valuesOf(rows, ['overload', 'overload_level'])) : null },
    data_quality: { has_enough_data: quality !== 'low', total_entries: rows.length, active_days: days.size, confidence_level: quality, required_active_days: minActiveDays, required_entries: minEntries, message: quality === 'low' ? lowMessage : 'Há registros suficientes para uma leitura cuidadosa do período.' },
  }
}

// §6 do audit: a IA só produz o texto narrativo (summary/patterns/attention_points/
// next_steps/relations/improvement_moments/reflection_questions). Os campos
// estruturados e numéricos do relatório (week_in_numbers, energy_by_day,
// month_timeline, attention_days, comparison_with_previous_month,
// advanced_indicators etc.) são sempre calculados em código a partir dos
// registros reais — pedir pra IA "inventar" esses números violaria a própria
// regra de segurança de não inventar fatos/padrões. Isso é deliberado, não uma
// simplificação: números vêm de cálculo determinístico, nunca de geração de texto.
function prompt(kind: 'weekly_report' | 'monthly_deep_report' | 'self_care_plan', summary: Summary) {
  const task = kind === 'weekly_report'
    ? 'Esta leitura responde "como foi minha semana?": curta, leve, prática, focada nos últimos 7 dias, com 2 ou 3 próximos passos leves. Não gere relatório mensal, plano de autocuidado ou orientação profissional.'
    : kind === 'monthly_deep_report'
      ? 'Esta leitura responde "o que o mês mostrou sobre meus padrões emocionais?": retrospectiva, mais profunda, organizada e não clínica. Não vire plano de autocuidado (sem rotina para o próximo mês) nem orientação profissional.'
      : 'Este roteiro responde "o que posso fazer agora com base no que meus registros mostraram?": prospectivo, leve e realista para o próximo ciclo. Não repita a retrospectiva do relatório mensal.'
  // §6.2/6.3 do audit: além do texto-base (summary/patterns/...), a IA também
  // lê em prosa curta os dados já agregados em código (marcadores, contextos,
  // necessidades, ações de cuidado, gatilhos reais, indicadores avançados,
  // dias de atenção, comparação com o mês anterior). São leituras/interpretações
  // do que já foi calculado — não números novos, então não violam a regra de
  // não inventar fatos. Campos condicionais (ex.: real_triggers_reading) só
  // devem vir preenchidos quando os dados correspondentes existirem no resumo.
  const shape = EMOTIONAL_NARRATIVE_SHAPES[kind]
  return `Você prepara ${kind} para o aplicativo A Vida Não Colabora. Use somente os dados agregados abaixo, em português brasileiro. Seja acolhedora, simples, humana e não clínica. Não diagnostique, prescreva, prometa cura, invente fatos, transforme correlação em causa nem trate marcadores emocionais como gatilhos. Regras compartilhadas: ${EMOTIONAL_AI_SAFETY_TEXT} Use "seus registros sugerem", "vale observar" e "pode ser interessante". Marcadores emocionais, contextos, necessidades, ações de cuidado e gatilhos reais são categorias diferentes e não devem ser misturados. Se houver poucos dados, reconheça a limitação sem criar padrões. ${task} Retorne exclusivamente JSON válido e sem markdown, apenas com os campos narrativos abaixo — os campos numéricos e estruturados do relatório final são calculados à parte, em código, a partir dos mesmos dados agregados.\nDADOS: ${JSON.stringify(summary)}\nFORMATO: ${shape}`
}

async function generate(promptText: string): Promise<{ text: string; model: string }> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const geminiModels = (Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash,gemini-2.0-flash').split(',').map(v => v.trim()).filter(Boolean)
  if (geminiKey) {
    for (const model of geminiModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1800 } }),
        })
        if (res.ok) {
          const data = await res.json(); const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text && String(text).trim()) return { text: String(text).trim(), model }
        }
      } catch { /* tenta próximo modelo/provedor */ }
    }
  }

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: promptText }], max_tokens: 1800 }),
      })
      if (res.ok) {
        const data = await res.json(); const text = data?.choices?.[0]?.message?.content
        if (text && String(text).trim()) return { text: String(text).trim(), model: 'groq:llama-3.3-70b-versatile' }
      }
    } catch { /* tenta OpenAI */ }
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: promptText }], max_tokens: 1800 }),
      })
      if (res.ok) {
        const data = await res.json(); const text = data?.choices?.[0]?.message?.content
        if (text && String(text).trim()) return { text: String(text).trim(), model: 'openai:gpt-4o-mini' }
      }
    } catch { /* fallback determinístico será usado pelo chamador */ }
  }

  throw new Error('Nenhum provedor de IA emocional respondeu; fallback determinístico aplicado')
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
  const markersReadingFallback = markers.length ? `Os marcadores mais citados foram ${markers.map(x => x.tag).join(', ')}.` : 'Ainda não há marcadores emocionais suficientes para uma leitura de recorrência.'
  if (kind === 'weekly') {
    // §6.2: leituras narrativas curtas por eixo. Cada uma só ganha conteúdo (da
    // IA ou de um fallback determinístico) quando o dado correspondente existe.
    const whatMostAppeared = str(ai?.what_most_appeared, s.dominant_emotions[0] ? `${s.dominant_emotions[0].label} foi a emoção que mais apareceu nos seus registros.` : 'Ainda não há uma emoção predominante nesta semana.')
    const emotionalMarkersReading = str(ai?.emotional_markers_reading, markersReadingFallback)
    const contextsReading = s.contexts.length ? str(ai?.contexts_reading, `Os contextos mais citados foram ${s.contexts.map(x => x.tag).join(', ')}.`) : ''
    const needsReading = s.needs.length ? str(ai?.needs_reading, `As necessidades mais citadas foram ${s.needs.map(x => x.tag).join(', ')}.`) : ''
    const careActionsReading = s.care_actions.length ? str(ai?.care_actions_reading, `As ações de cuidado mais escolhidas foram ${s.care_actions.map(x => x.tag).join(', ')}.`) : ''
    const closingMessage = str(ai?.closing_message, 'Você não precisa resolver tudo agora; um pequeno registro já pode ajudar a perceber o seu ritmo.')
    return {
      kind, v: 10, title: 'Sua leitura semanal', report_type: 'weekly', period_start: s.period_start, period_end: s.period_end, period_label: `${s.period_start} a ${s.period_end}`, short_summary: str(ai?.summary, fallback), what_most_appeared: whatMostAppeared, emotional_markers_reading: emotionalMarkersReading, contexts_reading: contextsReading, needs_reading: needsReading, care_actions_reading: careActionsReading, week_in_numbers: { active_days: s.active_days, checkins_count: s.total_checkins, diaries_count: s.total_main_diaries, addons_count: s.total_addons, total_entries: s.total_entries }, dominant_emotions: s.dominant_emotions, emotional_markers: markers, main_contexts: s.contexts, main_needs: s.needs, care_actions_used: s.care_actions, energy_anxiety_sleep_summary: `Energia média ${s.averages.energy || '—'}, ansiedade média ${s.averages.anxiety || '—'} e sono médio ${s.averages.sleep || '—'}.`, energy_by_day: daily.energy, anxiety_by_day: daily.anxiety, sleep_by_day: daily.sleep, mood_by_day: daily.mood, markers_by_day: daily.markers, context_distribution: distributions.contexts, need_distribution: distributions.needs, care_action_distribution: distributions.care_actions, observed_patterns: patterns.length ? patterns : [fallback], attention_points: texts(ai?.attention_points, 260), gentle_next_steps: texts(ai?.next_steps, 260), recommended_contents: markers.map(x => x.tag), data_quality_notice: s.data_quality.message, data_quality: quality, fallback_used: !ai, closing_message: closingMessage, summary: str(ai?.summary, fallback), interpretation: str(ai?.summary, fallback), patterns: patterns.length ? patterns : [fallback], attentionPoints: texts(ai?.attention_points, 260), improvementMoments: texts(ai?.improvement_moments, 260).join(' ') || 'Continue observando os pequenos momentos que ajudaram.', topEmotions: s.dominant_emotions.map(x => ({ ...x, emoji: '•' })), avgEnergy: s.averages.energy, avgAnxiety: s.averages.anxiety, avgMood: s.averages.mood, emotionalMarkers: markers, topContexts: s.contexts, comparison: [], nextSteps: texts(ai?.next_steps, 260), recommendTags: markers.map(x => x.tag), energyByDay: daily.energy, anxietyByDay: daily.anxiety, checkinCount: s.total_checkins, diaryCount: s.total_main_diaries + s.total_addons, dominantEmotion: s.dominant_emotions[0]?.label || null, topEmotionalMarker: markers[0]?.tag || null,
    }
  }
  const comparison = compareSummaries(s, prevSummary)
  const comparisonLines = comparison.available ? (comparison.changes.length ? comparison.changes : [comparison.message]) : [comparison.message]
  const attentionDays = attentionDaysOf(rows)
  const hasAdvancedData = s.averages.stress != null || s.averages.selfEsteem != null || s.averages.irritability != null || s.averages.overload != null
  // §6.3: leituras narrativas mensais, também condicionais aos dados existirem.
  const mainMarkersReading = str(ai?.main_emotional_markers_reading, markersReadingFallback)
  const contextsAndNeedsReading = (s.contexts.length || s.needs.length)
    ? str(ai?.contexts_and_needs_reading, [s.contexts.length ? `Contextos mais recorrentes: ${s.contexts.map(x => x.tag).join(', ')}.` : '', s.needs.length ? `Necessidades mais recorrentes: ${s.needs.map(x => x.tag).join(', ')}.` : ''].filter(Boolean).join(' '))
    : ''
  const careActionsObservedReading = s.care_actions.length ? str(ai?.care_actions_observed_reading, `As ações de cuidado mais observadas foram ${s.care_actions.map(x => x.tag).join(', ')}.`) : ''
  const realTriggersReading = s.real_triggers.length ? str(ai?.real_triggers_reading, `Os gatilhos reais mais citados foram ${s.real_triggers.map(x => x.tag).join(', ')}.`) : ''
  const advancedIndicatorsReading = hasAdvancedData ? str(ai?.advanced_indicators_reading, 'Vale observar como estresse, autoestima, irritabilidade e sobrecarga variaram ao longo do mês, sem tirar conclusões definitivas.') : 'Não há dados avançados suficientes informados neste mês para essa leitura.'
  const attentionDaysReading = attentionDays.length ? str(ai?.attention_days_reading, `Alguns dias tiveram sinais que pedem mais atenção — vale observar o que se repetiu neles.`) : 'Não houve dias com sinais fortes o bastante para destacar neste mês.'
  const comparisonReading = comparison.available ? str(ai?.comparison_with_previous_month_reading, comparison.message) : comparison.message
  const closingMessageMonthly = str(ai?.closing_message, 'Este é um retrato de autopercepção; vá no seu tempo.')
  return {
    kind, v: 10, title: 'Seu relatório mensal aprofundado', report_type: 'monthly_deep', month_label: s.period_start.slice(0, 7), period_start: s.period_start, period_end: s.period_end, executive_summary: str(ai?.summary, fallback), main_emotional_markers_reading: mainMarkersReading, contexts_and_needs_reading: contextsAndNeedsReading, care_actions_observed_reading: careActionsObservedReading, real_triggers_reading: realTriggersReading, advanced_indicators_reading: advancedIndicatorsReading, attention_days_reading: attentionDaysReading, comparison_with_previous_month_reading: comparisonReading, month_timeline: monthTimelineOf(rows, s.period_start, s.period_end), emotional_patterns: patterns.length ? patterns : [fallback], main_emotional_markers: markers, dominant_emotions: s.dominant_emotions, recurring_contexts: s.contexts, recurring_needs: s.needs, care_actions_observed: s.care_actions, real_triggers: s.real_triggers, advanced_indicators: { stress: s.averages.stress, self_esteem: s.averages.selfEsteem, irritability: s.averages.irritability, overload: s.averages.overload }, energy_anxiety_sleep_relationship: energyAnxietySleepRelationship(rows), energy_by_week: weeksOf(rows, 'energy'), anxiety_by_week: weeksOf(rows, 'anxiety_level'), sleep_by_week: weeksOf(rows, 'sleep_quality'), mood_by_week: weeksOf(rows, 'mood_score'), marker_distribution: distributions.markers, context_distribution: distributions.contexts, need_distribution: distributions.needs, care_action_distribution: distributions.care_actions, trigger_distribution: distributions.triggers, attention_days: attentionDays, improvement_signals: texts(ai?.improvement_moments, 260), comparison_with_previous_month: comparisonLines, reflection_questions: texts(ai?.reflection_questions, 260), bridge_to_self_care_plan: 'Este relatório pode ajudar seu plano de autocuidado a escolher um ponto de atenção e uma ação leve para o próximo ciclo.', bridge_to_professional_guidance: 'Se fizer sentido, você pode levar um ponto deste relatório para sua orientação mensal.', data_quality_notice: s.data_quality.message, data_quality: quality, fallback_used: !ai, closing_message: closingMessageMonthly, hasEnoughData: s.data_quality.has_enough_data, summary: str(ai?.summary, fallback), patterns: patterns.length ? patterns : [fallback], narrative: [], relations: texts(ai?.relations, 320), avgEnergy: s.averages.energy, avgAnxiety: s.averages.anxiety, avgSleep: s.averages.sleep, topEmotions: s.dominant_emotions.map(x => ({ ...x, emoji: '•' })), topEmotionalMarkers: markers, topContexts: s.contexts, topNeeds: s.needs, energyByDay: daily.energy, anxietyByDay: daily.anxiety, checkinCount: s.total_checkins, diaryCount: s.total_main_diaries + s.total_addons, emotionalMarkers: markers, realTriggers: s.real_triggers, improvementMoments: texts(ai?.improvement_moments, 260).join(' '), reflectionQuestions: texts(ai?.reflection_questions, 260), attentionDays: attentionDays, monthlyComparison: comparisonLines, predominantEmotions: s.dominant_emotions.map(x => x.label).join(', ') || 'Ainda não há emoção predominante', energyAnxietySleep: energyAnxietySleepRelationship(rows), emotionalMarkersText: markersReadingFallback, bridgeToSelfCarePlan: 'Este relatório pode ajudar seu plano de autocuidado a escolher um ponto de atenção e uma ação leve para o próximo ciclo.', bridgeToProfessionalGuidance: 'Se fizer sentido, você pode levar um ponto deste relatório para sua orientação mensal.', recommendTags: markers.map(x => x.tag),
  }
}

// Banco sem Database types gerados: mantém o client administrativo flexível nesta Edge Function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

async function log(admin: AdminClient, row: Record<string, unknown>) {
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
  let profileQuery = admin.from('profiles').select('user_id, plan, subscription_status, unlimited_access, unlimited_access_until, plan_activated_at')
  if (body.userId) profileQuery = profileQuery.eq('user_id', body.userId)
  const { data: candidates, error } = await profileQuery
  if (error) return json({ error: error.message }, 500)
  const results: string[] = []
  for (const profile of candidates as { user_id: string; plan: string; subscription_status?: string; unlimited_access?: boolean; unlimited_access_until?: string | null; plan_activated_at?: string | null }[]) {
    const unlimited = hasActiveUnlimitedAccess(profile, now)
    const normalizedBasePlan = ['plus', 'therapeutic', 'therapeutic-plus', 'therapeutic_plus'].includes(profile.plan) ? 'plus' : profile.plan === 'essential' ? 'essential' : 'free'
    if (!unlimited && normalizedBasePlan === 'free') continue
    if (!unlimited && profile.subscription_status && !['active', 'trialing'].includes(profile.subscription_status)) continue
    // Acesso ilimitado equivale a Plus em TODA a automação emocional, mesmo se o
    // plano comercial salvo continuar Gratuito/Essencial para fins de cobrança.
    const plan: 'essential' | 'plus' = unlimited ? 'plus' : normalizedBasePlan as 'essential' | 'plus'
    const weekFullStart = isoDay(weekStart), weekFullEnd = isoDay(weekEnd)
    const monthFullStart = isoDay(monthStart), monthFullEnd = isoDay(monthEnd)
    const weeklyStart = clampStartToActivation(weekFullStart, weekFullEnd, profile.plan_activated_at)
    const monthlyStart = clampStartToActivation(monthFullStart, monthFullEnd, profile.plan_activated_at)
    const jobs = [
      { kind: 'weekly' as const, start: weeklyStart, end: weekFullEnd, allowed: !!weeklyStart },
      { kind: 'monthly' as const, start: monthlyStart, end: monthFullEnd, allowed: plan === 'plus' && !!monthlyStart },
    ]
    for (const job of jobs) {
      if (!job.allowed || !job.start || (body.mode && body.mode !== 'all' && body.mode !== job.kind)) continue
      const { data: exists } = await admin.from('reports').select('id,status').eq('user_id', profile.user_id).eq('report_type', job.kind).eq('period_start', job.start).eq('period_end', job.end).maybeSingle()
      if (exists) { results.push(`${profile.user_id}:${job.kind}:já existe`); continue }
      const { data: rows } = await admin.from('diary_entries').select(DIARY_COLUMNS).eq('user_id', profile.user_id).gte('date', job.start).lte('date', job.end)
      const summary = summaryOf((rows || []) as Record<string, unknown>[], job.start, job.end, plan, job.kind === 'monthly' ? 'monthly' : 'weekly')
      let prevSummary: Summary | null = null
      if (job.kind === 'monthly') {
        const prevStart = isoDay(prevMonthStart), prevEnd = isoDay(prevMonthEnd)
        const activationDay = calendarYmd(profile.plan_activated_at)
        // Não compara com um mês que terminou antes do usuário ter ativado o plano:
        // isso evitaria tratar registros gratuitos anteriores como um ciclo premium.
        if (!activationDay || activationDay <= prevEnd) {
          const effectivePrevStart = activationDay && activationDay > prevStart ? activationDay : prevStart
          const { data: prevRows } = await admin.from('diary_entries').select(DIARY_COLUMNS).eq('user_id', profile.user_id).gte('date', effectivePrevStart).lte('date', prevEnd)
          prevSummary = summaryOf((prevRows || []) as Record<string, unknown>[], effectivePrevStart, prevEnd, plan, 'monthly')
        }
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
      const careStart = clampStartToActivation(isoDay(monthStart), isoDay(monthEnd), profile.plan_activated_at)
      if (!careStart) { results.push(`${profile.user_id}:plano:sem ciclo fechado`); continue }
      const careEnd = isoDay(monthEnd)
      const { data: existingPlan } = await admin.from('monthly_care_plans').select('id,status').eq('user_id', profile.user_id).eq('period_start', careStart).eq('period_end', careEnd).maybeSingle()
      if (!existingPlan) {
        const { data: rows } = await admin.from('diary_entries').select(DIARY_COLUMNS).eq('user_id', profile.user_id).gte('date', careStart).lte('date', careEnd)
        const s = summaryOf((rows || []) as Record<string, unknown>[], careStart, careEnd, 'plus', 'monthly')
        let parsed: Record<string, unknown> | null = null; let model = 'deterministic-fallback'; let fallback = true; let errorMessage: string | null = null
        try { const generated = await generate(prompt('self_care_plan', s)); parsed = parse(generated.text); if (!parsed || !parsed.main_focus || carePriorities(parsed.three_care_priorities).length < 3) throw new Error('JSON do plano inválido'); model = generated.model; fallback = false } catch (e) { errorMessage = e instanceof Error ? e.message : String(e) }
        const actions = texts(parsed?.suggested_micro_actions ?? parsed?.practical_tips, 260)
        const care = { title: str(parsed?.title, 'Seu roteiro de cuidado'), month_label: str(parsed?.month_label, monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })), based_on_period: `${careStart} a ${careEnd}`, main_focus: str(parsed?.main_focus ?? parsed?.monthly_priority, 'Escolher um pequeno passo de cuidado possível.'), why_this_focus: str(parsed?.why_this_focus ?? parsed?.main_care, s.data_quality.message), three_care_priorities: carePriorities(parsed?.three_care_priorities), weekly_rhythm: weeklyRhythm(parsed?.weekly_rhythm), suggested_micro_actions: actions, recommended_guided_contents: texts(parsed?.recommended_guided_contents, 160), gentle_reminders: texts(parsed?.gentle_reminders, 220), what_not_to_force: str(parsed?.what_not_to_force, 'Você não precisa resolver todos os pontos de uma vez.'), light_emotional_goal: str(parsed?.light_emotional_goal, 'Perceber um sinal seu e escolher um cuidado possível.'), monthly_priority: str(parsed?.monthly_priority ?? parsed?.main_focus, 'Escolher um pequeno passo de cuidado possível.'), main_care: str(parsed?.main_care ?? parsed?.why_this_focus, s.data_quality.message), recommended_practice: actions[0] || 'Reserve alguns minutos para observar como você está, sem cobrança.', attention_point: s.data_quality.message, small_commitment: actions[1] || 'Escolha uma ação leve em um dia da semana.', checkin_suggestion: str(parsed?.checkin_suggestion, 'Faça um check-in breve quando fizer sentido.'), when_to_seek_more_support: str(parsed?.when_to_seek_more_support, 'Se algo pesar mais do que o de costume, procurar apoio profissional é sempre uma escolha válida — sem pressa e sem cobrança.'), practical_tips: actions, reflection_questions: texts(parsed?.reflection_questions, 260), final_message: str(parsed?.final_message, 'Você não precisa resolver tudo agora.') }
        await admin.from('monthly_care_plans').insert({ user_id: profile.user_id, month_reference: isoDay(monthStart), period_start: careStart, period_end: careEnd, available_at: new Date().toISOString(), plan_required: 'plus', status: 'pending_review', records_summary: s, ai_summary: str(parsed?.data_quality_message, s.data_quality.message), ai_summary_json: { data_quality: s.data_quality }, care_plan: care, generated_by_ai: !fallback, generated_at: new Date().toISOString(), ai_prompt_type: 'self_care_plan', ai_prompt_version: PROMPT_VERSION.self_care_plan, model_used: model, fallback_used: fallback, data_quality: s.data_quality, error_message: errorMessage, generated_by: actor })
        await log(admin, { user_id: profile.user_id, admin_id: actor, content_type: 'self_care_plan', prompt_type: 'self_care_plan', prompt_version: PROMPT_VERSION.self_care_plan, model_used: model, fallback_used: fallback, data_quality: s.data_quality, source_period_start: s.period_start, source_period_end: s.period_end, generation_status: fallback ? 'fallback' : 'success', status: fallback ? 'fallback' : 'success', error_msg: errorMessage })
        results.push(`${profile.user_id}:plano:ok`)
      }
    }
  }
  return json({ ok: true, prompt_versions: PROMPT_VERSION, results })
})
