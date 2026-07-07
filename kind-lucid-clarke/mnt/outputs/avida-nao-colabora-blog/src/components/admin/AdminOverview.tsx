import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AdminView } from './types'
import {
  Users, CreditCard, Clock, MessageSquare, RefreshCw, ArrowRight,
  MessageCircle, LifeBuoy, BarChart3, CalendarCheck, AlertTriangle,
  UserPlus, TrendingUp, Mail, Database, Cpu, HardDrive, ChevronRight,
} from 'lucide-react'

interface OverviewProps {
  onNavigate: (v: AdminView) => void
}

interface Counts {
  users: number
  newUsers7d: number
  paid: number
  pendingComments: number
  pendingGuidance: number
  openTickets: number
  reportsToReview: number
  selfCarePending: number
  emailFailures: number
}

const EMPTY: Counts = {
  users: 0, newUsers7d: 0, paid: 0, pendingComments: 0, pendingGuidance: 0,
  openTickets: 0, reportsToReview: 0, selfCarePending: 0, emailFailures: 0,
}

// conta defensiva — 0 se a tabela/coluna não existir
async function safeCount(build: () => PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count } = await build()
    return count ?? 0
  } catch { return 0 }
}

interface Activity { icon: typeof UserPlus; text: string; sub: string; at: string }

export default function AdminOverview({ onNavigate }: OverviewProps) {
  const [c, setC] = useState<Counts>(EMPTY)
  const [activity, setActivity] = useState<Activity[]>([])
  const [dbOk, setDbOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const users = await safeCount(() => supabase.from('profiles').select('*', { count: 'exact', head: true }))
    setDbOk(true)
    const [newUsers7d, paid, pendingComments, pendingGuidance, openTickets, reportsToReview, selfCarePending, emailFailures] = await Promise.all([
      safeCount(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since)),
      safeCount(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).in('plan', ['essential', 'plus'])),
      safeCount(() => supabase.from('professional_comments').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      safeCount(() => supabase.from('monthly_guidance_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      safeCount(() => supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open')),
      safeCount(() => supabase.from('monthly_reports').select('*', { count: 'exact', head: true }).eq('status', 'draft')),
      safeCount(() => supabase.from('self_care_plans').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      safeCount(() => supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed')),
    ])
    setC({ users, newUsers7d, paid, pendingComments, pendingGuidance, openTickets, reportsToReview, selfCarePending, emailFailures })

    // Atividade recente (novos usuários + mudanças de plano)
    const acts: Activity[] = []
    try {
      const { data } = await supabase.from('profiles').select('full_name, email, created_at').order('created_at', { ascending: false }).limit(4)
      ;(data || []).forEach((u: { full_name?: string; email?: string; created_at: string }) => {
        acts.push({ icon: UserPlus, text: 'Novo usuário cadastrado', sub: u.full_name || u.email || '—', at: u.created_at })
      })
    } catch { /* noop */ }
    try {
      const { data } = await supabase.from('plan_change_history').select('new_plan, change_type, created_at').order('created_at', { ascending: false }).limit(4)
      ;(data || []).forEach((p: { new_plan?: string; change_type?: string; created_at: string }) => {
        acts.push({ icon: TrendingUp, text: p.change_type === 'downgrade' ? 'Downgrade de plano' : 'Upgrade de plano', sub: `Para o plano ${p.new_plan ?? ''}`.trim(), at: p.created_at })
      })
    } catch { /* noop */ }
    acts.sort((a, b) => (a.at < b.at ? 1 : -1))
    setActivity(acts.slice(0, 6))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const pendencias = c.pendingComments + c.pendingGuidance + c.openTickets + c.reportsToReview + c.selfCarePending + c.emailFailures

  const cards = [
    { label: 'Usuários ativos', value: c.users, delta: c.newUsers7d > 0 ? `+${c.newUsers7d} nesta semana` : 'Total de contas', Icon: Users, bg: 'bg-mint', color: 'text-forest-600' },
    { label: 'Assinaturas pagas', value: c.paid, delta: 'Essencial + Plus', Icon: CreditCard, bg: 'bg-sky', color: 'text-[#3d6ea5]' },
    { label: 'Pendências', value: pendencias, delta: 'Precisam de atenção', Icon: Clock, bg: 'bg-coral', color: 'text-[#c05f3c]' },
    { label: 'Orientações abertas', value: c.pendingGuidance, delta: 'Aguardando resposta', Icon: MessageSquare, bg: 'bg-lilac', color: 'text-[#7c5cbf]' },
  ]

  const fila = [
    { Icon: MessageCircle, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Comentários profissionais pendentes', sub: 'Aguardando revisão e resposta', qtd: c.pendingComments, nav: 'professional-comments' as AdminView },
    { Icon: MessageSquare, color: 'text-[#3d6ea5]', bg: 'bg-sky', title: 'Orientações mensais aguardando resposta', sub: 'Usuários Plus no aguardo', qtd: c.pendingGuidance, nav: 'guidance-requests' as AdminView },
    { Icon: LifeBuoy, color: 'text-forest-600', bg: 'bg-mint', title: 'Tickets de suporte abertos', sub: 'Em atendimento', qtd: c.openTickets, nav: 'support' as AdminView },
    { Icon: BarChart3, color: 'text-[#7c5cbf]', bg: 'bg-lilac', title: 'Relatórios a revisar', sub: 'Relatórios mensais aguardando revisão', qtd: c.reportsToReview, nav: 'pdf' as AdminView },
    { Icon: CalendarCheck, color: 'text-forest-600', bg: 'bg-mint', title: 'Planos de autocuidado pendentes', sub: 'Aguardando geração ou envio', qtd: c.selfCarePending, nav: 'self-care-plans' as AdminView },
    { Icon: AlertTriangle, color: 'text-[#c9971f]', bg: 'bg-[#fbf1d5]', title: 'Falhas de e-mail ou IA', sub: 'Eventos que precisam de atenção', qtd: c.emailFailures, nav: 'notifications' as AdminView },
  ]

  // Saúde básica (mockup): DB/E-mails/IA operacionais, Pagamentos em teste.
  const health: { Icon: typeof Database; label: string; state: 'ok' | 'warn' | 'unknown'; note: string }[] = [
    { Icon: Database, label: 'Banco de dados', state: dbOk ? 'ok' : 'unknown', note: dbOk ? 'Operacional' : 'Ver detalhes' },
    { Icon: Mail, label: 'E-mails', state: c.emailFailures > 0 ? 'warn' : 'ok', note: c.emailFailures > 0 ? `${c.emailFailures} falha(s)` : 'Operacional' },
    { Icon: CreditCard, label: 'Pagamentos', state: 'warn', note: 'Em teste' },
    { Icon: Cpu, label: 'IA e recomendações', state: 'ok', note: 'Operacional' },
    { Icon: HardDrive, label: 'Storage', state: 'ok', note: 'Operacional' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Visão geral</h1>
          <p className="mt-1 text-sm text-ink-soft">Panorama operacional da plataforma e do que precisa de atenção hoje.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 text-sm border border-line bg-white px-4 py-2 rounded-xl hover:border-forest-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(card => (
          <div key={card.label} className="bg-white border border-line rounded-2xl p-5">
            <span className={`w-11 h-11 rounded-full ${card.bg} flex items-center justify-center`}>
              <card.Icon className={`w-5 h-5 ${card.color}`} />
            </span>
            <p className="mt-3 text-sm text-ink-soft">{card.label}</p>
            <p className="font-serif text-3xl text-forest-900 leading-tight">{loading ? '—' : card.value}</p>
            <p className="text-xs text-ink-soft mt-1">{card.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Fila de atenção */}
        <div className="lg:col-span-2 bg-white border border-line rounded-2xl p-5">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Fila de atenção</h2>
          <div className="divide-y divide-line">
            {fila.map(row => (
              <div key={row.title} className="flex items-center gap-3 py-3">
                <span className={`w-9 h-9 rounded-full ${row.bg} flex items-center justify-center flex-shrink-0`}>
                  <row.Icon className={`w-4 h-4 ${row.color}`} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-forest-900 truncate">{row.title}</p>
                  <p className="text-xs text-ink-soft truncate">{row.sub}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.qtd > 0 ? 'bg-coral text-[#b0532f]' : 'bg-mint text-forest-700'}`}>{loading ? '—' : row.qtd}</span>
                <button onClick={() => onNavigate(row.nav)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2.5 py-1 whitespace-nowrap">Ver fila</button>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade recente */}
        <div className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Atividade recente</h2>
          {loading ? (
            <p className="text-sm text-ink-soft">Carregando…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-ink-soft">Sem atividade recente.</p>
          ) : (
            <div className="space-y-4">
              {activity.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-8 h-8 rounded-full bg-paper-soft border border-line flex items-center justify-center flex-shrink-0">
                    <a.icon className="w-4 h-4 text-forest-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-forest-900 leading-tight">{a.text}</p>
                    <p className="text-xs text-ink-soft truncate">{a.sub}</p>
                  </div>
                  <span className="text-[11px] text-ink-soft whitespace-nowrap">{new Date(a.at).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Saúde do sistema */}
      <div className="bg-white border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-forest-900">Saúde do sistema</h2>
          <button onClick={() => onNavigate('system-health')} className="inline-flex items-center gap-1 text-sm text-forest-700 hover:text-forest-900">
            Ver detalhes do sistema <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {health.map(h => {
            const dot = h.state === 'ok' ? 'bg-forest-500' : h.state === 'warn' ? 'bg-[#c9971f]' : 'bg-stone-300'
            const txt = h.state === 'ok' ? 'text-forest-600' : h.state === 'warn' ? 'text-[#9a6a10]' : 'text-ink-soft'
            return (
              <button key={h.label} onClick={() => onNavigate('system-health')} className="flex items-center gap-2.5 text-left">
                <span className="w-9 h-9 rounded-full bg-paper-soft border border-line flex items-center justify-center flex-shrink-0">
                  <h.Icon className="w-4 h-4 text-forest-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-forest-900 truncate">{h.label}</p>
                  <p className={`text-xs flex items-center gap-1 ${txt}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    {h.note}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ir para todas as pendências */}
      <div className="mt-6 text-center">
        <button onClick={() => onNavigate('support')} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
          Ir para todas as pendências <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
