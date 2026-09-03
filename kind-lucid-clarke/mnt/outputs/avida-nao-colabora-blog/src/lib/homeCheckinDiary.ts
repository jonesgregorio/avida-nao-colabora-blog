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

  const { data: existing, error: lookupError } = await supabase
    .from('diary_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('entry_type', 'checkin')
    .contains('markers', [HOME_CHECKIN_MARKER])
    .limit(1)
    .maybeSingle()

  if (lookupError) throw lookupError

  if (existing?.id) {
    const { error } = await supabase.from('diary_entries').update(payload).eq('id', existing.id)
    if (error) throw error
    return existing.id
  }

  const { data, error } = await supabase.from('diary_entries').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}
