import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Loader2, RefreshCw, RotateCcw, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface RetentionPoint {
  eligible: number
  returned: number
  rate: number | null
}

interface DailyPoint {
  day: string
  active_users: number
}

interface FeaturePoint {
  key: string
  label: string
  users: number
  rate: number | null
}

interface RetentionPayload {
  generated_at: string
  timezone: string
  tracking_since: string | null
  active: {
    today: number
    days_7: number
    days_30: number
    repeat_7: number
    repeat_30: number
    returned_after_pause_30: number
  }
  retention: {
    d1: RetentionPoint
    d7: RetentionPoint
    d30: RetentionPoint
  }
  daily: DailyPoint[]
  features: FeaturePoint[]
}

function formatDate(value: string | null) {
  if (!value) return 'ainda sem base histórica'
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function rateLabel(point: RetentionPoint) {
  return point.rate == null ? 'Sem base ainda' : `${point.rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function RetentionCard({ label, description, point }: { label: string; description: string; point: RetentionPoint }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-forest-600">{label}</p>
      <p className="mt-2 font-serif text-3xl text-forest-900">{rateLabel(point)}</p>
      <p className="mt-1 text-xs text-ink-soft">{point.eligible > 0 ? `${point.returned} de ${point.eligible} pessoas elegíveis` : 'Ainda não há pessoas com tempo suficiente para esta janela.'}</p>
      <p className="mt-3 text-xs leading-relaxed text-ink-soft">{description}</p>
    </div>
  )
}

export default function AdminRetentionAnalytics() {
  const [data, setData] = useState<RetentionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: payload, error: rpcError } = await supabase.rpc('get_retention_continuity_analytics', { p_days: 90 })
      if (rpcError) throw rpcError
      setData(payload as unknown as RetentionPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as métricas de continuidade.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const maxDaily = useMemo(() => Math.max(1, ...(data?.daily ?? []).map(point => point.active_users)), [data?.daily])

  return (
    <section className="max-w-7xl mx-auto w-full px-6 pt-8" aria-labelledby="retention-analytics-title">
      <div className="rounded-[28px] border border-line bg-paper-soft overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6 border-b border-line bg-white/70">
          <div>
            <div className="flex items-center gap-2 text-forest-700">
              <Activity className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">Ideia 1 · continuidade</span>
            </div>
            <h2 id="retention-analytics-title" className="font-serif text-2xl sm:text-3xl text-forest-900 mt-2">Retenção e continuidade</h2>
            <p className="text-sm text-ink-soft mt-1 max-w-3xl">Mostra se as pessoas voltam e quais partes da experiência ajudam a criar continuidade, sem analisar o conteúdo emocional dos registros.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-forest-800 hover:border-forest-200 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>

        {loading && !data ? (
          <div className="p-8 flex items-center justify-center gap-2 text-sm text-ink-soft"><Loader2 className="w-5 h-5 animate-spin" /> Calculando retenção…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">Erro ao carregar: {error}</div>
        ) : data ? (
          <div className="p-5 sm:p-6 space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Ativos hoje', value: data.active.today, icon: Activity, detail: 'pessoas que fizeram alguma ação de produto hoje' },
                { label: 'Ativos em 7 dias', value: data.active.days_7, icon: CalendarDays, detail: 'pessoas ativas em pelo menos um dos últimos 7 dias' },
                { label: 'Ativos em 30 dias', value: data.active.days_30, icon: Users, detail: 'pessoas ativas em pelo menos um dos últimos 30 dias' },
                { label: 'Continuidade em 7 dias', value: data.active.repeat_7, icon: RotateCcw, detail: 'pessoas com atividade em 2 ou mais dias diferentes' },
                { label: 'Continuidade em 30 dias', value: data.active.repeat_30, icon: RotateCcw, detail: 'pessoas com atividade em 4 ou mais dias diferentes' },
                { label: 'Voltaram após uma pausa', value: data.active.returned_after_pause_30, icon: RotateCcw, detail: 'retornos após pelo menos 3 dias completos sem atividade, nos últimos 30 dias' },
              ].map(card => (
                <div key={card.label} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-forest-900">{card.label}</p>
                    <card.icon className="w-4 h-4 text-forest-600" />
                  </div>
                  <p className="font-serif text-3xl text-forest-900 mt-2">{card.value}</p>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">{card.detail}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-serif text-xl text-forest-900">Retenção de retorno</h3>
                  <p className="text-xs text-ink-soft mt-1">Retenção rolante: conta quem voltou em qualquer momento a partir do marco, não exige retorno exatamente naquele dia.</p>
                </div>
                <p className="text-[11px] text-ink-soft">Base confiável desde {formatDate(data.tracking_since)}</p>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <RetentionCard label="Após D1" point={data.retention.d1} description="Entre quem já teve pelo menos 1 dia para voltar, quantos retornaram do dia seguinte em diante." />
                <RetentionCard label="Após D7" point={data.retention.d7} description="Entre quem já completou 7 dias desde o cadastro, quantos voltaram em algum momento a partir do sétimo dia." />
                <RetentionCard label="Após D30" point={data.retention.d30} description="Entre quem já completou 30 dias desde o cadastro, quantos voltaram em algum momento a partir do trigésimo dia." />
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
              <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
                <h3 className="font-serif text-xl text-forest-900">Pessoas ativas por dia</h3>
                <p className="text-xs text-ink-soft mt-1">Últimos 30 dias, contando uma pessoa no máximo uma vez por dia.</p>
                <div className="mt-5 flex items-end gap-1 h-32" aria-label="Atividade diária dos últimos 30 dias">
                  {data.daily.map(point => (
                    <div key={point.day} className="group relative flex-1 min-w-[4px] h-full flex items-end">
                      <div className="w-full rounded-t bg-forest-700/75 min-h-[2px]" style={{ height: `${Math.max(2, (point.active_users / maxDaily) * 100)}%` }} />
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded-lg bg-forest-900 px-2 py-1 text-[10px] text-white z-10">
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${point.day}T12:00:00`))}: {point.active_users}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
                <h3 className="font-serif text-xl text-forest-900">Adoção da experiência · 30 dias</h3>
                <p className="text-xs text-ink-soft mt-1">Percentual sobre as pessoas ativas nos últimos 30 dias. Eventos novos começam a acumular a partir desta medição.</p>
                <div className="mt-4 space-y-3">
                  {data.features.map(feature => (
                    <div key={feature.key}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-forest-900">{feature.label}</span>
                        <span className="text-ink-soft">{feature.rate == null ? 'Sem base ainda' : `${feature.rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} · {feature.users}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-stone-100 overflow-hidden">
                        <div className="h-full rounded-full bg-forest-700" style={{ width: `${Math.min(100, Math.max(0, feature.rate ?? 0))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-forest-100 bg-mint/40 p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-forest-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-forest-900">Métrica de comportamento, não de conteúdo emocional</p>
                <p className="text-xs text-ink-soft mt-1 leading-relaxed">Este painel usa apenas o tipo da ação e quando ela aconteceu. Não consulta texto livre do Diário, humor, ansiedade, gatilhos, emoções, necessidades, títulos de foco, conteúdo de descobertas ou respostas pessoais.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
