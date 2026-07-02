import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MessageSquare, Send, ChevronLeft, Loader2, Lock } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  onNavigatePricing: () => void
}

interface Ticket {
  id: string
  ticket_number: number
  subject: string
  status: string
  created_at: string
  last_message_at: string | null
}

interface Message {
  id: string
  sender_role: 'user' | 'admin'
  sender_name: string | null
  content: string
  is_internal: boolean
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function currentMonthLabel() {
  return new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function isSameMonth(isoA: string, isoB: string) {
  const a = new Date(isoA)
  const b = new Date(isoB)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export default function MonthlyGuidancePage({ user, profile, onBack, onNavigatePricing }: Props) {
  const [loading, setLoading] = useState(true)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const allowed = profile?.plan === 'therapeutic' || profile?.plan === 'therapeutic-plus'

  useEffect(() => {
    if (!user || !allowed) { setLoading(false); return }
    loadCurrentTicket()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadCurrentTicket() {
    setLoading(true)
    const { data } = await supabase
      .from('support_tickets')
      .select('id,ticket_number,subject,status,created_at,last_message_at')
      .eq('user_id', user!.id)
      .eq('category', 'monthly_guidance')
      .order('created_at', { ascending: false })
      .limit(10)

    const now = new Date().toISOString()
    const thisMonth = data?.find((t: Ticket) => isSameMonth(t.created_at, now))
    setTicket(thisMonth ?? null)
    if (thisMonth) loadMessages(thisMonth.id)
    setLoading(false)
  }

  async function loadMessages(ticketId: string) {
    setLoadingMessages(true)
    const [{ data: msgs }, { data: desc }] = await Promise.all([
      supabase.from('ticket_messages').select('id,sender_role,content,is_internal,created_at,sender_id').eq('ticket_id', ticketId).order('created_at'),
      supabase.from('support_tickets').select('description,created_at,user_id').eq('id', ticketId).single(),
    ])

    type RawMsg = { id: string; sender_role: 'user' | 'admin'; content: string; is_internal: boolean; created_at: string; sender_id: string }
    const senderIds = [...new Set((msgs as RawMsg[] ?? []).map(m => m.sender_id))]
    const { data: profiles } = senderIds.length > 0
      ? await supabase.from('profiles').select('user_id,full_name').in('user_id', senderIds)
      : { data: [] }
    const nameMap = new Map((profiles ?? []).map((p: { user_id: string; full_name: string | null }) => [p.user_id, p.full_name]))

    const descMsg: Message = {
      id: `desc-${ticketId}`,
      sender_role: 'user',
      sender_name: profile?.full_name ?? null,
      content: (desc as { description: string } | null)?.description ?? '',
      is_internal: false,
      created_at: (desc as { created_at: string } | null)?.created_at ?? '',
    }
    const enriched: Message[] = (msgs as RawMsg[] ?? []).map(m => ({
      ...m,
      sender_name: m.sender_role === 'admin' ? 'Suporte' : (nameMap.get(m.sender_id) ?? null),
    }))
    setMessages([descMsg, ...enriched])
    setLoadingMessages(false)
  }

  useEffect(() => {
    if (messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleCreate() {
    if (!subject.trim() || !body.trim() || !user) return
    setCreating(true)
    setCreateError(null)
    const { data, error } = await supabase.from('support_tickets').insert({
      user_id: user.id,
      subject: subject.trim(),
      description: body.trim(),
      category: 'monthly_guidance',
      plan_at_creation: profile?.plan ?? 'therapeutic',
      priority: 'medium',
      status: 'open',
      source: 'monthly_guidance',
    }).select().single()
    if (error || !data) {
      setCreateError('Erro ao enviar. Tente novamente.')
      setCreating(false)
      return
    }
    setTicket(data as Ticket)
    loadMessages(data.id)
    setShowCreate(false)
    setSubject('')
    setBody('')
    setCreating(false)
  }

  async function handleReply() {
    if (!reply.trim() || !ticket || !user || sending) return
    setSending(true)
    setSendError(null)
    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: 'user',
      content: reply.trim(),
      is_internal: false,
    })
    if (error) { setSendError('Erro ao enviar. Tente novamente.'); setSending(false); return }
    await supabase.from('support_tickets').update({ unread_for_admin: true, last_message_at: new Date().toISOString() }).eq('id', ticket.id)
    setReply('')
    loadMessages(ticket.id)
    setSending(false)
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-7 h-7 text-purple-600" />
        </div>
        <h1 className="font-serif text-2xl text-sage-800 mb-2">Orientação mensal por mensagem</h1>
        <p className="text-sage-500 mb-6">Este recurso está disponível nos planos Terapêutico e Terapêutico Plus.</p>
        <button onClick={onNavigatePricing} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full text-sm font-medium transition-colors">
          Ver planos
        </button>
        <button onClick={onBack} className="block mx-auto mt-3 text-sm text-stone-400 hover:text-stone-600">Voltar</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h1 className="font-serif text-2xl text-sage-800">Orientação mensal</h1>
            <p className="text-xs text-stone-400 capitalize">{currentMonthLabel()}</p>
          </div>
        </div>
        <p className="text-sm text-sage-500 mt-2 leading-relaxed">
          Envie uma mensagem por mês e receba orientação de apoio personalizada dentro do site.
          Você pode usar esse espaço para compartilhar como está se sentindo, tirar dúvidas ou pedir sugestões de autocuidado.
        </p>
      </div>

      {!ticket && !showCreate && (
        <div className="bg-white border border-purple-100 rounded-2xl p-8 text-center shadow-sm">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold text-sage-800 mb-1">Você ainda não enviou sua mensagem deste mês</p>
          <p className="text-sm text-sage-500 mb-6">Use esse espaço para compartilhar como está se sentindo ou o que gostaria de apoio.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full text-sm font-medium transition-colors"
          >
            Enviar mensagem deste mês
          </button>
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-sage-800 mb-4">Nova mensagem — {currentMonthLabel()}</h2>
          <div className="mb-3">
            <label className="text-xs font-medium text-stone-500 mb-1 block">Assunto</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Como estou me sentindo este mês"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium text-stone-500 mb-1 block">Mensagem</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Compartilhe como está se sentindo, o que precisa de apoio ou o que gostaria de explorar..."
              rows={6}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>
          {createError && <p className="text-xs text-red-600 mb-3">{createError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar
            </button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-stone-400 hover:text-stone-600 px-4 py-2.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {ticket && (
        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sage-800 text-sm">{ticket.subject}</p>
                <p className="text-xs text-stone-400 mt-0.5">Enviado em {formatDate(ticket.created_at)}</p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${ticket.status === 'awaiting_user' ? 'bg-green-100 text-green-700' : ticket.status === 'closed' || ticket.status === 'resolved' ? 'bg-stone-100 text-stone-500' : 'bg-purple-100 text-purple-700'}`}>
                {ticket.status === 'awaiting_user' ? 'Respondida' : ticket.status === 'open' || ticket.status === 'awaiting_admin' ? 'Aguardando resposta' : ticket.status === 'resolved' ? 'Encerrada' : 'Fechada'}
              </span>
            </div>
          </div>

          <div className="p-4 space-y-3 bg-stone-50 min-h-[200px] max-h-[420px] overflow-y-auto">
            {loadingMessages ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>
            ) : messages.filter(m => !m.is_internal).map(msg => {
              const isAdmin = msg.sender_role === 'admin'
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isAdmin ? 'bg-white border border-stone-100 text-stone-800' : 'bg-purple-600 text-white'}`}>
                    {isAdmin && <p className="text-[10px] font-semibold text-purple-600 mb-1">Suporte</p>}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] mt-1.5 text-right ${isAdmin ? 'text-stone-300' : 'text-purple-200'}`}>{formatDateTime(msg.created_at)}</p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <div className="px-4 pb-4 pt-3 border-t border-stone-100 bg-white">
              {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
              <div className="flex gap-2 items-end">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleReply() } }}
                  placeholder="Responder... (Ctrl+Enter para enviar)"
                  rows={2}
                  className="flex-1 resize-none px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                  className="flex-shrink-0 w-10 h-10 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {(ticket.status === 'closed' || ticket.status === 'resolved') && (
            <div className="px-4 py-3 border-t border-stone-100 bg-stone-50 flex items-center gap-2 text-xs text-stone-400">
              <Lock className="w-3.5 h-3.5" /> Orientação encerrada.
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-stone-400 text-center mt-6">
        Sua orientação será respondida em até 7 dias úteis. Este espaço não é um canal de emergência.
      </p>
    </div>
  )
}
