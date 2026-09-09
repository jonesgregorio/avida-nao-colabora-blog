import { supabase } from '../../lib/supabase'
import type { User360, UserRow } from './adminUsersModel'

/**
 * Retrato 360º do usuário (Etapa 1). Passa por admin_user_360 (SECURITY DEFINER
 * + is_admin) porque a RLS das tabelas de dados é `auth.uid() = user_id` — um
 * SELECT direto do admin sobre outro usuário volta vazio.
 * Devolve null se a RPC ainda não existir no banco (antes do deploy da etapa).
 */
export async function loadUser360(userId: string): Promise<User360 | null> {
  const { data, error } = await supabase.rpc('admin_user_360', { target_user_id: userId })
  if (error) {
    // Só trata como "ainda não publicada" quando a RPC realmente não existe /
    // não está no cache do PostgREST. Erro de coluna/tabela dentro da função
    // (does not exist) precisa propagar — não é ausência de deploy.
    const code = (error as { code?: string }).code
    if (code === 'PGRST202' || /could not find the function|schema cache/i.test(error.message)) return null
    throw error
  }
  return (data ?? null) as User360 | null
}

export interface AdminUsersServerStats {
  total: number
  newThisMonth: number
  paying: number
  blocked: number
  withDiscount: number
  unlimitedAccess: number
  openTickets: number
  usersWithUnreadNotifications: number
  plus: number
  essential: number
  free: number
  cancelled: number
}

export type SignupRange = 'all' | 'today' | '24h' | '7d' | 'month' | 'custom'
export type SubscribedSince = 'all' | 'today' | '7d' | 'month'

export interface AdminUsersFilters {
  search: string
  plan: string
  status: string
  access: string
  signupRange?: SignupRange
  signupFrom?: string | null
  signupTo?: string | null
  subscribedSince?: SubscribedSince
}

/** Converte o preset de cadastro em (from, to) ISO — server-side faz o resto. */
export function resolveSignupWindow(f: AdminUsersFilters): { from: string | null; to: string | null } {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (f.signupRange) {
    case 'today':
      return { from: startOfDay.toISOString(), to: null }
    case '24h':
      return { from: new Date(now.getTime() - 24 * 3600_000).toISOString(), to: null }
    case '7d':
      return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString(), to: null }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: null }
    case 'custom':
      return {
        from: f.signupFrom ? new Date(`${f.signupFrom}T00:00:00`).toISOString() : null,
        to: f.signupTo ? new Date(`${f.signupTo}T23:59:59`).toISOString() : null,
      }
    default:
      return { from: null, to: null }
  }
}

export interface AdminUsersPage {
  items: UserRow[]
  total: number
}

const EMPTY_STATS: AdminUsersServerStats = {
  total: 0,
  newThisMonth: 0,
  paying: 0,
  blocked: 0,
  withDiscount: 0,
  unlimitedAccess: 0,
  openTickets: 0,
  usersWithUnreadNotifications: 0,
  plus: 0,
  essential: 0,
  free: 0,
  cancelled: 0,
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function loadAdminUsersStats(): Promise<AdminUsersServerStats> {
  const { data, error } = await supabase.rpc('admin_users_stats_v2')
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    total: numberValue(raw.total),
    newThisMonth: numberValue(raw.newThisMonth),
    paying: numberValue(raw.paying),
    blocked: numberValue(raw.blocked),
    withDiscount: numberValue(raw.withDiscount),
    unlimitedAccess: numberValue(raw.unlimitedAccess),
    openTickets: numberValue(raw.openTickets),
    usersWithUnreadNotifications: numberValue(raw.usersWithUnreadNotifications),
    plus: numberValue(raw.plus),
    essential: numberValue(raw.essential),
    free: numberValue(raw.free),
    cancelled: numberValue(raw.cancelled),
  }
}

export async function loadAdminUsersPage(
  filters: AdminUsersFilters,
  page: number,
  pageSize: number,
): Promise<AdminUsersPage> {
  const window = resolveSignupWindow(filters)
  const { data, error } = await supabase.rpc('admin_list_users_v2', {
    p_page: page,
    p_page_size: pageSize,
    p_search: filters.search.trim(),
    p_plan: filters.plan,
    p_status: filters.status,
    p_access: filters.access,
    p_signup_from: window.from,
    p_signup_to: window.to,
    p_subscribed_since:
      filters.subscribedSince && filters.subscribedSince !== 'all' ? filters.subscribedSince : null,
  })
  if (error) throw error
  const raw = (data ?? {}) as { total?: unknown; items?: unknown }
  return {
    total: numberValue(raw.total),
    items: Array.isArray(raw.items) ? raw.items as UserRow[] : [],
  }
}

export async function loadAllAdminUsersForExport(filters: AdminUsersFilters): Promise<UserRow[]> {
  const pageSize = 200
  let page = 1
  let total = 0
  const rows: UserRow[] = []

  do {
    const result = await loadAdminUsersPage(filters, page, pageSize)
    total = result.total
    rows.push(...result.items)
    page += 1
  } while (rows.length < total)

  return rows
}

export { EMPTY_STATS }
