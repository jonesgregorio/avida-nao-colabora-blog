import { supabase } from './supabase'
import { ymd } from './reportPeriods'
import { buildDiaryPatternInsight, type DiaryPatternEntry, type DiaryPatternInsight } from './diaryPatternRules'

export type { DiaryPatternEntry, DiaryPatternInsight, DiaryPatternKind } from './diaryPatternRules'
export { buildDiaryPatternInsight } from './diaryPatternRules'

/**
 * Busca somente o recorte estruturado necessário. Texto livre do Diário nunca
 * sai desta consulta e a RLS continua limitando a leitura ao próprio usuário.
 */
export async function fetchDiaryPatternInsight(
  userId: string,
  current: DiaryPatternEntry,
): Promise<DiaryPatternInsight | null> {
  if (!userId || !current.id) return null
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - 14)

  const { data, error } = await supabase
    .from('diary_entries')
    .select('id,date,created_at,emotional_tags,context_tags,need_tags,trigger_tags')
    .eq('user_id', userId)
    .gte('date', ymd(sinceDate))
    .neq('id', current.id)
    .order('date', { ascending: false })
    .limit(60)

  if (error) return null
  return buildDiaryPatternInsight(current, (data ?? []) as DiaryPatternEntry[])
}
