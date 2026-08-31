import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Send, Lock, CheckCheck } from 'lucide-react'
import SupportAttachmentPicker from './support/SupportAttachmentPicker'
import SupportAttachmentList from './support/SupportAttachmentList'
import {
  normalizeSupportAttachments,
  removeSupportAttachments,
  uploadSupportAttachments,
  type SupportAttachment,
} from '../lib/supportAttachments'

interface Ticket {
  id: string
  ticket_number: number
  subject: string
  description: string
  status: string
  priority: string
  plan_at_creation: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  closed_at: string | null
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
  attachments: SupportAttachment[]
}

interface Props {
  ticketId: string
  user: { id: string } | null
  onBack: () => void
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting_client: 'Aguardando resposta',
  awaiting_admin: 'Aguardando suporte',
  awaiting_user: 'Aguardando você',
  resolved: 'Resolvido',
  closed: 'Fechado',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-mint text-forest-700',
  in_progress: 'bg-coral/25 text-[#8a3b23]',
  waiting_client: 'bg-amber-100 text-amber-800',
  awaiting_admin: 'bg-amber-100 text-amber-800',
  awaiting_user: 'bg-coral/20 text-[#8a3b23]',
  resolved: 'bg-mint text-forest-700',
  closed: 'bg-paper-soft text-ink-soft',
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function descriptionAsMessage(ticket: Ticket): Message {
  return {
    id: `desc-${ticket.id}`,
    ticket_id: ticket.id,
    sender_id: '',
    sender_role: 'user',
    sender_name: null,
    content: ticket.description,
    is_internal: false,
    created_at: ticket.created_at,
    attachments: [],
  }
}

export default function SupportTicketDetail({ ticketId, user, onBack }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const messagesRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountRef = useRef(0)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesRef.current
    if (!el) return
    if (behavior === 'instant') {
      el.scrollTop = el.scrollHeight
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior })
    }
  }, [])

  const fetchData = useCallback(async (silent = false) => {
    if (!user) {
      if (!silent) setLoading(false)
      return
    }

    try {
      const { data: ticketData, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('user_id', user.id)
        .single()

      if (error || !ticketData) {
        if (!silent) { setNotFound(true); setLoading(false) }
        return
      }

      const { data: msgData } = await supabase
        .from('ticket_messages')
        .select('id, ticket_id, sender_id, sender_role, content, is_internal, created_at, attachments')
        .eq('ticket_id', ticketId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true })

      const msgs: Message[] = (msgData || []).map(m => ({
        ...m,
        sender_name: null,
        attachments: normalizeSupportAttachments(m.attachments),
      }))
      const all: Message[] = [descriptionAsMessage(ticketData), ...msgs]

      setTicket(ticketData)
      setMessages(prev => {
        if (silent && all.length === lastCountRef.current) return prev
        lastCountRef.current = all.length
        return all
      })
    } catch {
      if (!silent) setNotFound(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [ticketId, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!loading) scrollToBottom('instant')
  }, [loading, scrollToBottom])

  useEffect(() => {
    if (messages.length > lastCountRef.current - 1) scrollToBottom()
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    if (!ticket) return
    if (ticket.status === 'closed' || ticket.status === 'resolved') return
    pollingRef.current = setInterval(() => fetchData(true), 4000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.status, fetchData])

  async function handleSend() {
    const trimmed = content.trim()
    if ((!trimmed && files.length === 0) || sending || !user) return
    if (ticket?.status === 'closed' || ticket?.status === 'resolved') { setSendError('Este ticket está fechado.'); return }

    setSending(true)
    setSendError(null)
    const originalFiles = files
    let uploaded: SupportAttachment[] = []

    try {
      uploaded = await uploadSupportAttachments(user.id, ticketId, originalFiles)
    } catch {
      setSendError('Não foi possível enviar os anexos. Confira os arquivos e tente novamente.')
      setSending(false)
      return
    }

    const finalContent = trimmed || (uploaded.length === 1 ? 'Anexo enviado.' : 'Anexos enviados.')
    const optimisticId = `opt-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: 'user',
      sender_name: null,
      content: finalContent,
      is_internal: false,
      created_at: new Date().toISOString(),
      attachments: uploaded,
    }
    setMessages(prev => [...prev, optimistic])
    setContent('')
    setFiles([])

    const { data: newMsg, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_role: 'user',
        content: finalContent,
        is_internal: false,
        attachments: uploaded,
      })
      .select()
      .single()

    if (error) {
      await removeSupportAttachments(uploaded)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setContent(trimmed)
      setFiles(originalFiles)
      setSendError('Erro ao enviar mensagem. Tente novamente.')
      setSending(false)
      return
    }

    setMessages(prev => prev.map(m =>
      m.id === optimisticId
        ? { ...newMsg, sender_name: null, attachments: normalizeSupportAttachments(newMsg.attachments) }
        : m
    ))

    await fetchData(true)
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSend() }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-paper-soft border border-line rounded-2xl animate-pulse" />)}
    </div>
  )

  if (notFound || !ticket) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-ink-soft">Ticket não encontrado.</p>
      <button onClick={onBack} className="mt-4 text-sm text-forest-700 hover:underline">Voltar</button>
    </div>
  )

  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved'

  return (
    <div className="max-w-2xl mx-auto px-4 flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      <div className="flex items-center gap-3 py-4 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-mint/30 text-ink-soft" aria-label="Voltar para suporte">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-soft font-mono">#{ticket.ticket_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ticket.status] ?? 'bg-paper-soft text-ink-soft'}`}>
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </span>
            <span className="text-xs border border-line text-ink-soft px-2 py-0.5 rounded-full">
              {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
            </span>
          </div>
          <p className="font-serif text-base text-forest-900 leading-snug truncate mt-0.5">{ticket.subject}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 flex-shrink-0">
        {(
          [
            ['Aberto em', ticket.created_at],
            ['Atualizado', ticket.updated_at],
            ...(ticket.resolved_at ? [['Resolvido em', ticket.resolved_at]] : []),
            ...(ticket.closed_at ? [['Fechado em', ticket.closed_at]] : []),
          ] as [string, string][]
        ).map(([label, date]) => (
          <div key={label} className="bg-paper-soft border border-line rounded-xl px-3 py-2">
            <p className="text-[10px] text-ink-soft">{label}</p>
            <p className="text-xs font-medium text-forest-800">{formatDate(date)}</p>
          </div>
        ))}
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto bg-paper-soft rounded-2xl border border-line p-4 space-y-3 min-h-0">
        {messages.map(msg => {
          const isUser = msg.sender_role === 'user'
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${isUser ? 'bg-forest-900 text-white' : 'bg-white border border-line text-forest-900'}`}>
                {!isUser && (
                  <p className="text-[10px] font-semibold text-forest-600 mb-1">Suporte</p>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <SupportAttachmentList attachments={msg.attachments} inverse={isUser} />
                <div className={`flex items-center justify-end gap-1 mt-1.5 ${isUser ? 'text-white/65' : 'text-ink-soft/60'}`}>
                  <span className="text-[10px]">{formatDateTime(msg.created_at)}</span>
                  {isUser && <CheckCheck className="w-3 h-3" />}
                </div>
              </div>
            </div>
          )
        })}
        <div />
      </div>

      <div className="flex-shrink-0 pt-3 pb-4">
        {sendError && (
          <p className="text-xs text-coral mb-2">{sendError}</p>
        )}
        {isClosed ? (
          <div className="flex items-center gap-2 text-sm text-ink-soft bg-paper-soft border border-line rounded-xl px-4 py-3">
            <Lock className="w-4 h-4 flex-shrink-0" />
            Ticket encerrado — abra um novo ticket se precisar de mais ajuda.
          </div>
        ) : (
          <div className="space-y-2">
            <SupportAttachmentPicker files={files} onChange={setFiles} onError={setSendError} disabled={sending} compact />
            <div className="flex gap-2 items-end">
              <textarea
                placeholder="Digite uma mensagem... (Ctrl+Enter para enviar)"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={sending}
                className="flex-1 resize-none px-3 py-2.5 border border-line rounded-xl text-sm text-forest-900 placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-forest-200 bg-white"
              />
              <button
                onClick={handleSend}
                disabled={sending || (!content.trim() && files.length === 0)}
                className="flex-shrink-0 w-10 h-10 bg-forest-900 hover:bg-forest-800 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
                aria-label="Enviar mensagem"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
