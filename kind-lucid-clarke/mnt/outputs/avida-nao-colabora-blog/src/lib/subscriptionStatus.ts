// ============================================================================
// Status da assinatura — tradução única (§2)
// ============================================================================
// O banco guarda dois status diferentes e é fácil confundi-los:
//   • user_subscriptions.status        → status INTERNO do app (active, cancel_pending…)
//   • user_subscriptions.payment_status → status CRU do Stripe (active, past_due…)
// O Stripe é a fonte de verdade; quando o status dele existe, ele manda.
// ============================================================================

export type Tom = 'ok' | 'alerta' | 'erro' | 'neutro'

interface StatusInfo { label: string; tom: Tom }

// Status crus do Stripe.
const STRIPE_STATUS: Record<string, StatusInfo> = {
  active: { label: 'Ativa', tom: 'ok' },
  trialing: { label: 'Em período de teste', tom: 'ok' },
  past_due: { label: 'Inadimplente', tom: 'erro' },
  unpaid: { label: 'Pagamento recusado', tom: 'erro' },
  canceled: { label: 'Cancelada', tom: 'neutro' },
  incomplete: { label: 'Incompleta', tom: 'alerta' },
  incomplete_expired: { label: 'Expirada', tom: 'neutro' },
  paused: { label: 'Pausada', tom: 'alerta' },
}

// Status internos do app (user_subscriptions.status).
const APP_STATUS: Record<string, StatusInfo> = {
  active: { label: 'Ativa', tom: 'ok' },
  cancel_pending: { label: 'Cancelamento agendado', tom: 'alerta' },
  cancelled: { label: 'Cancelada', tom: 'neutro' },
  past_due: { label: 'Pagamento pendente', tom: 'erro' },
  trial: { label: 'Em período de teste', tom: 'ok' },
  inactive: { label: 'Inativa', tom: 'neutro' },
  free: { label: 'Ativo', tom: 'ok' },
}

export const TOM_CLASSES: Record<Tom, string> = {
  ok: 'bg-green-100 text-green-700',
  alerta: 'bg-amber-100 text-amber-700',
  erro: 'bg-red-100 text-red-700',
  neutro: 'bg-stone-100 text-stone-500',
}

/**
 * Status para exibir. Agendamentos têm prioridade sobre o status cru: para quem
 * olha, "Cancelamento agendado" é mais informativo do que "Ativa" — embora as
 * duas coisas sejam verdade ao mesmo tempo no Stripe.
 */
export function resolveStatus(opts: {
  appStatus?: string | null
  stripeStatus?: string | null
  cancelAtPeriodEnd?: boolean | null
  pendingPlan?: string | null
  plan?: string | null
}): StatusInfo {
  const { appStatus, stripeStatus, cancelAtPeriodEnd, pendingPlan, plan } = opts

  if (plan === 'free' && !stripeStatus) return { label: 'Gratuito', tom: 'neutro' }

  // Problema de pagamento vence tudo: é o que exige ação.
  if (stripeStatus && ['past_due', 'unpaid', 'incomplete'].includes(stripeStatus)) {
    return STRIPE_STATUS[stripeStatus]
  }
  if (cancelAtPeriodEnd || appStatus === 'cancel_pending') {
    return { label: 'Cancelamento agendado', tom: 'alerta' }
  }
  if (pendingPlan) return { label: 'Downgrade agendado', tom: 'alerta' }

  if (stripeStatus && STRIPE_STATUS[stripeStatus]) return STRIPE_STATUS[stripeStatus]
  if (appStatus && APP_STATUS[appStatus]) return APP_STATUS[appStatus]
  return { label: appStatus || '—', tom: 'neutro' }
}

// ── Linha do tempo (subscription_events.event_type) ──
export const EVENT_LABELS: Record<string, string> = {
  subscription_created: 'Assinatura criada',
  checkout_completed: 'Checkout concluído',
  payment_confirmed: 'Pagamento confirmado',
  payment_failed: 'Pagamento recusado',
  subscription_renewed: 'Assinatura renovada',
  upgrade_confirmed: 'Upgrade realizado',
  downgrade_requested: 'Downgrade solicitado',
  downgrade_completed: 'Downgrade efetivado',
  cancellation_requested: 'Cancelamento solicitado',
  cancellation_completed: 'Cancelamento efetivado',
  subscription_deleted: 'Assinatura encerrada',
  plan_changed: 'Plano alterado',
}

export const EVENT_TOM: Record<string, Tom> = {
  payment_confirmed: 'ok',
  subscription_renewed: 'ok',
  upgrade_confirmed: 'ok',
  checkout_completed: 'ok',
  subscription_created: 'ok',
  payment_failed: 'erro',
  cancellation_requested: 'alerta',
  downgrade_requested: 'alerta',
  cancellation_completed: 'neutro',
  downgrade_completed: 'neutro',
  subscription_deleted: 'neutro',
  plan_changed: 'neutro',
}

export const eventLabel = (t: string): string => EVENT_LABELS[t] ?? t

/** "15 de julho de 2026 às 14:32" — pt-BR, fuso de São Paulo (§4). */
export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const data = d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
  })
  const hora = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
  return `${data} às ${hora}`
}

/** "15/07/2026 14:32" — versão curta para tabelas. */
export function formatDateTimeShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

export const formatBRL = (v: number | null | undefined): string =>
  v == null ? '—' : `R$ ${v.toFixed(2).replace('.', ',')}`
