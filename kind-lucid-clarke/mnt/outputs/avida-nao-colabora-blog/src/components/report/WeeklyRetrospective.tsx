import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, CalendarDays, CheckCircle2, Heart, History, Info, Leaf,
  Sparkles, Target, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { WeeklyContent } from '../../lib/reportGeneration'
import { buildWeeklyRetrospective } from '../../lib/weeklyRetrospective'
import {
  loadWeeklyFocusForWeek,
  type SavedWeeklyFocus,
  type WeeklyFocusOutcome,
} from '../../lib/weeklyFocusStore'

type ViewPeriod = { start: string; end: string }
type WeeklyContentWithViewPeriod = WeeklyContent & { __view_period?: ViewPeriod }

const FOCUS_OUTCOMES: Record<WeeklyFocusOutcome, string> = {
  helped: 'Me ajudou',
  somewhat: 'Ajudou um pouco',
  not_much: 'Não fez diferença',
  not_used: 'Não usei',
}

function periodLabel(period?: ViewPeriod) {
  if (!period) return null
  const format = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${value}T12:00:00`))
    .replace('.', '')
  return `${format(period.start)} a ${format(period.end)}`
}

function ListBlock({ title, icon, items, empty, tone = 'forest' }: {
  title: string
  icon: React.ReactNode
  items: string[]
  empty: string
  tone?: 'forest' | 'coral'
}) {
  const iconClass = tone === 'coral' ? 'bg-coral/45 text-[#b85f3a]' : 'bg-mint text-forest-700'
  return (
    <div className="rounded-2xl border border-line bg-white/85 p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconClass}`}>{icon}</span>
        <h4 className="text-sm font-semibold text-forest-900">{title}</h4>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-relaxed text-stone-700">
              <span className={tone === 'coral' ? 'text-[#c2673f]' : 'text-forest-400'}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm leading-relaxed text-ink-soft">{empty}</p>}
    </div>
  )
}

export default function WeeklyRetrospective({ content }: { content: WeeklyContent }) {
  const source = content as WeeklyContentWithViewPeriod
  const period = source.__view_period
  const model = useMemo(() => buildWeeklyRetrospective(content), [content])
  const [focus, setFocus] = useState<SavedWeeklyFocus | null>(null)

  useEffect(() => {
    if (!period?.start) return
    let active = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const userId = data.user?.id
        if (!userId) return
        const saved = await loadWeeklyFocusForWeek(userId, period.start)
        if (active) setFocus(saved)
      } catch {
        if (active) setFocus(null)
      }
    })()
    return () => { active = false }
  }, [period?.start])

  const label = periodLabel(period)
  const focusOutcome = focus?.outcome ? FOCUS_OUTCOMES[focus.outcome] : null

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-forest-100 bg-gradient-to-br from-mint/55 via-paper-soft to-sand-50" aria-labelledby="weekly-retrospective-title">
      <div className="p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-forest-700 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-100 bg-white/75 px-3 py-1.5 font-semibold uppercase tracking-[0.1em]">
                <History className="w-3.5 h-3.5" /> Sua semana em retrospectiva
              </span>
              {label && <span className="inline-flex items-center gap-1.5 text-ink-soft"><CalendarDays className="w-3.5 h-3.5" /> {label}</span>}
            </div>
            <h2 id="weekly-retrospective-title" className="font-serif text-2xl sm:text-3xl text-forest-900">Uma leitura do que ficou mais visível nesta semana</h2>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-stone-700 max-w-3xl">{model.summary}</p>
            <p className="mt-3 inline-flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-forest-500" />
              <span>{model.evidenceLine}</span>
            </p>
          </div>
          <div className={`lg:w-64 flex-shrink-0 rounded-2xl border p-4 ${model.hasEnoughData ? 'border-forest-100 bg-white/75' : 'border-coral/50 bg-coral/20'}`}>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-forest-600">Como ler esta síntese</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700">
              {model.hasEnoughData
                ? 'Ela organiza sinais que se repetiram ou ficaram mais visíveis no conjunto dos seus registros.'
                : 'A amostra ainda é pequena. Leia o que aparece aqui como sinais iniciais, não como um padrão consolidado.'}
            </p>
          </div>
        </div>

        {model.highlights.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-forest-600 mb-2.5">O que mais apareceu</p>
            <div className="grid sm:grid-cols-3 gap-2.5">
              {model.highlights.map(item => (
                <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-line bg-white/85 p-4">
                  <p className="text-[11px] text-ink-soft">{item.label}</p>
                  <p className="font-serif text-lg text-forest-900 mt-1 leading-snug">{item.value}</p>
                  {item.evidence && <p className="text-[11px] text-ink-soft mt-1.5">{item.evidence}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-3 mt-5">
          <ListBlock
            title="O que mudou em relação à semana anterior"
            icon={<TrendingUp className="w-4 h-4" />}
            items={model.comparison}
            empty="Ainda não há uma semana anterior com base suficiente para uma comparação cuidadosa."
          />
          <ListBlock
            title="O que vale perceber"
            icon={<Sparkles className="w-4 h-4" />}
            items={model.perceptions}
            empty="Ainda não apareceu recorrência suficiente para destacar uma percepção além do resumo desta semana."
          />
          <ListBlock
            title="Onde a semana pediu mais atenção"
            icon={<Target className="w-4 h-4" />}
            items={model.attention}
            empty="Não apareceu um ponto de atenção específico com base suficiente nos registros desta semana."
            tone="coral"
          />
          <div className="rounded-2xl border border-line bg-white/85 p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-full bg-mint text-forest-700 flex items-center justify-center"><Heart className="w-4 h-4" /></span>
              <h4 className="text-sm font-semibold text-forest-900">Onde houve algum respiro</h4>
            </div>
            <p className="text-sm leading-relaxed text-stone-700">
              {model.relief || 'Ainda não há registros suficientes para destacar um momento de maior leveza sem preencher lacunas por suposição.'}
            </p>
          </div>
        </div>

        {focus && (
          <div className="mt-5 rounded-2xl border border-forest-100 bg-white/80 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-mint text-forest-700 flex items-center justify-center flex-shrink-0"><Leaf className="w-4 h-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-forest-600">O foco que acompanhou sua semana</p>
                <p className="font-serif text-lg text-forest-900 mt-0.5">{focus.focus_title}</p>
              </div>
              <span className="rounded-full border border-line bg-sand-50 px-3 py-1.5 text-xs text-forest-700 flex-shrink-0">
                {focusOutcome ?? 'Sem avaliação registrada'}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">A avaliação do foco registra apenas como foi carregá-lo naquela semana. Ela não mede desempenho, progresso ou cumprimento de meta.</p>
          </div>
        )}

        {model.carryForward && (
          <div className="mt-5 rounded-2xl bg-forest-900 text-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-4 h-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-mint">Uma coisa para levar com você</p>
                <p className="font-serif text-xl mt-1 leading-snug">{model.carryForward}</p>
                <p className="text-xs text-white/75 mt-2 leading-relaxed">É apenas um convite para o próximo ciclo. Não precisa virar tarefa, sequência ou obrigação.</p>
                {model.otherNextSteps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {model.otherNextSteps.map(item => <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/85"><ArrowRight className="w-3 h-3" /> {item}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="mt-5 pt-4 border-t border-line text-[11px] leading-relaxed text-ink-soft">
          Abaixo estão os gráficos, contagens e detalhes que sustentam esta retrospectiva. Relações observadas não significam diagnóstico nem demonstram causa entre os sinais.
        </p>
      </div>
    </section>
  )
}
