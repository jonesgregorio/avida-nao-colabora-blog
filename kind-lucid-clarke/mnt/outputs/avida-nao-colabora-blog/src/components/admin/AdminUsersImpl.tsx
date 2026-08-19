import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { sendUserMessage } from '../../lib/messaging'
import { logAdminAction } from '../../lib/adminAudit'
import { createUserNotification } from '../../lib/notifications'
import { generateUserProfileSummary, type UserProfileData } from '../../lib/aiContent'
import {
  X, Crown, Bell, FileText, MessageCircle, Plus, Ticket, Shield, Tag,
  Brain, Loader2, Copy, Save, RefreshCw, AlertTriangle, Mail, ChevronDown,
} from 'lucide-react'
import { normalizePlan, OFFICIAL_PLANS } from '../../lib/officialPlans'
import { PLAN_LABELS } from '../../lib/planConstants'
import { ADMIN_INPUT_CLASS as inputCls } from '../../lib/styleConstants'
import AdminSubscriptionPanel from './AdminSubscriptionPanel'
import AdminSendUserEmail from './AdminSendUserEmail'
import AdminUsersOverview from './AdminUsersOverview'
import {
  ACCOUNT_STATUS_COLORS,
  DRAWER_TABS,
  NOTE_PRIORITY_COLORS,
  PLAN_COLORS,
  PREDEFINED_TAGS,
  STATUS_COLORS,
  STATUS_LABELS,
  TYPE_LABELS,
  buildAdminUsersCsv,
  filterAdminUsers,
  resolveTabFilter,
  timeSince,
  type AdminSubscription,
  type AISummaryRow,
  type DrawerTab,
  type EmailLogRow,
  type NoteRow,
  type NotifRow,
  type PlanHistoryRow,
  type TicketRow,
  type UserRow,
  type ViewMode,
} from './adminUsersModel'

export default function AdminUsers({ initialUserId }: { initialUserId?: string | null }) {
  const { user: adminUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAccess, setFilterAccess] = useState('all') // discount / unlimited / tickets…
  const [exporting, setExporting] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('resumo')

  // Drawer data
  const [adminSub, setAdminSub] = useState<AdminSubscription | null>(null)
  const [adminSubPlan, setAdminSubPlan] = useState('')
  const [adminSubActing, setAdminSubActing] = useState(false)
  const [adminSubMsg, setAdminSubMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [userTickets, setUserTickets] = useState<TicketRow[]>([])
  const [userNotifs, setUserNotifs] = useState<NotifRow[]>([])
  const [userNotes, setUserNotes] = useState<NoteRow[]>([])
  const [planHistory, setPlanHistory] = useState<PlanHistoryRow[]>([])
  const [metrics, setMetrics] = useState({ diary: 0, saved: 0, questionnaires: 0, tickets: 0, unreadNotifs: 0 })
  const [userGuidance, setUserGuidance] = useState<{ id: string; month_key: string; status: string; created_at: string; message: string | null }[]>([])
  const [lastDiary, setLastDiary] = useState<string | null>(null)
  const [loadingDrawer, setLoadingDrawer] = useState(false)
  // Comunicação: e-mails manuais enviados pelo admin a este usuário
  const [emailHistory, setEmailHistory] = useState<EmailLogRow[]>([])
  const [loadingEmailHistory, setLoadingEmailHistory] = useState(false)
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Summary stats
  const [stats, setStats] = useState({
    total: 0, newThisMonth: 0, paying: 0, blocked: 0,
    withDiscount: 0, unlimitedAccess: 0, openTickets: 0,
    plus: 0, essential: 0, free: 0, cancelled: 0,
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
  const [discountMsg, setDiscountMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Block/unblock
  const [blockReason, setBlockReason] = useState('')
  const [blockingUser, setBlockingUser] = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)

  // Auth ops
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [authOpResult, setAuthOpResult] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [savingAuthOp, setSavingAuthOp] = useState(false)

  // Resumo inteligente
  const [aiSummaries, setAiSummaries] = useState<AISummaryRow[]>([])
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiCurrentSummary, setAiCurrentSummary] = useState<string>('')
  const [aiSaving, setAiSaving] = useState(false)
  const [aiExtraMetrics, setAiExtraMetrics] = useState({
    guidanceCount: 0, guidancePending: 0,
    commentsCount: 0, reportsCount: 0, topTags: [] as string[], avgMood: 0,
  })
  const [aiExtraLoaded, setAiExtraLoaded] = useState(false)
  const [aiMsg, setAiMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
      .select('id, user_id, full_name, email, plan, role, created_at, account_status, unlimited_access, unlimited_access_until, unlimited_access_reason, discount_percent, discount_fixed, admin_tags, last_seen_at')
      .order('created_at', { ascending: false })

    if (!profileData) { setLoading(false); return }

    const userIds = profileData.map((p: UserRow) => p.user_id)
    const [ticketRes, notifRes, openTicketCountRes, lastDiaryRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('support_tickets').select('user_id').in('user_id', userIds).not('status', 'in', '("closed","resolved")')
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from('notifications').select('user_id').in('user_id', userIds).eq('is_read', false)
        : Promise.resolve({ data: [] }),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).not('status', 'in', '("closed","resolved")'),
      userIds.length > 0
        ? supabase.from('diary_entries').select('user_id, created_at').in('user_id', userIds).order('created_at', { ascending: false }).limit(1000)
        : Promise.resolve({ data: [] }),
    ])

    const ticketData = ticketRes.data || []
    const notifData = notifRes.data || []

    const ticketMap = new Map<string, number>()
    for (const t of ticketData) ticketMap.set(t.user_id, (ticketMap.get(t.user_id) ?? 0) + 1)
    const notifMap = new Map<string, number>()
    for (const n of notifData) notifMap.set(n.user_id, (notifMap.get(n.user_id) ?? 0) + 1)
    const lastDiaryMap = new Map<string, string>()
    for (const e of lastDiaryRes.data ?? []) {
      if (!lastDiaryMap.has(e.user_id)) lastDiaryMap.set(e.user_id, e.created_at)
    }

    // Atividade = o mais recente entre "esteve no site" (last_seen_at, tocado a
    // cada login/boot) e "escreveu no diário". Só olhar diary_entries deixava
    // "Sem registros" pra quase todo mundo — a maioria acessa (lê conteúdo, vê
    // o mapa emocional) sem necessariamente escrever no diário naquele dia.
    const rows: UserRow[] = profileData.map((p: UserRow) => {
      const seen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0
      const diary = lastDiaryMap.has(p.user_id) ? new Date(lastDiaryMap.get(p.user_id)!).getTime() : 0
      const latest = Math.max(seen, diary)
      return {
        ...p,
        open_tickets: ticketMap.get(p.user_id) ?? 0,
        unread_notifs: notifMap.get(p.user_id) ?? 0,
        last_activity: latest > 0 ? new Date(latest).toISOString() : null,
      }
    })

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
      plus: rows.filter(r => r.plan === 'plus' || r.plan === 'therapeutic-plus' || r.plan === 'therapeutic').length,
      essential: rows.filter(r => r.plan === 'essential').length,
      free: rows.filter(r => r.plan === 'free').length,
      cancelled: rows.filter(r => r.account_status === 'cancelled').length,
    })

    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Abre drawer automaticamente quando vindo de outra página (ex: "Ver perfil" no Suporte)
  const pendingOpenRef = useRef<string | null>(null)
  useEffect(() => {
    if (initialUserId) pendingOpenRef.current = initialUserId
  }, [initialUserId])
  useEffect(() => {
    if (!loading && pendingOpenRef.current && users.length > 0) {
      const target = users.find(u => u.user_id === pendingOpenRef.current)
      if (target) { openDrawer(target); pendingOpenRef.current = null }
    }
  // openDrawer é estável (não é useCallback); users e loading são as dependências reais
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, users])

  useEffect(() => {
    if (drawerTab === 'resumo-inteligente' && selectedUser && !aiExtraLoaded) {
      loadAiExtraMetrics(selectedUser.user_id)
    }
  // Dependência `loadAiExtraMetrics` omitida intencionalmente: a função é redefinida
  // a cada render e incluí-la causaria loop infinito. O efeito deve disparar apenas
  // quando `drawerTab` ou o usuário selecionado mudar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerTab, selectedUser?.user_id])

  async function loadDrawerData(userId: string) {
    setLoadingDrawer(true)
    const [ticketRes, notifRes, noteRes, planHistRes, diaryRes, savedRes, qRes, guidanceRes, lastDiaryRes] = await Promise.all([
      supabase.from('support_tickets').select('id, ticket_number, subject, status, priority, updated_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('notifications').select('id, title, type, is_read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('user_internal_notes').select('id, note, admin_id, is_pinned, priority, created_at').eq('user_id', userId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('user_plan_history').select('id, old_plan, new_plan, reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('monthly_guidance_requests').select('id, month_key, status, created_at, message').eq('user_id', userId).order('created_at', { ascending: false }).limit(20).then(r => r, () => ({ data: [] })),
      supabase.from('diary_entries').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    ])
    setUserTickets(ticketRes.data || [])
    setUserNotifs(notifRes.data || [])
    setUserNotes(noteRes.data || [])
    setPlanHistory(planHistRes.data || [])
    setUserGuidance((guidanceRes as { data: typeof userGuidance }).data || [])
    setLastDiary((lastDiaryRes.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null)
    setMetrics({
      diary: diaryRes.count ?? 0,
      saved: savedRes.count ?? 0,
      questionnaires: qRes.count ?? 0,
      tickets: ticketRes.data?.length ?? 0,
      unreadNotifs: (notifRes.data || []).filter((n: NotifRow) => !n.is_read).length,
    })
    setLoadingDrawer(false)
    void loadEmailHistory(userId)
  }

  // Histórico de e-mails manuais enviados pelo admin (RLS de admin permite o SELECT).
  async function loadEmailHistory(userId: string) {
    setLoadingEmailHistory(true)
    const { data } = await supabase
      .from('email_logs')
      .select('id, created_at, sent_at, subject, status, error_message, metadata')
      .eq('user_id', userId)
      .eq('template_key', 'admin_custom_message')
      .order('created_at', { ascending: false })
      .limit(50)
    setEmailHistory((data as EmailLogRow[]) ?? [])
    setLoadingEmailHistory(false)
  }

  async function loadAiSummaries(userId: string) {
    setAiSummaryLoading(true)
    const { data } = await supabase
      .from('user_ai_summaries')
      .select('id, summary, data_snapshot, provider, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
    setAiSummaries(data ?? [])
    if (data && data.length > 0) setAiCurrentSummary(data[0].summary)
    setAiSummaryLoading(false)
  }

  async function loadAiExtraMetrics(userId: string) {
    const [guidanceRes, commentsRes, reportsRes, diaryTagsRes] = await Promise.all([
      supabase.from('monthly_guidance_requests').select('id, status').eq('user_id', userId),
      supabase.from('professional_comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('report_type', 'monthly'),
      supabase.from('diary_entries').select('emotional_tags, mood').eq('user_id', userId).limit(100),
    ])
    const guidance = guidanceRes.data ?? []
    const tagCounts: Record<string, number> = {}
    const moodVals: number[] = []
    for (const e of diaryTagsRes.data ?? []) {
      const tags = Array.isArray(e.emotional_tags) ? e.emotional_tags : []
      tags.forEach((t: string) => { tagCounts[t] = (tagCounts[t] ?? 0) + 1 })
      const m = Number(e.mood)
      if (m > 0) moodVals.push(m)
    }
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)
    const avgMood = moodVals.length ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length : 0
    setAiExtraMetrics({
      guidanceCount: guidance.length,
      guidancePending: guidance.filter(g => g.status === 'open').length,
      commentsCount: commentsRes.count ?? 0,
      reportsCount: reportsRes.count ?? 0,
      topTags,
      avgMood,
    })
    setAiExtraLoaded(true)
  }

  async function generateAiSummary() {
    if (!selectedUser) return
    setAiGenerating(true)
    setAiMsg(null)
    try {
      const data: UserProfileData = {
        plan: selectedUser.plan,
        planLabel: PLAN_LABELS[selectedUser.plan] ?? selectedUser.plan,
        memberSince: new Date(selectedUser.created_at).toLocaleDateString('pt-BR'),
        diaryCount: metrics.diary,
        questionnaireCount: metrics.questionnaires,
        savedCount: metrics.saved,
        ticketCount: metrics.tickets,
        guidanceCount: aiExtraMetrics.guidanceCount,
        guidancePending: aiExtraMetrics.guidancePending,
        commentsCount: aiExtraMetrics.commentsCount,
        reportsCount: aiExtraMetrics.reportsCount,
        topTags: aiExtraMetrics.topTags,
        avgMood: aiExtraMetrics.avgMood || undefined,
        recentActivity: [],
        adminTags: selectedUser.admin_tags ?? [],
      }
      const summary = await generateUserProfileSummary(data)
      setAiCurrentSummary(summary)
    } catch (err) {
      setAiMsg({ type: 'err', text: 'Erro ao gerar resumo: ' + ((err as Error)?.message ?? 'Tente novamente.') })
    }
    setAiGenerating(false)
  }

  async function saveAiSummary() {
    if (!selectedUser || !aiCurrentSummary.trim() || !adminUser) return
    setAiSaving(true)
    setAiMsg(null)
    const { error } = await supabase.from('user_ai_summaries').insert({
      user_id: selectedUser.user_id,
      generated_by: adminUser.id,
      summary: aiCurrentSummary.trim(),
      data_snapshot: {
        plan: selectedUser.plan,
        diary: metrics.diary,
        questionnaires: metrics.questionnaires,
        guidance: aiExtraMetrics.guidanceCount,
        topTags: aiExtraMetrics.topTags,
      },
      provider: 'gemini',
    })
    if (!error) {
      setAiMsg({ type: 'ok', text: 'Resumo salvo com sucesso!' })
      loadAiSummaries(selectedUser.user_id)
    } else {
      setAiMsg({ type: 'err', text: 'Erro ao salvar: ' + error.message })
    }
    setAiSaving(false)
  }

  // Continua carregando a assinatura porque as AÇÕES de admin (alterar plano,
  // cancelar/reativar) dependem dela. A EXIBIÇÃO agora é do AdminSubscriptionPanel,
  // que busca os próprios dados.
  async function loadAdminSub(userId: string) {
    const { data } = await supabase.from('user_subscriptions').select('*').eq('user_id', userId).maybeSingle()
    setAdminSub(data as AdminSubscription | null)
    if (data) setAdminSubPlan(data.plan_key)
  }

  async function adminChangePlan(targetPlan: string, userId: string) {
    setAdminSubActing(true)
    setAdminSubMsg(null)
    const oldPlan = selectedUser?.plan ?? 'free'
    const { error } = await supabase.from('profiles').update({ plan: targetPlan }).eq('user_id', userId)
    if (error) { setAdminSubMsg({ type: 'err', text: 'Erro ao alterar plano: ' + error.message }); setAdminSubActing(false); return }
    await supabase.from('user_subscriptions').upsert({ user_id: userId, plan_key: targetPlan, status: targetPlan === 'free' ? 'inactive' : 'active', cancel_at_period_end: false, pending_plan: null, pending_plan_starts_at: null }, { onConflict: 'user_id' })
    await supabase.from('plan_change_history').insert({ user_id: userId, old_plan: oldPlan, new_plan: targetPlan, change_type: 'admin_change', changed_by: adminUser?.id ?? null, source: 'admin', notes: planReason || null })
    await createUserNotification({ userId, type: 'plan_change', title: 'Plano atualizado pelo suporte', message: `Seu plano foi alterado para ${PLAN_LABELS[targetPlan] ?? targetPlan}.`, destination: 'my-plan' })
    void logAdminAction('update', 'user_plan', userId, { from: oldPlan, to: targetPlan, reason: planReason || null })
    setUsers(u => u.map(r => r.user_id === userId ? { ...r, plan: targetPlan } : r))
    setSelectedUser(s => s ? { ...s, plan: targetPlan } : s)
    setPlanHistory(prev => [{ id: Date.now().toString(), old_plan: oldPlan, new_plan: targetPlan, reason: planReason || 'admin_change', created_at: new Date().toISOString() }, ...prev])
    setAdminSubMsg({ type: 'ok', text: `Plano alterado para ${PLAN_LABELS[targetPlan] ?? targetPlan}.` })
    loadAdminSub(userId)
    setAdminSubActing(false)
  }

  async function adminCancelSub(userId: string) {
    setAdminSubActing(true)
    setAdminSubMsg(null)
    await supabase.from('user_subscriptions').upsert({ user_id: userId, status: 'cancel_pending', cancel_at_period_end: true }, { onConflict: 'user_id' })
    await supabase.from('plan_change_history').insert({ user_id: userId, old_plan: selectedUser?.plan, new_plan: 'free', change_type: 'cancel', changed_by: adminUser?.id ?? null, source: 'admin', notes: 'Cancelado pelo admin' })
    await createUserNotification({ userId, type: 'plan_change', title: 'Plano cancelado pelo suporte', message: 'Seu plano foi cancelado. Você continuará com acesso até o fim do ciclo atual.', destination: 'my-plan' })
    void logAdminAction('update', 'subscription_cancel', userId, { plan: selectedUser?.plan ?? null })
    setAdminSubMsg({ type: 'ok', text: 'Cancelamento agendado com sucesso.' })
    loadAdminSub(userId)
    setAdminSubActing(false)
  }

  async function adminReactivateSub(userId: string) {
    setAdminSubActing(true)
    setAdminSubMsg(null)
    await supabase.from('user_subscriptions').update({ status: 'active', cancel_at_period_end: false, pending_plan: null, pending_plan_starts_at: null }).eq('user_id', userId)
    await supabase.from('plan_change_history').insert({ user_id: userId, old_plan: selectedUser?.plan, new_plan: selectedUser?.plan, change_type: 'reactivate', changed_by: adminUser?.id ?? null, source: 'admin', notes: 'Reativado pelo admin' })
    await createUserNotification({ userId, type: 'plan_change', title: 'Assinatura reativada pelo suporte', message: 'Seu cancelamento foi removido. A assinatura continuará ativa normalmente.', destination: 'my-plan' })
    setAdminSubMsg({ type: 'ok', text: 'Assinatura reativada com sucesso.' })
    loadAdminSub(userId)
    setAdminSubActing(false)
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
    setUnlimitedAccessForm({
      enabled: u.unlimited_access ?? false,
      until: u.unlimited_access_until ? u.unlimited_access_until.slice(0, 10) : '',
      reason: u.unlimited_access_reason ?? '',
    })
    setDiscountMsg(null) // resultado é por usuário: não pode vazar para o próximo
    setDiscountForm({
      discount_percent: u.discount_percent ?? 0,
      discount_fixed: u.discount_fixed ?? 0,
      discount_code: '',
      discount_until: '',
      discount_reason: '',
    })
    setBlockReason('')
    setShowBlockForm(false)
    setNewEmail('')
    setNewPassword('')
    setAuthOpResult(null)
    setMsgTitle(''); setMsgBody(''); setMsgType('admin_message')
    setMsgCreateTicket(false); setMsgPriority('medium')
    setMsgCategory(''); setMsgResult(null); setShowMsgModal(false)
    setAdminSub(null); setAdminSubMsg(null); setAdminSubPlan(u.plan)
    setAiSummaries([]); setAiCurrentSummary(''); setAiExtraLoaded(false); setAiMsg(null)
    loadDrawerData(u.user_id)
    loadAdminSub(u.user_id)
    loadAiSummaries(u.user_id)
  }

  function closeDrawer() { setSelectedUser(null) }

  async function setAdmin(userId: string, isAdmin: boolean) {
    if (!isAdmin && !window.confirm('Remover o acesso administrativo desta pessoa? Ela perderá imediatamente o acesso ao painel.')) return
    const { error } = await supabase.from('profiles').update({ role: isAdmin ? 'admin' : null }).eq('user_id', userId)
    if (error) {
      window.alert(error.message.includes('último administrador')
        ? 'Não é possível remover o último administrador da plataforma.'
        : 'Não foi possível alterar a permissão administrativa. Tente novamente.')
      return
    }
    void logAdminAction(isAdmin ? 'promote_admin' : 'revoke_admin', 'profile', userId, { role: isAdmin ? 'admin' : 'user' })
    setUsers(u => u.map(r => r.user_id === userId ? { ...r, role: isAdmin ? 'admin' : null } : r))
    if (selectedUser?.user_id === userId) setSelectedUser(s => s ? { ...s, role: isAdmin ? 'admin' : null } : s)
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
      unlimited_access_until: unlimitedAccessForm.enabled && unlimitedAccessForm.until
        ? `${unlimitedAccessForm.until}T23:59:59.999-03:00`
        : null,
      unlimited_access_reason: unlimitedAccessForm.enabled ? (unlimitedAccessForm.reason || null) : null,
    }
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', selectedUser.user_id)
    if (!error) {
      const normalizedUntil = unlimitedAccessForm.enabled && unlimitedAccessForm.until
        ? `${unlimitedAccessForm.until}T23:59:59.999-03:00`
        : null
      const accessPatch = {
        unlimited_access: unlimitedAccessForm.enabled,
        unlimited_access_until: normalizedUntil,
        unlimited_access_reason: unlimitedAccessForm.enabled ? (unlimitedAccessForm.reason || null) : null,
      }
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, ...accessPatch } : r))
      setSelectedUser(s => s ? { ...s, ...accessPatch } : s)
    }
    setSavingUnlimited(false)
  }

  // O desconto NÃO é gravado direto no banco: quem manda é a Edge Function
  // admin-discount, que cria o Coupon no Stripe e aplica na assinatura/cliente.
  // Escrever só nas colunas discount_* (como era antes) não descontava nada — o
  // usuário seguia pagando o valor cheio.
  async function saveDiscount() {
    if (!selectedUser) return
    setSavingDiscount(true)
    setDiscountMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('admin-discount', {
        body: {
          user_id: selectedUser.user_id,
          action: 'apply',
          discount_percent: Number(discountForm.discount_percent) || 0,
          discount_fixed: Number(discountForm.discount_fixed) || 0,
          discount_code: discountForm.discount_code || null,
          discount_until: discountForm.discount_until || null,
          discount_reason: discountForm.discount_reason || null,
        },
      })
      const res = data as { ok?: boolean; error?: string; resumo?: string; duracao?: string; aplicado_em?: string } | null
      const msg = error?.message ?? res?.error
      if (msg || !res?.ok) throw new Error(msg ?? 'Não foi possível aplicar o desconto.')
      setDiscountMsg({ ok: true, text: `${res.resumo} — ${res.duracao}. Aplicado em: ${res.aplicado_em}.` })
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id
        ? { ...r, discount_percent: Number(discountForm.discount_percent) || 0, discount_fixed: Number(discountForm.discount_fixed) || 0 }
        : r
      ))
    } catch (e) {
      setDiscountMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao aplicar desconto' })
    } finally {
      setSavingDiscount(false)
    }
  }

  async function clearDiscount() {
    if (!selectedUser) return
    setSavingDiscount(true)
    setDiscountMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('admin-discount', {
        body: { user_id: selectedUser.user_id, action: 'remove' },
      })
      const res = data as { ok?: boolean; error?: string } | null
      const msg = error?.message ?? res?.error
      if (msg || !res?.ok) throw new Error(msg ?? 'Não foi possível remover o desconto.')
      setDiscountForm({ discount_percent: 0, discount_fixed: 0, discount_code: '', discount_until: '', discount_reason: '' })
      setDiscountMsg({ ok: true, text: 'Desconto removido do Stripe e do cadastro. As próximas faturas voltam ao valor cheio.' })
      setUsers(u => u.map(r => r.user_id === selectedUser.user_id ? { ...r, discount_percent: 0, discount_fixed: 0 } : r))
    } catch (e) {
      setDiscountMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao remover desconto' })
    } finally {
      setSavingDiscount(false)
    }
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

  async function handleResetPassword() {
    if (!selectedUser || !newPassword.trim()) return
    if (newPassword.trim().length < 8) {
      setAuthOpResult({ type: 'err', msg: 'Senha deve ter pelo menos 8 caracteres.' }); return
    }
    setSavingAuthOp(true); setAuthOpResult(null)
    const { error } = await supabase.rpc('admin_set_user_password', {
      target_user_id: selectedUser.user_id,
      new_password: newPassword.trim(),
    })
    if (error) {
      setAuthOpResult({ type: 'err', msg: 'Erro: ' + error.message })
    } else {
      setAuthOpResult({ type: 'ok', msg: 'Senha alterada com sucesso.' })
      setNewPassword('')
    }
    setSavingAuthOp(false)
  }

  async function handleChangeEmail() {
    if (!selectedUser || !newEmail.trim()) return
    if (!newEmail.includes('@')) {
      setAuthOpResult({ type: 'err', msg: 'E-mail inválido.' }); return
    }
    setSavingAuthOp(true); setAuthOpResult(null)
    const { error } = await supabase.rpc('admin_change_user_email', {
      target_user_id: selectedUser.user_id,
      new_email: newEmail.trim(),
    })
    if (error) {
      setAuthOpResult({ type: 'err', msg: 'Erro: ' + error.message })
    } else {
      setAuthOpResult({ type: 'ok', msg: 'E-mail alterado com sucesso.' })
      setNewEmail('')
    }
    setSavingAuthOp(false)
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

  const filtered = filterAdminUsers(users, {
    search,
    plan: filterPlan,
    status: filterStatus,
    access: filterAccess,
  })

  // Exporta os usuários FILTRADOS para CSV (abre no Excel).
  function exportarCSV() {
    setExporting(true)
    try {
      const csv = buildAdminUsersCsv(filtered)
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function setTabFilter(tab: string) {
    const next = resolveTabFilter(tab)
    setActiveTab(next.activeTab)
    setFilterPlan(next.filterPlan)
    setFilterStatus(next.filterStatus)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <AdminUsersOverview
        users={users}
        filteredUsers={filtered}
        filteredCount={filtered.length}
        stats={stats}
        loading={loading}
        search={search}
        filterPlan={filterPlan}
        filterStatus={filterStatus}
        filterAccess={filterAccess}
        exporting={exporting}
        viewMode={viewMode}
        activeTab={activeTab}
        selectedUserId={selectedUser?.user_id ?? null}
        onSearchChange={setSearch}
        onPlanChange={setFilterPlan}
        onStatusChange={setFilterStatus}
        onAccessChange={setFilterAccess}
        onExport={exportarCSV}
        onViewModeChange={setViewMode}
        onTabFilter={setTabFilter}
        onShowNotifications={() => { setTabFilter('all'); setFilterAccess('all'); setSearch('') }}
        onShowTickets={() => { setTabFilter('all'); setFilterAccess('tickets'); setSearch('') }}
        onShowCancelled={() => setTabFilter('cancelled')}
        onOpenUser={openDrawer}
      />

      {/* Drawer */}
      {selectedUser && (
        <div className="flex flex-col w-full lg:w-[560px] border-l border-line bg-white flex-shrink-0 overflow-hidden">
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-line flex-shrink-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-forest-900">{selectedUser.full_name || 'Sem nome'}</p>
                  {selectedUser.role === 'admin' && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                {selectedUser.email && (
                  <p className="text-xs text-stone-500 truncate max-w-[280px]">{selectedUser.email}</p>
                )}
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
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${drawerTab === t.key ? 'bg-forest-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
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
                        ['E-mail', selectedUser.email || '—'],
                        ['Plano', PLAN_LABELS[selectedUser.plan] ?? selectedUser.plan],
                        ['Perfil', selectedUser.role === 'admin' ? 'Admin' : 'Usuário'],
                        ['Cadastro', new Date(selectedUser.created_at).toLocaleDateString('pt-BR')],
                        ['Desde', timeSince(selectedUser.created_at)],
                        ['Status', selectedUser.account_status ?? 'active'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-stone-50 rounded-xl p-3 border border-line">
                          <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
                          <p className="text-sm font-medium text-forest-900">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Benefit badges */}
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.unlimited_access && (
                        <span className="text-xs px-2 py-1 rounded-full bg-mint text-forest-800 font-medium">Acesso ilimitado</span>
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
                        className="text-xs px-2 py-1.5 border border-line rounded-lg bg-white focus:outline-none"
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
                        className="accent-forest-700"
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
                        className="flex items-center gap-2 text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-800"
                      >
                        Alterar plano
                      </button>
                    ) : (
                      <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
                        <p className="text-xs font-semibold text-stone-700">Alterar plano</p>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Novo plano</label>
                          <select value={newPlan} onChange={e => setNewPlan(e.target.value)} className={inputCls}>
                            {/* Só planos oficiais: PLAN_LABELS mantém os legados
                                (therapeutic/-plus) para EXIBIR "Plus", mas eles não
                                devem ser ATRIBUÍVEIS — senão apareciam 3 "Plus". */}
                            {OFFICIAL_PLANS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-stone-500 mb-1">Motivo (opcional)</label>
                          <input value={planReason} onChange={e => setPlanReason(e.target.value)} placeholder="Motivo da alteração..." className={inputCls} />
                        </div>
                        <p className="text-[10px] text-stone-400">Integração com checkout real depende do Stripe/Mercado Pago.</p>
                        <div className="flex gap-2">
                          <button onClick={handlePlanChange} disabled={savingPlan} className="text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
                            {savingPlan ? 'Salvando...' : 'Confirmar alteração'}
                          </button>
                          <button onClick={() => setChangingPlan(false)} className="text-sm border border-line px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
                        </div>
                      </div>
                    )}

                    {planHistory.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-stone-700 mb-2">Histórico de planos</p>
                        <div className="space-y-2">
                          {planHistory.map(h => (
                            <div key={h.id} className="bg-stone-50 border border-line rounded-xl p-3">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-stone-400">{PLAN_LABELS[h.old_plan ?? ''] ?? h.old_plan ?? '—'}</span>
                                <span className="text-stone-300">→</span>
                                <span className="font-medium text-forest-900">{PLAN_LABELS[h.new_plan ?? ''] ?? h.new_plan ?? '—'}</span>
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

                {/* Tab: Mapa emocional */}
                {drawerTab === 'mapa' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-stone-50 border border-line rounded-xl p-4">
                        <p className="text-2xl font-serif text-forest-900">{metrics.diary}</p>
                        <p className="text-xs text-stone-500 mt-1">Entradas no diário</p>
                      </div>
                      <div className="bg-stone-50 border border-line rounded-xl p-4">
                        <p className="text-2xl font-serif text-forest-900">{metrics.questionnaires}</p>
                        <p className="text-xs text-stone-500 mt-1">Questionários respondidos</p>
                      </div>
                    </div>
                    <div className="bg-stone-50 border border-line rounded-xl p-4 text-xs text-stone-600">
                      Último registro no diário: <strong>{lastDiary ? new Date(lastDiary).toLocaleDateString('pt-BR') : '—'}</strong>
                    </div>
                    <p className="text-xs text-stone-400">
                      O mapa emocional detalhado (marcadores, gráficos e relatórios) fica na área <strong>Diário e mapa emocional</strong>.
                    </p>
                  </div>
                )}

                {/* Tab: Orientações */}
                {drawerTab === 'orientacoes' && (
                  <div className="space-y-3">
                    {loadingDrawer ? (
                      <div className="h-16 bg-stone-100 rounded-xl animate-pulse" />
                    ) : userGuidance.length === 0 ? (
                      <p className="text-sm text-stone-400">Nenhuma orientação registrada para este usuário.</p>
                    ) : userGuidance.map(g => {
                      const [y, m] = (g.month_key || '').split('-')
                      const mLabel = y && m ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : (g.month_key || '—')
                      const sLabel = g.status === 'answered' ? 'Respondida' : g.status === 'closed' ? 'Fechada' : 'Aguardando'
                      const sCls = g.status === 'answered' ? 'bg-mint text-forest-800' : g.status === 'closed' ? 'bg-stone-100 text-stone-500' : 'bg-amber-100 text-amber-700'
                      return (
                        <div key={g.id} className="bg-stone-50 border border-line rounded-xl p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-forest-900 capitalize">{mLabel}</p>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${sCls}`}>{sLabel}</span>
                          </div>
                          {g.message && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{g.message}</p>}
                          <p className="text-[11px] text-stone-400 mt-1">{new Date(g.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Tab: Assinatura */}
                {drawerTab === 'assinatura' && (
                  <div className="space-y-4">
                    {adminSubMsg && (
                      <div className={`text-sm px-3 py-2 rounded-lg border ${adminSubMsg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {adminSubMsg.text}
                      </div>
                    )}
                    {/* Visão completa (§1): dados da assinatura, pagamento, motivos e
                        linha do tempo. Vive em AdminSubscriptionPanel para não inchar
                        ainda mais este arquivo. */}
                    {selectedUser && (
                      <AdminSubscriptionPanel userId={selectedUser.user_id} plan={selectedUser.plan} />
                    )}

                    <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Alterar plano (admin)</p>
                      <div className="flex gap-2">
                        <select
                          value={adminSubPlan}
                          onChange={e => setAdminSubPlan(e.target.value)}
                          className={inputCls}
                        >
                          {/* Só planos oficiais (free/essential/plus). Os legados
                              therapeutic/-plus continuam em PLAN_LABELS para exibir
                              "Plus", mas não são atribuíveis. */}
                          {OFFICIAL_PLANS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </select>
                        <button
                          onClick={() => adminChangePlan(adminSubPlan, selectedUser!.user_id)}
                          disabled={adminSubActing || adminSubPlan === selectedUser?.plan}
                          className="flex-shrink-0 text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-40 transition-colors"
                        >
                          {adminSubActing ? '...' : 'Aplicar'}
                        </button>
                      </div>
                      <p className="text-[10px] text-stone-400">Altera o plano imediatamente, sem cobrança proporcional. Uma notificação é enviada ao usuário.</p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {adminSub?.cancel_at_period_end ? (
                        <button
                          onClick={() => adminReactivateSub(selectedUser!.user_id)}
                          disabled={adminSubActing}
                          className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
                        >
                          Reativar assinatura
                        </button>
                      ) : selectedUser?.plan !== 'free' ? (
                        <button
                          onClick={() => adminCancelSub(selectedUser!.user_id)}
                          disabled={adminSubActing}
                          className="text-sm border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          Agendar cancelamento
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Tab: Acesso */}
                {drawerTab === 'acesso' && (
                  <div className="space-y-4">
                    <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Acesso ilimitado</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="unlimited-toggle"
                          checked={unlimitedAccessForm.enabled}
                          onChange={e => setUnlimitedAccessForm(f => ({ ...f, enabled: e.target.checked }))}
                          className="accent-forest-700"
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
                      <button onClick={saveUnlimitedAccess} disabled={savingUnlimited} className="text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
                        {savingUnlimited ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                    <div className="bg-stone-50 border border-line rounded-xl p-4">
                      <p className="text-xs font-semibold text-stone-700 mb-3">Recursos desbloqueados pelo plano</p>
                      <div className="space-y-1 text-xs text-stone-500">
                        {normalizePlan(selectedUser.plan) === 'free' && <p>Acesso Gratuito: blog aberto, diário emocional básico e questionário inicial</p>}
                        {normalizePlan(selectedUser.plan) === 'essential' && <p>Acesso Essencial: diário ilimitado, mapa emocional completo, conteúdos guiados e relatório semanal</p>}
                        {normalizePlan(selectedUser.plan) === 'plus' && <p>Acesso Plus: tudo do Essencial + plano de autocuidado mensal, relatório mensal aprofundado, comentário e orientação profissional</p>}
                        {selectedUser.unlimited_access && <p className="text-forest-800 font-medium">Acesso ilimitado ativo — sem restrições</p>}
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
                        className="flex items-center gap-1.5 text-xs bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800"
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
                          <div key={t.id} className="bg-stone-50 border border-line rounded-xl p-3">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs text-stone-400 font-mono">#{t.ticket_number}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? 'bg-stone-100'}`}>
                                {STATUS_LABELS[t.status] ?? t.status}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-forest-900 truncate">{t.subject}</p>
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
                      className="flex items-center gap-1.5 text-xs bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800"
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
                          <div key={n.id} className={`rounded-xl p-3 border ${n.is_read ? 'bg-stone-50 border-line' : 'bg-blue-50 border-blue-100'}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{TYPE_LABELS[n.type] ?? n.type}</span>
                              {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                            </div>
                            <p className="text-sm font-medium text-forest-900">{n.title}</p>
                            <p className="text-xs text-stone-400">{new Date(n.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Comunicação — enviar e-mail + histórico */}
                {drawerTab === 'comunicacao' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-forest-900">E-mails enviados</h3>
                        <p className="text-xs text-stone-400">Mensagens manuais enviadas por você a este usuário.</p>
                      </div>
                      <button
                        onClick={() => setShowEmailModal(true)}
                        disabled={!selectedUser.email}
                        title={selectedUser.email ? '' : 'Este usuário não possui e-mail cadastrado.'}
                        className="flex items-center gap-1.5 text-xs bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50 flex-shrink-0"
                      >
                        <Mail className="w-3.5 h-3.5" /> Enviar e-mail
                      </button>
                    </div>

                    {!selectedUser.email && (
                      <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        Este usuário não possui e-mail cadastrado.
                      </div>
                    )}

                    {loadingEmailHistory ? (
                      <div className="flex items-center gap-2 text-sm text-stone-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
                    ) : emailHistory.length === 0 ? (
                      <div className="text-center py-10 text-stone-400">
                        <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum e-mail enviado ainda.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {emailHistory.map(e => {
                          const status = e.status ?? 'pending'
                          const statusCls = status === 'sent' ? 'bg-green-100 text-green-700'
                            : status === 'failed' ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                          const statusLabel = status === 'sent' ? 'Enviado' : status === 'failed' ? 'Falhou' : 'Pendente'
                          const corpo = e.metadata?.variables?.corpo ?? ''
                          const expanded = expandedEmailId === e.id
                          return (
                            <div key={e.id} className="rounded-xl border border-line bg-white p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-forest-900 truncate">{e.subject || '(sem assunto)'}</p>
                                  <p className="text-xs text-stone-400 mt-0.5">
                                    {new Date(e.sent_at ?? e.created_at).toLocaleString('pt-BR')}
                                    {e.metadata?.template_title ? <> · modelo: {e.metadata.template_title}</> : null}
                                    {e.metadata?.sent_by_admin_email ? <> · por {e.metadata.sent_by_admin_email}</> : null}
                                  </p>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${statusCls}`}>{statusLabel}</span>
                              </div>
                              {status === 'failed' && e.error_message && (
                                <p className="text-[11px] text-red-600 mt-1.5">{e.error_message}</p>
                              )}
                              <button
                                onClick={() => setExpandedEmailId(expanded ? null : e.id)}
                                className="inline-flex items-center gap-1 text-xs text-forest-700 hover:text-forest-900 mt-2"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                {expanded ? 'Ocultar conteúdo' : 'Ver conteúdo'}
                              </button>
                              {expanded && (
                                <div className="mt-2 pt-2 border-t border-line text-sm text-ink leading-relaxed whitespace-pre-wrap">
                                  {corpo || '(conteúdo indisponível)'}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Uso */}
                {drawerTab === 'uso' && (
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'Entradas no diário', value: metrics.diary, icon: <FileText className="w-5 h-5 text-forest-700" /> },
                      { label: 'Itens salvos', value: metrics.saved, icon: <Bell className="w-5 h-5 text-blue-600" /> },
                      { label: 'Questionários respondidos', value: metrics.questionnaires, icon: <MessageCircle className="w-5 h-5 text-purple-600" /> },
                      { label: 'Tickets de suporte', value: metrics.tickets, icon: <Ticket className="w-5 h-5 text-orange-600" /> },
                      { label: 'Notificações não lidas', value: metrics.unreadNotifs, icon: <Bell className="w-5 h-5 text-red-500" /> },
                    ].map(m => (
                      <div key={m.label} className="bg-stone-50 border border-line rounded-xl p-4 flex items-center gap-3">
                        {m.icon}
                        <div>
                          <p className="font-serif text-2xl text-forest-900">{m.value}</p>
                          <p className="text-xs text-stone-500">{m.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Descontos */}
                {drawerTab === 'descontos' && (
                  <div className="space-y-4">
                    <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
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
                      <p className="text-[10px] text-stone-400">
                        Cria um cupom no Stripe e aplica na assinatura — o desconto vale na <strong>cobrança real</strong>, já na próxima fatura, e se repete nas renovações.
                        Use <strong>% ou valor fixo</strong>, não os dois. Sem data em “válido até”, vale enquanto a assinatura durar.
                      </p>
                      {discountMsg && (
                        <div className={`text-xs px-3 py-2 rounded-lg border ${discountMsg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {discountMsg.text}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={saveDiscount} disabled={savingDiscount} className="text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
                          {savingDiscount ? 'Aplicando no Stripe...' : 'Salvar desconto'}
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
                    <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
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
                          <select value={notePriority} onChange={e => setNotePriority(e.target.value)} className="text-xs px-2 py-1 border border-line rounded-lg bg-white">
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="pin-note" checked={notePinned} onChange={e => setNotePinned(e.target.checked)} className="accent-forest-700" />
                          <label htmlFor="pin-note" className="text-xs text-stone-700 cursor-pointer">Fixar</label>
                        </div>
                      </div>
                      <button
                        onClick={saveNote}
                        disabled={savingNote || !newNote.trim()}
                        className="flex items-center gap-2 text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50"
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
                              <p className="text-sm text-forest-900 whitespace-pre-wrap flex-1">{n.note}</p>
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
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${NOTE_PRIORITY_COLORS[n.priority] ?? 'bg-stone-100'}`}>
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

                {/* Tab: Resumo Inteligente */}
                {drawerTab === 'resumo-inteligente' && (
                  <div className="space-y-4">
                    {/* Aviso */}
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">Resumo administrativo de apoio. Não representa avaliação clínica ou diagnóstico.</p>
                    </div>

                    {/* Dados agregados */}
                    {!aiExtraLoaded ? (
                      <div className="bg-stone-50 border border-line rounded-xl p-4">
                        <p className="text-xs text-stone-500 mb-3 font-semibold">Dados de uso para o resumo</p>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          {[
                            ['Diário', metrics.diary],
                            ['Questionários', metrics.questionnaires],
                            ['Itens salvos', metrics.saved],
                            ['Tickets', metrics.tickets],
                          ].map(([l, v]) => (
                            <div key={l as string} className="bg-white rounded-lg p-2 border border-line">
                              <p className="text-[10px] text-stone-400 mb-0.5">{l}</p>
                              <p className="font-bold text-stone-700">{v}</p>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => loadAiExtraMetrics(selectedUser!.user_id)}
                          className="text-xs bg-forest-900 text-white px-3 py-1.5 rounded-lg hover:bg-forest-800"
                        >
                          Carregar dados completos
                        </button>
                      </div>
                    ) : (
                      <div className="bg-stone-50 border border-line rounded-xl p-4">
                        <p className="text-xs text-stone-500 mb-3 font-semibold">Dados de uso agregados</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            ['Diário', metrics.diary],
                            ['Questionários', metrics.questionnaires],
                            ['Itens salvos', metrics.saved],
                            ['Tickets', metrics.tickets],
                            ['Orientações', aiExtraMetrics.guidanceCount],
                            ['Orient. pendentes', aiExtraMetrics.guidancePending],
                            ['Coment. profissionais', aiExtraMetrics.commentsCount],
                            ['Relatórios', aiExtraMetrics.reportsCount],
                          ].map(([l, v]) => (
                            <div key={l as string} className="bg-white rounded-lg p-2 border border-line">
                              <p className="text-[10px] text-stone-400 mb-0.5">{l}</p>
                              <p className="font-bold text-stone-700">{v}</p>
                            </div>
                          ))}
                        </div>
                        {aiExtraMetrics.topTags.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] text-stone-400 mb-1">Marcadores mais frequentes no diário</p>
                            <div className="flex flex-wrap gap-1">
                              {aiExtraMetrics.topTags.map(t => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-mint text-forest-800 rounded-full border border-mint">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {aiExtraMetrics.avgMood > 0 && (
                          <p className="text-xs text-stone-500 mt-2">Humor médio registrado: <span className="font-semibold">{aiExtraMetrics.avgMood.toFixed(1)}/5</span></p>
                        )}
                      </div>
                    )}

                    {/* Gerar resumo com IA */}
                    <div className="bg-white border border-line rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5" /> Resumo inteligente
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={generateAiSummary}
                            disabled={aiGenerating || !aiExtraLoaded}
                            title={!aiExtraLoaded ? 'Carregue os dados completos primeiro' : 'Gerar resumo com IA'}
                            className="flex items-center gap-1 text-xs bg-forest-700 text-white px-2.5 py-1 rounded-lg hover:bg-forest-800 disabled:opacity-40 transition-colors"
                          >
                            {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {aiGenerating ? 'Gerando...' : aiCurrentSummary ? 'Atualizar' : 'Gerar com IA'}
                          </button>
                          {aiCurrentSummary && (
                            <>
                              <button
                                onClick={() => navigator.clipboard.writeText(aiCurrentSummary)}
                                title="Copiar resumo"
                                className="flex items-center gap-1 text-xs border border-line text-stone-600 px-2.5 py-1 rounded-lg hover:bg-stone-50"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={saveAiSummary}
                                disabled={aiSaving}
                                title="Salvar resumo"
                                className="flex items-center gap-1 text-xs bg-forest-900 text-white px-2.5 py-1 rounded-lg hover:bg-forest-800 disabled:opacity-40"
                              >
                                {aiSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {aiMsg && (
                        <div className={`text-xs px-3 py-2 rounded-lg ${aiMsg.type === 'ok' ? 'bg-mint border border-forest-200 text-forest-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                          {aiMsg.text}
                        </div>
                      )}

                      {aiCurrentSummary ? (
                        <textarea
                          value={aiCurrentSummary}
                          onChange={e => setAiCurrentSummary(e.target.value)}
                          rows={10}
                          className="w-full text-xs text-stone-700 border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-300 resize-y leading-relaxed"
                        />
                      ) : aiSummaryLoading ? (
                        <div className="flex items-center gap-2 py-4 text-stone-400 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 py-4 text-center">
                          {aiExtraLoaded
                            ? 'Clique em "Gerar com IA" para criar um resumo do perfil deste usuário.'
                            : 'Primeiro carregue os dados completos, depois clique em "Gerar com IA".'}
                        </p>
                      )}
                    </div>

                    {/* Histórico de resumos */}
                    {aiSummaries.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-stone-600 mb-2">Histórico de resumos salvos</p>
                        <div className="space-y-2">
                          {aiSummaries.map(s => (
                            <button
                              key={s.id}
                              onClick={() => setAiCurrentSummary(s.summary)}
                              className="w-full text-left bg-stone-50 border border-line rounded-xl p-3 hover:bg-stone-100 transition-colors"
                            >
                              <p className="text-[10px] text-stone-400 mb-1">
                                Salvo em {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </p>
                              <p className="text-xs text-stone-600 line-clamp-2">{s.summary}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Segurança */}
                {drawerTab === 'seguranca' && (
                  <div className="space-y-4">
                    <div className="bg-stone-50 border border-line rounded-xl p-4">
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
                                <button onClick={() => setShowBlockForm(false)} className="text-sm border border-line px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
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

                    {/* Auth ops result */}
                    {authOpResult && (
                      <div className={`text-sm px-3 py-2 rounded-lg ${authOpResult.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {authOpResult.msg}
                      </div>
                    )}

                    {/* Reset / change password */}
                    <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Redefinir senha</p>
                      <p className="text-xs text-stone-400">Define uma nova senha temporária para o usuário. O usuário deverá alterar no próximo acesso.</p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Nova senha (mín. 8 caracteres)"
                          className={inputCls}
                          autoComplete="new-password"
                        />
                        <button
                          onClick={handleResetPassword}
                          disabled={savingAuthOp || newPassword.trim().length < 8}
                          className="flex-shrink-0 text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-900 disabled:opacity-40 transition-colors"
                        >
                          {savingAuthOp ? 'Salvando...' : 'Definir'}
                        </button>
                      </div>
                    </div>

                    {/* Change email */}
                    <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Alterar e-mail</p>
                      <p className="text-xs text-stone-400">Atualiza o e-mail de login do usuário imediatamente, sem necessidade de confirmação.</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          placeholder="novo@email.com"
                          className={inputCls}
                          autoComplete="off"
                        />
                        <button
                          onClick={handleChangeEmail}
                          disabled={savingAuthOp || !newEmail.trim()}
                          className="flex-shrink-0 text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-900 disabled:opacity-40 transition-colors"
                        >
                          {savingAuthOp ? 'Salvando...' : 'Alterar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Send message modal */}
      {showEmailModal && selectedUser && (
        <AdminSendUserEmail
          user={{ user_id: selectedUser.user_id, full_name: selectedUser.full_name, email: selectedUser.email, plan: selectedUser.plan }}
          adminId={adminUser?.id ?? null}
          adminEmail={adminUser?.email ?? null}
          onClose={() => setShowEmailModal(false)}
          onSent={() => { if (selectedUser) void loadEmailHistory(selectedUser.user_id) }}
        />
      )}

      {showMsgModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-forest-900">Enviar mensagem para {selectedUser.full_name || 'usuário'}</h3>
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
              <input type="checkbox" id="modal-create-ticket" checked={msgCreateTicket} onChange={e => setMsgCreateTicket(e.target.checked)} className="accent-forest-700" />
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
              <div className={`text-sm px-3 py-2 rounded-lg border ${msgResult.startsWith('Erro') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-mint border-forest-200 text-forest-800'}`}>
                {msgResult}
              </div>
            )}
            <button
              onClick={sendMsg}
              disabled={sendingMsg || !msgTitle.trim() || !msgBody.trim()}
              className="w-full bg-forest-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50 transition-colors"
            >
              {sendingMsg ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
