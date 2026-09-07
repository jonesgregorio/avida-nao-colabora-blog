import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Route, Loader2, RefreshCw, TrendingUp } from 'lucide-react'

type Period = 30 | 90 | 180

interface Payload {
  window_days: number
  cohort_since: string
  journey: {
    signed_up: number
    first_checkin: number
    first_diary: number
    first_questionnaire: number
    first_report: number
    first_care_plan: number
    recurring_use: number
  }
  plans: {
    free_to_paid: number
    upgrades: number
    downgrades: number
    cancellations_requested: number
    cancellations_completed: number
    reactivations: number
    payments_failed: number
  }
}

const STAGES: { key: keyof Payload['journey']; label: string }[] = [
  { key: 'signed_up', label: 'Criaram conta' },
  { key: 'first_checkin', label: 'Fizeram o 1º check-in' },
  { key: 'first_diary', label: 'Escreveram no diário' },
  { key: 'first_questionnaire', label: 'Concluíram um questionário' },
  { key: 'first_report', label: 'Receberam o 1º relatório' },
  { key: 'first_care_plan', label: 'Receberam plano de autocuidado' },
  { key: 'recurring_use', label: 'Uso recorrente (3+ dias)' },
]

const PLAN_CARDS: { key: keyof Payload['plans']; label: string; good?: boolean; bad?: boolean }[] = [
  { key: 'free_to_paid', label: 'Gratuito → pago', good: true },
  { key: 'upgrades', label: 'Upgrades', good: true },
  { key: 'reactivations', label: 'Reativações', good: true },
  { key: 'downgrades', label: 'Downgrades' },
  { key: 'cancellations_requested', label: 'Cancelamentos pedidos', bad: true },
  { key: 'cancellations_completed', label: 'Cancelamentos efetivados', bad: true },
  { key: 'payments_failed', label: 'Pagamentos falhos', bad: true },
]

export default function AdminJourneyFunnel() {
  const [period, setPeriod] = useState<Period>(90)
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [notAvailable, setNotAvailable] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data: payload, error } = await supabase.rpc('admin_journey_funnel', { p_days: period })
    if (error) {
      if (/admin_journey_funnel|does not exist|schema cache/i.test(error.message)) setNotAvailable(true)
      else setErr(error.message)
      setData(null)
    } else {
      setData(payload as unknown as Payload)
    }
    setLoading(false)
  }, [period])

  useEffect(() => { void load() }, [load])

  const base = data?.journey.signed_up ?? 0
  const pct = (n: number) => (base > 0 ? Math.round((n / base) * 100) : 0)

  return (
    <section className="max-w-7xl mx-auto w-full px-6 pt-8" aria-labelledby="journey-funnel-title">
      <div className="rounded-[28px] border border-line bg-paper-soft overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6 border-b border-line bg-white/70">
          <div>
            <div className="flex items-center gap-2 text-forest-700">
              <Route className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">Funil de ativação</span>
            </div>
            <h2 id="journey-funnel-title" className="font-serif text-2xl sm:text-3xl text-forest-900 mt-2">Jornada de quem entra</h2>
            <p className="text-sm text-ink-soft mt-1 max-w-3xl">
              De cada 100 pessoas que criaram conta no período, quantas chegaram a cada passo da experiência. Conta apenas o tipo da ação — nunca o conteúdo dos registros.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-line overflow-hidden text-sm">
              {([30, 90, 180] as Period[]).map(d => (
                <button key={d} onClick={() => setPeriod(d)} className={`px-3 py-2 ${period === d ? 'bg-forest-600 text-white' : 'bg-white text-forest-800 hover:bg-mint/40'}`}>{d}d</button>
              ))}
            </div>
            <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-forest-800 hover:border-forest-200 disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>

        {notAvailable ? (
          <div className="p-6 text-sm bg-amber-50 border-t border-amber-200 text-amber-800">
            O funil de ativação fica disponível após o deploy desta etapa.
          </div>
        ) : err ? (
          <div className="p-6 text-sm text-red-600">Erro ao carregar: {err}</div>
        ) : loading && !data ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-ink-soft"><Loader2 className="w-5 h-5 animate-spin" /> Calculando…</div>
        ) : data ? (
          <div className="p-5 sm:p-6 space-y-6">
            {base === 0 ? (
              <p className="text-sm text-ink-soft">Nenhum cadastro no período selecionado.</p>
            ) : (
              <div className="space-y-2.5">
                {STAGES.map((stage, i) => {
                  const value = data.journey[stage.key]
                  const prev = i === 0 ? value : data.journey[STAGES[i - 1].key]
                  const stepPct = prev > 0 ? Math.round((value / prev) * 100) : 0
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-forest-900">{stage.label}</span>
                        <span className="text-ink-soft whitespace-nowrap">
                          {value} · {pct(value)}% do total{i > 0 ? ` · ${stepPct}% do passo anterior` : ''}
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full rounded-full bg-forest-600 transition-all" style={{ width: `${Math.min(100, pct(value))}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-forest-600" />
                <h3 className="font-serif text-xl text-forest-900">Movimento de planos · últimos {data.window_days} dias</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PLAN_CARDS.map(card => (
                  <div key={card.key} className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs text-ink-soft">{card.label}</p>
                    <p className={`font-serif text-2xl mt-1 ${card.bad && data.plans[card.key] > 0 ? 'text-red-600' : card.good && data.plans[card.key] > 0 ? 'text-forest-700' : 'text-forest-900'}`}>
                      {data.plans[card.key]}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-stone-400 mt-3">
                Receita, MRR e inadimplência detalhados ficam em <strong>Financeiro</strong>. Retenção D1/D7/D30 fica no painel de continuidade acima.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
