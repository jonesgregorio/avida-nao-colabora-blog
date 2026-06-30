import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  MessageSquare, Search, X, Send, Lock, AlertTriangle,
  RefreshCw, RotateCcw, ChevronDown, LayoutList, Columns,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface Ticket {
  id: string
  ticket_number: number
  user_id: string
  assigned_to: string | null
  subject: string
  description: string
  status: string
  priority: string
  plan_at_creation: string | null
  source: string | null
  category: string | null
  resolved_at: string | null
  closed_at: string | null
  unread_for_admin: boolean
  unread_for_user: boolean
  last_message_at: string | null
  created_at: string
  updated_at: string
  // enriched
  user_name?: string | null
  user_plan?: string | null
}

interface Message {
  id: string
  ticket_id: string
  sender_id: string
  sender_role: 'user' | 'admin'
  sender_name: string | null
  content: string
  is_internal: boolean
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  awaiting_admin: 'Aguardando suporte',
  awaiting_user: 'Aguardando cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
}
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  awaiting_admin: 'bg-red-100 text-red-700',
  awaiting_user: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-stone-100 text-stone-500',
}
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-stone-100 text-stone-500',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}
const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}

const STATUS_TABS = [
  { key: '', label: 'Todos' },
  { key: 'open', label: 'Abertos' },
  { key: 'awaiting_admin', label: 'Aguardando suporte' },
  { key: 'in_progress', label: 'Em atendimento' },
  { key: 'awaiting_user', label: 'Aguardando cliente' },
  { key: 'resolved', label: 'Resolvidos' },
  { key: 'closed', label: 'Fechados' },
]

const REPLY_TEMPLATES = [
  { label: 'Recebemos sua solicitação', text: 'Olá! Recebemos sua solicitação e ela já está registrada por aqui.\n\nVou analisar as informações com atenção e te retornar assim que possível.\n\nEnquanto isso, você pode acompanhar o andamento por esta conversa dentro do site.' },
  { label: 'Precisamos de mais informações', text: 'Olá! Para eu conseguir te ajudar melhor, preciso de mais algumas informações.\n\nVocê pode me enviar mais detalhes sobre o que aconteceu? Se possível, informe:\n- em qual página ou recurso ocorreu;\n- o que você tentou fazer;\n- se apareceu alguma mensagem de erro;\n- se o problema aconteceu no celular ou computador.\n\nAssim consigo analisar com mais precisão.' },
  { label: 'Problema técnico em análise', text: 'Olá! Obrigado por avisar.\n\nEsse comportamento parece estar relacionado a uma instabilidade ou problema técnico. Vou verificar com mais cuidado e acompanhar por aqui.\n\nAssim que eu tiver uma atualização, te respondo nesta mesma solicitação.' },
  { label: 'Problema resolvido', text: 'Olá! Fizemos uma verificação e o problema informado foi corrigido.\n\nVocê pode testar novamente, por favor?\n\nCaso ainda perceba algo errado, responda esta solicitação com mais detalhes para que eu continue acompanhando.' },
  { label: 'Dúvida sobre plano', text: 'Olá! Vou te ajudar com sua dúvida sobre os planos.\n\nCada plano libera recursos diferentes dentro do site. O plano Gratuito oferece uma experiência inicial, enquanto os planos pagos liberam mais recursos, limites maiores e funcionalidades extras.\n\nSe você me disser qual recurso quer usar, eu consigo te orientar sobre qual plano faz mais sentido para o seu caso.' },
  { label: 'Recurso disponível em outro plano', text: 'Olá! Esse recurso faz parte de um plano superior ao seu plano atual.\n\nVocê ainda pode continuar usando os recursos disponíveis no seu plano, mas para acessar essa funcionalidade específica será necessário fazer upgrade.\n\nSe quiser, posso te explicar a diferença entre os planos e te ajudar a escolher a melhor opção.' },
  { label: 'Solicitação de cancelamento', text: 'Olá! Recebi sua solicitação de cancelamento.\n\nVou verificar as informações da sua assinatura e te orientar sobre os próximos passos.\n\nSe puder, me diga também o motivo do cancelamento. Isso nos ajuda a melhorar o serviço.' },
  { label: 'Pagamento ou assinatura', text: 'Olá! Vou te ajudar com sua assinatura.\n\nPara analisar melhor, me informe o que aconteceu:\n- pagamento não aprovado;\n- cobrança duplicada;\n- plano não liberado;\n- desconto não aplicado;\n- dúvida sobre renovação;\n- cancelamento.\n\nCom essas informações, consigo direcionar melhor o atendimento.' },
  { label: 'Privacidade e dados', text: 'Olá! Entendo sua preocupação com privacidade.\n\nAs informações registradas no site devem ser tratadas com cuidado e usadas apenas para melhorar sua experiência dentro da plataforma.\n\nVou verificar sua solicitação e te orientar da forma mais clara possível.' },
  { label: 'Encerramento cordial', text: 'Olá! Como não tivemos novas mensagens por aqui e a solicitação parece ter sido resolvida, vou encerrar este atendimento.\n\nSe precisar de ajuda novamente, você pode abrir uma nova solicitação pelo Fale Conosco/Suporte dentro do site.' },
  { label: 'Atendimento prioritário Plus', text: 'Olá! Vi que você está no plano Terapêutico Plus, então sua solicitação será tratada com prioridade.\n\nVou analisar o caso com atenção e te retornar por aqui assim que possível.' },
  { label: 'Não consegui reproduzir o erro', text: 'Olá! Fiz alguns testes, mas por enquanto não consegui reproduzir o erro informado.\n\nVocê pode me enviar mais detalhes, como:\n- print da tela, se possível;\n- passo a passo do que você fez;\n- navegador ou aparelho usado;\n- horário aproximado em que aconteceu.\n\nCom isso, consigo investigar melhor.' },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function getSLA(ticket: Ticket): { label: string; color: string } {
  const created = new Date(ticket.created_at).getTime()
  const now = Date.now()
  const hours = (now - created) / 3600000
  const slaHours: Record<string, number> = {
    free: 72, essential: 48, therapeutic: 24, 'therapeutic-plus': 8,
  }
  const limit = slaHours[ticket.user_plan ?? ticket.plan_at_creation ?? 'free'] ?? 72
  if (hours > limit) return { label: 'Atrasado', color: 'bg-red-100 text-red-700' }
  if (hours > limit * 0.75) return { label: 'Perto de vencer', color: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Dentro do prazo', color: 'bg-green-100 text-green-700' }
}

function descriptionAsMessage(ticket: Ticket): Message {
  return {
    id: `desc-${ticket.id}`,
    ticket_id: ticket.id,
    sender_id: ticket.user_id,
    sender_role: 'user',
    sender_name: ticket.user_name ?? null,
    content: ticket.description,
    is_internal: false,
    created_at: ticket.created_at,
  }
}

const SUMMARY_CARDS = [
  { key: 'open', label: 'Novos', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'awaiting_admin', label: 'Aguardando suporte', color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'in_progress', label: 'Em atendimento', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { key: 'awaiting_user', label: 'Aguardando cliente', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { key: 'resolved', label: 'Resolvidos', color: 'bg-green-50 border-green-200 text-green-700' },
  { key: 'closed', label: 'Fechados', color: 'bg-stone-50 border-stone-200 text-stone-500' },
]

const KANBAN_COLUMNS = [
  { key: 'open', label: 'Aberto', color: 'bg-blue-100 text-blue-700' },
  { key: 'awaiting_admin', label: 'Aguardando suporte', color: 'bg-red-100 text-red-700' },
  { key: 'in_progress', label: 'Em atendimento', color: 'bg-orange-100 text-orange-700' },
  { key: 'awaiting_user', label: 'Aguardando cliente', color: 'bg-purple-100 text-purple-700' },
  { key: 'resolved', label: 'Resolvido', color: 'bg-green-100 text-green-700' },
]

export default function AdminSupport() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountRef = useRef(0)
  const drawerOpenRef = useRef(false)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const userIds = [...new Set(data.map((t: Ticket) => t.user_id))]
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name, plan').in('user_id', userIds)
      : { data: [] }

    const profileMap = new Map((profiles || []).map((p: { user_id: string; full_name: string | null; plan: string }) => [p.user_id, p]))

    setTickets(data.map((t: Ticket) => ({
      ...t,
      user_name: profileMap.get(t.user_id)?.full_name ?? null,
      user_plan: profileMap.get(t.user_id)?.plan ?? null,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  const loadMessages = useCallback(async (ticketId: string, silent = false) => {
    if (!silent) setLoadingMessages(true)
    const { data } = await supabase
      .from('ticket_messages')
      .select('id, ticket_id, sender_id, sender_role, content, is_internal, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (!data) { if (!silent) setLoadingMessages(false); return }

    type RawMsg = { id: string; ticket_id: string; sender_id: string; sender_role: 'user' | 'admin'; content: string; is_internal: boolean; created_at: string }
    const rawData = data as RawMsg[]
    const senderIds = [...new Set(rawData.map(m => m.sender_id))]
    const { data: profiles } = senderIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', senderIds)
      : { data: [] }
    const profileMap = new Map((profiles || []).map((p: { user_id: string; full_name: string | null }) => [p.user_id, p]))

    const enriched: Message[] = rawData.map(m => ({
      ...m,
      sender_name: profileMap.get(m.sender_id)?.full_name ?? null,
    }))

    setMessages(prev => {
      if (silent && enriched.length === lastCountRef.current) return prev
      lastCountRef.current = enriched.length
      return enriched
    })
    if (!silent) setLoadingMessages(false)
  }, [])

  function openDrawer(ticket: Ticket) {
    setSelectedTicket(ticket)
    setReplyContent('')
    setSendError(null)
    setIsInternal(false)
    setSelectedTemplate('')
    lastCountRef.current = 0
    drawerOpenRef.current = true
    loadMessages(ticket.id)
  }

  function closeDrawer() {
    drawerOpenRef.current = false
    setSelectedTicket(null)
    setMessages([])
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }

  useEffect(() => {
    if (!selectedTicket) return
    if (selectedTicket.status === 'closed' || selectedTicket.status === 'resolved') return
    pollingRef.current = setInterval(() => {
      if (drawerOpenRef.current) loadMessages(selectedTicket.id, true)
    }, 4000)
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }
  }, [selectedTicket?.id, selectedTicket?.status, loadMessages])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages.length])

  async function handleSend() {
    const trimmed = replyContent.trim()
    if (!trimmed || sending || !selectedTicket || !user) return

    setSending(true)
    setSendError(null)
    const optimisticId = `opt-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      sender_role: 'admin',
      sender_name: 'Suporte',
      content: trimmed,
      is_internal: isInternal,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setReplyContent('')

    const { data: newMsg, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        sender_role: 'admin',
        content: trimmed,
        is_internal: isInternal,
      })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setReplyContent(trimmed)
      setSendError('Erro ao enviar. Tente novamente.')
      setSending(false)
      return
    }

    setMessages(prev => prev.map(m =>
      m.id === optimisticId ? { ...newMsg, sender_name: 'Suporte' } : m
    ))

    if (!isInternal) {
      const now = new Date().toISOString()
      await supabase.from('support_tickets').update({
        unread_for_user: true,
        unread_for_admin: false,
        status: 'awaiting_user',
        last_message_at: now,
        last_admin_message_at: now,
      }).eq('id', selectedTicket.id)

      const updated = { ...selectedTicket, status: 'awaiting_user', unread_for_admin: false, unread_for_user: true }
      setSelectedTicket(updated)
      setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, status: 'awaiting_user', unread_for_admin: false } : t))

      await supabase.from('notifications').insert({
        user_id: selectedTicket.user_id,
        title: 'Resposta do suporte',
        body: 'Sua solicitação foi respondida. Clique para visualizar.',
        type: 'support_reply',
        related_ticket_id: selectedTicket.id,
        action_view: 'support-ticket',
        action_label: 'Ver resposta',
        is_read: false,
      })
    }

    setSending(false)
    setIsInternal(false)
    setSelectedTemplate('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSend() }
  }

  async function updateTicket(field: 'status' | 'priority', value: string) {
    if (!selectedTicket) return
    setUpdatingStatus(true)

    const updates: Record<string, unknown> = { [field]: value }
    if (field === 'status' && value === 'resolved') updates.resolved_at = new Date().toISOString()
    if (field === 'status' && value === 'closed') updates.closed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', selectedTicket.id)
      .select()
      .single()

    if (!error && data) {
      setSelectedTicket(prev => prev ? { ...prev, ...updates } : prev)
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...updates } : t))
    }
    setUpdatingStatus(false)
  }

  const filtered = tickets
    .filter(t => !statusTab || t.status === statusTab)
    .filter(t => !priorityFilter || t.priority === priorityFilter)
    .filter(t => !unreadOnly || t.unread_for_admin)
    .filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (t.user_name ?? '').toLowerCase().includes(q) ||
        (t.subject ?? '').toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q)
      )
    })

  const countByStatus = (status: string) => tickets.filter(t => t.status === status).length
  const unreadCount = tickets.filter(t => t.unread_for_admin).length

  const allMessages: Message[] = selectedTicket
    ? [descriptionAsMessage(selectedTicket), ...messages]
    : []

  const selectCls = 'px-2 py-1.5 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50'
  const isClosed = selectedTicket?.status === 'closed' || selectedTicket?.status === 'resolved'

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className={`flex flex-col flex-1 min-w-0 ${selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="font-semibold text-stone-800">Central de Suporte</h1>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} não lido{unreadCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                title="Lista"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                title="Kanban"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button onClick={loadTickets} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400" title="Recarregar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {SUMMARY_CARDS.map(card => (
              <button
                key={card.key}
                onClick={() => setStatusTab(prev => prev === card.key ? '' : card.key)}
                className={`border rounded-xl p-2 text-center transition-all ${card.color} ${statusTab === card.key ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'}`}
              >
                <p className="text-xl font-bold">{countByStatus(card.key)}</p>
                <p className="text-[10px] leading-tight">{card.label}</p>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              placeholder="Buscar por usuário, assunto ou nº..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filters row */}
          <div className="flex gap-2 flex-wrap mb-2">
            <button
              onClick={() => setUnreadOnly(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${unreadOnly ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {unreadOnly && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
              Não lidos
            </button>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="text-xs px-2 py-1.5 border border-stone-200 rounded-full bg-white focus:outline-none"
            >
              <option value="">Prioridade</option>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${statusTab === tab.key ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List / Kanban */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />)}
            </div>
          ) : viewMode === 'list' ? (
            filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-sm">Nenhum ticket encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {filtered.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => openDrawer(ticket)}
                    className={`w-full text-left px-6 py-4 hover:bg-stone-50 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs text-stone-400 font-mono">#{ticket.ticket_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status] ?? 'bg-stone-100'}`}>
                            {STATUS_LABELS[ticket.status] ?? ticket.status}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority] ?? 'bg-stone-100'}`}>
                            {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                          </span>
                          {ticket.unread_for_admin && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium animate-pulse">Nova mensagem</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-stone-800 truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-400">
                          <span>{ticket.user_name ?? 'Usuário'}</span>
                          {ticket.user_plan && (
                            <span className="text-stone-300">· {PLAN_LABELS[ticket.user_plan] ?? ticket.user_plan}</span>
                          )}
                          <span className="text-stone-300">· {timeAgo(ticket.created_at)}</span>
                        </div>
                      </div>
                      {ticket.unread_for_admin ? (
                        <span className="flex-shrink-0 w-2.5 h-2.5 bg-red-500 rounded-full mt-1.5 animate-pulse" />
                      ) : ticket.status === 'open' ? (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* Kanban view */
            <div className="flex gap-3 p-4 overflow-x-auto h-full">
              {KANBAN_COLUMNS.map(col => {
                const colTickets = filtered.filter(t => t.status === col.key)
                return (
                  <div key={col.key} className="flex-shrink-0 w-64 flex flex-col">
                    <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg mb-2 ${col.color}`}>
                      {col.label} ({colTickets.length})
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto">
                      {colTickets.map(ticket => (
                        <button
                          key={ticket.id}
                          onClick={() => openDrawer(ticket)}
                          className="w-full text-left bg-white border border-stone-100 rounded-xl p-3 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] text-stone-400 font-mono">#{ticket.ticket_number}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority] ?? 'bg-stone-100'}`}>
                              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                            </span>
                            {ticket.unread_for_admin && (
                              <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-stone-800 line-clamp-2">{ticket.subject}</p>
                          <p className="text-[10px] text-stone-400 mt-1">{ticket.user_name ?? 'Usuário'} · {timeAgo(ticket.created_at)}</p>
                        </button>
                      ))}
                      {colTickets.length === 0 && (
                        <p className="text-xs text-stone-300 text-center py-4">Vazio</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right drawer */}
      {selectedTicket && (
        <div className="flex flex-col w-full lg:w-[560px] border-l border-stone-100 bg-white flex-shrink-0 overflow-hidden">
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-stone-100 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs text-stone-400 font-mono">#{selectedTicket.ticket_number}</span>
                  {selectedTicket.plan_at_creation && (
                    <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                      {PLAN_LABELS[selectedTicket.plan_at_creation] ?? selectedTicket.plan_at_creation}
                    </span>
                  )}
                  {selectedTicket.unread_for_admin && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      Nova mensagem do cliente
                    </span>
                  )}
                </div>
                <p className="font-semibold text-stone-800 leading-snug">{selectedTicket.subject}</p>
                {/* User info row */}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-stone-500">{selectedTicket.user_name ?? 'Usuário'}</span>
                  {selectedTicket.user_plan && (
                    <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">
                      {PLAN_LABELS[selectedTicket.user_plan] ?? selectedTicket.user_plan}
                    </span>
                  )}
                  {selectedTicket.unread_for_user && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Aguardando cliente</span>
                  )}
                  <span className="text-xs text-stone-400">· Aberto em {formatDate(selectedTicket.created_at)}</span>
                </div>
              </div>
              <button onClick={closeDrawer} className="flex-shrink-0 p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SLA indicator */}
            {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (() => {
              const sla = getSLA(selectedTicket)
              return (
                <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium mt-2 ${sla.color}`}>
                  SLA: {sla.label}
                </div>
              )
            })()}

            {/* Status + Priority controls */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-stone-400">Status:</span>
                <select
                  className={selectCls}
                  value={selectedTicket.status}
                  disabled={updatingStatus}
                  onChange={e => updateTicket('status', e.target.value)}
                >
                  <option value="open">Aberto</option>
                  <option value="in_progress">Em atendimento</option>
                  <option value="awaiting_admin">Aguardando suporte</option>
                  <option value="awaiting_user">Aguardando cliente</option>
                  <option value="resolved">Resolvido</option>
                  <option value="closed">Fechado</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-stone-400">Prioridade:</span>
                <select
                  className={selectCls}
                  value={selectedTicket.priority}
                  disabled={updatingStatus}
                  onChange={e => updateTicket('priority', e.target.value)}
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              {isClosed ? (
                <button
                  onClick={() => updateTicket('status', 'open')}
                  disabled={updatingStatus}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" /> Reabrir
                </button>
              ) : (
                <button
                  onClick={() => updateTicket('status', 'closed')}
                  disabled={updatingStatus}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-stone-50 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50"
                >
                  Fechar ticket
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50 min-h-0">
            {loadingMessages ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}
              </div>
            ) : allMessages.map(msg => {
              const isAdminMsg = msg.sender_role === 'admin'
              if (msg.is_internal) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 max-w-[85%]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lock className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Nota interna</span>
                      </div>
                      <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[10px] text-amber-500 mt-1 text-right">{formatDateTime(msg.created_at)}</p>
                    </div>
                  </div>
                )
              }
              return (
                <div key={msg.id} className={`flex ${isAdminMsg ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isAdminMsg ? 'bg-blue-600 text-white' : 'bg-white border border-stone-100 text-stone-800'}`}>
                    {!isAdminMsg && (
                      <p className="text-[10px] font-semibold text-blue-600 mb-1">{msg.sender_name ?? 'Usuário'}</p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] mt-1.5 text-right ${isAdminMsg ? 'text-blue-200' : 'text-stone-300'}`}>
                      {formatDateTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply area */}
          <div className="flex-shrink-0 p-4 border-t border-stone-100 bg-white">
            {sendError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> {sendError}
              </div>
            )}

            {isClosed ? (
              <div className="flex items-center justify-between gap-2 text-sm text-stone-400 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  {selectedTicket.status === 'resolved' ? 'Ticket resolvido.' : 'Ticket fechado.'}
                </div>
                <button
                  onClick={() => updateTicket('status', 'open')}
                  disabled={updatingStatus}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  Reabrir
                </button>
              </div>
            ) : (
              <>
                {/* Template selector */}
                <div className="mb-2 relative">
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTemplate}
                      onChange={e => {
                        setSelectedTemplate(e.target.value)
                        if (e.target.value) {
                          const tpl = REPLY_TEMPLATES.find(t => t.label === e.target.value)
                          if (tpl) setReplyContent(tpl.text)
                        }
                      }}
                      className="flex-1 text-xs px-2 py-1.5 border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-300"
                    >
                      <option value="">Usar template...</option>
                      {REPLY_TEMPLATES.map(t => (
                        <option key={t.label} value={t.label}>{t.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400 -ml-6 pointer-events-none" />
                  </div>
                </div>

                {/* Internal note toggle */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setIsInternal(v => !v)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${isInternal ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                  >
                    <Lock className="w-3 h-3" />
                    {isInternal ? 'Nota interna ativada' : 'Nota interna'}
                  </button>
                  {isInternal && (
                    <span className="text-xs text-amber-600">Visível apenas para admins</span>
                  )}
                </div>

                <div className="flex gap-2 items-end">
                  <textarea
                    placeholder={isInternal ? 'Escreva uma nota interna...' : 'Responder usuário... (Ctrl+Enter para enviar)'}
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    disabled={sending}
                    className={`flex-1 resize-none px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white ${isInternal ? 'border-amber-300 focus:ring-amber-200' : 'border-stone-200 focus:ring-blue-200'}`}
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !replyContent.trim()}
                    className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
