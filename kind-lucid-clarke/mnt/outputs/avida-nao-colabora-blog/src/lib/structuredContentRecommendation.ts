import { supabase } from './supabase'
import { detectRisk, mergeSignals, signalFromEntries, signalFromTags, type Signal } from './contentRecommendation'

export type StructuredRecommendationRow = {
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  emotional_tags?: string[] | string | null
  context_tags?: string[] | string | null
  need_tags?: string[] | string | null
  care_action_tags?: string[] | string | null
  trigger_tags?: string[] | string | null
  entry_type?: string | null
  created_at?: string | null
  date?: string | null
  // Estes campos podem existir no objeto de origem, mas são deliberadamente
  // ignorados pelo agregador abaixo.
  text?: string | null
  free_note?: string | null
  recurring_thoughts?: string | null
  emotional_triggers?: string | null
}

type RiskRow = {
  text?: string | null
  free_note?: string | null
  recurring_thoughts?: string | null
  emotional_triggers?: string | null
  emotional_need?: string | null
  relationships?: string | null
  habits?: string | null
}

function arr(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  const raw = value.trim()
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String).map(v => v.trim()).filter(Boolean)
    } catch { /* formato simples abaixo */ }
  }
  return [raw]
}

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = value.trim().toLocaleLowerCase('pt-BR')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function dayKey(row: StructuredRecommendationRow) {
  const explicit = String(row.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  const created = String(row.created_at ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : ''
}

function average(values: Array<number | null | undefined>) {
  const valid = values.map(Number).filter(value => Number.isFinite(value) && value > 0)
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10 : null
}

function dominantMood(rows: StructuredRecommendationRow[]) {
  const counts = new Map<string, { label: string; count: number }>()
  for (const row of rows) {
    const value = String(row.mood ?? '').trim()
    if (!value || /^\d+(\.\d+)?$/.test(value)) continue
    const key = value.toLocaleLowerCase('pt-BR')
    const current = counts.get(key)
    counts.set(key, { label: current?.label ?? value, count: (current?.count ?? 0) + 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))[0]?.label ?? null
}

/**
 * Resume vários registros do mesmo dia em um único ponto de contexto.
 * Isso evita que cinco check-ins no mesmo dia pesem cinco vezes mais na
 * recomendação. Campos de texto livre não são copiados para o resultado.
 */
export function aggregateStructuredEntriesByDay(rows: StructuredRecommendationRow[]) {
  const byDay = new Map<string, StructuredRecommendationRow[]>()
  for (const row of rows) {
    const key = dayKey(row)
    if (!key) continue
    const list = byDay.get(key) ?? []
    list.push(row)
    byDay.set(key, list)
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayRows]) => ({
      date,
      created_at: `${date}T12:00:00Z`,
      mood: dominantMood(dayRows),
      energy: average(dayRows.map(row => row.energy)),
      anxiety_level: average(dayRows.map(row => row.anxiety_level)),
      emotional_tags: unique(dayRows.flatMap(row => arr(row.emotional_tags))),
      context_tags: unique(dayRows.flatMap(row => arr(row.context_tags))),
      need_tags: unique(dayRows.flatMap(row => arr(row.need_tags))),
      care_action_tags: unique(dayRows.flatMap(row => arr(row.care_action_tags))),
      trigger_tags: unique(dayRows.flatMap(row => arr(row.trigger_tags))),
      entry_type: dayRows.some(row => row.entry_type === 'checkin') ? 'checkin' : 'diary',
    }))
}

function parseQuestionnaireTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  const raw = String(value ?? '').trim()
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String).map(v => v.trim()).filter(Boolean)
    } catch { /* CSV legado abaixo */ }
  }
  return raw.split(',').map(v => v.trim()).filter(Boolean)
}

function hasRiskSignal(rows: RiskRow[]) {
  return rows.some(row => [
    row.text,
    row.free_note,
    row.recurring_thoughts,
    row.emotional_triggers,
    row.emotional_need,
    row.relationships,
    row.habits,
  ].some(value => detectRisk(value)))
}

/**
 * Contexto recente para Home/Mapa: a pontuação consulta somente campos
 * estruturados. Texto livre é consultado em uma chamada separada e exclusivamente
 * para preservar a barreira de segurança que impede recomendar conteúdo diante
 * de linguagem de risco.
 */
export async function fetchStructuredUserSignal(
  userId: string | null | undefined,
  days = 14,
): Promise<Signal> {
  if (!userId) return signalFromEntries([])
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  try {
    const [{ data: rows }, { data: quiz }, { data: riskRows }] = await Promise.all([
      supabase.from('diary_entries')
        .select('mood,energy,anxiety_level,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags,entry_type,created_at,date')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.from('questionnaire_responses')
        .select('generated_tags')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('diary_entries')
        .select('text,free_note,recurring_thoughts,emotional_triggers,emotional_need,relationships,habits')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(120),
    ])

    const rawRows = (rows ?? []) as StructuredRecommendationRow[]
    const dailyRows = aggregateStructuredEntriesByDay(rawRows)
    const entrySignal = signalFromEntries(dailyRows)

    // O agregador usa um registro sintético por dia. Recolocamos apenas a
    // informação de origem para o motivo da recomendação continuar fiel.
    if (rawRows.some(row => row.entry_type === 'checkin')) entrySignal.sources.add('checkin')
    if (rawRows.some(row => row.entry_type !== 'checkin')) entrySignal.sources.add('diario')

    const questionnaireSignal = signalFromTags(parseQuestionnaireTags((quiz as { generated_tags?: unknown } | null)?.generated_tags))
    const merged = mergeSignals(entrySignal, questionnaireSignal)
    merged.risk = hasRiskSignal((riskRows ?? []) as RiskRow[])
    return merged
  } catch {
    return signalFromEntries([])
  }
}
