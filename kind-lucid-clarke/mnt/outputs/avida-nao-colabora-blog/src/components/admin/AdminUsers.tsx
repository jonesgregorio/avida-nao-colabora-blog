import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { sendUserMessage } from '../../lib/messaging'
import {
  Search, X, Users, Crown, MessageCircle, Bell, FileText,
  ChevronRight, Plus, Ticket,
} from 'lucide-react'

interface UserRow {
  id: string
  user_id: string
  full_name: string | null
  plan: string
  role: string | null
  created_at: string
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
  created_at: string
}

interface MetricRow {
  diary_entries: number
  saved_items: number
  questionnaire_responses: number
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em andamento', awaiting_admin: 'Aguard. admin',
  awaiting_user: 'Aguard. cliente', resolved: 'Resolvido', closed: 'Fechado',
}
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700', in_progress: 'bg-orange-100 text-orange-700',
  awaiting_admin: 'bg-yellow-100 text-yellow-700', awaiting_user: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700', closed: 'bg-stone-100 text-stone-500',
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

type DrawerTab = 'resumo' | 'suporte' | 'notificacoes' | 'notas' | 'metricas' | 'mensagem'

export default function AdminUsers() {
  const { user: adminUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('resumo')

  // Drawer data
  const [userTickets, setUserTickets] = useState<TicketRow[]>([])
  const [userNotifs, setUserNotifs] = useState<NotifRow[]>([])
  const [userNotes, setUserNotes] = useState<NoteRow[]>([])
  const [userMetrics, setUserMetrics] = useState<MetricRow | null>(null)
  const [loadingDrawer, setLoadingDrawer] = useState(false)

  // Notes
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Send message
  const [msgTitle, setMsgTitle] = useState('')
  const [msgBody, setMsgBody] = useState('')
  const [msgType, setMsgType] = useState('admin_message')
  const [msgCreateTicket, setMsgCreateTicket] = useState(false)
  const [msgPriority, setMsgPriority] = useState('medium')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgResult, setMsgResult] = useState<string | null>(null)

  // Summary stats
  const [stats, setStats] = useState({ total: 0, free: 0, essential: 0, therapeutic: 0, plus: 0, newLast7: 0, withTickets: 0 })

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, plan, role, created_at')
      .order('created_at', { ascending: false })

    if (!profileData) { setLoading(false); return }

    // Get open ticket counts
    const userIds = profileData.map(p => p.user_id)
    const { data: ticketData } = userIds.length > 0
      ? await supabase.from('support_tickets').select('user_id').in('user_id', userIds).eq('status', 'open')
      : { data: [] }

    const { data: notifData } = userIds.length > 0
      ? await supabase.from('notifications').select('user_id').in('user_id', userIds).eq('is_read', false)
      : { data: [] }

    const ticketMap = new Map<string, number>()
    for (const t of (ticketData || [])) ticketMap.set(t.user_id, (ticketMap.get(t.user_id) ?? 0) + 1)

    const notifMap = new Map<string, number>()
    for (const n of (notifData || [])) notifMap.set(n.user_id, (notifMap.get(n.user_id) ?? 0) + 1)

    const rows: UserRow[] = profileData.map(p => ({
      ...p,
      open_tickets: ticketMap.get(p.user_id) ?? 0,
      unread_notifs: notifMap.get(p.user_id) ?? 0,
    }))

    setUsers(rows)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const usersWithTickets = new Set((ticketData || []).map(t => t.user_id)).size
    setStats({
      total: rows.length,
      free: rows.filter(r => r.plan === 'free').length,
      essential: rows.filter(r => r.plan === 'essential').length,
      therapeutic: rows.filter(r => r.plan === 'therapeutic').length,
      plus: rows.filter(r => r.plan === 'therapeutic-plus').length,
      newLast7: rows.filter(r => r.created_at >= sevenDaysAgo).length,
      withTickets: usersWithTickets,
    })

    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function loadDrawerData(userId: string) {
    setLoadingDrawer(true)
    const [ticketRes, notifRes, noteRes, diaryRes, savedRes, qRes] = await Promise.all([
      supabase.from('support_tickets').select('id, ticket_number, subject, status, priority, updated_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('notifications').select('id, title, type, is_read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('user_internal_notes').select('id, note, admin_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    setUserTickets(ticketRes.data || [])
    setUserNotifs(notifRes.data || [])
    setUserNotes(noteRes.data || [])
    setUserMetrics({
      diary_entries: diaryRes.count ?? 0,
      saved_items: savedRes.count ?? 0,
      questionnaire_responses: qRes.count ?? 0,
    })
    setLoadingDrawer(false)
  }

  function openDrawer(u: UserRow) {
    setSelectedUser(u)
    setDrawerTab('resumo')
    setMsgTitle(''); setMsgBody(''); setMsgType('admin_message')
    setMsgCreateTicket(false); setMsgPriority('medium'); setMsgResult(null)
    setNewNote('')
    loadDrawerData(u.user_id)
  }

  function closeDrawer() {
    setSelectedUser(null)
  }

  async function updatePlan(userId: string, plan: string) {
    await supabase.from('profiles').update({ plan }).eq('user_id', userId)
    setUsers(u => u.map(r => r.user_id === userId ? { ...r, plan } : r))
    if (selectedUser?.user_id === userId) setSelectedUser(s => s ? { ...s, plan } : s)
  }

  async function setAdmin(userId: string, isAdmin: boolean) {
    await supabase.from('profiles').update({ role: isAdmin ? 'admin' : null }).eq('user_id', userId)
    setUsers(u => u.map(r => r.user_id === userId ? { ...r, role: isAdmin ? 'admin' : null } : r))
  }

  async function saveNote() {
    if (!newNote.trim() || !selectedUser || !adminUser) return
    setSavingNote(true)
    const { data } = await supabase.from('user_internal_notes').insert({
      user_id: selectedUser.user_id,
      admin_id: adminUser.id,
      note: newNote.trim(),
    }).select().single()
    if (data) setUserNotes(prev => [data, ...prev])
    setNewNote('')
    setSavingNote(false)
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
      adminId: adminUser?.id,
    })
    setSendingMsg(false)
    if (result.error) {
      setMsgResult('Erro: ' + result.error)
    } else {
      setMsgResult(result.ticket ? `Ticket #${result.ticket.ticket_number} criado e notificação enviada!` : 'Notificação enviada!')
      setMsgTitle(''); setMsgBody('')
    }
  }

  const filtered = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.user_id?.toLowerCase().includes(search.toLowerCase())
  )

  const DRAWER_TABS: { key: DrawerTab; label: string }[] = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'suporte', label: 'Suporte' },
    { key: 'notificacoes', label: 'Notificações' },
    { key: 'notas', label: 'Notas' },
    { key: 'metricas', label: 'Métricas' },
    { key: 'mensagem', label: 'Enviar msg' },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ── */}
      <div className={`flex flex-col flex-1 min-w-0 ${selectedUser ? 'hidden lg:flex' : 'flex'}`}>
        {/* Stats */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-100 flex-shrink-0">
          <h1 className="text-xl font-bold text-stone-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Usuários
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-stone-700' },
              { label: 'Novos (7d)', value: stats.newLast7, color: 'text-emerald-700' },
              { label: 'Com tickets', value: stats.withTickets, color: 'text-blue-700' },
              { label: 'Gratuito', value: stats.free, color: 'text-stone-500' },
            ].map(s => (
              <div key={s.label} className="bg-stone-50 border border-stone-100 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou ID..."
              className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y divide-stone-50">
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => openDrawer(u)}
                  className={`w-full text-left px-6 py-3 hover:bg-stone-50 transition-colors flex items-center gap-3 ${selectedUser?.user_id === u.user_id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-stone-800 truncate">{u.full_name || 'Sem nome'}</p>
                      {u.role === 'admin' && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-stone-400">{PLAN_LABELS[u.plan] ?? u.plan}</span>
                      <span className="text-stone-300 text-xs">·</span>
                      <span className="text-xs text-stone-400">{new Date(u.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer ── */}
      {selectedUser && (
        <div className="flex flex-col w-full lg:w-[520px] xl:w-[600px] border-l border-stone-100 bg-white flex-shrink-0">
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-stone-100 flex-shrink-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-stone-800">{selectedUser.full_name || 'Sem nome'}</p>
                <p className="text-xs text-stone-400 font-mono">{selectedUser.user_id}</p>
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
                {/* Resumo */}
                {drawerTab === 'resumo' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Nome', selectedUser.full_name || '—'],
                        ['Plano', PLAN_LABELS[selectedUser.plan] ?? selectedUser.plan],
                        ['Perfil', selectedUser.role === 'admin' ? 'Admin' : 'Usuário'],
                        ['Cadastro', new Date(selectedUser.created_at).toLocaleDateString('pt-BR')],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                          <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
                          <p className="text-sm font-medium text-stone-800">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Plano</label>
                      <select
                        value={selectedUser.plan}
                        onChange={e => updatePlan(selectedUser.user_id, e.target.value)}
                        className={inputCls}
                      >
                        {Object.entries(PLAN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedUser.role === 'admin'}
                        onChange={e => setAdmin(selectedUser.user_id, e.target.checked)}
                        className="accent-stone-800"
                        id="admin-toggle"
                      />
                      <label htmlFor="admin-toggle" className="text-sm text-stone-700 cursor-pointer">
                        Acesso de administrador
                      </label>
                    </div>
                  </div>
                )}

                {/* Suporte */}
                {drawerTab === 'suporte' && (
                  <div className="space-y-2">
                    {userTickets.length === 0 ? (
                      <div className="text-center py-10 text-stone-400">
                        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum ticket.</p>
                      </div>
                    ) : userTickets.map(t => (
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

                {/* Notificações */}
                {drawerTab === 'notificacoes' && (
                  <div className="space-y-2">
                    {userNotifs.length === 0 ? (
                      <div className="text-center py-10 text-stone-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhuma notificação.</p>
                      </div>
                    ) : userNotifs.map(n => (
                      <div key={n.id} className={`rounded-xl p-3 border ${n.is_read ? 'bg-stone-50 border-stone-100' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-stone-500">{n.type}</span>
                          {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                        </div>
                        <p className="text-sm font-medium text-stone-800">{n.title}</p>
                        <p className="text-xs text-stone-400">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notas internas */}
                {drawerTab === 'notas' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <textarea
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Adicionar nota interna sobre este usuário..."
                        rows={3}
                        className={inputCls + ' resize-none'}
                      />
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
                          <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                            <p className="text-sm text-stone-800 whitespace-pre-wrap">{n.note}</p>
                            <p className="text-xs text-stone-400 mt-1">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Métricas */}
                {drawerTab === 'metricas' && userMetrics && (
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'Entradas no diário', value: userMetrics.diary_entries, icon: <FileText className="w-5 h-5 text-emerald-600" /> },
                      { label: 'Itens salvos', value: userMetrics.saved_items, icon: <Bell className="w-5 h-5 text-blue-600" /> },
                      { label: 'Questionários respondidos', value: userMetrics.questionnaire_responses, icon: <MessageCircle className="w-5 h-5 text-purple-600" /> },
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

                {/* Enviar mensagem */}
                {drawerTab === 'mensagem' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">Título</label>
                      <input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="Assunto da mensagem..." className={inputCls} />
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
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={msgCreateTicket}
                        onChange={e => setMsgCreateTicket(e.target.checked)}
                        className="accent-stone-800"
                        id="create-ticket-toggle"
                      />
                      <label htmlFor="create-ticket-toggle" className="text-sm text-stone-700 cursor-pointer">
                        Criar ticket de suporte
                      </label>
                    </div>
                    {msgCreateTicket && (
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Prioridade do ticket</label>
                        <select value={msgPriority} onChange={e => setMsgPriority(e.target.value)} className={inputCls}>
                          <option value="low">Baixa</option>
                          <option value="medium">Média</option>
                          <option value="high">Alta</option>
                          <option value="urgent">Urgente</option>
                        </select>
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
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
