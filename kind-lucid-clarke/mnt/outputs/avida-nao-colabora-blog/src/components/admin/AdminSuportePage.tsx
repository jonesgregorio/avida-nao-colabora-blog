import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import AdminSupport from './AdminSupport'

interface Ticket {
  id: string
  ticket_number: number
  subject: string
  status: string
  priority: string | null
  plan_at_creation: string | null
  created_at: string
  user_id: string | null
  user_name?: string
}

const LANES: { key: string; label: string; statuses: string[] }[] = [
  { key: 'novo', label: 'Novo', statuses: ['open'] },
  { key: 'atendimento', label: 'Em atendimento', statuses: ['in_progress', 'awaiting_admin'] },
  { key: 'aguardando', label: 'Aguardando usuário', statuses: ['awaiting_user'] },
  { key: 'resolvido', label: 'Resolvido', statuses: ['resolved', 'closed'] },
]

const PRIO_PILL: Record<string, string> = {
  urgent: 'bg-coral text-[#c84f3d]', high: 'bg-coral text-[#c84f3d]',
  medium: 'bg-[#f8e7b6] text-[#9a6a10]', low: 'bg-sky text-[#245f85]',
}
const PLAN_LABEL: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus',
  therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'agora há pouco'
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d} dia${d !== 1 ? 's' : ''}`
}

export default function AdminSuportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [full, setFull] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('id, ticket_number, subject, status, priority, plan_at_creation, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(200)
      const list = (data ?? []) as Ticket[]
      const ids = [...new Set(list.map(t => t.user_id).filter(Boolean))] as string[]
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
        const byId = new Map((profs ?? []).map(p => [p.user_id as string, (p.full_name as string | null) ?? null]))
        list.forEach(t => { if (t.user_id) t.user_name = byId.get(t.user_id) ?? undefined })
      }
      setTickets(list)
    } catch { setTickets([]) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (full) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button onClick={() => setFull(false)} className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao quadro
        </button>
        <AdminSupport />
      </div>
    )
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const count = (statuses: string[]) => tickets.filter(t => statuses.includes(t.status)).length
  const metrics = [
    { n: count(['open']), label: 'Novos tickets' },
    { n: count(['in_progress', 'awaiting_admin']), label: 'Em atendimento' },
    { n: count(['awaiting_user']), label: 'Aguardando usuário' },
    { n: tickets.filter(t => ['resolved', 'closed'].includes(t.status) && t.created_at >= monthStart).length, label: 'Resolvidos no mês' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Suporte</h1>
          <p className="text-sm text-ink-soft mt-1">Resolva problemas técnicos, conta, pagamento, acesso e dúvidas de uso.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
          <button onClick={() => setFull(true)} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800">Abrir atendimento</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map(m => (
          <div key={m.label} className="bg-white border border-line rounded-2xl p-5">
            <p className="font-serif text-3xl text-forest-900">{loading ? '—' : m.n}</p>
            <p className="text-sm text-ink-soft mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {LANES.map(lane => {
          const items = tickets.filter(t => lane.statuses.includes(t.status))
          return (
            <div key={lane.key} className="bg-paper-soft border border-line rounded-2xl p-3 min-h-[380px]">
              <div className="flex items-center justify-between px-1 mb-2">
                <strong className="text-sm text-forest-900">{lane.label}</strong>
                <span className="text-xs text-ink-soft">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.length === 0 ? (
                  <p className="text-xs text-ink-soft text-center py-6">Nenhum ticket</p>
                ) : items.map(t => (
                  <button key={t.id} onClick={() => setFull(true)} className="w-full text-left bg-white border border-line rounded-xl p-3 hover:shadow-sm transition-shadow">
                    {t.priority && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIO_PILL[t.priority] ?? 'bg-mint text-forest-700'}`}>{t.priority === 'urgent' ? 'Urgente' : t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa'}</span>}
                    <h3 className="text-sm font-medium text-forest-900 mt-1.5 leading-tight">#{t.ticket_number} {t.subject}</h3>
                    <p className="text-xs text-ink-soft mt-1">
                      {t.user_name || 'Usuário'}{t.plan_at_creation ? ` · ${PLAN_LABEL[t.plan_at_creation] ?? t.plan_at_creation}` : ''} · {timeAgo(t.created_at)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
