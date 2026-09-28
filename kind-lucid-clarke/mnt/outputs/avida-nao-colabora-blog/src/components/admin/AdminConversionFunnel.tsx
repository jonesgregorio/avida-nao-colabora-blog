import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, CreditCard, Loader2, RefreshCw, TrendingUp, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { collectAllPages } from '../../lib/supabasePagination'

type Period = '7d' | '30d' | '90d'

const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '90d', label: '90 dias', days: 90 },
]

type EventRow = {
  event: string
  session_id: string | null
  user_id: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

type ExperimentVariant = 'ig_landing' | 'site_home'
type VariantSnapshot = { visits: number; registrations: number }

type ProfileRow = {
  user_id: string | null
  created_at: string
}

type SubscriptionRow = {
  user_id: string | null
  event_type: string
  previous_plan: string | null
  new_plan: string | null
  occurred_at: string
  status: string | null
  amount: number | null
}

type UsageRow = {
  user_id: string | null
  created_at: string
}

type Snapshot = {
  visitors: number
  planInterest: number
  signupStarted: number
  accountsCreated: number
  emailsConfirmed: number
  checkoutStarted: number
  newPaid: number
  upgrades: number
  activatedNewAccounts: number
  paidFromNewAccounts: number
  campaignVisits: number
  campaignCheckinStarted: number
  campaignCheckinCompleted: number
  campaignSignupClicked: number
  campaignRegistrations: number
  variants: Record<ExperimentVariant, VariantSnapshot>
  warnings: string[]
}

const EMPTY: Snapshot = {
  visitors: 0,
  planInterest: 0,
  signupStarted: 0,
  accountsCreated: 0,
  emailsConfirmed: 0,
  checkoutStarted: 0,
  newPaid: 0,
  upgrades: 0,
  activatedNewAccounts: 0,
  paidFromNewAccounts: 0,
  campaignVisits: 0,
  campaignCheckinStarted: 0,
  campaignCheckinCompleted: 0,
  campaignSignupClicked: 0,
  campaignRegistrations: 0,
  variants: {
    ig_landing: { visits: 0, registrations: 0 },
    site_home: { visits: 0, registrations: 0 },
  },
  warnings: [],
}

function uniqueSessions(rows: EventRow[]): number {
  return new Set(rows.map(row => row.session_id).filter((value): value is string => Boolean(value))).size
}

function userSet<T extends { user_id: string | null }>(rows: T[]): Set<string> {
  return new Set(rows.map(row => row.user_id).filter((value): value is string => Boolean(value)))
}

function intersectSize(a: Set<string>, b: Set<string>): number {
  let total = 0
  for (const value of a) if (b.has(value)) total++
  return total
}

function pct(value: number, base: number): string {
  return base > 0 ? `${Math.round((value / base) * 100)}%` : '—'
}

function isPaidPlan(plan: string | null): boolean {
  return Boolean(plan && !['free', 'gratuito'].includes(plan.toLowerCase()))
}

function eventVariant(row: EventRow): ExperimentVariant | null {
  const value = row.metadata?.experiment_variant
  return value === 'ig_landing' || value === 'site_home' ? value : null
}

export default function AdminConversionFunnel() {
  const [period, setPeriod] = useState<Period>('30d')
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)

  const days = PERIODS.find(item => item.id === period)?.days ?? 30
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days])

  async function load() {
    setLoading(true)

    const [eventsRes, profilesRes, subsRes, diaryRes, questionnaireRes] = await Promise.all([
      collectAllPages<EventRow>((from, to) =>
        supabase.from('analytics_events').select('event,session_id,user_id,created_at,metadata')
          .gte('created_at', since).order('created_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: EventRow[] | null; error: { message?: string } | null }>
      ),
      collectAllPages<ProfileRow>((from, to) =>
        supabase.from('profiles').select('user_id,created_at')
          .gte('created_at', since).order('created_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: ProfileRow[] | null; error: { message?: string } | null }>
      ),
      collectAllPages<SubscriptionRow>((from, to) =>
        supabase.from('subscription_events').select('user_id,event_type,previous_plan,new_plan,occurred_at,status,amount')
          .gte('occurred_at', since).in('event_type', ['checkout_completed', 'upgrade_confirmed'])
          .order('occurred_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: SubscriptionRow[] | null; error: { message?: string } | null }>
      ),
      collectAllPages<UsageRow>((from, to) =>
        supabase.from('diary_entries').select('user_id,created_at')
          .gte('created_at', since).order('created_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: UsageRow[] | null; error: { message?: string } | null }>
      ),
      collectAllPages<UsageRow>((from, to) =>
        supabase.from('questionnaire_responses').select('user_id,created_at')
          .eq('status', 'completed').gte('created_at', since)
          .order('created_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: UsageRow[] | null; error: { message?: string } | null }>
      ),
    ])

    const warnings: string[] = []
    if (eventsRes.error) warnings.push('eventos de navegação')
    if (profilesRes.error) warnings.push('cadastros')
    if (subsRes.error) warnings.push('confirmações do Stripe')
    if (diaryRes.error) warnings.push('uso de diário/check-in')
    if (questionnaireRes.error) warnings.push('questionários concluídos')

    const events = eventsRes.data
    const profiles = profilesRes.data
    const subscriptions = subsRes.data
    const diary = diaryRes.data
    const questionnaires = questionnaireRes.data

    const visitors = uniqueSessions(events.filter(row => ['page_view', 'article_view', 'route_change'].includes(row.event)))
    const planInterest = uniqueSessions(events.filter(row => row.event === 'plan_click'))
    const signupStarted = uniqueSessions(events.filter(row => row.event === 'signup_click'))
    const checkoutStarted = uniqueSessions(events.filter(row => row.event === 'checkout_started'))

    const profileUsers = userSet(profiles)
    const registerUsers = userSet(events.filter(row => row.event === 'register_success'))
    const confirmedUsers = userSet(events.filter(row => row.event === 'email_confirmation_success'))
    const accountUsers = profileUsers.size > 0 ? profileUsers : registerUsers

    const newPaidRows = subscriptions.filter(row =>
      row.event_type === 'checkout_completed' &&
      (!row.previous_plan || row.previous_plan === 'free') &&
      isPaidPlan(row.new_plan),
    )
    const upgradeRows = subscriptions.filter(row =>
      row.event_type === 'upgrade_confirmed' ||
      (row.event_type === 'checkout_completed' && Boolean(row.previous_plan) && row.previous_plan !== 'free' && isPaidPlan(row.new_plan)),
    )
    const newPaidUsers = userSet(newPaidRows)
    const upgradeUsers = userSet(upgradeRows)

    const usageUsers = userSet([...diary, ...questionnaires])
    const campaignRows = events.filter(row => eventVariant(row) !== null)
    const campaignVisits = uniqueSessions(campaignRows.filter(row => row.event === 'campaign_landing_view'))
    const campaignCheckinStarted = uniqueSessions(campaignRows.filter(row => row.event === 'ig_checkin_start'))
    const campaignCheckinCompleted = uniqueSessions(campaignRows.filter(row => row.event === 'ig_checkin_complete'))
    const campaignSignupClicked = uniqueSessions(campaignRows.filter(row => ['signup_click', 'signup_cta_click'].includes(row.event)))
    const campaignRegistrations = userSet(campaignRows.filter(row => ['registration_complete', 'email_confirmation_success'].includes(row.event))).size
    const variants = (['ig_landing', 'site_home'] as const).reduce<Record<ExperimentVariant, VariantSnapshot>>((result, variant) => {
      const variantRows = campaignRows.filter(row => eventVariant(row) === variant)
      result[variant] = {
        visits: uniqueSessions(variantRows.filter(row => row.event === 'campaign_landing_view')),
        registrations: userSet(variantRows.filter(row => ['registration_complete', 'email_confirmation_success'].includes(row.event))).size,
      }
      return result
    }, { ig_landing: { visits: 0, registrations: 0 }, site_home: { visits: 0, registrations: 0 } })

    setSnapshot({
      visitors,
      planInterest,
      signupStarted,
      accountsCreated: accountUsers.size,
      emailsConfirmed: confirmedUsers.size,
      checkoutStarted,
      newPaid: newPaidUsers.size,
      upgrades: upgradeUsers.size,
      activatedNewAccounts: intersectSize(accountUsers, usageUsers),
      paidFromNewAccounts: intersectSize(accountUsers, newPaidUsers),
      campaignVisits,
      campaignCheckinStarted,
      campaignCheckinCompleted,
      campaignSignupClicked,
      campaignRegistrations,
      variants,
      warnings,
    })
    setLoading(false)
  }

  useEffect(() => { void load() }, [since]) // eslint-disable-line react-hooks/exhaustive-deps

  const sessionSteps = [
    { label: 'Visitantes', value: snapshot.visitors },
    { label: 'Interesse em plano', value: snapshot.planInterest },
    { label: 'Iniciaram cadastro', value: snapshot.signupStarted },
    { label: 'Iniciaram checkout', value: snapshot.checkoutStarted },
  ]
  const sessionMax = Math.max(1, snapshot.visitors, ...sessionSteps.map(step => step.value))

  const cards = [
    { label: 'Contas criadas', value: snapshot.accountsCreated, note: `${pct(snapshot.accountsCreated, snapshot.visitors)} das visitas`, Icon: UserPlus },
    { label: 'Novos assinantes pagos', value: snapshot.newPaid, note: 'Stripe confirmado', Icon: CreditCard },
    { label: 'Ativaram um recurso', value: snapshot.activatedNewAccounts, note: `${pct(snapshot.activatedNewAccounts, snapshot.accountsCreated)} das contas novas`, Icon: Activity },
    { label: 'Upgrades pagos', value: snapshot.upgrades, note: 'separados de aquisição', Icon: TrendingUp },
  ]
  const campaignSteps = [
    { label: 'Visita', value: snapshot.campaignVisits },
    { label: 'Início do check-in', value: snapshot.campaignCheckinStarted },
    { label: 'Check-in concluído', value: snapshot.campaignCheckinCompleted },
    { label: 'Clique no cadastro', value: snapshot.campaignSignupClicked },
    { label: 'Conta criada e confirmada', value: snapshot.campaignRegistrations },
  ]
  const campaignMax = Math.max(1, ...campaignSteps.map(step => step.value))
  const abReady = snapshot.variants.ig_landing.visits >= 100 && snapshot.variants.site_home.visits >= 100

  return (
    <section className="mb-6 rounded-3xl border border-forest-100 bg-gradient-to-br from-white to-mint/30 p-5 md:p-6 shadow-sm" aria-labelledby="conversion-funnel-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-900 px-2.5 py-1 text-[11px] font-semibold text-white">P3.19 · oficial</span>
            <span className="text-xs text-ink-soft">fonte financeira: Stripe/webhook</span>
          </div>
          <h2 id="conversion-funnel-title" className="mt-2 font-serif text-2xl text-forest-900">Funil comercial e ativação</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">
            Separa intenção de compra, criação de conta, assinatura nova, upgrade e primeira utilização real. Nenhum texto de diário, resposta de questionário ou conteúdo emocional é lido por este painel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-line bg-white p-1">
            {PERIODS.map(item => (
              <button key={item.id} onClick={() => setPeriod(item.id)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${period === item.id ? 'bg-forest-900 text-white' : 'text-ink-soft hover:text-forest-900'}`}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-forest-800 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, note, Icon }) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-serif text-2xl text-forest-900">{loading ? '—' : value}</p>
                <p className="mt-0.5 text-sm font-medium text-forest-900">{label}</p>
              </div>
              <span className="rounded-xl bg-mint p-2 text-forest-700"><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-2 text-[11px] text-ink-soft">{loading ? 'Carregando…' : note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-line bg-white p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg text-forest-900">Aquisição por sessão</h3>
              <p className="text-xs text-ink-soft">Etapas anônimas do navegador. Não são somadas a usuários do Stripe como se fossem a mesma unidade.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {sessionSteps.map((step, index) => {
              const previous = index > 0 ? sessionSteps[index - 1].value : 0
              return (
                <div key={step.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="text-forest-900">{step.label}</span>
                    <span className="whitespace-nowrap text-ink-soft">{loading ? '—' : step.value}{!loading && index > 0 ? ` · ${pct(step.value, previous)} da etapa` : ''}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: loading ? '0%' : `${Math.min(100, (step.value / sessionMax) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4 md:p-5">
          <h3 className="font-serif text-lg text-forest-900">Conversão por usuário</h3>
          <p className="text-xs text-ink-soft">A assinatura é confirmada no servidor. Upgrade não entra como novo assinante.</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-ink-soft">Contas criadas</dt><dd className="font-medium text-forest-900">{loading ? '—' : snapshot.accountsCreated}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-ink-soft">E-mails confirmados rastreados</dt><dd className="font-medium text-forest-900">{loading ? '—' : snapshot.emailsConfirmed}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-ink-soft">Contas novas que viraram pagas</dt><dd className="font-medium text-forest-900">{loading ? '—' : snapshot.paidFromNewAccounts} · {pct(snapshot.paidFromNewAccounts, snapshot.accountsCreated)}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-ink-soft">Contas novas que ativaram recurso</dt><dd className="font-medium text-forest-900">{loading ? '—' : snapshot.activatedNewAccounts} · {pct(snapshot.activatedNewAccounts, snapshot.accountsCreated)}</dd></div>
          </dl>
          <div className="mt-4 rounded-xl bg-mint/60 p-3 text-xs text-forest-800">
            <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /><p><strong>Ativação real</strong> = a conta nova registrou diário/check-in ou concluiu questionário no período. O painel usa somente IDs e horários para essa contagem.</p></div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-line bg-white p-4 md:p-5">
          <h3 className="font-serif text-lg text-forest-900">Funil da campanha Instagram</h3>
          <p className="text-xs text-ink-soft">Cada etapa recebe a mesma atribuição UTM. A conversão final só conta após a confirmação do e-mail.</p>
          <div className="mt-4 space-y-3">
            {campaignSteps.map((step, index) => {
              const previous = index > 0 ? campaignSteps[index - 1].value : 0
              return (
                <div key={step.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="text-forest-900">{step.label}</span>
                    <span className="whitespace-nowrap text-ink-soft">{loading ? '—' : step.value}{!loading && index > 0 ? ` · ${pct(step.value, previous)} da etapa` : ''}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: loading ? '0%' : `${Math.min(100, (step.value / campaignMax) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg text-forest-900">Teste A/B · /ig × site normal</h3>
              <p className="text-xs text-ink-soft">Não altere páginas, público ou criativo enquanto o teste estiver coletando visitas.</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${abReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {abReady ? 'Pronto para avaliar' : 'Coletando'}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {([
              { key: 'ig_landing' as const, label: 'Landing /ig' },
              { key: 'site_home' as const, label: 'Site normal' },
            ]).map(item => {
              const result = snapshot.variants[item.key]
              const progress = Math.min(100, (result.visits / 100) * 100)
              return (
                <div key={item.key} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between text-sm"><span className="font-medium text-forest-900">{item.label}</span><span className="text-ink-soft">{result.visits} visitas · {result.registrations} cadastros</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-forest-600" style={{ width: `${progress}%` }} /></div>
                  <p className="mt-1.5 text-[11px] text-ink-soft">{result.visits >= 100 ? `${pct(result.registrations, result.visits)} de conversão · mínimo atingido` : `${100 - result.visits} visitas até o mínimo`}</p>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">Avalie a primeira leitura com 100 visitas por versão; prefira 200 por versão para uma decisão mais estável.</p>
        </div>
      </div>

      {snapshot.warnings.length > 0 && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Dados parcialmente indisponíveis nesta leitura: {snapshot.warnings.join(', ')}. O restante do painel continua válido.
        </p>
      )}
    </section>
  )
}
