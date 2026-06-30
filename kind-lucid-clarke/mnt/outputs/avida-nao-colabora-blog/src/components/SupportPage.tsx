import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, MessageCircle, Clock, AlertCircle, ChevronRight, X } from 'lucide-react'

interface Ticket {
  id: string
  ticket_number: number
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  message_count?: number
}

interface Props {
  user: { id: string } | null
  profile: { plan?: string } | null
  navigate: (v: string) => void
  onBack: () => void
  onOpenTicket: (id: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting_client: 'Aguardando resposta',
  resolved: 'Resolvido',
  closed: 'Fechado',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  waiting_client: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-stone-100 text-stone-500',
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
}
const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-stone-100 text-stone-500',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white'

export default function SupportPage({ user, profile, navigate, onBack, onOpenTicket }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium' })

  useEffect(() => {
    if (!user) return
    loadTickets()
  }, [user])

  async function loadTickets() {
    setLoading(true)
    const { data: ticketData } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })

    if (!ticketData) { setLoading(false); return }

    // Enrich with message counts
    const ids = ticketData.map(t => t.id)
    const { data: msgs } = ids.length > 0
      ? await supabase.from('ticket_messages').select('ticket_id').in('ticket_id', ids).eq('is_internal', false)
      : { data: [] }

    const countMap = new Map<string, number>()
    for (const m of (msgs || [])) {
      countMap.set(m.ticket_id, (countMap.get(m.ticket_id) ?? 0) + 1)
    }

    setTickets(ticketData.map(t => ({ ...t, message_count: countMap.get(t.id) ?? 0 })))
    setLoading(false)
  }

  async function handleCreate() {
    setCreateError(null)
    if (!form.subject.trim() || !form.description.trim()) {
      setCreateError('Preencha o assunto e a descrição.'); return
    }
    if (form.description.trim().length < 20) {
      setCreateError('Descrição deve ter pelo menos 20 caracteres.'); return
    }
    setCreating(true)

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user!.id,
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority,
        plan_at_creation: profile?.plan ?? null,
        unread_for_admin: true,
        source: 'support_page',
      })
      .select()
      .single()

    if (error) {
      setCreateError('Erro ao criar ticket. Tente novamente.')
      setCreating(false)
      return
    }

    setTickets(prev => [{ ...ticket, message_count: 0 }, ...prev])
    setDialogOpen(false)
    setForm({ subject: '', description: '', priority: 'medium' })
    setCreating(false)
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <MessageCircle className="w-10 h-10 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500 mb-4">Faça login para acessar o suporte.</p>
        <button onClick={() => navigate('auth')} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700">
          Entrar
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-xs text-stone-400 hover:text-stone-600 mb-1">← Voltar</button>
          <h1 className="text-2xl font-bold text-stone-800">Suporte</h1>
          <p className="text-stone-500 text-sm">Acompanhe e abra tickets de suporte</p>
        </div>
        <button
          onClick={() => { setDialogOpen(true); setCreateError(null) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo ticket
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <MessageCircle className="w-10 h-10 text-stone-200 mx-auto mb-3" />
          <p className="font-medium text-stone-700 mb-1">Nenhum ticket aberto</p>
          <p className="text-sm text-stone-400 mb-5">Abra um ticket sempre que precisar de ajuda</p>
          <button
            onClick={() => { setDialogOpen(true); setCreateError(null) }}
            className="flex items-center gap-2 mx-auto border border-stone-200 text-stone-600 px-4 py-2 rounded-lg text-sm hover:bg-stone-50"
          >
            <Plus className="w-4 h-4" /> Abrir ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => onOpenTicket(ticket.id)}
              className="w-full text-left bg-white border border-stone-100 rounded-xl px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-stone-400 font-mono">#{ticket.ticket_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ticket.status] ?? 'bg-stone-100 text-stone-500'}`}>
                    {STATUS_LABEL[ticket.status] ?? ticket.status}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[ticket.priority] ?? 'bg-stone-100 text-stone-500'}`}>
                    {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
                  </span>
                </div>
                <p className="font-medium text-sm text-stone-800 truncate">{ticket.subject}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ticket.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                  {(ticket.message_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {ticket.message_count} mensagem{ticket.message_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-stone-800">Abrir ticket de suporte</h2>
              </div>
              <button onClick={() => setDialogOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Assunto</label>
                <input
                  className={inputCls}
                  placeholder="Resumo do problema..."
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Prioridade</label>
                <select
                  className={inputCls}
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Descrição</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={5}
                  placeholder="Descreva o problema com detalhes (mínimo 20 caracteres)..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                <p className="text-xs text-stone-400 text-right mt-0.5">{form.description.length} caracteres</p>
              </div>

              {createError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setDialogOpen(false)}
                disabled={creating}
                className="flex-1 border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
              >
                {creating ? 'Enviando...' : 'Enviar ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
