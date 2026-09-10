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
  fetchOperationalSnapshot, attentionTotal, markAiFailuresDeepLink,
  type OperationalSnapshot,
} from '../../lib/adminOperationalStatus'
import {
  Users, CreditCard, Clock, MessageSquare, RefreshCw, ArrowRight,
  LifeBuoy, BarChart3, CalendarCheck, AlertTriangle,
  UserPlus, TrendingUp, Mail, Database, Cpu, HardDrive, ChevronRight, Ban,
  Megaphone, BookOpen,
} from 'lucide-react'

interface OverviewProps { onNavigate: (v: AdminView) => void }

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
type HealthItem = { Icon: typeof Database; label: string; state: HealthState; note: string; nav: AdminView }
interface Activity { icon: typeof UserPlus; text: string; sub: string; at: string }
interface CountResult { count: number; error: string | null }

const EMPTY: Counts = {
  users: 0, newUsers7d: 0, paid: 0, pendingGuidance: 0,
  openTickets: 0, reportsToReview: 0, selfCarePending: 0, emailFailures: 0, aiFailures: 0, pendingCancellations: 0,
}
const EMPTY_SNAPSHOT: OperationalSnapshot = { ok: false, queues: {}, failuresActive: {}, failures24h: {} }

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
      checkSupabaseConnection(), checkTransactionalEmail(), checkPayments(), checkAI(), checkStorage(),
    ])

    setHealth([
      { Icon: Database, label: 'Banco de dados', state: healthState(databaseCheck.status), note: databaseCheck.status === 'ok' ? 'Conexão verificada' : databaseCheck.errorMessage || 'Não foi possível confirmar', nav: 'system-health' },
      { Icon: Mail, label: 'E-mails', state: emailFailures > 0 ? 'warn' : healthState(emailCheck.status), note: emailFailures > 0 ? `${emailFailures} falha(s) ativa(s) nas últimas 24h` : emailCheck.status === 'ok' ? 'Função de envio acessível' : emailCheck.errorMessage || 'Não foi possível confirmar', nav: 'emails' },
      { Icon: CreditCard, label: 'Pagamentos', state: healthState(paymentCheck.status), note: paymentCheck.status === 'ok' ? 'Checkout, webhook e gestão acessíveis' : paymentCheck.errorMessage || 'Não foi possível confirmar', nav: 'financeiro' },
      { Icon: Cpu, label: 'IA e recomendações', state: aiFailures > 0 ? 'warn' : healthState(aiCheck.status), note: aiFailures > 0 ? `${aiFailures} falha(s) ativa(s) nas últimas 24h` : aiCheck.status === 'ok' ? 'Provedor principal respondeu ao teste' : aiCheck.errorMessage || 'Não foi possível confirmar', nav: 'uso-ia' },
      { Icon: HardDrive, label: 'Storage', state: healthState(storageCheck.status), note: storageCheck.status === 'ok' ? 'Bucket de mídia acessível' : storageCheck.errorMessage || 'Não foi possível confirmar', nav: 'system-health' },
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

  const q = snapshot.queues
  const f = snapshot.failuresActive
  const pendencias = snapshot.ok
    ? attentionTotal(snapshot)
    : c.pendingGuidance + c.openTickets + c.reportsToReview + c.selfCarePending + c.emailFailures + c.aiFailures + c.pendingCancellations

  const cards = [
    { label: 'Usuários ativos', value: c.users, delta: 'Total de contas', Icon: Users, tone: 'bg-[#eaf3ed] text-forest-700' },
    { label: 'Assinaturas pagas', value: c.paid, delta: 'Essencial + Plus', Icon: CreditCard, tone: 'bg-[#eaf1f8] text-[#3d6ea5]' },
    { label: 'Precisa de atenção', value: pendencias, delta: 'Pendências e falhas ativas', Icon: Clock, tone: 'bg-[#fbe9e1] text-[#b95b3b]' },
    { label: 'Novos cadastros', value: c.newUsers7d, delta: 'Nos últimos 7 dias', Icon: UserPlus, tone: 'bg-[#f0ebf8] text-[#7056a5]' },
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
    { Icon: AlertTriangle, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Falhas ativas de IA', qtd: f.ai_errors ?? c.aiFailures, nav: 'uso-ia' as AdminView, before: markAiFailuresDeepLink },
    { Icon: Mail, color: 'text-[#c9971f]', bg: 'bg-[#fbf1d5]', title: 'Falhas ativas de e-mail', qtd: f.emails_failed ?? c.emailFailures, nav: 'emails' as AdminView },
    { Icon: BarChart3, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Relatórios com falha', qtd: f.reports_failed ?? 0, nav: 'pdf' as AdminView },
    { Icon: CalendarCheck, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Planos de autocuidado com falha', qtd: f.care_plans_failed ?? 0, nav: 'self-care-plans' as AdminView },
    { Icon: BookOpen, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Jobs de conteúdo com falha', qtd: f.content_jobs_failed ?? 0, nav: 'automacoes-blog' as AdminView },
    { Icon: CreditCard, color: 'text-[#c05f3c]', bg: 'bg-coral', title: 'Webhooks do Stripe com falha', qtd: f.webhooks_failed ?? 0, nav: 'financeiro' as AdminView },
    { Icon: Clock, color: 'text-[#c9971f]', bg: 'bg-[#fbf1d5]', title: 'Webhooks do Stripe travados', qtd: q.webhooks_stuck ?? 0, nav: 'financeiro' as AdminView },
  ]

  const activeActions = acaoRows.filter(r => (r.qtd ?? 0) > 0)
  const activeFailures = falhaRows.filter(r => (r.qtd ?? 0) > 0)

  function openAllPending() {
    try { localStorage.setItem('admin-sistema-tab', 'filas') } catch { /* storage indisponível não impede navegação */ }
    onNavigate('sistema')
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <header className="mb-5 flex flex-col gap-4 rounded-[24px] border border-line bg-[#fbf8f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">Painel administrativo</p>
          <h1 className="font-serif text-[30px] leading-none text-forest-900 sm:text-[34px]">Visão geral</h1>
          <p className="mt-2 text-sm text-ink-soft">O essencial da operação, da jornada e do que precisa da sua atenção.</p>
          {loadError && <p className="mt-2 text-xs text-amber-700">{loadError}</p>}
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex self-start items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm text-forest-900 shadow-sm transition-colors hover:border-forest-300 disabled:opacity-50 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card, index) => (
          <div key={card.label} className={`relative overflow-hidden rounded-[22px] border p-4 sm:p-5 ${index === 2 && !loading && pendencias > 0 ? 'border-[#e9c3b5] bg-[#fff8f4]' : 'border-line bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">{card.label}</p>
                <p className="mt-2 font-serif text-[36px] leading-none text-forest-900 sm:text-[42px]">{loading ? '—' : card.value}</p>
              </div>
              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${card.tone}`}><card.Icon className="h-[18px] w-[18px]" /></span>
            </div>
            <p className="mt-3 text-[11px] text-stone-500">{card.delta}</p>
          </div>
        ))}
      </section>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8"><AdminOperationalDashboard onNavigate={onNavigate} /></div>

        <aside className="rounded-[24px] border border-line bg-white p-5 sm:p-6 xl:col-span-4">
          <div className="mb-5 flex items-end justify-between gap-3 border-b border-line/80 pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-600">Movimento</p>
              <h2 className="mt-1 font-serif text-2xl text-forest-900">Atividade recente</h2>
            </div>
            <span className="text-[11px] text-stone-400">Últimos eventos</span>
          </div>
          {loading ? (
            <p className="text-sm text-ink-soft">Carregando…</p>
          ) : activity.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-4 text-sm text-ink-soft">Sem atividade recente.</p>
          ) : (
            <div className="relative pl-1 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-line">
              {activity.map((a, i) => (
                <div key={`${a.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
                  <span className="z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-line bg-[#fffdf9] shadow-[0_0_0_4px_white]">
                    <a.icon className="h-3.5 w-3.5 text-forest-600" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium leading-tight text-forest-900">{a.text}</p>
                    <p className="mt-1 truncate text-xs text-ink-soft">{a.sub}</p>
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide text-stone-400">{new Date(a.at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="rounded-[24px] border border-line bg-white p-5 sm:p-6 xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a95738]">Prioridades</p>
              <h2 className="mt-1 font-serif text-2xl text-forest-900">Requer ação</h2>
            </div>
            <button onClick={openAllPending} className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-700 hover:text-forest-900">Ver todas as pendências <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>

          {loading ? (
            <p className="text-xs text-stone-400">Carregando…</p>
          ) : activeActions.length === 0 && activeFailures.length === 0 ? (
            <div className="rounded-2xl border border-forest-100 bg-mint/35 px-4 py-4 text-sm text-forest-700">Nada pendente no momento. 🌿</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Operação</h3>
                <div className="divide-y divide-line rounded-2xl border border-line px-3">
                  {activeActions.map(row => (
                    <div key={row.title} className="flex items-center gap-3 py-2.5">
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${row.bg}`}><row.Icon className={`h-3.5 w-3.5 ${row.color}`} /></span>
                      <p className="min-w-0 flex-1 text-xs font-medium text-forest-900">{row.title}</p>
                      <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-semibold text-[#b0532f]">{row.qtd}</span>
                      <button onClick={() => onNavigate(row.nav)} className="text-[11px] font-medium text-forest-700 hover:text-forest-900">Abrir</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Falhas técnicas ativas</h3>
                {activeFailures.length === 0 ? (
                  <div className="rounded-2xl border border-forest-100 bg-mint/25 px-4 py-4 text-xs text-forest-700">Nenhuma falha técnica ativa.</div>
                ) : (
                  <div className="divide-y divide-line rounded-2xl border border-[#eed9cf] bg-[#fffaf7] px-3">
                    {activeFailures.map(row => (
                      <div key={row.title} className="flex items-center gap-3 py-2.5">
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${row.bg}`}><row.Icon className={`h-3.5 w-3.5 ${row.color}`} /></span>
                        <p className="min-w-0 flex-1 text-xs font-medium text-forest-900">{row.title}</p>
                        <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-semibold text-[#b0532f]">{row.qtd}</span>
                        <button onClick={() => { (row as { before?: () => void }).before?.(); onNavigate(row.nav) }} className="text-[11px] font-medium text-forest-700 hover:text-forest-900">Abrir</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {!snapshot.ok && !loading && <p className="mt-3 text-[10px] text-amber-700">Painel de filas indisponível — mostrando estimativa parcial.</p>}
        </section>

        <aside className="rounded-[24px] border border-line bg-[#fbf8f2] p-5 sm:p-6 xl:col-span-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-600">Resumo operacional</p>
          <h2 className="mt-1 font-serif text-2xl text-forest-900">Hoje no Admin</h2>
          <div className="mt-5 divide-y divide-line">
            {[
              { label: 'Orientações abertas', value: c.pendingGuidance, Icon: MessageSquare, nav: 'guidance-requests' as AdminView },
              { label: 'Tickets abertos', value: c.openTickets, Icon: LifeBuoy, nav: 'support' as AdminView },
              { label: 'Cancelamentos a tratar', value: c.pendingCancellations, Icon: Ban, nav: 'cancelamentos' as AdminView },
              { label: 'Falhas técnicas', value: activeFailures.reduce((sum, row) => sum + Number(row.qtd ?? 0), 0), Icon: AlertTriangle, nav: 'system-health' as AdminView },
            ].map(item => (
              <button key={item.label} onClick={() => onNavigate(item.nav)} className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white"><item.Icon className="h-4 w-4 text-forest-600" /></span>
                <span className="min-w-0 flex-1 text-sm text-stone-600">{item.label}</span>
                <strong className="font-serif text-2xl font-normal text-forest-900">{loading ? '—' : item.value}</strong>
                <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="rounded-[24px] border border-line bg-white px-5 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-600">Infraestrutura</p>
            <h2 className="mt-1 font-serif text-xl text-forest-900">Saúde do sistema</h2>
          </div>
          <button onClick={() => onNavigate('system-health')} className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 hover:text-forest-900">Ver detalhes do sistema <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          {health.map(h => {
            const dot = h.state === 'ok' ? 'bg-forest-500' : h.state === 'warn' ? 'bg-[#c9971f]' : h.state === 'error' ? 'bg-red-500' : 'bg-stone-300'
            const text = h.state === 'ok' ? 'text-forest-600' : h.state === 'warn' ? 'text-[#9a6a10]' : h.state === 'error' ? 'text-red-600' : 'text-ink-soft'
            return (
              <button key={h.label} onClick={() => onNavigate(h.nav)} className="flex min-w-0 items-start gap-2.5 px-0 py-3 text-left sm:px-3 lg:first:pl-0 lg:last:pr-0">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-paper-soft"><h.Icon className="h-3.5 w-3.5 text-forest-600" /></span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-forest-900">{h.label}</p>
                  <p className={`mt-0.5 flex items-start gap-1 text-[10px] leading-snug ${text}`} title={h.note}><span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} /><span className="line-clamp-2">{h.note}</span></p>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
