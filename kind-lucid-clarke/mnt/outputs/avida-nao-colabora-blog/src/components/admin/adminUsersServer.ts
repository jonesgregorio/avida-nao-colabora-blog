import { supabase } from '../../lib/supabase'
import type { UserRow } from './adminUsersModel'

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

export interface AdminUsersFilters {
  search: string
  plan: string
  status: string
  access: string
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
  const { data, error } = await supabase.rpc('admin_list_users_v2', {
    p_page: page,
    p_page_size: pageSize,
    p_search: filters.search.trim(),
    p_plan: filters.plan,
    p_status: filters.status,
    p_access: filters.access,
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
