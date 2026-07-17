import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, TrendingUp, TrendingDown, DollarSign, Users, XCircle, ArrowDownCircle, RefreshCw } from 'lucide-react'
import { OFFICIAL_PLANS, normalizePlan } from '../../lib/officialPlans'
import { REASON_LABELS, reasonsLabel, type ReasonSlug } from '../../lib/cancelReasons'
import { formatDateTimeShort, formatBRL, eventLabel } from '../../lib/subscriptionStatus'
import {
  periodRange, calcularMetricas, rankingMotivos, serieMensal, serieMensalEvento,
  PERIOD_LABELS, type PeriodKey, type FinanceEvent, type FeedbackRow,
} from '../../lib/financeAnalytics'

const PLAN_LABELS: Record<string, string> = Object.fromEntries(OFFICIAL_PLANS.map(p => [p.key, p.label]))
const PLAN_PRICES: Record<string, number> = Object.fromEntries(OFFICIAL_PLANS.map(p => [p.key, p.priceValue]))
const planLabel = (p: string | null | undefined) => (p && PLAN_LABELS[p]) || p || '—'

interface PerfilRow { user_id: string; plan: string | null; email: string | null; full_name: string | null }

function Card({ titulo, valor, sub, icone, tom = 'neutro' }: {
  titulo: string; valor: string; sub?: string; icone?: React.ReactNode
  tom?: 'ok' | 'erro' | 'neutro'
}) {
  const cor = tom === 'ok' ? 'text-forest-800' : tom === 'erro' ? 'text-red-700' : 'text-stone-800'
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icone}
        <p className="text-[11px] text-stone-500">{titulo}</p>
      </div>
      <p className={`text-xl font-bold ${cor}`}>{valor}</p>
      {sub && <p className="text-[11px] text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// Gráfico de barras em CSS — sem dependência nova só para isto.
function Barras({ dados, formato }: { dados: { rotulo: string; valor: number }[]; formato?: (v: number) => string }) {
  const max = Math.max(...dados.map(d => d.valor), 1)
  const vazio = dados.every(d => d.valor === 0)
  if (vazio) return <p className="text-xs text-stone-400 py-6 text-center">Sem dados no período.</p>
  return (
    <div className="flex items-end gap-2 h-32">
      {dados.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] text-stone-500">{d.valor > 0 ? (formato ? formato(d.valor) : d.valor) : ''}</span>
          <div
            className="w-full bg-forest-600 rounded-t transition-all"
            style={{ height: `${Math.max((d.valor / max) * 100, d.valor > 0 ? 4 : 0)}%` }}
            title={`${d.rotulo}: ${formato ? formato(d.valor) : d.valor}`}
          />
          <span className="text-[9px] text-stone-400">{d.rotulo}</span>
        </div>
      ))}
    </div>
  )
}

// Analytics Financeiro (§5–§8). Lê subscription_events e
// subscription_change_feedback — as duas alimentadas pelo Stripe via webhook.
// Nada é mockado: sem evento, a métrica é zero e a tela diz isso.
export default function AdminFinanceiro() {
  const [eventos, setEventos] = useState<FinanceEvent[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])
  const [perfis, setPerfis] = useState<PerfilRow[]>([])
  const [assinaturas, setAssinaturas] = useState<{ user_id: string; plan_key: string | null; status: string | null; payment_status: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros (§7)
  const [periodo, setPeriodo] = useState<PeriodKey>('mes')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [filtroPlano, setFiltroPlano] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroMotivo, setFiltroMotivo] = useState<string>('todos')
  const [filtroChange, setFiltroChange] = useState<'todos' | 'cancellation' | 'downgrade'>('todos')
  const [busca, setBusca] = useState('')

  // Carga única na montagem; recarga manual pelo botão "Atualizar".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [e, f, p, s] = await Promise.all([
      supabase.from('subscription_events').select('*').order('occurred_at', { ascending: false }).limit(2000),
      supabase.from('subscription_change_feedback').select('*').order('requested_at', { ascending: false }).limit(1000),
      supabase.from('profiles').select('user_id, plan, email, full_name').limit(5000),
      supabase.from('user_subscriptions').select('user_id, plan_key, status, payment_status').limit(5000),
    ])
    setEventos((e.data as FinanceEvent[]) ?? [])
    setFeedbacks((f.data as FeedbackRow[]) ?? [])
    setPerfis((p.data as PerfilRow[]) ?? [])
    setAssinaturas((s.data as typeof assinaturas) ?? [])
    setLoading(false)
  }

  const nomePorUser = useMemo(() => {
    const m = new Map<string, PerfilRow>()
    for (const p of perfis) m.set(p.user_id, p)
    return m
  }, [perfis])

  const range = useMemo(() => periodRange(periodo, custom), [periodo, custom])

  // Filtros aplicados aos eventos antes de qualquer métrica.
  const eventosFiltrados = useMemo(() => eventos.filter(ev => {
    if (filtroPlano !== 'todos' && normalizePlan(ev.new_plan) !== filtroPlano) return false
    if (filtroTipo !== 'todos' && ev.event_type !== filtroTipo) return false
    if (filtroMotivo !== 'todos' && !(ev.reasons ?? []).includes(filtroMotivo)) return false
    if (busca) {
      const u = ev.user_id ? nomePorUser.get(ev.user_id) : null
      const alvo = `${u?.email ?? ''} ${u?.full_name ?? ''}`.toLowerCase()
      if (!alvo.includes(busca.toLowerCase())) return false
    }
    return true
  }), [eventos, filtroPlano, filtroTipo, filtroMotivo, busca, nomePorUser])

  // Assinaturas pagas ativas → base do MRR.
  const ativasPagas = useMemo(() => assinaturas
    .filter(a => {
      const plano = normalizePlan(a.plan_key)
      const ativa = a.status === 'active' || a.payment_status === 'active' || a.payment_status === 'trialing'
      return plano !== 'free' && ativa
    })
    .map(a => ({ plan: normalizePlan(a.plan_key), valor: PLAN_PRICES[normalizePlan(a.plan_key)] ?? 0 })),
  [assinaturas])

  const m = useMemo(() => calcularMetricas(eventosFiltrados, range, ativasPagas), [eventosFiltrados, range, ativasPagas])

  // Contagem por plano vem de profiles.plan (quem tem acesso hoje), não de eventos.
  const porPlano = useMemo(() => {
    const c = { free: 0, essential: 0, plus: 0 }
    for (const p of perfis) {
      const k = normalizePlan(p.plan)
      if (k in c) c[k as keyof typeof c]++
    }
    return c
  }, [perfis])

  const totalUsuarios = perfis.length
  const pagas = porPlano.essential + porPlano.plus
  const conversao = totalUsuarios > 0 ? (pagas / totalUsuarios) * 100 : 0

  const feedbacksNoPeriodo = useMemo(() => feedbacks.filter(f => {
    const t = new Date(f.requested_at).getTime()
    if (t < range.from.getTime() || t >= range.to.getTime()) return false
    if (filtroPlano !== 'todos' && normalizePlan(f.current_plan) !== filtroPlano) return false
    if (filtroMotivo !== 'todos' && !(f.reasons ?? []).includes(filtroMotivo)) return false
    return true
  }), [feedbacks, range, filtroPlano, filtroMotivo])

  const ranking = useMemo(() => rankingMotivos(feedbacksNoPeriodo, { changeType: filtroChange }), [feedbacksNoPeriodo, filtroChange])

  const inadimplentes = assinaturas.filter(a => ['past_due', 'unpaid'].includes(a.payment_status ?? '')).length
  const pendentes = assinaturas.filter(a => a.payment_status === 'incomplete').length

  const ultimosPagamentos = useMemo(() => eventosFiltrados
    .filter(e => ['payment_confirmed', 'subscription_renewed', 'payment_failed'].includes(e.event_type))
    .slice(0, 20), [eventosFiltrados])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-forest-500" /></div>

  const semEventos = eventos.length === 0

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-forest-900">Analytics Financeiro</h2>
          <p className="text-xs text-ink-soft mt-1">
            Receita conta apenas <strong>pagamentos confirmados pelo Stripe</strong> — não assinaturas criadas.
          </p>
        </div>
        <button onClick={carregar} className="flex items-center gap-1.5 text-xs border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </header>

      {semEventos && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          Nenhum evento financeiro registrado ainda. Os números aparecem conforme o Stripe confirmar pagamentos,
          renovações e mudanças de plano. Nada aqui é simulado.
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-line rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <select value={periodo} onChange={e => setPeriodo(e.target.value as PeriodKey)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map(k => <option key={k} value={k}>{PERIOD_LABELS[k]}</option>)}
        </select>
        {periodo === 'custom' && (
          <>
            <input type="date" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5" />
            <input type="date" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5" />
          </>
        )}
        <select value={filtroPlano} onChange={e => setFiltroPlano(e.target.value)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5">
          <option value="todos">Todos os planos</option>
          {OFFICIAL_PLANS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5">
          <option value="todos">Todos os eventos</option>
          {['payment_confirmed','subscription_renewed','payment_failed','checkout_completed','upgrade_confirmed','downgrade_requested','downgrade_completed','cancellation_requested','cancellation_completed'].map(t => (
            <option key={t} value={t}>{eventLabel(t)}</option>
          ))}
        </select>
        <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5">
          <option value="todos">Todos os motivos</option>
          {(Object.keys(REASON_LABELS) as ReasonSlug[]).map(s => <option key={s} value={s}>{REASON_LABELS[s]}</option>)}
        </select>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar usuário/e-mail…" className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 flex-1 min-w-[140px]" />
      </div>

      {/* Receita */}
      <section>
        <h3 className="text-xs font-semibold text-stone-600 mb-2">Receita</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Card titulo={`Receita — ${PERIOD_LABELS[periodo]}`} valor={formatBRL(m.receitaPeriodo)} icone={<DollarSign className="w-3.5 h-3.5 text-forest-600" />} tom="ok" />
          <Card titulo="Receita do mês atual" valor={formatBRL(m.receitaMesAtual)} />
          <Card titulo="Mês anterior" valor={formatBRL(m.receitaMesAnterior)} />
          <Card
            titulo="Variação"
            valor={m.variacaoPct == null ? '—' : `${m.variacaoPct > 0 ? '+' : ''}${m.variacaoPct.toFixed(1)}%`}
            sub={m.variacaoPct == null ? 'sem base de comparação' : 'vs. mês anterior'}
            icone={m.variacaoPct != null && m.variacaoPct < 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              : <TrendingUp className="w-3.5 h-3.5 text-forest-600" />}
            tom={m.variacaoPct != null && m.variacaoPct < 0 ? 'erro' : 'ok'}
          />
          <Card titulo="MRR estimado" valor={formatBRL(m.mrr)} sub={`${ativasPagas.length} assinatura(s) ativa(s)`} />
          <Card titulo="Receita perdida" valor={formatBRL(m.receitaPerdida)} sub="cancelamentos no período" tom={m.receitaPerdida > 0 ? 'erro' : 'neutro'} />
        </div>
      </section>

      {/* Assinaturas por plano */}
      <section>
        <h3 className="text-xs font-semibold text-stone-600 mb-2">Assinaturas por plano</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Card titulo="Gratuito" valor={String(porPlano.free)} icone={<Users className="w-3.5 h-3.5 text-stone-400" />} />
          <Card titulo="Essencial" valor={String(porPlano.essential)} />
          <Card titulo="Plus" valor={String(porPlano.plus)} />
          <Card titulo="Total pagas" valor={String(pagas)} tom="ok" />
          <Card titulo="Usuários cadastrados" valor={String(totalUsuarios)} />
          <Card titulo="Conversão p/ pago" valor={`${conversao.toFixed(1)}%`} sub={`${pagas} de ${totalUsuarios}`} />
        </div>
      </section>

      {/* Cancelamentos e downgrades */}
      <section>
        <h3 className="text-xs font-semibold text-stone-600 mb-2">Cancelamentos e downgrades — {PERIOD_LABELS[periodo]}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Card titulo="Cancelamentos solicitados" valor={String(m.cancelamentosSolicitados)} icone={<XCircle className="w-3.5 h-3.5 text-amber-500" />} />
          <Card titulo="Cancelamentos efetivados" valor={String(m.cancelamentosEfetivados)} tom={m.cancelamentosEfetivados > 0 ? 'erro' : 'neutro'} />
          <Card titulo="Downgrades solicitados" valor={String(m.downgradesSolicitados)} icone={<ArrowDownCircle className="w-3.5 h-3.5 text-blue-500" />} />
          <Card titulo="Downgrades efetivados" valor={String(m.downgradesEfetivados)} />
          <Card titulo="Upgrades" valor={String(m.upgrades)} tom="ok" />
          <Card titulo="Churn do mês" valor={pagas + m.cancelamentosEfetivados > 0 ? `${((m.cancelamentosEfetivados / (pagas + m.cancelamentosEfetivados)) * 100).toFixed(1)}%` : '—'} sub="efetivados ÷ base" />
        </div>
      </section>

      {/* Pagamentos */}
      <section>
        <h3 className="text-xs font-semibold text-stone-600 mb-2">Pagamentos — {PERIOD_LABELS[periodo]}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          <Card titulo="Confirmados" valor={String(m.pagamentosConfirmados)} tom="ok" />
          <Card titulo="Negados" valor={String(m.pagamentosNegados)} tom={m.pagamentosNegados > 0 ? 'erro' : 'neutro'} />
          <Card titulo="Assinaturas c/ pagamento ok" valor={String(assinaturas.filter(a => a.payment_status === 'active').length)} />
          <Card titulo="Pagamento pendente" valor={String(pendentes)} />
          <Card titulo="Inadimplentes" valor={String(inadimplentes)} tom={inadimplentes > 0 ? 'erro' : 'neutro'} />
        </div>
      </section>

      {/* Gráficos */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-xs font-semibold text-stone-600 mb-3">Receita mensal (6 meses)</p>
          <Barras dados={serieMensal(eventosFiltrados, 6)} formato={v => `${v.toFixed(0)}`} />
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-xs font-semibold text-stone-600 mb-3">Cancelamentos efetivados por mês</p>
          <Barras dados={serieMensalEvento(eventosFiltrados, 'cancellation_completed', 6)} />
        </div>
      </section>

      {/* Ranking de motivos */}
      <section className="bg-white border border-line rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-stone-600">Motivos de cancelamento e downgrade</p>
          <select value={filtroChange} onChange={e => setFiltroChange(e.target.value as typeof filtroChange)} className="text-xs border border-stone-200 rounded-lg px-2 py-1">
            <option value="todos">Cancelamento + downgrade</option>
            <option value="cancellation">Só cancelamentos</option>
            <option value="downgrade">Só downgrades</option>
          </select>
        </div>
        {ranking.length === 0 ? (
          <p className="text-xs text-stone-400 py-4 text-center">Nenhum motivo informado no período.</p>
        ) : (
          <>
            <div className="space-y-2">
              {ranking.map(r => (
                <div key={r.slug}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-stone-700">{REASON_LABELS[r.slug]}</span>
                    <span className="text-stone-500 font-medium">{r.total} · {r.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-forest-600 rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-400 mt-3">
              O usuário pode escolher mais de um motivo, e cada escolha conta 1 — por isso a soma pode passar do número de solicitações.
            </p>
          </>
        )}
      </section>

      {/* Últimos pagamentos */}
      <section className="bg-white border border-line rounded-xl p-4">
        <p className="text-xs font-semibold text-stone-600 mb-3">Últimos pagamentos</p>
        {ultimosPagamentos.length === 0 ? (
          <p className="text-xs text-stone-400 py-4 text-center">Nenhum pagamento no período/filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-stone-400 border-b border-line">
                  <th className="pb-2 font-medium">Usuário</th><th className="pb-2 font-medium">Plano</th>
                  <th className="pb-2 font-medium">Valor</th><th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Data</th><th className="pb-2 font-medium">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {ultimosPagamentos.map(ev => {
                  const u = ev.user_id ? nomePorUser.get(ev.user_id) : null
                  const negado = ev.event_type === 'payment_failed'
                  return (
                    <tr key={ev.id} className="border-b border-line/60">
                      <td className="py-2 pr-2">
                        <p className="text-stone-700 truncate max-w-[140px]">{u?.full_name || '—'}</p>
                        <p className="text-[10px] text-stone-400 truncate max-w-[140px]">{u?.email || ''}</p>
                      </td>
                      <td className="py-2 pr-2 text-stone-600">{planLabel(ev.new_plan)}</td>
                      <td className="py-2 pr-2 font-medium text-stone-700">{formatBRL(ev.amount)}</td>
                      <td className="py-2 pr-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${negado ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {negado ? 'Negado' : 'Confirmado'}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-stone-500">{formatDateTimeShort(ev.occurred_at)}</td>
                      <td className="py-2 text-[10px] text-stone-300 font-mono truncate max-w-[110px]">{ev.stripe_invoice_id ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cancelamentos e downgrades detalhados */}
      <section className="bg-white border border-line rounded-xl p-4">
        <p className="text-xs font-semibold text-stone-600 mb-3">Cancelamentos e downgrades</p>
        {feedbacksNoPeriodo.length === 0 ? (
          <p className="text-xs text-stone-400 py-4 text-center">Nenhuma solicitação no período/filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-stone-400 border-b border-line">
                  <th className="pb-2 font-medium">Usuário</th><th className="pb-2 font-medium">Mudança</th>
                  <th className="pb-2 font-medium">Motivos</th><th className="pb-2 font-medium">Comentário</th>
                  <th className="pb-2 font-medium">Solicitado</th><th className="pb-2 font-medium">Vigência</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {feedbacksNoPeriodo.map(f => {
                  const u = nomePorUser.get(f.user_id)
                  return (
                    <tr key={f.id} className="border-b border-line/60">
                      <td className="py-2 pr-2">
                        <p className="text-stone-700 truncate max-w-[130px]">{u?.full_name || '—'}</p>
                        <p className="text-[10px] text-stone-400 truncate max-w-[130px]">{u?.email || ''}</p>
                      </td>
                      <td className="py-2 pr-2 text-stone-600">{planLabel(f.current_plan)} → {planLabel(f.target_plan)}</td>
                      <td className="py-2 pr-2 text-stone-600 max-w-[180px]">{reasonsLabel(f.reasons)}</td>
                      <td className="py-2 pr-2 text-stone-400 italic truncate max-w-[150px]">{f.comment || '—'}</td>
                      <td className="py-2 pr-2 text-stone-500">{formatDateTimeShort(f.requested_at)}</td>
                      <td className="py-2 pr-2 text-stone-500">{formatDateTimeShort(f.effective_at)}</td>
                      <td className="py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          f.status === 'scheduled' ? 'bg-amber-100 text-amber-700'
                            : f.status === 'completed' ? 'bg-stone-100 text-stone-500' : 'bg-green-100 text-green-700'
                        }`}>
                          {f.status === 'scheduled' ? 'agendado' : f.status === 'completed' ? 'efetivado' : 'revertido'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
