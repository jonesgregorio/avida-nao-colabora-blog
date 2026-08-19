import {
  Bell,
  ChevronRight,
  Columns,
  Crown,
  Download,
  LayoutList,
  Search,
  Star,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react'
import { OFFICIAL_PLANS } from '../../lib/officialPlans'
import { PLAN_LABELS } from '../../lib/planConstants'
import {
  KANBAN_COLUMNS,
  PLAN_COLORS,
  timeSince,
  type UserRow,
  type ViewMode,
} from './adminUsersModel'

export interface AdminUsersStats {
  total: number
  newThisMonth: number
  paying: number
  blocked: number
  withDiscount: number
  unlimitedAccess: number
  openTickets: number
  plus: number
  essential: number
  free: number
  cancelled: number
}

interface AdminUsersHeaderProps {
  users: UserRow[]
  filteredCount: number
  stats: AdminUsersStats
  loading: boolean
  search: string
  filterPlan: string
  filterStatus: string
  filterAccess: string
  exporting: boolean
  viewMode: ViewMode
  activeTab: string
  onSearchChange: (value: string) => void
  onPlanChange: (value: string) => void
  onStatusChange: (value: string) => void
  onAccessChange: (value: string) => void
  onExport: () => void
  onViewModeChange: (mode: ViewMode) => void
  onTabFilter: (tab: string) => void
  onShowNotifications: () => void
  onShowTickets: () => void
  onShowCancelled: () => void
}

export function AdminUsersHeader({
  users,
  filteredCount,
  stats,
  loading,
  search,
  filterPlan,
  filterStatus,
  filterAccess,
  exporting,
  viewMode,
  activeTab,
  onSearchChange,
  onPlanChange,
  onStatusChange,
  onAccessChange,
  onExport,
  onViewModeChange,
  onTabFilter,
  onShowNotifications,
  onShowTickets,
  onShowCancelled,
}: AdminUsersHeaderProps) {
  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-line flex-shrink-0">
        <div className="mb-4">
          <h1 className="font-serif text-3xl text-forest-900">Usuários</h1>
          <p className="text-sm text-ink-soft mt-0.5">Gerencie planos, status e acompanhamento.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Total de usuários', value: stats.total, Icon: Users, bg: 'bg-mint', color: 'text-forest-600' },
            { label: 'Plus ativos', value: stats.plus, Icon: Crown, bg: 'bg-coral', color: 'text-[#c05f3c]' },
            { label: 'Essencial ativos', value: stats.essential, Icon: Star, bg: 'bg-sky', color: 'text-[#3d6ea5]' },
            { label: 'Gratuitos', value: stats.free, Icon: Users, bg: 'bg-paper-soft', color: 'text-ink-soft' },
            { label: 'Cancelados', value: stats.cancelled, Icon: XCircle, bg: 'bg-[#fbf1d5]', color: 'text-[#c9971f]' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-line rounded-2xl p-4">
              <span className={`w-9 h-9 rounded-full ${s.bg} flex items-center justify-center mb-2`}>
                <s.Icon className={`w-4 h-4 ${s.color}`} />
              </span>
              <p className="font-serif text-2xl text-forest-900 leading-tight">{s.value}</p>
              <p className="text-xs text-ink-soft mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {!loading && (
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Usuários que precisam de atenção</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onShowNotifications}
                className="bg-red-50 border border-red-100 rounded-xl p-3 text-left hover:bg-red-100 transition-colors group"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Bell className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] font-medium text-red-500 uppercase tracking-wide leading-tight">Notificações pendentes</span>
                </div>
                <p className="text-xl font-serif text-red-700 leading-none">
                  {users.filter(u => (u.unread_notifs ?? 0) > 0).length}
                </p>
                <p className="text-[10px] text-red-400 mt-0.5">usuários com não lidas</p>
              </button>

              <button
                onClick={onShowTickets}
                className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-left hover:bg-blue-100 transition-colors group"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Ticket className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wide leading-tight">Tickets em aberto</span>
                </div>
                <p className="text-xl font-serif text-blue-700 leading-none">{stats.openTickets}</p>
                <p className="text-[10px] text-blue-400 mt-0.5">aguardando atendimento</p>
              </button>

              <button
                onClick={onShowCancelled}
                className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-left hover:bg-amber-100 transition-colors group"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <XCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-medium text-amber-500 uppercase tracking-wide leading-tight">Cancelamentos</span>
                </div>
                <p className="text-xl font-serif text-amber-700 leading-none">{stats.cancelled}</p>
                <p className="text-[10px] text-amber-400 mt-0.5">usuários cancelados</p>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Buscar por nome, e-mail ou ID..."
              className="w-full pl-9 pr-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>

          <select
            value={filterPlan}
            onChange={e => onPlanChange(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <option value="all">Todos os planos</option>
            {OFFICIAL_PLANS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={e => onStatusChange(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="blocked">Bloqueado</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select
            value={filterAccess}
            onChange={e => onAccessChange(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <option value="all">Todos</option>
            <option value="discount">Com desconto</option>
            <option value="unlimited">Acesso ilimitado</option>
            <option value="tickets">Com ticket aberto</option>
            <option value="admin">Administradores</option>
          </select>

          <button
            onClick={onExport}
            disabled={exporting || filteredCount === 0}
            title="Exportar os usuários filtrados para Excel (CSV)"
            className="flex items-center gap-1.5 border border-forest-700 text-forest-700 hover:bg-mint/40 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            Exportar ({filteredCount})
          </button>

          <div className="flex rounded-lg border border-line overflow-hidden flex-shrink-0">
            <button
              onClick={() => onViewModeChange('list')}
              title="Lista"
              className={`px-3 py-2 transition-colors ${viewMode === 'list' ? 'bg-forest-900 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('kanban')}
              title="Kanban"
              className={`px-3 py-2 transition-colors ${viewMode === 'kanban' ? 'bg-forest-900 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 border-b border-line bg-white flex-shrink-0">
        <div className="flex gap-1.5 py-2.5 overflow-x-auto">
          {[
            { key: 'all', label: 'Todos', count: stats.total },
            { key: 'plus', label: 'Plus', count: stats.plus },
            { key: 'essential', label: 'Essencial', count: stats.essential },
            { key: 'free', label: 'Gratuitos', count: stats.free },
            { key: 'cancelled', label: 'Cancelados', count: stats.cancelled },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => onTabFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? 'bg-forest-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === t.key ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

interface AdminUsersCollectionProps {
  users: UserRow[]
  selectedUserId: string | null
  onOpenUser: (user: UserRow) => void
}

export function AdminUsersList({ users, selectedUserId, onOpenUser }: AdminUsersCollectionProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 border-b border-line">
          <tr>
            <th className="text-left px-4 py-3 text-stone-500 font-medium">Usuário</th>
            <th className="text-left px-3 py-3 text-stone-500 font-medium hidden lg:table-cell">E-mail</th>
            <th className="text-left px-3 py-3 text-stone-500 font-medium">Plano</th>
            <th className="text-left px-3 py-3 text-stone-500 font-medium hidden sm:table-cell">Status</th>
            <th className="text-left px-3 py-3 text-stone-500 font-medium hidden md:table-cell">Membro desde</th>
            <th className="text-left px-3 py-3 text-stone-500 font-medium hidden lg:table-cell">Atividade</th>
            <th className="text-center px-3 py-3 text-stone-500 font-medium hidden md:table-cell">Tickets</th>
            <th className="text-center px-3 py-3 text-stone-500 font-medium hidden lg:table-cell">Notif.</th>
            <th className="px-4 py-3 text-stone-500 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {users.map(u => {
            const hasDiscount = (u.discount_percent ?? 0) > 0 || (u.discount_fixed ?? 0) > 0
            const isBlocked = u.account_status === 'blocked'
            const isUnlimited = u.unlimited_access === true
            return (
              <tr key={u.id} className={`hover:bg-paper-soft transition-colors ${selectedUserId === u.user_id ? 'bg-mint/40' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-700 text-xs font-semibold flex-shrink-0">
                      {(u.full_name ?? 'U')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-forest-900 truncate">{u.full_name || 'Sem nome'}</p>
                        {u.role === 'admin' && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-ink-soft truncate lg:hidden">{u.email || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-soft hidden lg:table-cell"><span className="block truncate max-w-[220px]">{u.email || '—'}</span></td>
                <td className="px-3 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${PLAN_COLORS[u.plan] ?? 'bg-stone-100 text-stone-500'}`}>
                    {PLAN_LABELS[u.plan] ?? u.plan}
                  </span>
                </td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {isBlocked ? 'Bloqueado' : (u.account_status && u.account_status !== 'active' ? u.account_status : 'Ativo')}
                    </span>
                    {isUnlimited && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-mint text-forest-800 font-medium">Ilimitado</span>}
                    {hasDiscount && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Desconto</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-soft text-xs hidden md:table-cell whitespace-nowrap">{timeSince(u.created_at)}</td>
                <td className="px-3 py-3 text-xs hidden lg:table-cell whitespace-nowrap">
                  {u.last_activity
                    ? <span className="text-forest-700">{timeSince(u.last_activity)}</span>
                    : <span className="text-stone-300">Sem registros</span>}
                </td>
                <td className="px-3 py-3 text-center hidden md:table-cell">
                  {(u.open_tickets ?? 0) > 0
                    ? <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"><Ticket className="w-3 h-3" />{u.open_tickets}</span>
                    : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center hidden lg:table-cell">
                  {(u.unread_notifs ?? 0) > 0
                    ? <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full"><Bell className="w-3 h-3" />{u.unread_notifs}</span>
                    : <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onOpenUser(u)} className="inline-flex items-center gap-1.5 text-xs border border-line rounded-lg px-2.5 py-1.5 text-forest-700 hover:bg-stone-50 hover:border-forest-300 whitespace-nowrap">
                    Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {users.length === 0 && <p className="text-center text-ink-soft text-sm py-8">Nenhum usuário encontrado.</p>}
    </div>
  )
}

export function AdminUsersKanban({ users, selectedUserId, onOpenUser }: AdminUsersCollectionProps) {
  return (
    <div className="flex gap-3 p-4 h-full overflow-x-auto items-start">
      {KANBAN_COLUMNS.map(col => {
        const colUsers = users.filter(u => u.plan === col.key)
        return (
          <div key={col.key} className={`flex flex-col rounded-xl border-2 ${col.color} min-w-[220px] w-[220px] flex-shrink-0`}>
            <div className="px-3 py-2 flex items-center justify-between border-b border-black/10">
              <span className="text-xs font-semibold text-stone-700">{col.label}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${col.badge}`}>{colUsers.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {colUsers.length === 0 ? (
                <p className="text-[11px] text-stone-400 text-center py-4">Nenhum usuário</p>
              ) : colUsers.map(u => {
                const isBlocked = u.account_status === 'blocked'
                const isSuspended = u.account_status === 'suspended'
                const isUnlimited = u.unlimited_access === true
                const hasDiscount = (u.discount_percent ?? 0) > 0 || (u.discount_fixed ?? 0) > 0
                const hasOpenTickets = (u.open_tickets ?? 0) > 0
                const hasUnreadNotifs = (u.unread_notifs ?? 0) > 0
                return (
                  <button
                    key={u.id}
                    onClick={() => onOpenUser(u)}
                    className={`w-full text-left bg-white rounded-lg border px-3 py-2.5 hover:shadow-md transition-shadow ${selectedUserId === u.user_id ? 'ring-2 ring-blue-400 border-blue-200' : 'border-line'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-xs font-bold flex-shrink-0">
                        {(u.full_name ?? 'U')[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-forest-900 truncate leading-tight">{u.full_name || 'Sem nome'}</p>
                        {u.email && <p className="text-[10px] text-stone-400 truncate">{u.email}</p>}
                        <p className="text-[10px] text-stone-400">{timeSince(u.created_at)}</p>
                      </div>
                      {u.role === 'admin' && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {isBlocked && <span className="text-[10px] px-1.5 rounded-full bg-red-100 text-red-700 font-medium">Bloqueado</span>}
                      {isSuspended && <span className="text-[10px] px-1.5 rounded-full bg-orange-100 text-orange-700 font-medium">Suspenso</span>}
                      {isUnlimited && <span className="text-[10px] px-1.5 rounded-full bg-mint text-forest-800 font-medium">Ilimitado</span>}
                      {hasDiscount && <span className="text-[10px] px-1.5 rounded-full bg-amber-100 text-amber-700 font-medium">Desconto</span>}
                      {hasOpenTickets && (
                        <span className="text-[10px] px-1.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-0.5">
                          <Ticket className="w-2.5 h-2.5" />{u.open_tickets}
                        </span>
                      )}
                      {hasUnreadNotifs && (
                        <span className="text-[10px] px-1.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-0.5">
                          <Bell className="w-2.5 h-2.5" />{u.unread_notifs}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface AdminUsersOverviewProps extends AdminUsersHeaderProps {
  filteredUsers: UserRow[]
  selectedUserId: string | null
  onOpenUser: (user: UserRow) => void
}

export default function AdminUsersOverview({
  filteredUsers,
  selectedUserId,
  onOpenUser,
  viewMode,
  ...headerProps
}: AdminUsersOverviewProps) {
  return (
    <div className={`flex flex-col flex-1 min-w-0 ${selectedUserId ? 'hidden lg:flex' : 'flex'}`}>
      <AdminUsersHeader
        {...headerProps}
        viewMode={viewMode}
        filteredCount={filteredUsers.length}
      />

      <div className="flex-1 overflow-auto">
        {headerProps.loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}
          </div>
        ) : viewMode === 'list' ? (
          <AdminUsersList users={filteredUsers} selectedUserId={selectedUserId} onOpenUser={onOpenUser} />
        ) : (
          <AdminUsersKanban users={filteredUsers} selectedUserId={selectedUserId} onOpenUser={onOpenUser} />
        )}
      </div>
    </div>
  )
}
