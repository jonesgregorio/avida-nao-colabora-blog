import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getPlanLabel } from '../../lib/officialPlans'
import { checkStorage } from '../../lib/adminHealthExtras'
import {
  checkAI,
  checkPayments,
  checkSupabaseConnection,
  checkTransactionalEmail,
  type CheckStatus,
} from '../../lib/systemHealth'
import type { AdminView } from './types'
import AdminOperationalDashboard from './AdminOperationalDashboard'
import {
  fetchOperationalSnapshot, attentionTotal,
  type OperationalSnapshot,
} from '../../lib/adminOperationalStatus'
import {
  Users, CreditCard, Clock, MessageSquare, RefreshCw, ArrowRight,
  LifeBuoy, BarChart3, CalendarCheck, AlertTriangle,
  UserPlus, TrendingUp, Mail, Database, Cpu, HardDrive, ChevronRight, Ban,
  Megaphone, BookOpen,
} from 'lucide-react'

interface OverviewProps {
  onNavigate: (v: AdminView) => void
}

interface Counts {
  users: number
  newUsers7d: number
  paid: number
  pendingGuidance: number
  openTickets: number
  reportsToReview: number
  selfCarePending: number
  emailFailures: number
  aiFailures: number
  pendingCancellations: number
}

type HealthState = 'ok' | 'warn' | 'error' | 'unknown'

type HealthItem = {
  Icon: typeof Database
  label: string
  state: HealthState
  note: string
  nav: AdminView
}

const EMPTY: Counts = {
  users: 0, newUsers7d: 0, paid: 0, pendingGuidance: 0,
  openTickets: 0, reportsToReview: 0, selfCarePending: 0, emailFailures: 0, aiFailures: 0, pendingCancellations: 0,
}

interface CountResult { count: number; error: string | null }

async function readCount(build: () => PromiseLike<{ count: number | null; error?: { message: string } | null }>): Promise<CountResult> {
  try {
    const { count, error } = await build()
    return { count: count ?? 0, error: error?.message ?? null }
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

function healthState(status: CheckStatus): HealthState {
  if (status === 'ok') return 'ok'
  if (status === 'warning') return 'warn'
  if (status === 'error') return 'error'
  return 'unknown'
}

interface Activity { icon: typeof UserPlus; text: string; sub: string; at: string }

const EMPTY_SNAPSHOT: OperationalSnapshot = { ok: false, queues: {}, failuresActive: {}, failures24h: {} }

export default function AdminOverview({ onNavigate }: OverviewProps) {
  const [c, setC] = useState<Counts>(EMPTY)
  const [snapshot, setSnapshot] = useState<OperationalSnapshot>(EMPTY_SNAPSHOT)
  const [activity, setActivity] = useState<Activity[]>([])
  const [health, setHealth] = useState<HealthItem[]>([
    { Icon: Database, label: 'Banco de dados', state: 'unknown', note: 'Verificação pendente', nav: 'system-health' },
    { Icon: Mail, label: 'E-mails', state: 'unknown', note: 'Verificação pendente', nav: 'emails' },
    { Icon: CreditCard, label: 'Pagamentos', state: 'unknown', note: 'Verificação pendente', nav: 'financeiro' },
    { Icon: Cpu, label: 'IA e recomendações', state: 'unknown', note: 'Verificação pendente', nav: 'uso-ia' },
    { Icon: HardDrive, label: 'Storage', state: 'unknown', note: 'Verificação pendente', nav: 'system-health' },
  ])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setLoadError('')
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [usersRes, newUsersRes, paidRes, pendingGuidanceRes, openTicketsRes, reportsRes, cancellationsRes, snap] = await Promise.all([
      readCount(() => supabase.from('profiles').select('*', { count: 'exact', head: true })),
      readCount(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since7d)),
      readCount(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).in('plan', ['essential', 'plus', 'therapeutic', 'therapeutic-plus', 'therapeutic_plus'])),
      readCount(() => supabase.from('monthly_guidance_requests').select('*', { count: 'exact', head: true }).eq('status', 'open')),
      readCount(() => supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open')),
      readCount(() => supabase.from('reports').select('*', { count: 'exact', head: true }).eq('report_type', 'monthly').in('status', ['draft', 'generated'])),
      readCount(() => supabase.from('subscription_change_feedback').select('*', { count: 'exact', head: true }).eq('change_type', 'cancellation').is('admin_handled_at', null).neq('status', 'reverted')),
      fetchOperationalSnapshot(),
    ])

    setSnapshot(snap)
    // Camada única de status operacional (adminOperationalStatus). Fallbacks
    // pontuais só quando a RPC não respondeu, para o Dashboard não zerar.
    let selfCarePending = snap.queues.care_plans_pending ?? 0
    let emailFailures = snap.failuresActive.emails_failed ?? 0
    let aiFailures = snap.failuresActive.ai_errors ?? 0
    if (!snap.ok) {
      const [careFallback, emailFallback, aiFallback] = await Promise.all([
        readCount(() => supabase.from('monthly_care_plans').select('*', { count: 'exact', head: true }).in('status', ['pending_generation', 'generated', 'pending_review', 'draft'])),
        readCount(() => supabase.from('email_logs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since24h)),
        readCount(() => supabase.from('ai_generation_logs').select('*', { count: 'exact', head: true }).in('status', ['error', 'failed']).gte('created_at', since24h)),
      ])
      selfCarePending = careFallback.count
      emailFailures = emailFallback.count
      aiFailures = aiFallback.count
    }

    setC({
      users: usersRes.count,
      newUsers7d: newUsersRes.count,
      paid: paidRes.count,
      pendingGuidance: pendingGuidanceRes.count,
      openTickets: openTicketsRes.count,
      reportsToReview: reportsRes.count,
      selfCarePending,
      emailFailures,
      aiFailures,
      pendingCancellations: cancellationsRes.count,
    })

    const countErrors = [usersRes, newUsersRes, paidRes, pendingGuidanceRes, openTicketsRes, reportsRes, cancellationsRes]
      .map(result => result.error)
      .filter(Boolean)
    if (countErrors.length > 0) setLoadError(`Algumas métricas não puderam ser lidas: ${countErrors.join(' · ')}`)

    const [databaseCheck, emailCheck, paymentCheck, aiCheck, storageCheck] = await Promise.all([
      checkSupabaseConnection(),
      checkTransactionalEmail(),
      checkPayments(),
      checkAI(),
      checkStorage(),
    ])

    setHealth([
      {
        Icon: Database,
        label: 'Banco de dados',
        state: healthState(databaseCheck.status),
        note: databaseCheck.status === 'ok' ? 'Conexão verificada' : databaseCheck.errorMessage || 'Não foi possível confirmar',
        nav: 'system-health',
      },
      {
        Icon: Mail,
        label: 'E-mails',
        state: emailFailures > 0 ? 'warn' : healthState(emailCheck.status),
        note: emailFailures > 0 ? `${emailFailures} falha(s) ativa(s) nas últimas 24h` : emailCheck.status === 'ok' ? 'Função de envio acessível' : emailCheck.errorMessage || 'Não foi possível confirmar',
        nav: 'emails',
      },
      {
        Icon: CreditCard,
        label: 'Pagamentos',
        state: healthState(paymentCheck.status),
        note: paymentCheck.status === 'ok' ? 'Checkout, webhook e gestão acessíveis' : paymentCheck.errorMessage || 'Não foi possível confirmar',
        nav: 'financeiro',
      },
      {
        Icon: Cpu,
        label: 'IA e recomendações',
        state: aiFailures > 0 ? 'warn' : healthState(aiCheck.status),
        note: aiFailures > 0 ? `${aiFailures} falha(s) ativa(s) nas últimas 24h` : aiCheck.status === 'ok' ? 'Provedor principal respondeu ao teste' : aiCheck.errorMessage || 'Não foi possível confirmar',
        nav: 'uso-ia',
      },
      {
        Icon: HardDrive,
        label: 'Storage',
        state: healthState(storageCheck.status),
        note: storageCheck.status === 'ok' ? 'Bucket de mídia acessível' : storageCheck.errorMessage || 'Não foi possível confirmar',
        nav: 'system-health',
      },
    ])

    const acts: Activity[] = []
    const usersActivity = await supabase.from('profiles').select('full_name, email, created_at').order('created_at', { ascending: false }).limit(4)
    if (!usersActivity.error) {
      (usersActivity.data || []).forEach((u: { full_name?: string; email?: string; created_at: string }) => {
        acts.push({ icon: UserPlus, text: 'Novo usuário cadastrado', sub: u.full_name || u.email || '—', at: u.created_at })
      })
    }

    const plansActivity = await supabase.from('plan_change_history').select('new_plan, change_type, created_at').order('created_at', { ascending: false }).limit(4)
    if (!plansActivity.error) {
      (plansActivity.data || []).forEach((p: { new_plan?: string; change_type?: string; created_at: string }) => {
        acts.push({
          icon: TrendingUp,
          text: p.change_type === 'downgrade' ? 'Downgrade de plano' : 'Upgrade de plano',
          sub: `Para o plano ${getPlanLabel(p.new_plan)}`,
          at: p.created_at,
        })
      })
    }

    acts.sort((a, b) => (a.at < b.at ? 1 : -1))
    setActivity(acts.slice(0, 6))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  // Fonte única: soma deduplicada de "requer ação" + "falhas técnicas ativas".
  // Fallback para a soma manual só quando a RPC não respondeu.
  const q = snapshot.queues
  const f = snapshot.failuresActive
  const pendencias = snapshot.ok
    ? attentionTotal(snapshot)
    : c.pendingGuidance + c.openTickets + c.reportsToReview + c.selfCarePending + c.emailFailures + c.aiFailures + c.pendingCancellations

  const cards = [
    { label: 'Usuários ativos', value: c.users, delta: c.newUsers7d > 0 ? `+${c.newUsers7d} nesta semana` : 'Total de contas', Icon: Users, bg: 'bg-mint', color: 'text-forest-600' },
    { label: 'Assinaturas pagas', value: c.paid, delta: 'Essencial + Plus', Icon: CreditCard, bg: 'bg-sky', color: 'text-[#3d6ea5]' },
    { label: 'Precisa de atenção', value: pendencias, delta: 'Ação + falhas técnicas ativas (sem duplicar)', Icon: Clock, bg: 'bg-coral', color: 'text-[#c05f3c]' },
    { label: 'Orientações abertas', value: c.pendingGuidance, delta: 'Aguardando resposta', Icon: MessageSquare, bg: 'bg-lilac', color: 'text-[#7c5cbf]' },
  ]

  const acaoRows = [
    { Icon: MessageSquare, color: 'text-[#3d6ea5]', bg: 'bg-sky', title: 'Orientações mensais a responder', qtd: q.guidance_pending ?? c.pendingGuidance, nav: 'guidance-requests' as AdminView },
    { Icon: LifeBuoy, color: 'text-forest-600', bg: 'bg-mint', title: 'Tickets de suporte abertos', qtd: q.tickets_open ?? c.openTickets, nav: 'support' as AdminView },
    { Icon: BarChart3, color: 'text-[#7c5cbf]', bg: 'bg-lilac', title: 'Relatórios aguardando revisão', qtd: q.reports_pending_review ?? c.reportsToReview, nav: 'pdf' as AdminView },
    { Icon: CalendarCheck, color: 'text-forest-600', bg: 'bg-mint', title: 'Planos de autocuidado a revisar', qtd: q.care_plans_pending ?? c.selfCarePending, nav: 'self-care-plans' as AdminView },
    { Icon: Ban, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Cancelamentos a tratar', qtd: q.cancellations_to_handle ?? c.pendingCancellations, nav: 'cancelamentos' as AdminView },
    { Icon: Cpu, color: 'text-[#7c5cbf]', bg: 'bg-lilac', title: 'Personalizações vencidas', qtd: q.personalization_overdue ?? 0, nav: 'personalization' as AdminView },
    { Icon: Megaphone, color: 'text-[#3d6ea5]', bg: 'bg-sky', title: 'Campanhas em rascunho', qtd: q.notifications_draft ?? 0, nav: 'comunicacao' as AdminView },
  ]

  const falhaRows = [
    { Icon: AlertTriangle, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Falhas ativas de IA', qtd: f.ai_errors ?? c.aiFailures, nav: 'uso-ia' as AdminView },
    { Icon: Mail, color: 'text-[#c9971f]', bg: 'bg-[#fbf1d5]', title: 'Falhas ativas de e-mail', qtd: f.emails_failed ?? c.emailFailures, nav: 'emails' as AdminView },
    { Icon: BarChart3, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Relatórios com falha', qtd: f.reports_failed ?? 0, nav: 'pdf' as AdminView },
    { Icon: CalendarCheck, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Planos de autocuidado com falha', qtd: f.care_plans_failed ?? 0, nav: 'self-care-plans' as AdminView },
    { Icon: BookOpen, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Jobs de conteúdo com falha', qtd: f.content_jobs_failed ?? 0, nav: 'automacoes-blog' as AdminView },
    { Icon: CreditCard, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Webhooks do Stripe com falha', qtd: f.webhooks_failed ?? 0, nav: 'financeiro' as AdminView },
    { Icon: Clock, color: 'text-[#c9971f]', bg: 'bg-[#fbf1d5]', title: 'Webhooks do Stripe travados', qtd: q.webhooks_stuck ?? 0, nav: 'financeiro' as AdminView },
  ]

  function openAllPending() {
    try { localStorage.setItem('admin-sistema-tab', 'filas') } catch { /* storage indisponível não impede navegação */ }
    onNavigate('sistema')
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Visão geral</h1>
          <p className="mt-1 text-sm text-ink-soft">Panorama operacional da plataforma e do que precisa de atenção hoje.</p>
          {loadError && <p className="mt-2 text-xs text-amber-700">{loadError}</p>}
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm border border-line bg-white px-4 py-2 rounded-xl hover:border-forest-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <AdminOperationalDashboard onNavigate={onNavigate} />

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
        <div className="lg:col-span-2 bg-white border border-line rounded-2xl p-5 space-y-5">
          {([
            { title: 'Requer ação', rows: acaoRows, empty: 'Nenhuma pendência operacional. 🌿' },
            { title: 'Falhas técnicas ativas', rows: falhaRows, empty: 'Nenhuma falha técnica ativa.' },
          ] as const).map(group => {
            const visible = group.rows.filter(r => (r.qtd ?? 0) > 0)
            return (
              <div key={group.title}>
                <h2 className="font-serif text-lg text-forest-900 mb-3">{group.title}</h2>
                {loading ? (
                  <p className="text-xs text-stone-400">Carregando…</p>
                ) : visible.length === 0 ? (
                  <p className="rounded-xl bg-mint/40 border border-forest-100 p-3 text-xs text-forest-700">{group.empty}</p>
                ) : (
                  <div className="divide-y divide-line">
                    {visible.map(row => (
                      <div key={row.title} className="flex items-center gap-3 py-2.5">
                        <span className={`w-9 h-9 rounded-full ${row.bg} flex items-center justify-center flex-shrink-0`}>
                          <row.Icon className={`w-4 h-4 ${row.color}`} />
                        </span>
                        <p className="flex-1 min-w-0 text-sm font-medium text-forest-900 truncate">{row.title}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-coral text-[#b0532f]">{row.qtd}</span>
                        <button onClick={() => onNavigate(row.nav)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2.5 py-1 whitespace-nowrap">Abrir</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {!snapshot.ok && !loading && (
            <p className="text-[11px] text-amber-700">Painel de filas indisponível — mostrando estimativa parcial.</p>
          )}
        </div>

        <div className="bg-white border border-line rounded-2xl p-5">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Atividade recente</h2>
          {loading ? (
            <p className="text-sm text-ink-soft">Carregando…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-ink-soft">Sem atividade recente.</p>
          ) : (
            <div className="space-y-4">
              {activity.map((a, i) => (
                <div key={`${a.at}-${i}`} className="flex gap-3">
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

      <div className="bg-white border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-forest-900">Saúde do sistema</h2>
          <button onClick={() => onNavigate('system-health')} className="inline-flex items-center gap-1 text-sm text-forest-700 hover:text-forest-900">
            Ver detalhes do sistema <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {health.map(h => {
            const dot = h.state === 'ok' ? 'bg-forest-500' : h.state === 'warn' ? 'bg-[#c9971f]' : h.state === 'error' ? 'bg-red-500' : 'bg-stone-300'
            const txt = h.state === 'ok' ? 'text-forest-600' : h.state === 'warn' ? 'text-[#9a6a10]' : h.state === 'error' ? 'text-red-600' : 'text-ink-soft'
            return (
              <button key={h.label} onClick={() => onNavigate(h.nav)} className="flex items-center gap-2.5 text-left min-w-0">
                <span className="w-9 h-9 rounded-full bg-paper-soft border border-line flex items-center justify-center flex-shrink-0">
                  <h.Icon className="w-4 h-4 text-forest-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-forest-900 truncate">{h.label}</p>
                  <p className={`text-xs flex items-start gap-1 ${txt}`} title={h.note}>
                    <span className={`w-1.5 h-1.5 mt-1 rounded-full flex-shrink-0 ${dot}`} />
                    <span className="line-clamp-2">{h.note}</span>
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 text-center">
        <button onClick={openAllPending} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
          Ir para todas as pendências <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}