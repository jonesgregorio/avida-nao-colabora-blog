import { supabase } from './supabase'
import type { DiaryEntry } from '../types'

export async function loadDiaryMonth(userId: string, monthKey: string): Promise<DiaryEntry[]> {
  if (!userId) return []
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) return []
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const next = new Date(year, month, 1)
  const endExclusive = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
  const { data, error } = await supabase.from('diary_entries').select('*').eq('user_id', userId).gte('date', start).lt('date', endExclusive).order('date', { ascending: true }).order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as DiaryEntry[]
}
