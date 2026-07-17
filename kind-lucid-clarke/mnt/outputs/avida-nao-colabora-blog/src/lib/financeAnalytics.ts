// ============================================================================
// Analytics Financeiro — cálculo das métricas (§6)
// ============================================================================
// Regra que rege tudo: RECEITA = pagamento CONFIRMADO, nunca assinatura criada.
// A fonte é subscription_events (alimentado pelo webhook a partir do Stripe).
// Nada aqui inventa número: se não houver evento, a métrica é zero.
// ============================================================================

import { REASON_OPTIONS, type ReasonSlug } from './cancelReasons'

export interface FinanceEvent {
  id: string
  user_id: string | null
  event_type: string
  previous_plan: string | null
  new_plan: string | null
  amount: number | null
  currency: string | null
  status: string | null
  reasons: string[] | null
  comment: string | null
  stripe_invoice_id: string | null
  occurred_at: string
}

export interface FeedbackRow {
  id: string
  user_id: string
  change_type: string
  current_plan: string
  target_plan: string
  reasons: string[]
  comment: string | null
  requested_at: string
  effective_at: string | null
  status: string
}

export type PeriodKey = 'hoje' | '7d' | 'mes' | 'mes_anterior' | '3m' | '6m' | 'custom'

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoje: 'Hoje',
  '7d': 'Últimos 7 dias',
  mes: 'Este mês',
  mes_anterior: 'Mês anterior',
  '3m': 'Últimos 3 meses',
  '6m': 'Últimos 6 meses',
  custom: 'Personalizado',
}

/** Intervalo [início, fim) do período. Usa o fuso local do navegador (admin no Brasil). */
export function periodRange(p: PeriodKey, custom?: { from: string; to: string }, now: Date = new Date()): { from: Date; to: Date } {
  const fimDoDia = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  switch (p) {
    case 'hoje':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: fimDoDia }
    case '7d':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), to: fimDoDia }
    case 'mes':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: fimDoDia }
    case 'mes_anterior':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) }
    case '3m':
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: fimDoDia }
    case '6m':
      return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to: fimDoDia }
    case 'custom':
      return {
        from: custom?.from ? new Date(custom.from + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1),
        to: custom?.to ? new Date(custom.to + 'T23:59:59') : fimDoDia,
      }
  }
}

const dentro = (iso: string, r: { from: Date; to: Date }) => {
  const t = new Date(iso).getTime()
  return t >= r.from.getTime() && t < r.to.getTime()
}

// Eventos que representam DINHEIRO ENTRANDO de fato.
const EVENTOS_RECEITA = ['payment_confirmed', 'subscription_renewed']

/** Soma só pagamentos confirmados (§6). Upgrade/checkout sem valor não entram. */
export function receitaDe(eventos: FinanceEvent[], r: { from: Date; to: Date }): number {
  return eventos
    .filter(e => EVENTOS_RECEITA.includes(e.event_type) && dentro(e.occurred_at, r))
    .reduce((s, e) => s + (e.amount ?? 0), 0)
}

export interface Metricas {
  receitaPeriodo: number
  receitaMesAtual: number
  receitaMesAnterior: number
  variacaoPct: number | null
  mrr: number
  receitaPerdida: number
  pagamentosConfirmados: number
  pagamentosNegados: number
  cancelamentosSolicitados: number
  cancelamentosEfetivados: number
  downgradesSolicitados: number
  downgradesEfetivados: number
  upgrades: number
}

export function calcularMetricas(
  eventos: FinanceEvent[],
  range: { from: Date; to: Date },
  assinaturasAtivas: { plan: string; valor: number }[],
  now: Date = new Date(),
): Metricas {
  const noPeriodo = eventos.filter(e => dentro(e.occurred_at, range))
  const conta = (t: string) => noPeriodo.filter(e => e.event_type === t).length

  const rMes = periodRange('mes', undefined, now)
  const rAnterior = periodRange('mes_anterior', undefined, now)
  const receitaMesAtual = receitaDe(eventos, rMes)
  const receitaMesAnterior = receitaDe(eventos, rAnterior)

  // MRR: soma do valor das assinaturas pagas ativas AGORA (não histórico).
  const mrr = assinaturasAtivas.reduce((s, a) => s + a.valor, 0)

  // Receita perdida: mensalidade dos planos que foram cancelados no período.
  const receitaPerdida = noPeriodo
    .filter(e => e.event_type === 'cancellation_completed')
    .reduce((s, e) => s + (e.amount ?? 0), 0)

  const variacaoPct = receitaMesAnterior > 0
    ? ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100
    : null // sem base de comparação: não inventar percentual

  return {
    receitaPeriodo: receitaDe(eventos, range),
    receitaMesAtual,
    receitaMesAnterior,
    variacaoPct,
    mrr,
    receitaPerdida,
    pagamentosConfirmados: noPeriodo.filter(e => EVENTOS_RECEITA.includes(e.event_type)).length,
    pagamentosNegados: conta('payment_failed'),
    cancelamentosSolicitados: conta('cancellation_requested'),
    cancelamentosEfetivados: conta('cancellation_completed'),
    downgradesSolicitados: conta('downgrade_requested'),
    downgradesEfetivados: conta('downgrade_completed'),
    upgrades: conta('upgrade_confirmed'),
  }
}

/**
 * Ranking de motivos (§19). Cada motivo selecionado conta 1 — um feedback com
 * dois motivos soma +1 em cada, e não 0,5. Por isso o total pode exceder o
 * número de feedbacks, o que é esperado.
 */
export function rankingMotivos(
  feedbacks: FeedbackRow[],
  filtro?: { changeType?: 'cancellation' | 'downgrade' | 'todos' },
): { slug: ReasonSlug; total: number; pct: number }[] {
  const alvo = filtro?.changeType && filtro.changeType !== 'todos'
    ? feedbacks.filter(f => f.change_type === filtro.changeType)
    : feedbacks

  const contagem = {} as Record<ReasonSlug, number>
  for (const slug of REASON_OPTIONS) contagem[slug] = 0
  let totalSelecoes = 0
  for (const f of alvo) {
    for (const r of f.reasons ?? []) {
      if (r in contagem) { contagem[r as ReasonSlug]++; totalSelecoes++ }
    }
  }

  return REASON_OPTIONS
    .map(slug => ({
      slug,
      total: contagem[slug],
      pct: totalSelecoes > 0 ? (contagem[slug] / totalSelecoes) * 100 : 0,
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
}

/** Série mensal de receita para o gráfico. */
export function serieMensal(eventos: FinanceEvent[], meses: number, now: Date = new Date()): { rotulo: string; valor: number }[] {
  const out: { rotulo: string; valor: number }[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const ini = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const fim = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    out.push({
      rotulo: ini.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      valor: receitaDe(eventos, { from: ini, to: fim }),
    })
  }
  return out
}

/** Contagem mensal de um tipo de evento (cancelamentos, downgrades…). */
export function serieMensalEvento(eventos: FinanceEvent[], tipo: string, meses: number, now: Date = new Date()): { rotulo: string; valor: number }[] {
  const out: { rotulo: string; valor: number }[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const ini = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const fim = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    out.push({
      rotulo: ini.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      valor: eventos.filter(e => e.event_type === tipo && dentro(e.occurred_at, { from: ini, to: fim })).length,
    })
  }
  return out
}
