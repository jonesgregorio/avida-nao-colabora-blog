import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronRight, Clock3,
  Coffee, Heart, HelpCircle, History, Leaf, Loader2, Moon, Settings2,
  Sparkles, Sprout, Star, SunMedium,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { normalizePlan } from '../lib/officialPlans'
import { CARE_PLAN_DISCLAIMER, type CarePlanContent } from '../lib/careePlanAI'
import CarePlanActionFeedback from './CarePlanActionFeedback'
import SelfCarePlanPageLegacy from './SelfCarePlanPageLegacy'

type Props = ComponentProps<typeof SelfCarePlanPageLegacy>

type CurrentPlan = {
  id: string
  month_reference: string
  period_start: string
  period_end: string
  sent_at: string | null
  care_plan: CarePlanContent | null
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const value = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function dateBR(value: string) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function focusOf(plan: CarePlanContent | null) {
  return plan?.main_focus || plan?.monthly_priority || plan?.main_care || plan?.title || 'Um cuidado possível para este ciclo'
}

function whyOf(plan: CarePlanContent | null) {
  return plan?.why_this_focus || plan?.main_care || 'Este foco reúne sinais que apareceram nos seus registros recentes e pode ser observado com gentileza ao longo do mês.'
}

function actionsOf(plan: CarePlanContent | null) {
  const priorityActions = plan?.three_care_priorities?.flatMap(item => item.small_actions ?? []) ?? []
  const actions = priorityActions.length ? priorityActions : (plan?.suggested_micro_actions?.length ? plan.suggested_micro_actions : plan?.practical_tips ?? [])
  return [...new Set(actions.filter(Boolean))].slice(0, 4)
}

function questionsOf(plan: CarePlanContent | null) {
  const questions = plan?.reflection_questions?.filter(Boolean) ?? []
  if (questions.length) return questions.slice(0, 2)
  return [
    'Quando você abre um pouco de espaço, o restante do dia parece diferente?',
    'O que seu corpo e sua mente parecem pedir quando o dia fica mais pesado?',
  ]
}

const ACTION_ICONS = [Leaf, Coffee, Moon, Heart]

export default function SelfCarePlanPage(props: Props) {
  const { user, profile } = props
  const isPlus = normalizePlan(profile?.plan) === 'plus'
  const [plans, setPlans] = useState<CurrentPlan[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(isPlus)
  const [failed, setFailed] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)

  useEffect(() => {
    if (!user || !isPlus || showLegacy) { setLoading(false); return }
    let active = true
    setLoading(true)
    setFailed(false)
    supabase
      .from('monthly_care_plans')
      .select('id,month_reference,period_start,period_end,sent_at,care_plan')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .order('month_reference', { ascending: false })
      .limit(120)
      .then(({ data, error }) => {
        if (!active) return
        if (error) { setFailed(true); setLoading(false); return }
        const next = (data ?? []) as CurrentPlan[]
        setPlans(next)
        setSelectedId(current => current && next.some(plan => plan.id === current) ? current : next[0]?.id ?? null)
        setLoading(false)
      }, () => {
        if (!active) return
        setFailed(true)
        setLoading(false)
      })
    return () => { active = false }
  }, [isPlus, showLegacy, user])

  const selectedIndex = Math.max(0, plans.findIndex(plan => plan.id === selectedId))
  const current = plans[selectedIndex] ?? null
  const previous = plans[selectedIndex + 1] ?? null
  const actions = useMemo(() => actionsOf(current?.care_plan ?? null), [current])
  const questions = useMemo(() => questionsOf(current?.care_plan ?? null), [current])

  if (!isPlus || !user || failed || (!loading && !current)) return <SelfCarePlanPageLegacy {...props} />

  if (showLegacy) {
    return (
      <div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">
          <button type="button" onClick={() => setShowLegacy(false)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
            <ArrowLeft className="w-4 h-4" /> Voltar ao plano
          </button>
        </div>
        <SelfCarePlanPageLegacy {...props} />
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-500" /><span className="ml-3 text-sm text-ink-soft">Organizando seu cuidado…</span></div>
  }

  const focus = focusOf(current!.care_plan)
  const why = whyOf(current!.care_plan)
  const priority = current!.care_plan?.light_emotional_goal || current!.care_plan?.small_commitment || actions[0] || 'Escolha apenas uma pequena coisa que combine com o seu momento.'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-forest-600 flex items-center gap-2"><Sprout className="w-4 h-4" /> Plano de Autocuidado</p>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1">Um plano feito para apoiar você como está agora.</h1>
          <p className="mt-2 text-sm text-ink-soft">Um novo plano chega a cada mês. Os anteriores ficam guardados para você revisitar sua trajetória sem transformar cuidado em desempenho.</p>
        </div>
        <div className="flex flex-wrap gap-2 relative">
          <button type="button" onClick={() => setHistoryOpen(value => !value)} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-forest-800 hover:bg-paper-soft" aria-expanded={historyOpen}>
            <CalendarDays className="w-4 h-4" /> {monthLabel(current!.month_reference)} <ChevronDown className={`w-4 h-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" onClick={() => setShowLegacy(true)} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-forest-800 hover:bg-paper-soft">
            <Settings2 className="w-4 h-4" /> Ajustes
          </button>
          {historyOpen && (
            <div className="absolute right-0 top-12 z-30 w-[min(92vw,360px)] max-h-96 overflow-y-auto rounded-3xl border border-line bg-white p-2 shadow-xl">
              <div className="px-3 py-2 border-b border-line mb-1">
                <p className="font-serif text-lg text-forest-900">Histórico de planos</p>
                <p className="text-xs text-ink-soft">{plans.length} {plans.length === 1 ? 'plano guardado' : 'planos guardados'}</p>
              </div>
              {plans.map((plan, index) => (
                <button key={plan.id} type="button" onClick={() => { setSelectedId(plan.id); setHistoryOpen(false) }} className={`w-full text-left rounded-2xl px-3 py-2.5 flex items-center justify-between gap-3 ${plan.id === current!.id ? 'bg-mint/60 text-forest-900' : 'hover:bg-paper-soft text-ink'}`}>
                  <span><span className="block text-sm font-medium">{monthLabel(plan.month_reference)}</span><span className="block text-[11px] text-ink-soft">{index === 0 ? 'Plano atual' : 'Plano anterior'}</span></span>
                  {plan.id === current!.id && <span className="text-[10px] rounded-full bg-forest-900 text-white px-2 py-1">Aberto</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[30px] border border-forest-100 bg-gradient-to-r from-[#f3f0df] via-[#edf1df] to-[#dbe6d0] min-h-[290px]" aria-labelledby="care-focus-heading">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-70 bg-[radial-gradient(circle_at_70%_28%,rgba(255,245,190,.95),transparent_18%),radial-gradient(circle_at_82%_78%,rgba(27,88,64,.28),transparent_38%),linear-gradient(145deg,transparent_20%,rgba(55,111,75,.20)_21%,transparent_22%,transparent_35%,rgba(55,111,75,.18)_36%,transparent_38%)]" aria-hidden="true" />
        <div className="relative p-6 sm:p-8 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/65 px-3 py-1 text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-700"><Leaf className="w-3.5 h-3.5" /> Seu foco atual</span>
          <h2 id="care-focus-heading" className="font-serif text-3xl sm:text-4xl text-forest-900 mt-4 max-w-xl">{focus}</h2>
          <p className="mt-3 text-sm text-ink-soft leading-relaxed max-w-xl">{why}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setShowLegacy(true)} className="inline-flex items-center gap-2 rounded-xl border border-forest-200 bg-white/70 px-4 py-2 text-xs font-medium text-forest-800 hover:bg-white">Entender melhor <Sparkles className="w-3.5 h-3.5" /></button>
            <span className="text-[11px] text-ink-soft">Período: {dateBR(current!.period_start)} a {dateBR(current!.period_end)}</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="experimentar-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 id="experimentar-heading" className="font-serif text-2xl text-forest-900">Para experimentar</h2><p className="text-sm text-ink-soft mt-1">Pequenas ações que podem tornar seu dia mais leve. Escolha somente o que fizer sentido.</p></div>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft"><HelpCircle className="w-4 h-4" /> Sem meta ou sequência</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(actions.length ? actions : ['Abrir um pequeno espaço de pausa no seu dia.']).map((action, index) => {
            const Icon = ACTION_ICONS[index % ACTION_ICONS.length]
            return <article key={`${current!.id}-${index}`} className="rounded-3xl border border-line bg-white/80 p-5 text-center min-h-[210px] flex flex-col items-center justify-center"><span className="w-12 h-12 rounded-full bg-mint/70 flex items-center justify-center text-forest-700"><Icon className="w-5 h-5" /></span><h3 className="font-serif text-lg text-forest-900 mt-4 leading-snug">{action}</h3><p className="text-xs text-ink-soft mt-2">Experimente do seu jeito e observe como isso combina com o momento.</p></article>
          })}
        </div>
        {actions.length > 0 && <div className="rounded-3xl border border-line bg-paper-soft/80 p-4 sm:p-5"><CarePlanActionFeedback userId={user.id} carePlanId={current!.id} actions={actions} /></div>}
      </section>

      <section className="rounded-3xl border border-forest-100 bg-gradient-to-r from-mint/55 via-paper-soft to-sand-50 p-5 sm:p-6 grid lg:grid-cols-[1fr_1.4fr] gap-4 items-center">
        <div><p className="font-serif text-xl text-forest-900">Se quiser escolher apenas uma</p><p className="text-sm text-ink-soft mt-1">Entre as possibilidades, deixe uma única ação ocupar o primeiro plano.</p></div>
        <div className="rounded-2xl bg-white/80 border border-white p-4 flex flex-col sm:flex-row sm:items-center gap-3"><span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-700 flex-shrink-0"><Star className="w-5 h-5" /></span><p className="font-serif text-lg text-forest-900 flex-1">{priority}</p><span className="text-xs font-medium text-forest-700 whitespace-nowrap">Uma possibilidade</span></div>
      </section>

      <section aria-labelledby="observar-heading">
        <h2 id="observar-heading" className="font-serif text-2xl text-forest-900">Para observar, sem cobrança</h2>
        <p className="text-sm text-ink-soft mt-1">Perguntas leves para perceber o que faz sentido para você.</p>
        <div className="grid md:grid-cols-2 gap-3 mt-4">{questions.map((question, index) => <div key={question} className="rounded-3xl border border-line bg-white/75 p-5 flex gap-4 items-center"><span className="w-11 h-11 rounded-full bg-mint/60 flex items-center justify-center text-forest-700 flex-shrink-0">{index === 0 ? <Leaf className="w-5 h-5" /> : <SunMedium className="w-5 h-5" />}</span><p className="font-serif text-lg text-forest-900">{question}</p></div>)}</div>
      </section>

      <section aria-labelledby="previous-heading" className="space-y-3">
        <div className="flex flex-wrap justify-between items-end gap-2"><div><h2 id="previous-heading" className="font-serif text-2xl text-forest-900">Como foi o plano anterior</h2><p className="text-sm text-ink-soft mt-1">Revisite o que foi proposto sem contar acertos ou faltas.</p></div><button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-forest-700 hover:bg-paper-soft"><History className="w-4 h-4" /> Ver planos anteriores</button></div>
        {previous ? (
          <button type="button" onClick={() => setSelectedId(previous.id)} className="w-full rounded-3xl border border-line bg-white/70 p-5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper-soft">
            <div><p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-forest-600">{monthLabel(previous.month_reference)}</p><p className="font-serif text-xl text-forest-900 mt-1">{focusOf(previous.care_plan)}</p><p className="text-xs text-ink-soft mt-1">Abra este plano para rever as ações e as percepções que você registrou.</p></div><ChevronRight className="w-5 h-5 text-forest-500 flex-shrink-0" />
          </button>
        ) : <div className="rounded-3xl border border-line bg-paper-soft p-5 text-sm text-ink-soft">Este é o primeiro plano disponível no seu histórico. Os próximos meses aparecerão aqui automaticamente.</div>}
      </section>

      <section className="rounded-3xl border border-line bg-mint/35 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-3"><span className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center text-forest-700 flex-shrink-0"><Clock3 className="w-5 h-5" /></span><div><h2 className="font-serif text-lg text-forest-900">Atualização do plano</h2><p className="text-sm text-ink-soft">Seu plano principal é atualizado todo mês. Cada novo ciclo é guardado no histórico; nada substitui ou apaga os meses anteriores.</p></div></div>
        <button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-forest-200 bg-white/70 px-4 py-2 text-xs font-medium text-forest-800 whitespace-nowrap">Histórico completo <ArrowRight className="w-4 h-4" /></button>
      </section>

      <footer className="text-center pt-2 space-y-2"><p className="font-serif text-lg text-forest-800 flex items-center justify-center gap-2"><Heart className="w-4 h-4" /> Este plano não é sobre perfeição. É sobre cuidado, no seu tempo.</p><p className="text-xs text-ink-soft max-w-3xl mx-auto">Você pode mudar suas escolhas quando precisar. {CARE_PLAN_DISCLAIMER}</p></footer>
    </div>
  )
}
