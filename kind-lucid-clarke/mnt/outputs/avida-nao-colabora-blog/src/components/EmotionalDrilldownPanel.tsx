import { useMemo, useState } from 'react'
import { CalendarDays, CircleHelp, Moon, Sparkles, Waves, Zap } from 'lucide-react'
import type { DiaryRowLite } from '../lib/emotionalAnalytics'
import { buildEmotionalDrilldown, listDrilldownEmotions } from '../lib/emotionalDrilldown'
import { hasPlanAccess } from '../lib/officialPlans'
import DiaryTagChip from './DiaryTagChip'

function dateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(year, month - 1, day, 12))
    .replace('.', '')
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/80 p-3.5">
      <div className="flex items-center gap-2 text-ink-soft">
        <span className="text-forest-600">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-serif text-xl text-forest-900 mt-1.5">{value}</p>
    </div>
  )
}

export default function EmotionalDrilldownPanel({ entries, plan, periodEnd }: {
  entries: DiaryRowLite[]
  plan: string
  periodEnd?: string | null
}) {
  const emotions = useMemo(() => listDrilldownEmotions(entries), [entries])
  const [selected, setSelected] = useState<string | null>(emotions[0]?.label ?? null)

  // Quando o mês muda, uma emoção selecionada no mês anterior pode não existir mais.
  const effectiveSelected = selected && emotions.some(item => item.label === selected)
    ? selected
    : emotions[0]?.label ?? null

  const detail = useMemo(
    () => effectiveSelected
      ? buildEmotionalDrilldown(entries, effectiveSelected, {
          includeTriggers: hasPlanAccess(plan, 'plus'),
          periodEnd,
        })
      : null,
    [entries, effectiveSelected, periodEnd, plan],
  )

  if (!emotions.length || !detail) return null

  return (
    <section className="rounded-3xl border border-forest-100 bg-gradient-to-br from-mint/35 via-paper-soft to-white p-5 sm:p-6" aria-labelledby="emotion-explorer-title">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Explore uma emoção</p>
          <h3 id="emotion-explorer-title" className="font-serif text-xl sm:text-2xl text-forest-900 mt-1">Entenda como ela aparece na sua história</h3>
          <p className="text-sm text-ink-soft mt-1.5 max-w-2xl">Escolha uma emoção registrada neste mês. O mapa cruza apenas sinais estruturados dos mesmos dias — sem ler o texto do seu Diário.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft bg-white/80 border border-line rounded-full px-3 py-1.5 self-start">
          <CircleHelp className="w-3.5 h-3.5" /> relações observadas, não causas
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto py-4 -mx-1 px-1" aria-label="Escolher emoção para explorar">
        {emotions.map(item => {
          const active = effectiveSelected === item.label
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setSelected(item.label)}
              aria-pressed={active}
              className={`flex-shrink-0 rounded-full border px-3.5 py-2 text-sm transition-colors ${active ? 'bg-forest-900 border-forest-900 text-white' : 'bg-white border-line text-forest-800 hover:border-forest-300'}`}
            >
              {item.label} <span className={active ? 'text-white/70' : 'text-ink-soft'}>· {item.days}d</span>
            </button>
          )
        })}
      </div>

      <div className="rounded-3xl border border-line bg-paper-soft p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-serif text-2xl text-forest-900">{detail.emotion}</h4>
            <p className="text-sm text-ink-soft mt-1">
              Apareceu em <strong className="text-forest-900">{detail.occurrenceDays}</strong> de {detail.totalActiveDays} dias com registro ({detail.shareOfActiveDays}%).
              {detail.mostCommonWeekday ? ` Entre esses dias, ${detail.mostCommonWeekday} foi o dia da semana mais frequente.` : ''}
            </p>
          </div>
          <span className="rounded-full bg-mint px-3 py-1.5 text-xs font-medium text-forest-700">{detail.matchingRecords} registro{detail.matchingRecords === 1 ? '' : 's'} com a emoção</span>
        </div>

        {detail.lowSample && (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
            Ainda há poucos dias para falar em padrão. O mapa mostra o que apareceu nesses registros, mas trate as relações abaixo como pistas iniciais.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <Metric icon={<Waves className="w-4 h-4" />} label="Ansiedade nesses dias" value={detail.averages.anxiety != null ? `${detail.averages.anxiety}/5` : '—'} />
          <Metric icon={<Zap className="w-4 h-4" />} label="Energia nesses dias" value={detail.averages.energy != null ? `${detail.averages.energy}/5` : '—'} />
          <Metric icon={<Moon className="w-4 h-4" />} label="Sono nesses dias" value={detail.averages.sleep != null ? `${detail.averages.sleep}/5` : '—'} />
          <Metric icon={<CalendarDays className="w-4 h-4" />} label="Últimas 2 semanas" value={detail.trend.label === 'sem comparação' ? '—' : detail.trend.label} />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <div className="rounded-2xl border border-line bg-white p-4">
            <h5 className="text-sm font-medium text-forest-900">Contextos que apareceram junto</h5>
            {detail.topContexts.length ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {detail.topContexts.map(item => (
                  <span key={item.label} className="inline-flex items-center gap-1.5">
                    <DiaryTagChip label={item.label} category="context" />
                    <span className="text-[10px] text-ink-soft">{item.days}d</span>
                  </span>
                ))}
              </div>
            ) : <p className="text-xs text-ink-soft mt-3">Nenhum contexto apareceu com frequência suficiente nesses dias.</p>}
          </div>

          <div className="rounded-2xl border border-line bg-white p-4">
            <h5 className="text-sm font-medium text-forest-900">Outras emoções nesses mesmos dias</h5>
            {detail.coEmotions.length ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {detail.coEmotions.map(item => <span key={item.label} className="rounded-full bg-mint/70 text-forest-800 text-xs px-3 py-1.5">{item.label} · {item.days}d</span>)}
              </div>
            ) : <p className="text-xs text-ink-soft mt-3">Ainda não há outra emoção recorrente junto dela.</p>}
          </div>
        </div>

        {hasPlanAccess(plan, 'plus') && (
          <div className="rounded-2xl border border-line bg-white p-4 mt-4">
            <h5 className="text-sm font-medium text-forest-900">Gatilhos reconhecidos por você nesses dias</h5>
            {detail.topTriggers.length ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {detail.topTriggers.map(item => (
                  <span key={item.label} className="inline-flex items-center gap-1.5">
                    <DiaryTagChip label={item.label} category="advanced" />
                    <span className="text-[10px] text-ink-soft">{item.days}d</span>
                  </span>
                ))}
              </div>
            ) : <p className="text-xs text-ink-soft mt-3">Nenhum gatilho estruturado apareceu de forma recorrente nesses dias.</p>}
          </div>
        )}

        <div className="mt-5">
          <h5 className="text-sm font-medium text-forest-900">Dias relacionados</h5>
          <p className="text-xs text-ink-soft mt-1">Mostramos somente data e marcadores estruturados. O texto escrito no Diário não aparece aqui.</p>
          <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
            {detail.relatedDays.map(day => (
              <div key={day.date} className="rounded-2xl border border-line bg-white p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-forest-900">{dateLabel(day.date)}</span>
                  <span className="text-[10px] text-ink-soft">{day.recordCount} reg.</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {day.contexts.slice(0, 3).map(context => <DiaryTagChip key={context} label={context} category="context" />)}
                  {hasPlanAccess(plan, 'plus') && day.triggers.slice(0, 2).map(trigger => <DiaryTagChip key={trigger} label={trigger} category="advanced" />)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-soft mt-2.5">
                  {day.avgAnxiety != null && <span>ansiedade {day.avgAnxiety}/5</span>}
                  {day.avgEnergy != null && <span>energia {day.avgEnergy}/5</span>}
                  {day.avgSleep != null && <span>sono {day.avgSleep}/5</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-line flex items-start gap-2 text-xs text-ink-soft">
          <Sparkles className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" />
          <p>O mapa descreve coincidências nos seus próprios registros. Ele não afirma que um contexto ou gatilho causou a emoção e não substitui avaliação profissional.</p>
        </div>
      </div>
    </section>
  )
}
