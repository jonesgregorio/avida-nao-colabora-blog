import { supabase } from './supabase'

export type HistoryItemType = 'milestone' | 'hidden_month' | 'highlight_month'

export type HistoryManagementItem = {
  id: string
  user_id: string
  item_type: HistoryItemType
  title: string | null
  description: string | null
  event_date: string | null
  category: string | null
  reference_key: string | null
  created_at: string
  updated_at: string
}

export async function loadHistoryManagementItems(userId: string) {
  const { data, error } = await supabase
    .from('user_history_items')
    .select('id,user_id,item_type,title,description,event_date,category,reference_key,created_at,updated_at')
    .eq('user_id', userId)
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as HistoryManagementItem[]
}

export async function createHistoryMilestone(userId: string, input: { title: string; description?: string; eventDate: string; category?: string }) {
  const { data, error } = await supabase
    .from('user_history_items')
    .insert({
      user_id: userId,
      item_type: 'milestone',
      title: input.title.trim(),
      description: input.description?.trim() || null,
      event_date: input.eventDate,
      category: input.category?.trim() || null,
    })
    .select('id,user_id,item_type,title,description,event_date,category,reference_key,created_at,updated_at')
    .single()
  if (error) throw error
  return data as HistoryManagementItem
}

export async function updateHistoryMilestone(id: string, userId: string, input: { title: string; description?: string; eventDate: string; category?: string }) {
  const { data, error } = await supabase
    .from('user_history_items')
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      event_date: input.eventDate,
      category: input.category?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('item_type', 'milestone')
    .select('id,user_id,item_type,title,description,event_date,category,reference_key,created_at,updated_at')
    .single()
  if (error) throw error
  return data as HistoryManagementItem
}

export async function deleteHistoryItem(id: string, userId: string) {
  const { error } = await supabase.from('user_history_items').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function setMonthHistoryControl(userId: string, monthKey: string, type: 'hidden_month' | 'highlight_month', enabled: boolean) {
  if (enabled) {
    const { error } = await supabase.from('user_history_items').upsert(
      { user_id: userId, item_type: type, reference_key: monthKey },
      { onConflict: 'user_id,item_type,reference_key', ignoreDuplicates: true },
    )
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('user_history_items')
    .delete()
    .eq('user_id', userId)
    .eq('item_type', type)
    .eq('reference_key', monthKey)
  if (error) throw error
}
