import { supabase } from './supabase'
import type { WeeklyFocusSuggestion } from './weeklyFocus'

export type WeeklyFocusOutcome = 'helped' | 'somewhat' | 'not_much' | 'not_used'

export type SavedWeeklyFocus = {
  id: string
  user_id: string
  week_start: string
  focus_key: string
  focus_title: string
  status: 'active' | 'closed'
  outcome: WeeklyFocusOutcome | null
  chosen_at: string
  closed_at: string | null
  updated_at: string
}

const SELECT_COLUMNS = 'id,user_id,week_start,focus_key,focus_title,status,outcome,chosen_at,closed_at,updated_at'

export async function loadWeeklyFocusForWeek(userId: string, weekStart: string): Promise<SavedWeeklyFocus | null> {
  const { data, error } = await supabase
    .from('user_weekly_focus')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (error) throw error
  return (data as SavedWeeklyFocus | null) ?? null
}

export async function loadWeeklyFocusState(userId: string, weekStart: string): Promise<{
  current: SavedWeeklyFocus | null
  previousOpen: SavedWeeklyFocus | null
}> {
  const [{ data: currentData, error: currentError }, { data: previousData, error: previousError }] = await Promise.all([
    supabase
      .from('user_weekly_focus')
      .select(SELECT_COLUMNS)
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle(),
    supabase
      .from('user_weekly_focus')
      .select(SELECT_COLUMNS)
      .eq('user_id', userId)
      .lt('week_start', weekStart)
      .eq('status', 'active')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (currentError) throw currentError
  if (previousError) throw previousError

  return {
    current: (currentData as SavedWeeklyFocus | null) ?? null,
    previousOpen: (previousData as SavedWeeklyFocus | null) ?? null,
  }
}

export async function saveWeeklyFocus(
  userId: string,
  weekStart: string,
  suggestion: Pick<WeeklyFocusSuggestion, 'key' | 'title'>,
): Promise<SavedWeeklyFocus> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('user_weekly_focus')
    .upsert({
      user_id: userId,
      week_start: weekStart,
      focus_key: suggestion.key,
      focus_title: suggestion.title,
      status: 'active',
      outcome: null,
      chosen_at: now,
      closed_at: null,
      updated_at: now,
    }, { onConflict: 'user_id,week_start' })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error
  return data as SavedWeeklyFocus
}

export async function closeWeeklyFocus(
  userId: string,
  focusId: string,
  outcome: WeeklyFocusOutcome,
): Promise<SavedWeeklyFocus> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('user_weekly_focus')
    .update({
      status: 'closed',
      outcome,
      closed_at: now,
      updated_at: now,
    })
    .eq('id', focusId)
    .eq('user_id', userId)
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error
  return data as SavedWeeklyFocus
}
