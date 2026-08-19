import { normalizePlan } from '../../lib/officialPlans.ts'
import { PLAN_LABELS } from '../../lib/planConstants.ts'

export interface UserRow {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
  plan: string
  role: string | null
  created_at: string
  account_status: string | null
  unlimited_access: boolean | null
  unlimited_access_until: string | null
  unlimited_access_reason: string | null
  discount_percent: number | null
  discount_fixed: number | null
  admin_tags: string[] | null
  last_seen_at?: string | null
  open_tickets?: number
  unread_notifs?: number
  last_activity?: string | null
}

export interface AdminSubscription {
  id: string
  plan_key: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  pending_plan: string | null
  pending_plan_starts_at: string | null
}

export interface TicketRow {
  id: string
  ticket_number: number
  subject: string
  status: string
  priority: string
  updated_at: string
}

export interface NotifRow {
  id: string
  title: string
  type: string
  is_read: boolean
  created_at: string
}

export interface NoteRow {
  id: string
  note: string
  admin_id: string | null
  is_pinned: boolean
  priority: string
  created_at: string
}

export interface PlanHistoryRow {
  id: string
  old_plan: string | null
  new_plan: string | null
  reason: string | null
  created_at: string
}

export interface EmailLogRow {
  id: string
  created_at: string
  sent_at: string | null
  subject: string | null
  status: string | null
  error_message: string | null
  metadata: {
    variables?: { assunto?: string; corpo?: string }
    template_title?: string | null
    sent_by_admin_email?: string | null
  } | null
}

export interface AISummaryRow {
  id: string
  summary: string
  data_snapshot: Record<string, unknown>
  provider: string | null
  created_at: string
}

export type DrawerTab =
  | 'resumo'
  | 'plano'
  | 'mapa'
  | 'orientacoes'
  | 'assinatura'
  | 'acesso'
  | 'suporte'
  | 'notificacoes'
  | 'comunicacao'
  | 'uso'
  | 'descontos'
  | 'notas'
  | 'seguranca'
  | 'resumo-inteligente'

export type ViewMode = 'list' | 'kanban'

export interface AdminUserFilters {
  search: string
  plan: string
  status: string
  access: string
}

export const PLAN_COLORS: Record<string, string> = {
  free: 'bg-mint text-forest-700',
  essential: 'bg-sky text-[#3d6ea5]',
  plus: 'bg-coral text-[#c05f3c]',
  therapeutic: 'bg-coral text-[#c05f3c]',
  'therapeutic-plus': 'bg-coral text-[#c05f3c]',
}

export const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  awaiting_admin: 'Aguard. suporte',
  awaiting_user: 'Aguard. cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  awaiting_admin: 'bg-yellow-100 text-yellow-700',
  awaiting_user: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-stone-100 text-stone-500',
}

export const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-stone-100 text-stone-500',
  trial: 'bg-blue-100 text-blue-700',
}

export const TYPE_LABELS: Record<string, string> = {
  info: 'Info',
  content: 'Conteúdo',
  promo: 'Promo',
  reminder: 'Lembrete',
  alert: 'Alerta',
  support_reply: 'Suporte',
  admin_message: 'Admin',
  system: 'Sistema',
}

export const PREDEFINED_TAGS = [
  'VIP',
  'Problema técnico',
  'Cancelamento',
  'Pagamento pendente',
  'Usuário ativo',
  'Inativo',
  'Beta tester',
  'Parceiro',
] as const

export const KANBAN_COLUMNS = [
  { key: 'free', label: 'Gratuito', color: 'border-stone-300 bg-stone-50', badge: 'bg-stone-100 text-stone-600' },
  { key: 'essential', label: 'Essencial', color: 'border-blue-300 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  { key: 'plus', label: 'Plus', color: 'border-[#f0c3b4] bg-coral/30', badge: 'bg-coral text-[#c05f3c]' },
] as const

export const DRAWER_TABS: ReadonlyArray<{ key: DrawerTab; label: string }> = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'plano', label: 'Plano' },
  { key: 'mapa', label: 'Mapa emocional' },
  { key: 'orientacoes', label: 'Orientações' },
  { key: 'assinatura', label: 'Assinatura e Pagamentos' },
  { key: 'acesso', label: 'Acesso' },
  { key: 'suporte', label: 'Suporte' },
  { key: 'notificacoes', label: 'Notificações' },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'uso', label: 'Uso' },
  { key: 'descontos', label: 'Descontos' },
  { key: 'notas', label: 'Notas' },
  { key: 'seguranca', label: 'Segurança' },
  { key: 'resumo-inteligente', label: '✦ Resumo IA' },
]

export const NOTE_PRIORITY_COLORS: Record<string, string> = {
  normal: 'bg-stone-100 text-stone-500',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}

export function timeSince(iso: string, nowMs = Date.now()): string {
  const days = Math.floor((nowMs - new Date(iso).getTime()) / 86400000)
  if (days < 30) return `há ${days} dia${days !== 1 ? 's' : ''}`

  const months = Math.floor(days / 30)
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return remainingMonths > 0
    ? `há ${years} ano${years !== 1 ? 's' : ''} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`
    : `há ${years} ano${years !== 1 ? 's' : ''}`
}

export function filterAdminUsers(users: UserRow[], filters: AdminUserFilters): UserRow[] {
  const query = filters.search.toLowerCase()

  return users.filter(user => {
    const matchesSearch = !query
      || (user.full_name ?? '').toLowerCase().includes(query)
      || (user.email ?? '').toLowerCase().includes(query)
      || user.user_id.toLowerCase().includes(query)

    const matchesPlan = filters.plan === 'all' || normalizePlan(user.plan) === filters.plan
    const matchesStatus = filters.status === 'all' || (user.account_status ?? 'active') === filters.status
    const hasDiscount = (user.discount_percent ?? 0) > 0 || (user.discount_fixed ?? 0) > 0

    const matchesAccess = filters.access === 'all'
      ? true
      : filters.access === 'discount'
        ? hasDiscount
        : filters.access === 'unlimited'
          ? user.unlimited_access === true
          : filters.access === 'tickets'
            ? (user.open_tickets ?? 0) > 0
            : filters.access === 'admin'
              ? user.role === 'admin'
              : true

    return matchesSearch && matchesPlan && matchesStatus && matchesAccess
  })
}

export function resolveTabFilter(tab: string): { activeTab: string; filterPlan: string; filterStatus: string } {
  if (tab === 'all') return { activeTab: tab, filterPlan: 'all', filterStatus: 'all' }
  if (tab === 'cancelled') return { activeTab: tab, filterPlan: 'all', filterStatus: 'cancelled' }
  return { activeTab: tab, filterPlan: tab, filterStatus: 'all' }
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildAdminUsersCsv(users: UserRow[]): string {
  const columns: Array<{ header: string; get: (user: UserRow) => string }> = [
    { header: 'Nome', get: user => user.full_name ?? '' },
    { header: 'E-mail', get: user => user.email ?? '' },
    { header: 'ID', get: user => user.user_id },
    { header: 'Plano', get: user => PLAN_LABELS[user.plan] ?? user.plan },
    { header: 'Plano (chave)', get: user => user.plan },
    { header: 'Status', get: user => user.account_status ?? 'active' },
    { header: 'Papel', get: user => user.role ?? 'user' },
    { header: 'Acesso ilimitado', get: user => user.unlimited_access ? 'Sim' : 'Não' },
    { header: 'Desconto %', get: user => String(user.discount_percent ?? 0) },
    { header: 'Desconto fixo (R$)', get: user => String(user.discount_fixed ?? 0) },
    { header: 'Tickets abertos', get: user => String(user.open_tickets ?? 0) },
    { header: 'Notif. não lidas', get: user => String(user.unread_notifs ?? 0) },
    { header: 'Tags', get: user => (user.admin_tags ?? []).join('; ') },
    {
      header: 'Cadastro',
      get: user => new Date(user.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    },
  ]

  const lines = [
    columns.map(column => escapeCsv(column.header)).join(','),
    ...users.map(user => columns.map(column => escapeCsv(column.get(user))).join(',')),
  ]

  return String.fromCharCode(0xFEFF) + lines.join('\r\n')
}
