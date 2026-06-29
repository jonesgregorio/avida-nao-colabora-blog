import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MessageSquare, Search, CheckCircle, AlertCircle } from 'lucide-react'

interface Ticket {
  id: string
  user_id: string | null
  email: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'closed' | 'resolved'
  priority: 'low' | 'normal' | 'high'
  admin_reply: string | null
  admin_notes: string | null
  plan: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em andamento', closed: 'Resolvido', resolved: 'Resolvido',
}
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  closed: 'bg-green-100 text-green-700',
  resolved: 'bg-green-100 text-green-700',
}
const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-600', normal: 'text-stone-500', low: 'text-stone-400',
}

const QUICK_REPLIES = [
  { label: 'Confirmação de recebimento', text: 'Olá! Recebemos sua mensagem e iremos analisá-la em breve. Obrigado por entrar em contato com A Vida Não Colabora.' },
  { label: 'Acesso ao diário', text: 'Para acessar o diário, faça login com sua conta e clique em "Diário" no menu superior. Se ainda tiver dificuldades, conte-nos mais.' },
  { label: 'Problema resolvido', text: 'Ótima notícia! O problema foi identificado e já corrigido. Por favor, acesse novamente e nos informe se tudo está funcionando.' },
  { label: 'Encaminhar para suporte técnico', text: 'Agradecemos seu contato. Encaminhamos sua solicitação para nossa equipe técnica, que entrará em contato em breve.' },
]

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setTickets(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateTicket(id: string, fields: Partial<Ticket>) {
    setSaving(true)
    await supabase.from('support_tickets').update(fields).eq('id', id)
    setTickets(ts => ts.map(t => t.id === id ? { ...t, ...fields } : t))
    if (selected?.id === id) setSelected(s => s ? { ...s, ...fields } : s)
    setSaving(false)
    showToast('Atualizado!')
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return
    // Salva em ambas as colunas para compatibilidade (admin_reply é novo, admin_notes é antigo)
    await updateTicket(selected.id, { admin_reply: reply, admin_notes: reply, status: 'in_progress' })
    setReply('')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const filtered = tickets.filter(t => {
    const matchSearch = t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  // Lê admin_reply com fallback para admin_notes (coluna antiga)
  function getReply(t: Ticket) { return t.admin_reply ?? t.admin_notes ?? '' }

  const openCount = tickets.filter(t => t.status === 'open').length

  if (loading) return (
    <div className="flex items-center gap-3 text-stone-400">
      <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      Carregando tickets...
    </div>
  )

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-800">Suporte</h1>
          {openCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {openCount} aberto{openCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma mensagem de suporte ainda.</p>
          <p className="text-xs mt-1">Os tickets criados pelos usuários aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* List */}
          <div className="lg:col-span-1">
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-8 pr-3 py-2 border border-stone-200 rounded-lg text-xs focus:outline-none" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-stone-200 rounded-lg px-2 py-2 text-xs focus:outline-none">
                <option value="all">Todos</option>
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="resolved">Resolvido</option>
              </select>
            </div>

            <div className="space-y-2">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelected(t); setReply(getReply(t)) }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selected?.id === t.id ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                    <span className={`text-xs ${PRIORITY_COLORS[t.priority]}`}>
                      {t.priority === 'high' ? '🔴' : t.priority === 'normal' ? '🟡' : '⚪'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-stone-800 leading-snug truncate">{t.subject}</p>
                  <p className="text-xs text-stone-400 mt-0.5 truncate">{t.email}</p>
                  <p className="text-xs text-stone-400">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-stone-200 text-stone-400">
                <p className="text-sm">Selecione um ticket para ver os detalhes</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-stone-800 text-lg">{selected.subject}</h2>
                    <p className="text-sm text-stone-500 mt-0.5">{selected.email}</p>
                    {selected.plan && <p className="text-xs text-stone-400">Plano: {selected.plan}</p>}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selected.priority}
                      onChange={e => updateTicket(selected.id, { priority: e.target.value as any })}
                      className="border border-stone-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="low">Prioridade baixa</option>
                      <option value="normal">Prioridade normal</option>
                      <option value="high">Prioridade alta</option>
                    </select>
                    <select
                      value={selected.status}
                      onChange={e => updateTicket(selected.id, { status: e.target.value as any })}
                      className={`border rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[selected.status]}`}
                    >
                      <option value="open">Aberto</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="closed">Resolvido</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div className="bg-stone-50 rounded-xl p-4">
                  <p className="text-xs text-stone-400 mb-2">Mensagem do usuário</p>
                  <p className="text-sm text-stone-700 whitespace-pre-wrap">{selected.message}</p>
                </div>

                {/* Quick replies */}
                <div>
                  <p className="text-xs text-stone-500 mb-2">Respostas rápidas:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_REPLIES.map(qr => (
                      <button
                        key={qr.label}
                        onClick={() => setReply(qr.text)}
                        className="text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reply */}
                <div>
                  <label className="text-xs text-stone-500 block mb-1.5">Resposta do admin</label>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    rows={4}
                    placeholder="Digite sua resposta..."
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={sendReply}
                      disabled={saving || !reply.trim()}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : 'Salvar resposta'}
                    </button>
                    <button
                      onClick={() => updateTicket(selected.id, { status: 'closed' })}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Marcar resolvido
                    </button>

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
