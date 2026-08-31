import { supabase } from './supabase'
import { detectRisk, mergeSignals, signalFromEntries, signalFromTags, type Signal } from './contentRecommendation'
import { aggregateStructuredEntriesByDay, type StructuredRecommendationRow } from './structuredContentContext'

type RiskRow = {
  text?: string | null
  free_note?: string | null
  recurring_thoughts?: string | null
  emotional_triggers?: string | null
  emotional_need?: string | null
  relationships?: string | null
  habits?: string | null
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
