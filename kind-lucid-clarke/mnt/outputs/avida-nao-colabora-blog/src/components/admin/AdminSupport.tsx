import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  MessageSquare, Search, X, Send, Lock, AlertTriangle,
  RefreshCw, RotateCcw, ChevronDown, LayoutList, Columns, FileText, Save, Inbox, Download,
  Star, MoreVertical, Copy, CheckCircle2, Clock, ArrowUpDown, Crown,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { emailSupportReplyForUser } from '../../lib/emailTriggers'

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
  user_email?: string | null
  user_joined_at?: string | null
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
  open: 'Novo',
  in_progress: 'Em atendimento',
  awaiting_admin: 'Aguardando suporte',
  awaiting_user: 'Aguardando usuário',
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
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus',
  therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}

const STATUS_TABS = [
  { key: '', label: 'Todos' },
  { key: 'open', label: 'Novos' },
  { key: 'in_progress', label: 'Em atendimento' },
  { key: 'awaiting_user', label: 'Aguardando usuário' },
  { key: 'resolved', label: 'Resolvidos' },
  { key: 'closed', label: 'Fechados' },
]

const REPLY_TEMPLATES_FALLBACK = [
  { id: 'f01', title: 'Recebemos sua solicitação', category: 'Boas-vindas', body: 'Olá! Recebemos sua solicitação e ela já está registrada por aqui.\n\nVou analisar as informações com atenção e te retornar assim que possível.\n\nEnquanto isso, você pode acompanhar o andamento por esta conversa dentro do site.' },
  { id: 'f02', title: 'Como o blog funciona', category: 'Uso do blog', body: 'Olá! O "A Vida Não Colabora" funciona como um espaço de apoio ao autoconhecimento e à organização emocional.\n\nVocê pode usar o site para ler artigos, registrar como está se sentindo no diário, responder questionários, acompanhar sua evolução, salvar conteúdos importantes e acessar recursos extras conforme o seu plano.\n\nA ideia não é oferecer diagnóstico ou substituir acompanhamento profissional, mas ajudar você a perceber padrões, organizar sentimentos e criar pequenos passos de cuidado no dia a dia.' },
  { id: 'f03', title: 'Objetivo do site', category: 'Missão e propósito', body: 'O objetivo do "A Vida Não Colabora" é oferecer um espaço simples, acolhedor e sem julgamentos para quem quer se entender melhor.\n\nO site ajuda você a organizar pensamentos, registrar emoções, perceber padrões, encontrar conteúdos úteis para o seu momento e construir uma rotina de autocuidado possível.\n\nEle é uma ferramenta complementar de autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.' },
  { id: 'f04', title: 'Missão do blog', category: 'Missão e propósito', body: 'Nossa missão é transformar temas de saúde emocional em algo mais próximo da vida real.\n\nFalamos sobre autocuidado, cansaço, ansiedade, autoestima, limites, rotina e emoções difíceis de uma forma simples, humana e prática.\n\nQueremos que você encontre aqui um espaço para respirar, se organizar e dar pequenos passos, sem cobrança de perfeição.' },
  { id: 'f05', title: 'Diferença entre os planos', category: 'Planos', body: 'Olá! Os planos foram pensados para diferentes níveis de uso dentro do site.\n\nO Gratuito permite começar: blog aberto, diário emocional básico, questionário inicial e algumas práticas guiadas.\n\nO Essencial (R$ 19,90/mês) libera uso contínuo: diário ilimitado, mapa emocional completo, histórico e gráficos, conteúdos guiados completos e relatório semanal automático.\n\nO Plus (R$ 39,90/mês) inclui tudo do Essencial e ainda plano de autocuidado mensal, relatório mensal aprofundado, comentário profissional mensal e orientação mensal por mensagem.' },
  { id: 'f06', title: 'Plano Gratuito', category: 'Planos', body: 'O plano Gratuito é uma forma de começar a usar o site sem compromisso.\n\nEle inclui artigos gratuitos, questionário básico de autoavaliação, diário de bem-estar com até 5 entradas por mês, registro simples de humor, mini-desafios quinzenais automatizados, histórico limitado e conteúdos com anúncios.\n\nÉ ideal para conhecer o projeto e começar a registrar emoções de forma simples.' },
  { id: 'f07', title: 'Plano Essencial', category: 'Planos', body: 'O plano Essencial custa R$ 19,90 por mês e é indicado para quem quer usar o site de forma contínua.\n\nEle inclui tudo do Gratuito e também diário ilimitado, histórico completo, avaliações semanais, gráficos simples de evolução, meditações guiadas em texto, notas guiadas no diário, relatórios mensais em PDF, resumo do diário, humor e sintomas, destaques de evolução sem análise clínica, biblioteca de exercícios emocionais, uso sem anúncios e suporte por e-mail prioritário.' },
  { id: 'f08', title: 'Plano Plus', category: 'Planos', body: 'O plano Plus custa R$ 39,90 por mês e é o plano mais completo.\n\nEle inclui tudo do Essencial e também plano de autocuidado mensal, relatório mensal aprofundado, comentário profissional mensal sobre seus registros e orientação mensal por mensagem.' },
  { id: 'f10', title: 'Qual plano escolher', category: 'Planos', body: 'Para escolher o plano, pense no tipo de uso que você deseja.\n\nSe você quer apenas conhecer o site, o Gratuito pode ser suficiente.\nSe quer registrar emoções com frequência e acompanhar seu mapa emocional, o Essencial costuma fazer mais sentido.\nSe quer também plano de autocuidado mensal, relatório aprofundado, comentário profissional e orientação mensal por mensagem, o Plus é o plano mais completo.' },
  { id: 'f11', title: 'Orientação mensal por mensagem', category: 'Orientação profissional', body: 'A orientação mensal por mensagem é um recurso do plano Plus.\n\nEla permite enviar uma solicitação mensal para receber uma orientação breve dentro do próprio site.\n\nA ideia é ajudar você a organizar dúvidas, revisar dificuldades do mês e receber um direcionamento simples de cuidado, sempre sem substituir acompanhamento psicológico, psiquiátrico ou médico.' },
  { id: 'f13', title: 'Comentário sobre o relatório do mês', category: 'Profissional', body: 'No plano Plus, o usuário pode receber um comentário profissional individual sobre o relatório do mês.\n\nEsse comentário deve ser uma devolutiva breve e organizada, feita a partir das informações autorizadas e disponíveis no relatório.' },
  { id: 'f14', title: 'Precisamos de mais informações', category: 'Suporte técnico', body: 'Olá! Para eu conseguir te ajudar melhor, preciso de mais algumas informações.\n\nVocê pode me enviar mais detalhes sobre o que aconteceu? Se possível, informe:\n- em qual página ou recurso ocorreu;\n- o que você tentou fazer;\n- se apareceu alguma mensagem de erro;\n- se o problema aconteceu no celular ou computador.\n\nAssim consigo analisar com mais precisão.' },
  { id: 'f15', title: 'Problema técnico em análise', category: 'Suporte técnico', body: 'Olá! Obrigado por avisar.\n\nEsse comportamento parece estar relacionado a uma instabilidade ou problema técnico. Vou verificar com mais cuidado e acompanhar por aqui.\n\nAssim que eu tiver uma atualização, te respondo nesta mesma solicitação.' },
  { id: 'f16', title: 'Problema resolvido', category: 'Suporte técnico', body: 'Olá! Fizemos uma verificação e o problema informado foi corrigido.\n\nVocê pode testar novamente, por favor?\n\nCaso ainda perceba algo errado, responda esta solicitação com mais detalhes para que eu continue acompanhando.' },
  { id: 'f17', title: 'Não consegui reproduzir o erro', category: 'Suporte técnico', body: 'Olá! Fiz alguns testes, mas por enquanto não consegui reproduzir o erro informado.\n\nVocê pode me enviar mais detalhes, como:\n- print da tela, se possível;\n- passo a passo do que você fez;\n- navegador ou aparelho usado;\n- horário aproximado em que aconteceu.\n\nCom isso, consigo investigar melhor.' },
  { id: 'f18', title: 'Recurso em implantação', category: 'Suporte', body: 'Olá! Esse recurso já faz parte do planejamento da plataforma, mas ainda está em implantação.\n\nEstamos organizando a funcionalidade para que ela funcione de forma segura, clara e integrada ao seu plano.\n\nAssim que estiver disponível, ela aparecerá dentro do site com instruções de uso.' },
  { id: 'f19', title: 'Recurso disponível em outro plano', category: 'Planos', body: 'Olá! Esse recurso faz parte de um plano superior ao seu plano atual.\n\nVocê ainda pode continuar usando os recursos disponíveis no seu plano, mas para acessar essa funcionalidade específica será necessário fazer upgrade.' },
  { id: 'f20', title: 'Solicitação de cancelamento', category: 'Comercial', body: 'Olá! Recebi sua solicitação de cancelamento.\n\nVou verificar as informações da sua assinatura e te orientar sobre os próximos passos.\n\nSe puder, me diga também o motivo do cancelamento. Isso nos ajuda a melhorar o serviço.' },
  { id: 'f21', title: 'Pagamento ou assinatura', category: 'Pagamento', body: 'Olá! Vou te ajudar com sua assinatura.\n\nPara analisar melhor, me informe o que aconteceu:\n- pagamento não aprovado;\n- cobrança duplicada;\n- plano não liberado;\n- desconto não aplicado;\n- dúvida sobre renovação;\n- cancelamento.\n\nCom essas informações, consigo direcionar melhor o atendimento.' },
  { id: 'f22', title: 'Privacidade dos registros', category: 'Privacidade', body: 'Seus registros no diário, respostas de questionários e relatórios são informações pessoais.\n\nA proposta do site é que esses dados sejam usados para melhorar sua própria experiência dentro da plataforma, como gráficos, resumos e sugestões.' },
  { id: 'f23', title: 'Atendimento ao usuário Plus', category: 'Suporte', body: 'Olá! Vi que você está no plano Plus, então vou dar atenção especial à sua solicitação.\n\nVou analisar o caso com cuidado e te retornar por aqui assim que possível.' },
  { id: 'f24', title: 'Encerramento cordial', category: 'Encerramento', body: 'Olá! Como não tivemos novas mensagens por aqui e a solicitação parece ter sido resolvida, vou encerrar este atendimento.\n\nSe precisar de ajuda novamente, você pode abrir uma nova solicitação pelo Suporte dentro do site.' },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
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
function getSLA(ticket: Ticket): { label: string; color: string } {
  const created = new Date(ticket.created_at).getTime()
  const hours = (Date.now() - created) / 3600000
  const slaHours: Record<string, number> = {
    free: 72, essential: 48, plus: 24, therapeutic: 24, 'therapeutic-plus': 24,
  }
  const limit = slaHours[ticket.user_plan ?? ticket.plan_at_creation ?? 'free'] ?? 72
  if (hours > limit) return { label: 'Atrasado', color: 'bg-red-100 text-red-700' }
  if (hours > limit * 0.75) return { label: 'Perto de vencer', color: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Dentro do prazo', color: 'bg-green-100 text-green-700' }
}
function getSLARemaining(ticket: Ticket): {
  timeStr: string; isOverdue: boolean; isWarning: boolean; isOk: boolean
  deadline: string; limitHours: number
} {
  const created = new Date(ticket.created_at).getTime()
  const slaHours: Record<string, number> = {
    free: 72, essential: 48, plus: 24, therapeutic: 24, 'therapeutic-plus': 24,
  }
  const limit = slaHours[ticket.user_plan ?? ticket.plan_at_creation ?? 'free'] ?? 72
  const deadlineMs = created + limit * 3600000
  const deadlineStr = new Date(deadlineMs).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
  const remaining = deadlineMs - Date.now()
  if (remaining <= 0) {
    const e = Math.abs(remaining)
    const h = Math.floor(e / 3600000), m = Math.floor((e % 3600000) / 60000)
    return { timeStr: `-${h > 0 ? `${h}h ${m}m` : `${m}m`}`, isOverdue: true, isWarning: false, isOk: false, deadline: deadlineStr, limitHours: limit }
  }
  const h = Math.floor(remaining / 3600000), m = Math.floor((remaining % 3600000) / 60000)
  const isWarning = remaining < limit * 3600000 * 0.25
  return { timeStr: h > 0 ? `${h}h ${m}m` : `${m}m`, isOverdue: false, isWarning, isOk: !isWarning, deadline: deadlineStr, limitHours: limit }
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}
function formatAvgTime(ms: number | null): string {
  if (ms === null) return '—'
  const hours = ms / 3600000
  if (hours < 1) return `${Math.round(hours * 60)}min`
  if (hours < 24) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24)}d`
}
function isOverdue(ticket: Ticket): boolean {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false
  return getSLA(ticket).label === 'Atrasado'
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

const STATUS_DOT_OPTIONS = [
  { value: 'open', label: 'Novo', dot: 'bg-blue-500' },
  { value: 'in_progress', label: 'Em atendimento', dot: 'bg-orange-500' },
  { value: 'awaiting_admin', label: 'Aguard. suporte', dot: 'bg-red-500' },
  { value: 'awaiting_user', label: 'Aguard. usuário', dot: 'bg-purple-500' },
  { value: 'resolved', label: 'Resolvido', dot: 'bg-green-500' },
  { value: 'closed', label: 'Fechado', dot: 'bg-stone-400' },
]
const PRIORITY_DOT_OPTIONS = [
  { value: 'low', label: 'Baixa', dot: 'bg-stone-400' },
  { value: 'medium', label: 'Média', dot: 'bg-yellow-500' },
  { value: 'high', label: 'Alta', dot: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgente', dot: 'bg-red-500' },
]

const KANBAN_COLUMNS = [
  { key: 'open', label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  { key: 'awaiting_admin', label: 'Aguardando suporte', color: 'bg-red-100 text-red-700' },
  { key: 'in_progress', label: 'Em atendimento', color: 'bg-orange-100 text-orange-700' },
  { key: 'awaiting_user', label: 'Aguardando usuário', color: 'bg-purple-100 text-purple-700' },
  { key: 'resolved', label: 'Resolvido', color: 'bg-green-100 text-green-700' },
]

interface ReplyTemplate { id: string; title: string; category: string; body: string }

const PAGE_SIZE = 12
const draftKey = (id: string) => `avnc-support-draft-${id}`

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const src = name ?? email ?? 'U'
  return src.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminSupport({ onManageTemplates, onViewUser }: { onManageTemplates?: () => void; onViewUser?: (userId: string) => void }) {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [statusTab, setStatusTab] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [page, setPage] = useState(1)

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [msgOrder, setMsgOrder] = useState<'asc' | 'desc'>('asc')
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [starredTickets, setStarredTickets] = useState<Set<string>>(new Set())
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const [templates, setTemplates] = useState<ReplyTemplate[]>(REPLY_TEMPLATES_FALLBACK)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)

  useEffect(() => {
    supabase.from('support_reply_templates').select('id,title,category,body').eq('is_active', true)
      .in('usage_context', ['support', 'both']).order('category').order('title').then(({ data }) => {
        if (data && data.length > 0) setTemplates(data as ReplyTemplate[])
      })
  }, [])

  const bottomRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountRef = useRef(0)
  const drawerOpenRef = useRef(false)

  const loadTickets = useCallback(async () => {
    setLoading(true); setLoadError(false)
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) { setLoadError(true); setLoading(false); return }
    if (!data) { setLoading(false); return }

    const userIds = [...new Set(data.map((t: Ticket) => t.user_id))]
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name, plan, email, created_at').in('user_id', userIds)
      : { data: [] }

    const profileMap = new Map((profiles || []).map((p: { user_id: string; full_name: string | null; plan: string; email: string | null; created_at: string | null }) => [p.user_id, p]))

    setTickets(data.map((t: Ticket) => ({
      ...t,
      user_name: profileMap.get(t.user_id)?.full_name ?? null,
      user_plan: profileMap.get(t.user_id)?.plan ?? null,
      user_email: profileMap.get(t.user_id)?.email ?? null,
      user_joined_at: profileMap.get(t.user_id)?.created_at ?? null,
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

    const enriched: Message[] = rawData.map(m => ({ ...m, sender_name: profileMap.get(m.sender_id)?.full_name ?? null }))

    setMessages(prev => {
      if (silent && enriched.length === lastCountRef.current) return prev
      lastCountRef.current = enriched.length
      return enriched
    })
    if (!silent) setLoadingMessages(false)
  }, [])

  function openDrawer(ticket: Ticket) {
    setSelectedTicket(ticket)
    let draft = ''
    try { draft = localStorage.getItem(draftKey(ticket.id)) ?? '' } catch { /* noop */ }
    setReplyContent(draft)
    setSendError(null)
    setSavedMsg(null)
    setIsInternal(false)
    setSelectedTemplate('')
    setShowTemplatePanel(false)
    setShowMoreMenu(false)
    setMsgOrder('asc')
    lastCountRef.current = 0
    drawerOpenRef.current = true
    loadMessages(ticket.id)
  }

  function closeDrawer() {
    drawerOpenRef.current = false
    setSelectedTicket(null)
    setMessages([])
    setShowMoreMenu(false)
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }

  useEffect(() => {
    if (!selectedTicket) return
    try {
      if (replyContent.trim()) localStorage.setItem(draftKey(selectedTicket.id), replyContent)
      else localStorage.removeItem(draftKey(selectedTicket.id))
    } catch { /* noop */ }
  }, [replyContent, selectedTicket])

  function saveDraft() {
    if (!selectedTicket) return
    try { localStorage.setItem(draftKey(selectedTicket.id), replyContent) } catch { /* noop */ }
    setSavedMsg('Rascunho salvo'); setTimeout(() => setSavedMsg(null), 2500)
  }

  useEffect(() => {
    if (!selectedTicket) return
    if (selectedTicket.status === 'closed' || selectedTicket.status === 'resolved') return
    pollingRef.current = setInterval(() => {
      if (drawerOpenRef.current) loadMessages(selectedTicket.id, true)
    }, 4000)
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicket?.id, selectedTicket?.status, loadMessages])

  useEffect(() => {
    if (messages.length > 0 && msgOrder === 'asc')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [messages.length, msgOrder])

  async function handleSend() {
    const trimmed = replyContent.trim()
    if (!trimmed || sending || !selectedTicket || !user) return

    setSending(true)
    setSendError(null)
    const optimisticId = `opt-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId, ticket_id: selectedTicket.id, sender_id: user.id,
      sender_role: 'admin', sender_name: 'Suporte', content: trimmed,
      is_internal: isInternal, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setReplyContent('')
    try { localStorage.removeItem(draftKey(selectedTicket.id)) } catch { /* noop */ }

    const { data: newMsg, error } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: selectedTicket.id, sender_id: user.id, sender_role: 'admin', content: trimmed, is_internal: isInternal })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setReplyContent(trimmed)
      setSendError('Erro ao enviar. Tente novamente.')
      setSending(false)
      return
    }

    setMessages(prev => prev.map(m => m.id === optimisticId ? { ...newMsg, sender_name: 'Suporte' } : m))

    if (!isInternal) {
      if (selectedTicket.user_id) void emailSupportReplyForUser(selectedTicket.user_id, selectedTicket.id, newMsg.id)
      const now = new Date().toISOString()
      await supabase.from('support_tickets').update({
        unread_for_user: true, unread_for_admin: false, status: 'awaiting_user',
        last_message_at: now, last_admin_message_at: now,
      }).eq('id', selectedTicket.id)

      const updated = { ...selectedTicket, status: 'awaiting_user', unread_for_admin: false, unread_for_user: true }
      setSelectedTicket(updated)
      setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, status: 'awaiting_user', unread_for_admin: false } : t))
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

    const { data, error } = await supabase.from('support_tickets').update(updates).eq('id', selectedTicket.id).select().single()
    if (!error && data) {
      setSelectedTicket(prev => prev ? { ...prev, ...updates } : prev)
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...updates } : t))
    }
    setUpdatingStatus(false)
  }

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000)
    }).catch(() => {})
  }

  function toggleStar(id: string) {
    setStarredTickets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Derivados ──────────────────────────────────────────────────────────────
  const planOf = (t: Ticket) => t.user_plan ?? t.plan_at_creation ?? ''
  const categories = [...new Set(tickets.map(t => t.category).filter(Boolean))] as string[]

  const filtered = tickets
    .filter(t => !statusTab || t.status === statusTab)
    .filter(t => !priorityFilter || t.priority === priorityFilter)
    .filter(t => !categoryFilter || t.category === categoryFilter)
    .filter(t => !planFilter || PLAN_LABELS[planOf(t)] === PLAN_LABELS[planFilter] || planOf(t) === planFilter)
    .filter(t => !unreadOnly || t.unread_for_admin)
    .filter(t => !overdueOnly || isOverdue(t))
    .filter(t => {
      if (!periodFilter) return true
      const days = (Date.now() - new Date(t.created_at).getTime()) / 86400000
      return days <= Number(periodFilter)
    })
    .filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (t.user_name ?? '').toLowerCase().includes(q) ||
        (t.user_email ?? '').toLowerCase().includes(q) ||
        (t.subject ?? '').toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q)
      )
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const paginated = viewMode === 'list' ? filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE) : filtered

  const today = new Date()
  const resolvedToday = tickets.filter(t => {
    if (!['resolved', 'closed'].includes(t.status)) return false
    const ref = t.resolved_at ?? t.closed_at ?? t.updated_at
    if (!ref) return false
    const d = new Date(ref)
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).length

  const avgResponseMs = (() => {
    const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status) && t.last_message_at)
    if (!resolved.length) return null
    const total = resolved.reduce((sum, t) => sum + (new Date(t.last_message_at!).getTime() - new Date(t.created_at).getTime()), 0)
    return total / resolved.length
  })()

  const cnt = (s: string) => tickets.filter(t => t.status === s).length
  const summaryCards = [
    { key: 'open', n: loading ? '—' : cnt('open'), label: 'Novos', Icon: Inbox, bg: 'bg-blue-50', num: 'text-blue-600', border: 'border-blue-100' },
    { key: 'in_progress', n: loading ? '—' : cnt('in_progress'), label: 'Em atendimento', Icon: MessageSquare, bg: 'bg-orange-50', num: 'text-orange-600', border: 'border-orange-100' },
    { key: '__resolved_today', n: loading ? '—' : resolvedToday, label: 'Resolvidos hoje', Icon: CheckCircle2, bg: 'bg-green-50', num: 'text-green-600', border: 'border-green-100' },
    { key: '__overdue', n: loading ? '—' : tickets.filter(isOverdue).length, label: 'Atrasados', Icon: AlertTriangle, bg: 'bg-red-50', num: 'text-red-600', border: 'border-red-100' },
    { key: '__avg', n: loading ? '—' : formatAvgTime(avgResponseMs), label: 'Tempo médio', Icon: Clock, bg: 'bg-amber-50', num: 'text-amber-600', border: 'border-amber-100' },
  ]

  function clickCard(key: string) {
    setPage(1)
    if (key === '__overdue') { setOverdueOnly(v => !v); setStatusTab('') }
    else if (key === '__resolved_today' || key === '__avg') { /* stat-only, no filter */ }
    else { setOverdueOnly(false); setStatusTab(prev => prev === key ? '' : key) }
  }
  function clearFilters() {
    setStatusTab(''); setPriorityFilter(''); setCategoryFilter(''); setPlanFilter(''); setPeriodFilter(''); setUnreadOnly(false); setOverdueOnly(false); setSearch(''); setPage(1)
  }
  const hasFilters = !!(statusTab || priorityFilter || categoryFilter || planFilter || periodFilter || unreadOnly || overdueOnly || search)

  function exportCSV() {
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['#', 'Assunto', 'Status', 'Prioridade', 'Categoria', 'Plano', 'Usuário', 'E-mail', 'Criado em', 'Última atualização', 'SLA']
    const rows = filtered.map(t => [
      t.ticket_number, t.subject ?? '', STATUS_LABELS[t.status] ?? t.status,
      PRIORITY_LABELS[t.priority] ?? t.priority, t.category ?? '',
      PLAN_LABELS[planOf(t)] ?? planOf(t) ?? '', t.user_name ?? '', t.user_email ?? '',
      formatDateTime(t.created_at),
      formatDateTime(t.last_message_at ?? t.updated_at ?? t.created_at),
      (t.status === 'resolved' || t.status === 'closed') ? '—' : getSLA(t).label,
    ])
    const lines = [header, ...rows].map(r => r.map(esc).join(','))
    const bom = String.fromCharCode(0xFEFF)
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `suporte-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const allMessages: Message[] = selectedTicket ? [descriptionAsMessage(selectedTicket), ...messages] : []
  const orderedMessages = msgOrder === 'asc' ? allMessages : [...allMessages].reverse()
  const quickSuggestions = templates.slice(0, 3)
  const isClosed = selectedTicket?.status === 'closed' || selectedTicket?.status === 'resolved'
  const priorSameUser = selectedTicket ? tickets.filter(t => t.user_id === selectedTicket.user_id && t.id !== selectedTicket.id).length : 0
  const selectCls = 'w-full px-2 py-1.5 text-xs border border-line rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 disabled:opacity-50'

  return (
    <div className="flex h-full overflow-hidden bg-paper">
      {/* ─── Coluna esquerda ─── */}
      <div className={`flex flex-col flex-1 min-w-0 ${selectedTicket ? 'hidden lg:flex' : 'flex'}`}>

        {/* Cabeçalho */}
        <div className="px-6 pt-5 pb-0 border-b border-line flex-shrink-0 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="font-serif text-3xl text-forest-900">Suporte</h1>
              <p className="text-sm text-ink-soft mt-0.5">Resolva problemas técnicos, conta, pagamento e dúvidas de uso.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={loadTickets} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-xl text-xs text-forest-800 hover:border-forest-300">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
              <button onClick={exportCSV} disabled={loading || filtered.length === 0} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-xl text-xs text-forest-800 hover:border-forest-300 disabled:opacity-50">
                <Download className="w-3.5 h-3.5" /> Extrair relatório
              </button>
              {onManageTemplates && (
                <button onClick={onManageTemplates} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-xl text-xs text-forest-800 hover:border-forest-300">
                  <FileText className="w-3.5 h-3.5" /> Modelos de resposta
                </button>
              )}
              <div className="flex items-center gap-1 border border-line rounded-xl p-0.5">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-forest-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`} title="Lista"><LayoutList className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-lg ${viewMode === 'kanban' ? 'bg-forest-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`} title="Kanban"><Columns className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Cards de resumo (5) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 mb-4">
            {summaryCards.map(c => {
              const active = (c.key === '__overdue' && overdueOnly) || (statusTab === c.key)
              const isClickable = c.key !== '__resolved_today' && c.key !== '__avg'
              return (
                <button key={c.key} onClick={() => clickCard(c.key)}
                  className={`text-left border rounded-2xl p-3.5 transition-all ${c.bg} ${active ? `${c.border} ring-1 ring-offset-0` : `${c.border} ${isClickable ? 'hover:shadow-sm' : 'cursor-default'}`}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <c.Icon className={`w-4 h-4 ${c.num}`} />
                  </div>
                  <p className={`font-serif text-2xl font-semibold ${c.num}`}>{c.n}</p>
                  <p className="text-[11px] font-medium text-stone-600 leading-tight mt-0.5">{c.label}</p>
                </button>
              )
            })}
          </div>

          {/* Status tabs — underline nav */}
          <div className="flex overflow-x-auto -mx-1 px-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.key} onClick={() => { setStatusTab(tab.key); setOverdueOnly(false); setPage(1) }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  statusTab === tab.key && !overdueOnly
                    ? 'border-forest-700 text-forest-800'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
                }`}>
                {tab.label}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                  {tickets.filter(t => !tab.key || t.status === tab.key).length}
                </span>
              </button>
            ))}
            <button onClick={() => { setOverdueOnly(v => !v); setPage(1) }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                overdueOnly ? 'border-red-500 text-red-600' : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}>
              Atrasados
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">{tickets.filter(isOverdue).length}</span>
            </button>
          </div>
        </div>

        {/* Barra de busca e filtros */}
        <div className="px-4 py-3 border-b border-line bg-white flex-shrink-0 flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              className="w-full pl-8 pr-3 py-2 border border-line rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-forest-300"
              placeholder="Buscar por ID, usuário, assunto ou e-mail…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} className="text-xs px-2.5 py-2 border border-line rounded-lg bg-white focus:outline-none">
            <option value="">Categoria</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }} className="text-xs px-2.5 py-2 border border-line rounded-lg bg-white focus:outline-none">
            <option value="">Plano</option>
            <option value="free">Gratuito</option>
            <option value="essential">Essencial</option>
            <option value="plus">Plus</option>
          </select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1) }} className="text-xs px-2.5 py-2 border border-line rounded-lg bg-white focus:outline-none">
            <option value="">Prioridade</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
          <select value={periodFilter} onChange={e => { setPeriodFilter(e.target.value); setPage(1) }} className="text-xs px-2.5 py-2 border border-line rounded-lg bg-white focus:outline-none">
            <option value="">Período</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
          </select>
          <button onClick={() => { setUnreadOnly(v => !v); setPage(1) }} className={`text-xs px-3 py-2 rounded-lg border transition-colors ${unreadOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white border-line text-stone-600 hover:border-red-300'}`}>Não lidos</button>
          {hasFilters && <button onClick={clearFilters} className="text-xs text-stone-400 hover:text-stone-600 px-1">Limpar</button>}
        </div>

        {/* Lista / Kanban */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />)}</div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
              <AlertTriangle className="w-8 h-8 opacity-40 mb-2" />
              <p className="text-sm">Não foi possível carregar os tickets.</p>
              <button onClick={loadTickets} className="mt-3 text-sm text-forest-700 underline">Tentar novamente</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
              <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-sm">{hasFilters ? 'Nenhum ticket corresponde aos filtros.' : 'Nenhum ticket encontrado.'}</p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white border-b border-line">
                    <tr>
                      <th className="w-10 px-4 py-3 text-left text-xs font-medium text-stone-400">#</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-stone-500">Assunto</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-stone-500 hidden md:table-cell">Usuário</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-stone-500 hidden lg:table-cell">Plano</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-stone-500 hidden lg:table-cell">Prioridade</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-stone-500">Status</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-stone-500 hidden md:table-cell">Atualizado</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-stone-500 hidden xl:table-cell">SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {paginated.map(ticket => {
                      const overdue = isOverdue(ticket)
                      const sla = getSLA(ticket)
                      const isSelected = selectedTicket?.id === ticket.id
                      return (
                        <tr key={ticket.id} onClick={() => openDrawer(ticket)}
                          className={`cursor-pointer hover:bg-stone-50 transition-colors ${isSelected ? 'bg-mint/20' : ''}`}>
                          <td className="w-10 px-4 py-3 text-xs text-stone-400 font-mono whitespace-nowrap">
                            {ticket.unread_for_admin
                              ? <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0 animate-pulse" />#{ticket.ticket_number}</span>
                              : <span>#{ticket.ticket_number}</span>
                            }
                          </td>
                          <td className="px-3 py-3 min-w-[160px] max-w-[260px]">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-forest-700' : 'text-forest-900'}`}>{ticket.subject}</p>
                            {ticket.category && <p className="text-[10px] text-stone-400 truncate mt-0.5">{ticket.category}</p>}
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell min-w-[130px] max-w-[180px]">
                            <p className="text-xs font-medium text-stone-700 truncate">{ticket.user_name ?? 'Usuário'}</p>
                            {ticket.user_email && <p className="text-[10px] text-stone-400 truncate">{ticket.user_email}</p>}
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell whitespace-nowrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                              {PLAN_LABELS[planOf(ticket)] ?? planOf(ticket) ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority] ?? 'bg-stone-100'}`}>
                              {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status] ?? 'bg-stone-100'}`}>
                              {STATUS_LABELS[ticket.status] ?? ticket.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell text-xs text-stone-400 whitespace-nowrap">
                            {timeAgo(ticket.last_message_at ?? ticket.updated_at ?? ticket.created_at)}
                          </td>
                          <td className="px-3 py-3 hidden xl:table-cell whitespace-nowrap">
                            {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${overdue ? 'bg-red-100 text-red-700' : sla.color}`}>
                                {sla.label}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Paginação */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-stone-500 border-t border-line">
                <span>Mostrando {(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, filtered.length)} de {filtered.length} tickets</span>
                <div className="flex items-center gap-1">
                  <button disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 border border-line rounded-lg disabled:opacity-40 hover:bg-stone-50">Anterior</button>
                  <span className="px-2">{curPage} / {totalPages}</span>
                  <button disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2.5 py-1 border border-line rounded-lg disabled:opacity-40 hover:bg-stone-50">Próxima</button>
                </div>
              </div>
            </>
          ) : (
            /* Kanban */
            <div className="flex gap-3 p-4 overflow-x-auto h-full">
              {KANBAN_COLUMNS.map(col => {
                const colTickets = filtered.filter(t => t.status === col.key)
                return (
                  <div key={col.key} className="flex-shrink-0 w-64 flex flex-col">
                    <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg mb-2 ${col.color}`}>{col.label} ({colTickets.length})</div>
                    <div className="flex-1 space-y-2 overflow-y-auto">
                      {colTickets.map(ticket => (
                        <button key={ticket.id} onClick={() => openDrawer(ticket)} className="w-full text-left bg-white border border-line rounded-xl p-3 hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] text-stone-400 font-mono">#{ticket.ticket_number}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ticket.priority] ?? 'bg-stone-100'}`}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</span>
                            {ticket.unread_for_admin && <span className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                          </div>
                          <p className="text-xs font-medium text-forest-900 line-clamp-2">{ticket.subject}</p>
                          <p className="text-[10px] text-stone-400 mt-1">{ticket.user_name ?? 'Usuário'} · {timeAgo(ticket.created_at)}</p>
                        </button>
                      ))}
                      {colTickets.length === 0 && <p className="text-xs text-stone-300 text-center py-4">Vazio</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Painel lateral de detalhes ─── */}
      <div className={`${selectedTicket ? 'flex' : 'hidden lg:flex'} flex-col w-full lg:w-[540px] border-l border-line bg-white flex-shrink-0 overflow-hidden`}>
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-stone-400">
            <MessageSquare className="w-10 h-10 opacity-30 mb-3" />
            <p className="text-sm">Selecione um ticket para visualizar detalhes e responder.</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho do ticket */}
            <div className="px-5 py-4 border-b border-line flex-shrink-0 bg-white">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_COLORS[selectedTicket.priority] ?? 'bg-stone-100'}`}>
                      {PRIORITY_LABELS[selectedTicket.priority] ?? selectedTicket.priority}
                    </span>
                    <span className="text-xs text-stone-400 font-mono">#{selectedTicket.ticket_number}</span>
                    {selectedTicket.unread_for_admin && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium animate-pulse">Nova mensagem</span>
                    )}
                  </div>
                  <p className="font-semibold text-forest-900 leading-snug line-clamp-2">{selectedTicket.subject}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Aberto em {formatDateTime(selectedTicket.created_at)}
                    {selectedTicket.source && ` via ${selectedTicket.source.charAt(0).toUpperCase() + selectedTicket.source.slice(1)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleStar(selectedTicket.id)} className={`p-1.5 rounded-lg hover:bg-stone-100 ${starredTickets.has(selectedTicket.id) ? 'text-amber-400' : 'text-stone-300 hover:text-amber-400'}`}>
                    <Star className="w-4 h-4" fill={starredTickets.has(selectedTicket.id) ? 'currentColor' : 'none'} />
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowMoreMenu(v => !v)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMoreMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-line rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
                        <button onClick={() => { exportCSV(); setShowMoreMenu(false) }} className="w-full text-left px-4 py-2 text-xs text-stone-600 hover:bg-stone-50 flex items-center gap-2">
                          <Download className="w-3.5 h-3.5" /> Exportar ticket
                        </button>
                        <button onClick={() => { setShowMoreMenu(false) }} className="w-full text-left px-4 py-2 text-xs text-stone-400 hover:bg-stone-50">Fechar menu</button>
                      </div>
                    )}
                  </div>
                  <button onClick={closeDrawer} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Dados do usuário + controles — área scrollável no painel */}
            <div className="overflow-y-auto flex-shrink-0 max-h-[280px] border-b border-line bg-stone-50">
              {/* Card do usuário */}
              <div className="px-5 pt-4 pb-3">
                <div className="bg-white rounded-2xl border border-line p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-sm font-semibold text-forest-700 flex-shrink-0">
                      {initials(selectedTicket.user_name, selectedTicket.user_email)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-forest-900 text-sm truncate">{selectedTicket.user_name ?? 'Usuário'}</p>
                        <button
                          onClick={() => onViewUser?.(selectedTicket.user_id)}
                          className="flex-shrink-0 text-xs border border-line px-2.5 py-1 rounded-lg text-stone-600 hover:bg-stone-50 whitespace-nowrap"
                        >Ver perfil</button>
                      </div>
                      {selectedTicket.user_email && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-stone-400 truncate">{selectedTicket.user_email}</p>
                          <button onClick={() => copyEmail(selectedTicket.user_email!)} className="flex-shrink-0 text-stone-300 hover:text-stone-500" title="Copiar e-mail">
                            {copiedEmail ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-stone-500 flex-wrap border-t border-stone-50 pt-3">
                    <span className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      {PLAN_LABELS[planOf(selectedTicket)] ?? planOf(selectedTicket) ?? '—'}
                    </span>
                    {selectedTicket.user_joined_at && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                        Desde {formatShortDate(selectedTicket.user_joined_at)}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                      {priorSameUser + 1} ticket{priorSameUser + 1 !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Grid 3 colunas: Status, Prioridade, SLA */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Status</p>
                    <DotSelect
                      value={selectedTicket.status}
                      onChange={v => updateTicket('status', v)}
                      disabled={updatingStatus}
                      options={STATUS_DOT_OPTIONS}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Prioridade</p>
                    <DotSelect
                      value={selectedTicket.priority}
                      onChange={v => updateTicket('priority', v)}
                      disabled={updatingStatus}
                      options={PRIORITY_DOT_OPTIONS}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">SLA</p>
                    {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' ? (() => {
                      const sla = getSLARemaining(selectedTicket)
                      const timeColor = sla.isOverdue ? 'text-red-600' : sla.isWarning ? 'text-yellow-600' : 'text-green-600'
                      const iconColor = sla.isOverdue ? 'text-red-500' : sla.isWarning ? 'text-yellow-500' : 'text-green-500'
                      return (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
                            <span className={`text-base font-bold leading-none ${timeColor}`}>{sla.timeStr}</span>
                          </div>
                          <p className="text-[10px] text-stone-400 mt-1">{sla.isOverdue ? 'vencido' : sla.isWarning ? 'perto de vencer' : 'dentro da meta'}</p>
                        </div>
                      )
                    })() : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </div>
                </div>

                {/* Card SLA */}
                {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (() => {
                  const sla = getSLARemaining(selectedTicket)
                  const cardCls = sla.isOverdue
                    ? 'bg-red-50 border-red-200'
                    : sla.isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
                  const textCls = sla.isOverdue ? 'text-red-700' : sla.isWarning ? 'text-yellow-700' : 'text-green-700'
                  const iconCls = sla.isOverdue ? 'text-red-500' : sla.isWarning ? 'text-yellow-500' : 'text-green-500'
                  const label = sla.isOverdue ? 'SLA vencido' : sla.isWarning ? 'Perto de vencer' : 'Dentro da meta de resposta'
                  const Icon = sla.isOverdue || sla.isWarning ? AlertTriangle : CheckCircle2
                  return (
                    <div className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-3 mb-3 ${cardCls}`}>
                      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconCls}`} />
                      <div>
                        <p className={`text-xs font-semibold ${textCls}`}>{label}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">Meta: {sla.limitHours}h | Responder até: {sla.deadline}</p>
                      </div>
                    </div>
                  )
                })()}

                {/* Ações rápidas */}
                <div className="flex gap-2 flex-wrap">
                  {isClosed ? (
                    <button onClick={() => updateTicket('status', 'open')} disabled={updatingStatus} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">
                      <RotateCcw className="w-3 h-3" /> Reabrir ticket
                    </button>
                  ) : (
                    <>
                      <button onClick={() => updateTicket('status', 'resolved')} disabled={updatingStatus} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50">
                        <CheckCircle2 className="w-3 h-3" /> Marcar resolvido
                      </button>
                      <button onClick={() => updateTicket('status', 'closed')} disabled={updatingStatus} className="text-xs px-3 py-1.5 bg-stone-50 border border-line text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-50">Fechar</button>
                    </>
                  )}
                  {selectedTicket.category && (
                    <span className="text-[10px] px-2.5 py-1.5 bg-white border border-line text-stone-500 rounded-lg">{selectedTicket.category}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Conversa */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-stone-100 bg-stone-50 sticky top-0 z-10">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Conversa</p>
                <button onClick={() => setMsgOrder(v => v === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600">
                  <ArrowUpDown className="w-3 h-3" />
                  {msgOrder === 'asc' ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}
                </button>
              </div>
              <div className="p-4 space-y-3">
                {loadingMessages ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}</div>
                ) : orderedMessages.map(msg => {
                  const isAdminMsg = msg.sender_role === 'admin'
                  if (msg.is_internal) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 max-w-[85%]">
                          <div className="flex items-center gap-1.5 mb-1"><Lock className="w-3 h-3 text-amber-500" /><span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Nota interna</span></div>
                          <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-[10px] text-amber-500 mt-1 text-right">{formatDateTime(msg.created_at)}</p>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={msg.id} className={`flex ${isAdminMsg ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isAdminMsg ? 'bg-forest-700 text-white' : 'bg-white border border-line text-forest-900'}`}>
                        <p className={`text-[10px] font-semibold mb-1 ${isAdminMsg ? 'text-forest-100' : 'text-forest-600'}`}>{isAdminMsg ? 'Suporte' : (msg.sender_name ?? 'Usuário')}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-1.5 text-right ${isAdminMsg ? 'text-forest-200' : 'text-stone-300'}`}>{formatDateTime(msg.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Área de resposta */}
            <div className="flex-shrink-0 border-t border-line bg-white">
              {sendError && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-4 py-2 border-b border-red-100"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {sendError}</div>}
              {savedMsg && <div className="text-xs text-forest-700 bg-mint/60 px-4 py-2 border-b border-mint">{savedMsg}</div>}

              {isClosed ? (
                <div className="flex items-center justify-between gap-2 text-sm text-stone-400 px-5 py-4">
                  <div className="flex items-center gap-2"><Lock className="w-4 h-4 flex-shrink-0" />{selectedTicket.status === 'resolved' ? 'Ticket resolvido.' : 'Ticket fechado.'}</div>
                  <button onClick={() => updateTicket('status', 'open')} disabled={updatingStatus} className="text-xs text-blue-600 hover:underline disabled:opacity-50">Reabrir</button>
                </div>
              ) : (
                <div className="p-4">
                  {/* Seletor de modelo */}
                  <div className="mb-3 relative">
                    <button type="button" onClick={() => setShowTemplatePanel(v => !v)}
                      className="w-full flex items-center justify-between text-xs px-2.5 py-2 border border-line rounded-lg bg-white hover:bg-stone-50">
                      <span className="text-stone-500 truncate">{selectedTemplate ? (templates.find(t => t.id === selectedTemplate)?.title ?? 'Selecionar modelo…') : 'Selecionar modelo…'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-stone-400 flex-shrink-0 ml-2 transition-transform ${showTemplatePanel ? 'rotate-180' : ''}`} />
                    </button>
                    {showTemplatePanel && (() => {
                      const cats = [...new Set(templates.map(t => t.category))].sort()
                      const list = templates
                        .filter(t => !templateCategory || t.category === templateCategory)
                        .filter(t => !templateSearch || t.title.toLowerCase().includes(templateSearch.toLowerCase()) || t.body.toLowerCase().includes(templateSearch.toLowerCase()))
                      return (
                        <div className="absolute bottom-full mb-1 left-0 right-0 border border-line rounded-xl bg-white shadow-lg z-20 overflow-hidden">
                          <div className="p-2 border-b border-line flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400" />
                              <input autoFocus value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} placeholder="Buscar modelo…" className="w-full pl-6 pr-2 py-1 text-xs border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-300" />
                            </div>
                            <select value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} className="text-xs px-2 py-1 border border-line rounded-lg bg-white focus:outline-none">
                              <option value="">Todas categorias</option>
                              {cats.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="max-h-52 overflow-y-auto divide-y divide-stone-50">
                            {list.length === 0
                              ? <p className="text-xs text-stone-400 text-center py-4">Nenhum modelo encontrado</p>
                              : list.map(t => (
                                <button key={t.id} type="button"
                                  onClick={() => { setSelectedTemplate(t.id); setReplyContent(t.body); setShowTemplatePanel(false); setTemplateSearch('') }}
                                  className="w-full text-left px-3 py-2 hover:bg-stone-50">
                                  <p className="text-xs font-medium text-stone-700">{t.title}</p>
                                  <p className="text-[10px] text-stone-400">{t.category}</p>
                                </button>
                              ))
                            }
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Sugestões rápidas */}
                  {!replyContent && quickSuggestions.length > 0 && (
                    <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                      {quickSuggestions.map(s => (
                        <button key={s.id} type="button"
                          onClick={() => { setSelectedTemplate(s.id); setReplyContent(s.body) }}
                          className="flex-shrink-0 text-[10px] px-2.5 py-1.5 bg-stone-50 border border-line rounded-full text-stone-600 hover:bg-stone-100 whitespace-nowrap">
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tabs Responder / Nota interna */}
                  <div className="flex border-b border-line mb-3">
                    <button onClick={() => setIsInternal(false)}
                      className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${!isInternal ? 'border-forest-700 text-forest-800' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
                      Responder
                    </button>
                    <button onClick={() => setIsInternal(true)}
                      className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${isInternal ? 'border-amber-500 text-amber-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>
                      <Lock className="w-3 h-3" /> Nota interna
                    </button>
                  </div>

                  <textarea
                    placeholder={isInternal ? 'Escreva uma nota interna… (visível apenas para admins)' : 'Digite sua resposta… (Ctrl+Enter para enviar)'}
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    disabled={sending}
                    className={`w-full resize-none px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white ${isInternal ? 'border-amber-300 focus:ring-amber-200' : 'border-line focus:ring-forest-300'}`}
                  />
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <button onClick={saveDraft} disabled={!replyContent.trim()} className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-line rounded-xl text-stone-600 hover:bg-stone-50 disabled:opacity-40">
                      <Save className="w-3.5 h-3.5" /> Salvar rascunho
                    </button>
                    <button onClick={handleSend} disabled={sending || !replyContent.trim()}
                      className={`inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-40 ${isInternal ? 'bg-amber-500 hover:bg-amber-600' : 'bg-forest-700 hover:bg-forest-800'}`}>
                      <Send className="w-4 h-4" /> {isInternal ? 'Salvar nota' : 'Enviar resposta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DotSelect({
  value, onChange, disabled, options,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  options: { value: string; label: string; dot: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-1.5 px-2.5 py-2 border border-line rounded-xl bg-white text-xs hover:border-stone-300 disabled:opacity-50 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {current && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${current.dot}`} />}
          <span className="truncate text-stone-700">{current?.label ?? value}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-line rounded-xl shadow-lg z-30 py-1 min-w-[160px]">
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-stone-50 text-left ${o.value === value ? 'text-forest-700 font-medium' : 'text-stone-700'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${o.dot}`} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
