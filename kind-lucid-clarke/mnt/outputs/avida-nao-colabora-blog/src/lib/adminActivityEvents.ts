import { supabase } from './supabase'

// Camada única de acesso aos eventos administrativos (novos cadastros / novas
// assinaturas). Tudo server-side via RPC admin-only; o frontend nunca insere.

export type AdminActivityType = 'user_signup' | 'subscription_started' | string

export interface AdminActivityEvent {
  id: string
  event_type: AdminActivityType
  user_id: string | null
  title: string
  message: string
  metadata: Record<string, unknown>
  created_at: string
  read_at: string | null
  user_name: string | null
  user_email: string | null
  user_plan: string | null
}

export interface AdminActivityPage {
  rows: AdminActivityEvent[]
  total: number
  unread: number
}

export type AdminActivityFilter = 'all' | 'user_signup' | 'subscription_started' | 'unread'

export async function fetchActivityUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('admin_activity_events_unread_count')
  if (error) return 0
  return Number(data ?? 0)
}

export async function fetchActivityEvents(
  filter: AdminActivityFilter,
  limit: number,
  offset: number,
): Promise<AdminActivityPage> {
  const { data, error } = await supabase.rpc('admin_activity_events_list', {
    p_filter: filter,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  const raw = (data ?? {}) as { rows?: AdminActivityEvent[]; total?: number; unread?: number }
  return {
    rows: Array.isArray(raw.rows) ? raw.rows : [],
    total: Number(raw.total ?? 0),
    unread: Number(raw.unread ?? 0),
  }
}

export async function markActivityEventRead(id: string): Promise<void> {
  await supabase.rpc('admin_activity_events_mark_read', { p_id: id })
}

export async function markAllActivityEventsRead(): Promise<number> {
  const { data } = await supabase.rpc('admin_activity_events_mark_all_read')
  return Number(data ?? 0)
}

export interface NewUsersOverview {
  new_users_today: number
  new_users_7d: number
  new_users_month: number
  new_subs_today: number
  new_subs_7d: number
  new_subs_month: number
  conversion_30d: { signups: number; converted: number; rate: number }
  generated_at?: string
}

export async function fetchNewUsersOverview(): Promise<NewUsersOverview | null> {
  const { data, error } = await supabase.rpc('admin_new_users_overview')
  if (error || !data) return null
  return data as NewUsersOverview
}

/**
 * Assina INSERT em admin_activity_events (Realtime). O stream respeita a RLS de
 * SELECT (is_admin()). Devolve a função de cleanup.
 */
export function subscribeActivityEvents(onInsert: () => void): () => void {
  const channel = supabase
    .channel('admin_activity_events_stream')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'admin_activity_events' },
      () => onInsert(),
    )
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

export function activityRelativeTime(iso: string, nowMs = Date.now()): string {
  const diff = Math.max(0, nowMs - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} dia${d !== 1 ? 's' : ''}`
  const mo = Math.floor(d / 30)
  return `há ${mo} ${mo === 1 ? 'mês' : 'meses'}`
}
