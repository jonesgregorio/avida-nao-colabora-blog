import { Activity, CalendarRange, Heart, Moon, Sparkles, Zap } from 'lucide-react'
import type { MetricComparison, SignalComparison, TemporalComparisonModel } from '../../lib/temporalComparison'

interface Props {
  comparison: TemporalComparisonModel
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function periodLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
  return `${formatter.format(parseDate(start)).replace('.', '')} – ${formatter.format(parseDate(end)).replace('.', '')}`
}

function metricText(metric: MetricComparison) {
  if (metric.direction === 'unavailable' || metric.current.average == null || metric.previous.average == null) {
    return 'Ainda faltam dias com este marcador nos dois períodos.'
  }
  if (metric.direction === 'similar') return `Média parecida: ${metric.current.average.toFixed(1)} agora e ${metric.previous.average.toFixed(1)} antes.`
  if (metric.direction === 'higher') return `Média mais alta neste período: ${metric.current.average.toFixed(1)} agora e ${metric.previous.average.toFixed(1)} antes.`
  return `Média mais baixa neste período: ${metric.current.average.toFixed(1)} agora e ${metric.previous.average.toFixed(1)} antes.`
}

function MetricCard({ icon, label, metric }: { icon: React.ReactNode; label: string; metric: MetricComparison }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl bg-mint text-forest-700 flex items-center justify-center">{icon}</span>
        <p className="text-sm font-semibold text-forest-900">{label}</p>
      </div>
      <p className="text-xs text-ink-soft leading-relaxed mt-3">{metricText(metric)}</p>
      {metric.direction !== 'unavailable' && (
        <p className="text-[11px] text-ink-soft mt-2">Base: {metric.current.days} dias agora · {metric.previous.days} dias antes</p>
      )}
    </article>
  )
}

function signalText(signal: SignalComparison) {
  if (signal.direction === 'more') return 'apareceu em uma proporção maior dos dias registrados agora.'
  if (signal.direction === 'less') return 'apareceu em uma proporção menor dos dias registrados agora.'
  return 'apareceu em proporção parecida nos dois períodos.'
}

function SignalRow({ label, signal }: { label: string; signal: SignalComparison }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-forest-600">{label}</p>
          <p className="text-sm font-medium text-forest-900 mt-0.5">{signal.label}</p>
        </div>
        <div className="text-xs text-ink-soft sm:text-right">
          <p><strong className="text-forest-800">{signal.currentDays}</strong> dias agora ({signal.currentShare}%)</p>
          <p><strong className="text-forest-800">{signal.previousDays}</strong> dias antes ({signal.previousShare}%)</p>
        </div>
      </div>
      <p className="text-xs text-ink-soft leading-relaxed mt-2">{signal.label} {signalText(signal)}</p>
    </div>
  )
}

export default function TemporalComparisonPanel({ comparison }: Props) {
  const currentPeriod = periodLabel(comparison.current.start, comparison.current.end)
  const previousPeriod = periodLabel(comparison.previous.start, comparison.previous.end)

  return (
    <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6" aria-labelledby="now-before-heading">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3 max-w-3xl">
          <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center flex-shrink-0">
            <CalendarRange className="w-5 h-5" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Você agora × Você antes</p>
            <h2 id="now-before-heading" className="font-serif text-2xl text-forest-900 mt-0.5">Dois períodos, lado a lado</h2>
            <p className="text-sm text-ink-soft mt-1 leading-relaxed">
              Comparamos os últimos {comparison.windowDays} dias com os {comparison.windowDays} dias anteriores usando apenas os dias em que você registrou algo. Diferença não significa, por si só, melhora ou piora.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center flex-shrink-0">
          <div className="rounded-2xl bg-white border border-line px-3 py-2.5 min-w-[118px]">
            <p className="text-[10px] text-ink-soft">Agora</p>
            <p className="text-sm font-semibold text-forest-900 mt-0.5">{comparison.current.activeDays} dias</p>
            <p className="text-[10px] text-ink-soft mt-0.5">{currentPeriod}</p>
          </div>
          <div className="rounded-2xl bg-white border border-line px-3 py-2.5 min-w-[118px]">
            <p className="text-[10px] text-ink-soft">Antes</p>
            <p className="text-sm font-semibold text-forest-900 mt-0.5">{comparison.previous.activeDays} dias</p>
            <p className="text-[10px] text-ink-soft mt-0.5">{previousPeriod}</p>
          </div>
        </div>
      </div>

      {comparison.status === 'forming' ? (
        <div className="mt-5 rounded-2xl border border-dashed border-forest-200 bg-mint/30 px-4 py-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-forest-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-forest-900">Esta comparação ainda está se formando.</p>
            <p className="text-xs text-ink-soft leading-relaxed mt-1">Precisamos de pelo menos 3 dias registrados em cada período para colocar as duas janelas lado a lado com mais estabilidade. Não é preciso recuperar dias perdidos — continue registrando quando fizer sentido.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            <MetricCard icon={<Zap className="w-4 h-4" />} label="Energia" metric={comparison.metrics.energy} />
            <MetricCard icon={<Activity className="w-4 h-4" />} label="Ansiedade percebida" metric={comparison.metrics.anxiety} />
            <MetricCard icon={<Moon className="w-4 h-4" />} label="Qualidade do sono" metric={comparison.metrics.sleep} />
          </div>

          {(comparison.emotion || comparison.context || comparison.trigger) && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-forest-500" />
                <h3 className="text-sm font-semibold text-forest-900">O que mais mudou de presença</h3>
              </div>
              <div className="grid lg:grid-cols-2 gap-3">
                {comparison.emotion && <SignalRow label="Estado ou emoção" signal={comparison.emotion} />}
                {comparison.context && <SignalRow label="Contexto" signal={comparison.context} />}
                {comparison.trigger && <SignalRow label="Gatilho estruturado" signal={comparison.trigger} />}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-ink-soft leading-relaxed mt-5 border-t border-line pt-4">
        As proporções consideram somente dias com registro em cada janela. Vários check-ins no mesmo dia contam como um único dia para frequência; médias de energia, ansiedade e sono também são calculadas primeiro por dia para evitar distorção.
      </p>
    </section>
  )
}
