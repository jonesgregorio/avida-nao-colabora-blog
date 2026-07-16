// ============================================================================
// Ciclo de cobrança — fonte ÚNICA da data de fim de ciclo e da formatação.
// ============================================================================
// Regra oficial: a data que o usuário vê (downgrade/cancelamento/renovação) é
// SEMPRE o fim do ciclo já pago. Nunca data fixa, nunca a data de hoje.
//
// Prioridade da fonte:
//   1. current_period_end        (Stripe → sincronizado pelo webhook)
//   2. pending_plan_starts_at    (mudança já agendada)
//   3. plan_activated_at + 30d   (fallback só quando não há dado melhor)
//
// IMPORTANTE — por que existe `rollForward`:
// Um `current_period_end` no PASSADO é dado ESTRAGADO (webhook não sincronizou,
// ou a linha foi escrita à mão sem o ciclo). Exibir esse valor cru é o que fazia
// a modal mostrar sempre a mesma data vencida. Aqui, um limite no passado é
// projetado para a próxima fronteira de 30 dias, preservando o dia de cobrança.
// ============================================================================

export const BILLING_TZ = 'America/Sao_Paulo'
export const CYCLE_DAYS = 30
const MS_PER_DAY = 86_400_000
const MS_PER_CYCLE = CYCLE_DAYS * MS_PER_DAY

export interface BillingSubscription {
  current_period_start?: string | null
  current_period_end?: string | null
  pending_plan?: string | null
  pending_plan_starts_at?: string | null
  cancel_at_period_end?: boolean | null
  status?: string | null
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Projeta um limite de ciclo para a próxima fronteira futura, em passos de 30
 * dias, mantendo o alinhamento com a data original de cobrança.
 * Se `boundary` já é futuro, devolve ele mesmo.
 */
export function rollForward(boundary: Date, now: Date = new Date()): Date {
  const diff = now.getTime() - boundary.getTime()
  if (diff <= 0) return boundary
  const cycles = Math.ceil(diff / MS_PER_CYCLE)
  return new Date(boundary.getTime() + cycles * MS_PER_CYCLE)
}

/** Fallback §11: ativação + 30 dias, projetado para a próxima fronteira futura. */
export function calculateFallbackPeriodEnd(planActivatedAt: string | null | undefined, now: Date = new Date()): Date | null {
  const anchor = toDate(planActivatedAt)
  if (!anchor) return null
  return rollForward(new Date(anchor.getTime() + MS_PER_CYCLE), now)
}

/** Lê o fim do ciclo vindo do Stripe/Supabase, já protegido contra valor vencido. */
export function getCurrentPeriodEnd(sub: BillingSubscription | null, now: Date = new Date()): Date | null {
  const end = toDate(sub?.current_period_end)
  return end ? rollForward(end, now) : null
}

/**
 * Data em que a mudança (downgrade/cancelamento) entra em vigor.
 * Devolve `null` quando não há NENHUMA fonte confiável — o chamador deve exibir
 * um estado honesto ("—"), nunca inventar uma data.
 */
export function resolveEffectivePeriodEnd(
  sub: BillingSubscription | null,
  planActivatedAt: string | null | undefined,
  now: Date = new Date(),
): Date | null {
  // 1. Fim do ciclo vindo do Stripe (fonte preferencial).
  const fromStripe = getCurrentPeriodEnd(sub, now)
  if (fromStripe) return fromStripe

  // 2. Mudança já agendada.
  const scheduled = toDate(sub?.pending_plan_starts_at)
  if (scheduled) return rollForward(scheduled, now)

  // 3. Fallback: ativação + 30 dias.
  return calculateFallbackPeriodEnd(planActivatedAt, now)
}

/**
 * Um valor à meia-noite UTC exata NÃO é um instante real de cobrança: é uma data
 * de calendário (veio de seed/ajuste manual ou do fallback ativação+30d).
 * Exibi-lo em São Paulo (UTC−3) o joga para as 21h do DIA ANTERIOR — era isso que
 * fazia "15 de julho" virar "14 de julho" na tela. Nesse caso lemos em UTC, que é
 * o dia que o valor realmente representa.
 * Timestamps reais do Stripe têm hora cheia e continuam no fuso de São Paulo.
 */
function tzFor(d: Date): string {
  const isCalendarDate =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  return isCalendarDate ? 'UTC' : BILLING_TZ
}

/** "16 de agosto de 2026" — pt-BR, sem virar o dia por UTC. */
export function formatBillingDate(value: Date | string | null | undefined): string {
  const d = value instanceof Date ? value : toDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: tzFor(d),
  })
}

/** "16/08/2026" — pt-BR curto, mesma regra de fuso. */
export function formatBillingDateShort(value: Date | string | null | undefined): string {
  const d = value instanceof Date ? value : toDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tzFor(d),
  })
}

/** Dias restantes até o fim do ciclo (nunca negativo). */
export function daysRemaining(end: Date | string | null | undefined, now: Date = new Date()): number {
  const d = end instanceof Date ? end : toDate(end)
  if (!d) return 0
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / MS_PER_DAY))
}

/** Duração do ciclo em dias — usa o par start/end real quando existir. */
export function totalDaysInCycle(start: string | null | undefined, end: string | null | undefined): number {
  const s = toDate(start)
  const e = toDate(end)
  if (!s || !e) return CYCLE_DAYS
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / MS_PER_DAY))
}
