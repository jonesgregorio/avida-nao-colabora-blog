import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { sendUserMessage } from '../../lib/messaging'
import {
  Search, X, Users, Crown, Bell, FileText,
  MessageCircle, Plus, ChevronRight, Ticket, Shield, Tag,
  LayoutList, Columns,
} from 'lucide-react'

interface UserRow {
  id: string
  user_id: string
  full_name: string | null
  plan: string
  role: string | null
  created_at: string
  account_status: string | null
  unlimited_access: boolean | null
  discount_percent: number | null
  discount_fixed: number | null
  admin_tags: string[] | null
  open_tickets?: number
  unread_notifs?: number
}

interface TicketRow {
  id: string
  ticket_number: number
  subject: string
  status: string
  priority: string
  updated_at: string
}

interface NotifRow {
  id: string
  title: string
  type: string
  is_read: boolean
  created_at: string
}

interface NoteRow {
  id: string
  note: string
  admin_id: string | null
  is_pinned: boolean
  priority: string
  created_at: string
}

interface PlanHistoryRow {
  id: string
  old_plan: string | null
  new_plan: string | null
  reason: string | null
  created_at: string
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
}
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-500',
  essential: 'bg-blue-100 text-blue-700',
  therapeutic: 'bg-purple-100 text-purple-700',
  'therapeutic-plus': 'bg-emerald-100 text-emerald-700',
}
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em andamento',
  awaiting_admin: 'Aguard. suporte', awaiting_user: 'Aguard. cliente',
  resolved: 'Resolvido', closed: 'Fechado',
}
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700', in_progress: 'bg-orange-100 text-orange-700',
  awaiting_admin: 'bg-yellow-100 text-yellow-700', awaiting_user: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700', closed: 'bg-stone-100 text-stone-500',
}
const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-stone-100 text-stone-500',
  trial: 'bg-blue-100 text-blue-700',
}
const TYPE_LABELS: Record<string, string> = {
  info: 'Info', content: 'Conteúdo', promo: 'Promo', reminder: 'Lembrete',
  alert: 'Alerta', support_reply: 'Suporte', admin_message: 'Admin', system: 'Sistema',
}
const PREDEFINED_TAGS = [
  'VIP', 'Problema técnico', 'Cancelamento', 'Pagamento pendente',
  'Usuário ativo', 'Inativo', 'Beta tester', 'Parceiro',
]

function timeSince(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d < 30) return `há ${d} dia${d !== 1 ? 's' : ''}`
  const m = Math.floor(d / 30)
  if (m < 12) return `há ${m} ${m === 1 ? 'mês' : 'meses'}`
  const y = Math.floor(m / 12), rm = m % 12
  return rm > 0
    ? `há ${y} ano${y !== 1 ? 's' : ''} e ${rm} ${rm === 1 ? 'mês' : 'meses'}`
    : `há ${y} ano${y !== 1 ? 's' : ''}`
}

const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

type DrawerTab = 'resumo' | 'plano' | 'acesso' | 'suporte' | 'notificacoes' | 'uso' | 'descontos' | 'notas' | 'seguranca'
type ViewMode = 'list' | 'kanban'

const KANBAN_COLUMNS = [
  { key: 'free', label: 'Gratuito', color: 'border-stone-300 bg-stone-50', badge: 'bg-stone-100 text-stone-600' },
  { key: 'essential', label: 'Essencial', color: 'border-blue-300 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  { key: 'therapeutic', label: 'Terapêutico', color: 'border-purple-300 bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
  { key: 'therapeutic-plus', label: 'Plus', color: 'border-emerald-300 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
]

export default function AdminUsers() {
  const { user: adminUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('resumo')

  // Drawer data
  const [userTickets, setUserTickets] = useState<TicketRow[]>([])
  const [userNotifs, setUserNotifs] = useState<NotifRow[]>([])
  const [userNotes, setUserNotes] = useState<NoteRow[]>([])
  const [planHistory, setPlanHistory] = useState<PlanHistoryRow[]>([])
  const [metrics, setMetrics] = useState({ diary: 0, saved: 0, questionnaires: 0, tickets: 0, unreadNotifs: 0 })
  const [loadingDrawer, setLoadingDrawer] = useState(false)

  // Summary stats
  const [stats, setStats] = useState({
    total: 0, newThisMonth: 0, paying: 0, blocked: 0,
    withDiscount: 0, unlimitedAccess: 0, openTickets: 0, plus: 0,
  })

  // Notes form
  const [newNote, setNewNote] = useState('')
  const [notePriority, setNotePriority] = useState('normal')
  const [notePinned, setNotePinned] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  // Plan change
  const [changingPlan, setChangingPlan] = useState(false)
  const [newPlan, setNewPlan] = useState('')
  const [planReason, setPlanReason] = useState('')
  const [savingPlan, setSavingPlan] = useState(false)

  // Unlimited access
  const [unlimitedAccessForm, setUnlimitedAccessForm] = useState({ enabled: false, until: '', reason: '' })
  const [savingUnlimited, setSavingUnlimited] = useState(false)

  // Discounts
  const [discountForm, setDiscountForm] = useState({
    discount_percent: 0, discount_fixed: 0, discount_code: '',
    discount_until: '', discount_reason: '',
  })
  const [savingDiscount, setSavingDiscount] = useState(false)

  // Block/unblock
  const [blockReason, setBlockReason] = useState('')
  const [blockingUser, setBlockingUser] = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)

  // Send message
  const [msgTitle, setMsgTitle] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [msgType, setMsgType] = useState('admin_message')
  const [msgCreateTicket, setMsgCreateTicket] = useState(false)
  const [msgPriority, setMsgPriority] = useState('medium')
  const [msgCategory, setMsgCategory] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgResult, setMsgResult] = useState<string | null>(null)
  const [showMsgModal, setShowMsgModal] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, plan, role, created_at, account_status, unlimited_access, discount_percent, discount_fixed, admin_tags')
      .order('created_at', { ascending: false })

    if (!profileData) { setLoading(false); return }

    const userIds = profileData.map((p: UserRow) => p.user_id)
    const [ticketRes, notifRes, openTicketCountRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('support_tickets').select('user_id').in('user_id', userIds).not('status', 'in', '("closed","resolved")')
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from('notifications').select('user_id').in('user_id', userIds).eq('is_read', false)
        : Promise.resolve({ data: [] }),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).not('status', 'in', '("closed","resolved")'),
    ])

    const ticketData = ticketRes.data || []
    const notifData = notifRes.data || []

    const ticketMap = new Map<string, number>()
    for (const t of ticketData) ticketMap.set(t.user_id, (ticketMap.get(t.user_id) ?? 0) + 1)
    const notifMap = new Map<string, number>()
    for (const n of notifData) notifMap.set(n.user_id, (notifMap.get(n.user_id) ?? 0) + 1)

    const rows: UserRow[] = profileData.map((p: UserRow) => ({
      ...p,
      open_tickets: ticketMap.get(p.user_id) ?? 0,
      unread_notifs: notifMap.get(p.user_id) ?? 0,
    }))

    setUsers(rows)

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    setStats({
      total: rows.length,
      newThisMonth: rows.filter(r => r.created_at >= thisMonthStart).length,
      paying: rows.filter(r => r.plan !== 'free').length,
      blocked: rows.filter(r => r.account_status === 'blocked').length,
      withDiscount: rows.filter(r => (r.discount_percent ?? 0) > 0 || (r.discount_fixed ?? 0) > 0).length,
      unlimitedAccess: rows.filter(r => r.unlimited_access === true).length,
      openTickets: openTicketCountRes.count ?? 0,
      plus: rows.filter(r => r.plan === 'therapeutic-plus').length,
    })

    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function loadDrawerData(userId: string) {
    setLoadingDrawer(true)
    const [ticketRes, notifRes, noteRes, planHistRes, diaryRes, savedRes, qRes] = await Promise.all([
      supabase.from('support_tickets').select('id, ticket_number, subject, status, priority, updated_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('notifications').select('id, title, type, is_read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('user_internal_notes').select('id, note, admin_id, is_pinned, priority, created_at').eq('user_id', userId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('user_plan_history').select('id, old_plan, new_plan, reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    setUserTickets(ticketRes.data || [])
    setUserNotifs(notifRes.data || [])
    setUserNotes(noteRes.data || [])
    setPlanHistory(planHistRes.data || [])
    setMetrics({
      diary: diaryRes.count ?? 0,
      saved: savedRes.count ?? 0,
      questionnaires: qRes.count ?? 0,
      tickets: ticketRes.data?.length ?? 0,
      unreadNotifs: (notifRes.data || []).filter((n: NotifRow) => !n.is_read).length,
    })
    setLoadingDrawer(false)
  }

  function openDrawer(u: UserRow) {
    setSelectedUser(u)
    setDrawerTab('resumo')
    setNewNote('')
    setNotePriority('normal')
    setNotePinned(false)
    setChangingPlan(false)
    setNewPlan(u.plan)
    setPlanReason('')
    setUnlimitedAccessForm({ enabled: u.unlimited_access ?? false, until: '', reason: '' })
    setDiscountForm({
      discount_percent: u.discount_percent ?? 0,
      discount_fixed: u.discount_fixed ?? 0,
      discount_code: '',
      discount_until: '',
      discount_reason: '',
    })
    setBlockReason('')
    setShowBlockForm(false)
    setMsgTitle(''); setMsgBody(''); setMsgType('admin_message')
    setMsgCreateTicket(false); setMsgPriority('medium')
    setMsgCategory(''); setMsgResult(null); setShowMsgModal(false)
    loadDrawerData(u.user_id)
  }

  function closeDrawer() { setSelectedUser(null) }

  async function setAdmin(userId: string, isAdmin: boolean) {
    const { error } = await supabase.from('profiles').update({ role: isAdmin ? 'admin' : null }).eq('user_id', userId)
    if (!error) {
      setUsers(u => u.map(r => r.user_id === userId ? { ...r, role: isAdmin ? 'admin' : null } : r))
      if (selectedUser?.user_id === userId) setSelectedUser(s => s ? { ...s, role: isAdmin ? 'admin' : null } : s)
    }
  }

  async function handlePlanChange() {
    if (!selectedUser || !newPlan) return
    setSavingPlan(true)
    const oldPlan = selectedUser.plan
    const { error } = await supabase.from('profiles').update({ plan: newPlan }).eq('user_id', selectedUser.user_id)
    if (!error) {
      await supabase.from('user_plan_history').insert({
        user_id: selectedUser.user_id,
        old_plan: oldPlan,
        new_plan: newPlan,
        changed_by: adminUser?.id ?? null,
        reason: planReason || null,
      })
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, plan: newPlan } : r))
      setSelectedUser(s => s ? { ...s, plan: newPlan } : s)
      setPlanHistory(prev => [{ id: Date.now().toString(), old_plan: oldPlan, new_plan: newPlan, reason: planReason || null, created_at: new Date().toISOString() }, ...prev])
      setChangingPlan(false)
      setPlanReason('')
    }
    setSavingPlan(false)
  }

  async function saveUnlimitedAccess() {
    if (!selectedUser) return
    setSavingUnlimited(true)
    const updates: Record<string, unknown> = {
      unlimited_access: unlimitedAccessForm.enabled,
      unlimited_access_until: unlimitedAccessForm.until || null,
      unlimited_access_reason: unlimitedAccessForm.reason || null,
    }
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', selectedUser.user_id)
    if (!error) {
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, unlimited_access: unlimitedAccessForm.enabled } : r))
      setSelectedUser(s => s ? { ...s, unlimited_access: unlimitedAccessForm.enabled } : s)
    }
    setSavingUnlimited(false)
  }

  async function saveDiscount() {
    if (!selectedUser) return
    setSavingDiscount(true)
    const { error } = await supabase.from('profiles').update({
      discount_percent: discountForm.discount_percent,
      discount_fixed: discountForm.discount_fixed,
      discount_code: discountForm.discount_code || null,
      discount_until: discountForm.discount_until || null,
      discount_reason: discountForm.discount_reason || null,
    }).eq('user_id', selectedUser.user_id)
    if (!error) {
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id
        ? { ...r, discount_percent: discountForm.discount_percent, discount_fixed: discountForm.discount_fixed }
        : r
      ))
    }
    setSavingDiscount(false)
  }

  async function clearDiscount() {
    if (!selectedUser) return
    setSavingDiscount(true)
    const { error } = await supabase.from('profiles').update({
      discount_percent: 0, discount_fixed: 0,
      discount_code: null, discount_until: null, discount_reason: null,
    }).eq('user_id', selectedUser.user_id)
    if (!error) {
      setDiscountForm({ discount_percent: 0, discount_fixed: 0, discount_code: '', discount_until: '', discount_reason: '' })
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, discount_percent: 0, discount_fixed: 0 } : r))
    }
    setSavingDiscount(false)
  }

  async function blockUser() {
    if (!selectedUser || !blockReason.trim()) return
    setBlockingUser(true)
    const { error } = await supabase.from('profiles').update({
      account_status: 'blocked',
      blocked_at: new Date().toISOString(),
      blocked_by: adminUser?.id ?? null,
      blocked_reason: blockReason,
    }).eq('user_id', selectedUser.user_id)
    if (!error) {
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, account_status: 'blocked' } : r))
      setSelectedUser(s => s ? { ...s, account_status: 'blocked' } : s)
      setShowBlockForm(false)
    }
    setBlockingUser(false)
  }

  async function unblockUser() {
    if (!selectedUser) return
    setBlockingUser(true)
    const { error } = await supabase.from('profiles').update({
      account_status: 'active',
      blocked_at: null, blocked_by: null, blocked_reason: null,
    }).eq('user_id', selectedUser.user_id)
    if (!error) {
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, account_status: 'active' } : r))
      setSelectedUser(s => s ? { ...s, account_status: 'active' } : s)
    }
    setBlockingUser(false)
  }

  async function suspendUser() {
    if (!selectedUser) return
    setBlockingUser(true)
    const { error } = await supabase.from('profiles').update({ account_status: 'suspended' }).eq('user_id', selectedUser.user_id)
    if (!error) {
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, account_status: 'suspended' } : r))
      setSelectedUser(s => s ? { ...s, account_status: 'suspended' } : s)
    }
    setBlockingUser(false)
  }

  async function addTag(tag: string) {
    if (!selectedUser) return
    const currentTags = selectedUser.admin_tags ?? []
    if (currentTags.includes(tag)) return
    const newTags = [...currentTags, tag]
    const { error } = await supabase.from('profiles').update({ admin_tags: newTags }).eq('user_id', selectedUser.user_id)
    if (!error) {
      setSelectedUser(s => s ? { ...s, admin_tags: newTags } : s)
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, admin_tags: newTags } : r))
    }
  }

  async function removeTag(tag: string) {
    if (!selectedUser) return
    const newTags = (selectedUser.admin_tags ?? []).filter(t => t !== tag)
    const { error } = await supabase.from('profiles').update({ admin_tags: newTags }).eq('user_id', selectedUser.user_id)
    if (!error) {
      setSelectedUser(s => s ? { ...s, admin_tags: newTags } : s)
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, admin_tags: newTags } : r))
    }
  }

  async function saveNote() {
    if (!newNote.trim() || !selectedUser || !adminUser) return
    setSavingNote(true)
    const { data, error } = await supabase.from('user_internal_notes').insert({
      user_id: selectedUser.user_id,
      admin_id: adminUser.id,
      note: newNote.trim(),
      is_pinned: notePinned,
      priority: notePriority,
    }).select().single()
    if (!error && data) {
      setUserNotes(prev => [data, ...prev])
      setNewNote('')
      setNotePriority('normal')
      setNotePinned(false)
    }
    setSavingNote(false)
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Excluir nota?')) return
    const { error } = await supabase.from('user_internal_notes').delete().eq('id', noteId)
    if (!error) setUserNotes(prev => prev.filter(n => n.id !== noteId))
  }

  async function togglePinNote(noteId: string, current: boolean) {
    const { error } = await supabase.from('user_internal_notes').update({ is_pinned: !current }).eq('id', noteId)
    if (!error) setUserNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: !current } : n))
  }

  async function sendMsg() {
    if (!msgTitle.trim() || !msgBody.trim() || !selectedUser) return
    setSendingMsg(true)
    setMsgResult(null)
    const result = await sendUserMessage({
      userId: selectedUser.user_id,
      title: msgTitle.trim(),
      message: msgBody.trim(),
      type: msgType,
      createTicket: msgCreateTicket,
      priority: msgPriority,
      category: msgCategory || undefined,
      adminId: adminUser?.id,
    })
    setSendingMsg(false)
    if (result.error) {
      setMsgResult('Erro: ' + result.error)
    } else {
      setMsgResult(result.ticket
        ? `Ticket #${result.ticket.ticket_number} criado e notificação enviada!`
        : 'Notificação enviada!')
      setMsgTitle(''); setMsgBody('')
      setMsgCreateTicket(false)
    }
  }

  const filtered = users.filter(u =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    u.user_id?.toLowerCase().includes(search.toLowerCase())
  )

  const DRAWER_TABS: { key: DrawerTab; label: string }[] = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'plano', label: 'Plano' },
    { key: 'acesso', label: 'Acesso' },
    { key: 'suporte', label: 'Suporte' },
    { key: 'notificacoes', label: 'Notificações' },
    { key: 'uso', label: 'Uso' },
    { key: 'descontos', label: 'Descontos' },
    { key: 'notas', label: 'Notas' },
    { key: 'seguranca', label: 'Segurança' },
  ]

  const notePriorityColors: Record<string, string> = {
    normal: 'bg-stone-100 text-stone-500',
    alta: 'bg-orange-100 text-orange-700',
    urgente: 'bg-red-100 text-red-700',
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className={`flex flex-col flex-1 min-w-0 ${selectedUser ? 'hidden lg:flex' : 'flex'}`}>
        {/* Summary cards */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-100 flex-shrink-0">
          <h1 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Usuários
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-stone-700' },
              { label: 'Novos este mês', value: stats.newThisMonth, color: 'text-emerald-700' },
              { label: 'Pagantes', value: stats.paying, color: 'text-blue-700' },
              { label: 'Bloqueados', value: stats.blocked, color: 'text-red-700' },
              { label: 'Com desconto', value: stats.withDiscount, color: 'text-amber-700' },
              { label: 'Acesso ilimitado', value: stats.unlimitedAccess, color: 'text-emerald-700' },
              { label: 'Tickets abertos', value: stats.openTickets, color: 'text-orange-700' },
              { label: 'Terap. Plus', value: stats.plus, color: 'text-purple-700' },
            ].map(s => (
              <div key={s.label} className="bg-stone-50 border border-stone-100 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou ID..."
                className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
            <div className="flex rounded-lg border border-stone-200 overflow-hidden flex-shrink-0">
              <button
                onClick={() => setViewMode('list')}
                title="Lista"
                className={`px-3 py-2 transition-colors ${viewMode === 'list' ? 'bg-stone-800 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                title="Kanban"
                className={`px-3 py-2 transition-colors ${viewMode === 'kanban' ? 'bg-stone-800 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* List / Kanban */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-stone-50">
              {filtered.map(u => {
                const hasDiscount = (u.discount_percent ?? 0) > 0 || (u.discount_fixed ?? 0) > 0
                const isBlocked = u.account_status === 'blocked'
                const isTrial = u.account_status === 'trial'
                const isPlus = u.plan === 'therapeutic-plus'
                const isUnlimited = u.unlimited_access === true
                return (
                  <button
                    key={u.id}
                    onClick={() => openDrawer(u)}
                    className={`w-full text-left px-6 py-3 hover:bg-stone-50 transition-colors flex items-center gap-3 ${selectedUser?.user_id === u.user_id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-sm font-semibold flex-shrink-0">
                      {(u.full_name ?? 'U')[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-800 truncate">{u.full_name || 'Sem nome'}</p>
                        {u.role === 'admin' && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[u.plan] ?? 'bg-stone-100 text-stone-500'}`}>
                          {PLAN_LABELS[u.plan] ?? u.plan}
                        </span>
                        <span className="text-xs text-stone-400">{timeSince(u.created_at)}</span>
                        {u.account_status && u.account_status !== 'active' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ACCOUNT_STATUS_COLORS[u.account_status] ?? 'bg-stone-100'}`}>
                            {u.account_status}
                          </span>
                        )}
                        {isUnlimited && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Ilimitado</span>}
                        {hasDiscount && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Desconto</span>}
                        {isBlocked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Bloqueado</span>}
                        {isTrial && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Trial</span>}
                        {isPlus && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Plus</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(u.open_tickets ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          <Ticket className="w-3 h-3" />{u.open_tickets}
                        </span>
                      )}
                      {(u.unread_notifs ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          <Bell className="w-3 h-3" />{u.unread_notifs}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-stone-300" />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Kanban view — columns by plan */
            <div className="flex gap-3 p-4 h-full overflow-x-auto items-start">
              {KANBAN_COLUMNS.map(col => {
                const colUsers = filtered.filter(u => u.plan === col.key)
                return (
                  <div key={col.key} className={`flex flex-col rounded-xl border-2 ${col.color} min-w-[220px] w-[220px] flex-shrink-0`}>
                    {/* Column header */}
                    <div className="px-3 py-2 flex items-center justify-between border-b border-black/10">
                      <span className="text-xs font-semibold text-stone-700">{col.label}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${col.badge}`}>{colUsers.length}</span>
                    </div>
                    {/* Cards */}
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
                            onClick={() => openDrawer(u)}
                            className={`w-full text-left bg-white rounded-lg border px-3 py-2.5 hover:shadow-md transition-shadow ${selectedUser?.user_id === u.user_id ? 'ring-2 ring-blue-400 border-blue-200' : 'border-stone-100'}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-xs font-bold flex-shrink-0">
                                {(u.full_name ?? 'U')[0]?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-stone-800 truncate leading-tight">
                                  {u.full_name || 'Sem nome'}
                                </p>
                                <p className="text-[10px] text-stone-400">{timeSince(u.created_at)}</p>
                              </div>
                              {u.role === 'admin' && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {isBlocked && <span className="text-[10px] px-1.5 rounded-full bg-red-100 text-red-700 font-medium">Bloqueado</span>}
                              {isSuspended && <span className="text-[10px] px-1.5 rounded-full bg-orange-100 text-orange-700 font-medium">Suspenso</span>}
                              {isUnlimited && <span className="text-[10px] px-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Ilimitado</span>}
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
          )}
        </div>
      </div>

      {/* Drawer */}
      {selectedUser && (
        <div className="flex flex-col w-full lg:w-[560px] border-l border-stone-100 bg-white flex-shrink-0 overflow-hidden">
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-stone-100 flex-shrink-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-stone-800">{selectedUser.full_name || 'Sem nome'}</p>
                  {selectedUser.role === 'admin' && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                <p className="text-xs text-stone-400 font-mono truncate max-w-[240px]">{selectedUser.user_id}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[selectedUser.plan] ?? 'bg-stone-100'}`}>
                    {PLAN_LABELS[selectedUser.plan] ?? selectedUser.plan}
                  </span>
                  {selectedUser.account_status && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ACCOUNT_STATUS_COLORS[selectedUser.account_status] ?? 'bg-stone-100'}`}>
                      {selectedUser.account_status}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={closeDrawer} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 flex-wrap">
              {DRAWER_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setDrawerTab(t.key)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${drawerTab === t.key ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drawer content */}
          <div className="flex-1 overflow-y-auto p-5">
            {loadingDrawer ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <>
                {/* Tab: Resumo */}
                {drawerTab === 'resumo' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Nome', selectedUser.full_name || '—'],
                        ['Plano', PLAN_LABELS[selectedUser.plan] ?? selectedUser.plan],
                        ['Perfil', selectedUser.role === 'admin' ? 'Admin' : 'Usuário'],
                        ['Cadastro', new Date(selectedUser.created_at).toLocaleDateString('pt-BR')],
                        ['Desde', timeSince(selectedUser.created_at)],
                        ['Status', selectedUser.account_status ?? 'active'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                          <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
                          <p className="text-sm font-medium text-stone-800">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Benefit badges */}
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.unlimited_access && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">Acesso ilimitado</span>
                      )}
                      {((selectedUser.discount_percent ?? 0) > 0 || (selectedUser.discount_fixed ?? 0) > 0) && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                          Desconto {selectedUser.discount_percent ?? 0}%
                          {(selectedUser.discount_fixed ?? 0) > 0 ? ` / R$${selectedUser.discount_fixed}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Admin tags */}
                    <div>
                      <p className="text-xs text-stone-500 mb-2 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags administrativas</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(selectedUser.admin_tags ?? []).map(tag => (
                          <span key={tag} className="flex items-center gap-1 text-xs bg-stone-100 text-stone-700 px-2 py-1 rounded-full">
                            {tag}
                            <button onClick={() => removeTag(tag)} className="text-stone-400 hover:text-red-500 ml-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <select
                        onChange={e => { if (e.target.value) { addTag(e.target.value); e.target.value = '' } }}
                        defaultValue=""
                        className="text-xs px-2 py-1.5 border border-stone-200 rounded-lg bg-white focus:outline-none"
                      >
                        <option value="">Adicionar tag...</option>
                        {PREDEFINED_TAGS.filter(t => !(selectedUser.admin_tags ?? []).includes(t)).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Admin toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedUser.role === 'admin'}
                        onChange={e => setAdmin(selectedUser.user_id, e.target.checked)}
                        className="accent-stone-800"
                        id="admin-toggle"
                      />
                      <label htmlFor="admin-toggle" className="text-sm text-stone-700 cursor-pointer flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Acesso de administrador
                      </label>
                    </div>
                  </div>
                )}

                {/* Tab: Plano */}
                {drawerTab === 'plano' && (
                  <div className="space-y-4">
                    <div className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium ${PLAN_COLORS[selectedUser.plan] ?? 'bg-stone-100'}`}>
                      <Crown className="w-3.5 h-3.5" />
                      {PLAN_LABELS[selectedUser.plan] ?? selectedUser.plan}
                    </div>

                    {!changingPlan ? (
                      <button
                        onClick={() => setChangingPlan(true)}
                        className="flex items-center gap-2 text-sm bg-stone-800 text-white px-4 py-2 rounded-lg hover:bg-stone-700"
                      >
                        Alterar plano
                      </button>
                    ) : (
                      <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-stone-700">Alterar plano</p>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Novo plano</label>
                          <select value={newPlan} onChange={e => setNewPlan(e.target.value)} className={inputCls}>
                            {Object.entries(PLAN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Motivo (opcional)</label>
                          <input value={planReason} onChange={e => setPlanReason(e.target.value)} placeholder="Motivo da alteração..." className={inputCls} />
                        </div>
                        <p className="text-[10px] text-stone-400">Integração com checkout real depende do Stripe/Mercado Pago.</p>
                        <div className="flex gap-2">
                          <button onClick={handlePlanChange} disabled={savingPlan} className="text-sm bg-stone-800 text-white px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50">
                            {savingPlan ? 'Salvando...' : 'Confirmar alteração'}
                          </button>
                          <button onClick={() => setChangingPlan(false)} className="text-sm border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
                        </div>
                      </div>
                    )}

                    {planHistory.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-stone-700 mb-2">Histórico de planos</p>
                        <div className="space-y-2">
                          {planHistory.map(h => (
                            <div key={h.id} className="bg-stone-50 border border-stone-100 rounded-xl p-3">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-stone-400">{PLAN_LABELS[h.old_plan ?? ''] ?? h.old_plan ?? '—'}</span>
                                <span className="text-stone-300">→</span>
                                <span className="font-medium text-stone-800">{PLAN_LABELS[h.new_plan ?? ''] ?? h.new_plan ?? '—'}</span>
                              </div>
                              {h.reason && <p className="text-xs text-stone-400 mt-0.5">{h.reason}</p>}
                              <p className="text-xs text-stone-300 mt-0.5">{new Date(h.created_at).toLocaleDateString('pt-BR')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Acesso */}
                {drawerTab === 'acesso' && (
                  <div className="space-y-4">
                    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Acesso ilimitado</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="unlimited-toggle"
                          checked={unlimitedAccessForm.enabled}
                          onChange={e => setUnlimitedAccessForm(f => ({ ...f, enabled: e.target.checked }))}
                          className="accent-stone-800"
                        />
                        <label htmlFor="unlimited-toggle" className="text-sm text-stone-700 cursor-pointer">Ativar acesso ilimitado</label>
                      </div>
                      {unlimitedAccessForm.enabled && (
                        <>
                          <div>
                            <label className="block text-xs text-stone-500 mb-1">Válido até (opcional)</label>
                            <input type="date" value={unlimitedAccessForm.until} onChange={e => setUnlimitedAccessForm(f => ({ ...f, until: e.target.value }))} className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-xs text-stone-500 mb-1">Motivo</label>
                            <input value={unlimitedAccessForm.reason} onChange={e => setUnlimitedAccessForm(f => ({ ...f, reason: e.target.value }))} placeholder="Motivo..." className={inputCls} />
                          </div>
                        </>
                      )}
                      <button onClick={saveUnlimitedAccess} disabled={savingUnlimited} className="text-sm bg-stone-800 text-white px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50">
                        {savingUnlimited ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-stone-700 mb-3">Recursos desbloqueados pelo plano</p>
                      <div className="space-y-1 text-xs text-stone-500">
                        {selectedUser.plan === 'free' && <p>Acesso básico: artigos públicos, diário limitado</p>}
                        {selectedUser.plan === 'essential' && <p>Acesso essencial: diário completo, questionários, artigos premium</p>}
                        {selectedUser.plan === 'therapeutic' && <p>Acesso terapêutico: todos os recursos + trilhas + exportação</p>}
                        {selectedUser.plan === 'therapeutic-plus' && <p>Acesso Plus: todos os recursos + suporte prioritário + atendimento exclusivo</p>}
                        {selectedUser.unlimited_access && <p className="text-emerald-700 font-medium">Acesso ilimitado ativo — sem restrições</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Suporte */}
                {drawerTab === 'suporte' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowMsgModal(true)}
                        className="flex items-center gap-1.5 text-xs bg-stone-800 text-white px-3 py-2 rounded-lg hover:bg-stone-700"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Enviar mensagem
                      </button>
                    </div>
                    {userTickets.length === 0 ? (
                      <div className="text-center py-10 text-stone-400">
                        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum ticket.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {userTickets.map(t => (
                          <div key={t.id} className="bg-stone-50 border border-stone-100 rounded-xl p-3">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs text-stone-400 font-mono">#{t.ticket_number}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? 'bg-stone-100'}`}>
                                {STATUS_LABELS[t.status] ?? t.status}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-stone-800 truncate">{t.subject}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{new Date(t.updated_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Notificações */}
                {drawerTab === 'notificacoes' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowMsgModal(true)}
                      className="flex items-center gap-1.5 text-xs bg-stone-800 text-white px-3 py-2 rounded-lg hover:bg-stone-700"
                    >
                      <Bell className="w-3.5 h-3.5" /> Enviar notificação
                    </button>
                    {userNotifs.length === 0 ? (
                      <div className="text-center py-10 text-stone-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhuma notificação.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {userNotifs.map(n => (
                          <div key={n.id} className={`rounded-xl p-3 border ${n.is_read ? 'bg-stone-50 border-stone-100' : 'bg-blue-50 border-blue-100'}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{TYPE_LABELS[n.type] ?? n.type}</span>
                              {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                            </div>
                            <p className="text-sm font-medium text-stone-800">{n.title}</p>
                            <p className="text-xs text-stone-400">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Uso */}
                {drawerTab === 'uso' && (
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'Entradas no diário', value: metrics.diary, icon: <FileText className="w-5 h-5 text-emerald-600" /> },
                      { label: 'Itens salvos', value: metrics.saved, icon: <Bell className="w-5 h-5 text-blue-600" /> },
                      { label: 'Questionários respondidos', value: metrics.questionnaires, icon: <MessageCircle className="w-5 h-5 text-purple-600" /> },
                      { label: 'Tickets de suporte', value: metrics.tickets, icon: <Ticket className="w-5 h-5 text-orange-600" /> },
                      { label: 'Notificações não lidas', value: metrics.unreadNotifs, icon: <Bell className="w-5 h-5 text-red-500" /> },
                    ].map(m => (
                      <div key={m.label} className="bg-stone-50 border border-stone-100 rounded-xl p-4 flex items-center gap-3">
                        {m.icon}
                        <div>
                          <p className="text-2xl font-bold text-stone-800">{m.value}</p>
                          <p className="text-xs text-stone-500">{m.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Descontos */}
                {drawerTab === 'descontos' && (
                  <div className="space-y-4">
                    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Desconto administrativo</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Desconto % (0-100)</label>
                          <input
                            type="number" min="0" max="100"
                            value={discountForm.discount_percent}
                            onChange={e => setDiscountForm(f => ({ ...f, discount_percent: Number(e.target.value) }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Desconto fixo (R$)</label>
                          <input
                            type="number" min="0"
                            value={discountForm.discount_fixed}
                            onChange={e => setDiscountForm(f => ({ ...f, discount_fixed: Number(e.target.value) }))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Código</label>
                        <input value={discountForm.discount_code} onChange={e => setDiscountForm(f => ({ ...f, discount_code: e.target.value }))} placeholder="CUPOM123" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Válido até</label>
                        <input type="date" value={discountForm.discount_until} onChange={e => setDiscountForm(f => ({ ...f, discount_until: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Motivo</label>
                        <input value={discountForm.discount_reason} onChange={e => setDiscountForm(f => ({ ...f, discount_reason: e.target.value }))} placeholder="Motivo do desconto..." className={inputCls} />
                      </div>
                      <p className="text-[10px] text-stone-400">Desconto administrativo registrado. Integração com cobrança real depende do checkout.</p>
                      <div className="flex gap-2">
                        <button onClick={saveDiscount} disabled={savingDiscount} className="text-sm bg-stone-800 text-white px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50">
                          {savingDiscount ? 'Salvando...' : 'Salvar desconto'}
                        </button>
                        <button onClick={clearDiscount} disabled={savingDiscount} className="text-sm border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50">
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Notas */}
                {drawerTab === 'notas' && (
                  <div className="space-y-4">
                    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Adicionar nota interna</p>
                      <textarea
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Nota interna sobre este usuário..."
                        rows={3}
                        className={inputCls + ' resize-none'}
                      />
                      <div className="flex gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-stone-500">Prioridade:</label>
                          <select value={notePriority} onChange={e => setNotePriority(e.target.value)} className="text-xs px-2 py-1 border border-stone-200 rounded-lg bg-white">
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="pin-note" checked={notePinned} onChange={e => setNotePinned(e.target.checked)} className="accent-stone-800" />
                          <label htmlFor="pin-note" className="text-xs text-stone-700 cursor-pointer">Fixar</label>
                        </div>
                      </div>
                      <button
                        onClick={saveNote}
                        disabled={savingNote || !newNote.trim()}
                        className="flex items-center gap-2 text-sm bg-stone-800 text-white px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {savingNote ? 'Salvando...' : 'Adicionar nota'}
                      </button>
                    </div>
                    {userNotes.length === 0 ? (
                      <p className="text-sm text-stone-400 text-center py-4">Nenhuma nota ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {userNotes.map(n => (
                          <div key={n.id} className={`bg-amber-50 border rounded-xl p-3 ${n.is_pinned ? 'border-amber-300' : 'border-amber-100'}`}>
                            {n.is_pinned && <p className="text-[10px] text-amber-600 font-semibold mb-1">Fixado</p>}
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-stone-800 whitespace-pre-wrap flex-1">{n.note}</p>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={() => togglePinNote(n.id, n.is_pinned)}
                                  className="text-xs text-stone-400 hover:text-amber-600 px-1.5 py-0.5 rounded"
                                  title={n.is_pinned ? 'Desafixar' : 'Fixar'}
                                >
                                  {n.is_pinned ? '📌' : '📍'}
                                </button>
                                <button onClick={() => deleteNote(n.id)} className="text-xs text-stone-400 hover:text-red-500 px-1.5 py-0.5 rounded">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {n.priority !== 'normal' && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${notePriorityColors[n.priority] ?? 'bg-stone-100'}`}>
                                  {n.priority}
                                </span>
                              )}
                              <span className="text-xs text-stone-400">{new Date(n.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Segurança */}
                {drawerTab === 'seguranca' && (
                  <div className="space-y-4">
                    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-stone-700 mb-3">Status da conta</p>
                      <div className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium mb-4 ${ACCOUNT_STATUS_COLORS[selectedUser.account_status ?? 'active'] ?? 'bg-stone-100'}`}>
                        <Shield className="w-3.5 h-3.5" />
                        {selectedUser.account_status ?? 'active'}
                      </div>

                      {selectedUser.account_status === 'active' || !selectedUser.account_status ? (
                        <div className="space-y-3">
                          {!showBlockForm ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowBlockForm(true)}
                                className="text-sm border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50"
                              >
                                Bloquear usuário
                              </button>
                              <button
                                onClick={suspendUser}
                                disabled={blockingUser}
                                className="text-sm border border-orange-200 text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 disabled:opacity-50"
                              >
                                Suspender
                              </button>
                            </div>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                              <p className="text-xs font-semibold text-red-700">Confirmar bloqueio</p>
                              <div>
                                <label className="block text-xs text-red-600 mb-1">Motivo obrigatório</label>
                                <input
                                  value={blockReason}
                                  onChange={e => setBlockReason(e.target.value)}
                                  placeholder="Motivo do bloqueio..."
                                  className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={blockUser}
                                  disabled={blockingUser || !blockReason.trim()}
                                  className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                  {blockingUser ? 'Bloqueando...' : 'Confirmar bloqueio'}
                                </button>
                                <button onClick={() => setShowBlockForm(false)} className="text-sm border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <button
                            onClick={unblockUser}
                            disabled={blockingUser}
                            className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {blockingUser ? 'Desbloqueando...' : 'Desbloquear usuário'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Send message modal */}
      {showMsgModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-800">Enviar mensagem para {selectedUser.full_name || 'usuário'}</h3>
              <button onClick={() => { setShowMsgModal(false); setMsgResult(null) }} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Título</label>
              <input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="Assunto..." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Mensagem</label>
              <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={4} placeholder="Texto..." className={inputCls + ' resize-none'} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tipo</label>
              <select value={msgType} onChange={e => setMsgType(e.target.value)} className={inputCls}>
                <option value="info">Informativo</option>
                <option value="admin_message">Mensagem do admin</option>
                <option value="support_reply">Resposta de suporte</option>
                <option value="alert">Alerta</option>
                <option value="promo">Promoção</option>
                <option value="reminder">Lembrete</option>
                <option value="system">Sistema</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="modal-create-ticket" checked={msgCreateTicket} onChange={e => setMsgCreateTicket(e.target.checked)} className="accent-stone-800" />
              <label htmlFor="modal-create-ticket" className="text-sm text-stone-700 cursor-pointer">Criar ticket de suporte</label>
            </div>
            {msgCreateTicket && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Prioridade</label>
                  <select value={msgPriority} onChange={e => setMsgPriority(e.target.value)} className={inputCls}>
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Categoria</label>
                  <input value={msgCategory} onChange={e => setMsgCategory(e.target.value)} placeholder="Ex: pagamento" className={inputCls} />
                </div>
              </div>
            )}
            {msgResult && (
              <div className={`text-sm px-3 py-2 rounded-lg border ${msgResult.startsWith('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                {msgResult}
              </div>
            )}
            <button
              onClick={sendMsg}
              disabled={sendingMsg || !msgTitle.trim() || !msgBody.trim()}
              className="w-full bg-stone-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {sendingMsg ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
