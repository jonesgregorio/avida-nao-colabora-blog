import { supabase } from './supabase'
import { MOODS } from '../components/user/moods'

export const HOME_CHECKIN_MARKER = 'home_checkin'

type HomeCheckinData = {
  userId: string
  date: string
  score: number
  feelingTags?: string[] | null
  customTags?: string[] | null
}

function moodLabel(key: string | undefined) {
  if (!key) return null
  return MOODS.find(item => item.key === key)?.label ?? null
}

function emotionLabels(feelingTags: string[], customTags: string[]) {
  return [...feelingTags.map(key => moodLabel(key) || key), ...customTags]
}

export async function syncHomeCheckinToDiary({ userId, date, score, feelingTags = [], customTags = [] }: HomeCheckinData) {
  const feelings = Array.isArray(feelingTags) ? feelingTags : []
  const custom = Array.isArray(customTags) ? customTags : []
  const payload = {
    user_id: userId,
    date,
    mood: moodLabel(feelings[0]),
    mood_score: score,
    emotional_tags: emotionLabels(feelings, custom),
    text: null,
    entry_type: 'checkin',
    ai_disabled: true,
    markers: [HOME_CHECKIN_MARKER],
  }

  // O check-in é uma fotografia única do dia, não uma edição do Diário.
  // Se já existe qualquer check-in na data, preservamos o primeiro exatamente
  // como foi enviado e apenas devolvemos sua identidade.
  const { data: existing, error: lookupError } = await supabase
    .from('diary_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('entry_type', 'checkin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existing?.id) return existing.id

  const { data, error } = await supabase.from('diary_entries').insert(payload).select('id').single()
  if (error) {
    // Duas telas podem tentar sincronizar no mesmo instante. O índice único do
    // banco decide quem gravou primeiro; em seguida recuperamos o registro já
    // existente em vez de criar/editar um segundo check-in.
    if (error.code === '23505') {
      const { data: concurrent, error: concurrentError } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('date', date)
        .eq('entry_type', 'checkin')
        .limit(1)
        .single()
      if (concurrentError) throw concurrentError
      return concurrent.id
    }
    throw error
  }
  return data.id
}
