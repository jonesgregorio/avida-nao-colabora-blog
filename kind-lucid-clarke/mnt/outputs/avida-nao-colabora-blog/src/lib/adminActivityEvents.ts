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
  try {
    const channel = supabase
      .channel(`admin_activity_events:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_activity_events' },
        () => onInsert(),
      )
      .subscribe()
    return () => { try { void supabase.removeChannel(channel) } catch { /* noop */ } }
  } catch {
    return () => {}
  }
}

const PLAN_PT: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  plus: 'Plus',
  therapeutic: 'Plus',
  'therapeutic-plus': 'Plus',
  therapeutic_plus: 'Plus',
}

export function activityUserIdentity(ev: AdminActivityEvent) {
  const metadataEmail = typeof ev.metadata?.email === 'string' ? ev.metadata.email : null
  const name = ev.user_name?.trim() || null
  const email = ev.user_email?.trim() || metadataEmail?.trim() || null
  const technical = /production\s+smoke/i.test(name ?? '') || /^prod-smoke-/i.test(email ?? '')
  return { name, email, technical }
}

function planLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim().toLowerCase()
  return PLAN_PT[normalized] ?? value.trim()
}

export function activityEventCopy(ev: AdminActivityEvent): { title: string; message: string } {
  const plan = planLabel(ev.metadata?.plan ?? ev.user_plan)
  const previousPlan = planLabel(ev.metadata?.previous_plan)

  switch (ev.event_type) {
    case 'user_signup':
      return {
        title: 'Novo usuário cadastrado',
        message: plan ? `Uma nova conta foi criada no plano ${plan}.` : 'Uma nova conta foi criada.',
      }
    case 'subscription_started':
      return {
        title: plan ? `Nova assinatura ${plan}` : 'Nova assinatura',
        message: plan ? `Uma nova assinatura do plano ${plan} foi confirmada.` : 'Uma nova assinatura foi confirmada.',
      }
    case 'plan_upgraded':
      return {
        title: 'Plano alterado',
        message: previousPlan && plan
          ? `O plano foi alterado de ${previousPlan} para ${plan}.`
          : plan ? `O plano foi alterado para ${plan}.` : 'O plano do usuário foi alterado.',
      }
    case 'plan_downgraded':
      return {
        title: 'Plano alterado',
        message: previousPlan && plan
          ? `O plano foi alterado de ${previousPlan} para ${plan}.`
          : plan ? `O plano foi alterado para ${plan}.` : 'O plano do usuário foi alterado.',
      }
    case 'subscription_cancelled':
      return {
        title: 'Assinatura cancelada',
        message: previousPlan ? `A assinatura do plano ${previousPlan} foi cancelada.` : 'A assinatura do usuário foi cancelada.',
      }
    default:
      return {
        title: ev.title || 'Atividade do usuário',
        message: ev.message || 'Uma nova atividade administrativa foi registrada.',
      }
  }
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
