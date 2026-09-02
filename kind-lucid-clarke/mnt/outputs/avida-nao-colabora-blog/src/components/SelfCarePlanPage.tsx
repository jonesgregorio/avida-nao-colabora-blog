import { useEffect, useState, type ComponentProps } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Sprout } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { normalizePlan } from '../lib/officialPlans'
import SelfCarePlanPageLegacy from './SelfCarePlanPageLegacy'

type Props = ComponentProps<typeof SelfCarePlanPageLegacy>

type CarePlanSummary = {
  title?: string
  main_focus?: string
  monthly_priority?: string
  why_this_focus?: string
  main_care?: string
  three_care_priorities?: Array<{ priority?: string; small_actions?: string[] }>
  suggested_micro_actions?: string[]
  practical_tips?: string[]
}

type CurrentPlan = {
  id: string
  month_reference: string
  care_plan: CarePlanSummary | null
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const value = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function mainFocus(plan: CarePlanSummary | null) {
  return plan?.main_focus || plan?.monthly_priority || plan?.main_care || ''
}

function firstAction(plan: CarePlanSummary | null) {
  return plan?.three_care_priorities?.flatMap(item => item.small_actions ?? [])[0]
    || plan?.suggested_micro_actions?.[0]
    || plan?.practical_tips?.[0]
    || ''
}

export default function SelfCarePlanPage(props: Props) {
  const { user, profile } = props
  const isPlus = normalizePlan(profile?.plan) === 'plus'
  const [current, setCurrent] = useState<CurrentPlan | null>(null)
  const [loading, setLoading] = useState(isPlus)
  const [failed, setFailed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!user || !isPlus || showDetails) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setFailed(false)

    supabase
      .from('monthly_care_plans')
      .select('id,month_reference,care_plan')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .order('month_reference', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setFailed(true)
          setLoading(false)
          return
        }
        setCurrent(((data ?? [])[0] as CurrentPlan | undefined) ?? null)
        setLoading(false)
      }, () => {
        if (!active) return
        setFailed(true)
        setLoading(false)
      })

    return () => { active = false }
  }, [isPlus, showDetails, user])

  if (!isPlus || !user || failed || (!loading && !current)) return <SelfCarePlanPageLegacy {...props} />

  if (showDetails) {
    return (
      <div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5">
          <button type="button" onClick={() => setShowDetails(false)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
            <ArrowLeft className="w-4 h-4" /> Voltar ao resumo do plano
          </button>
        </div>
        <SelfCarePlanPageLegacy {...props} />
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-500" /><span className="ml-3 text-sm text-ink-soft">Organizando seu cuidado…</span></div>
  }

  const focus = mainFocus(current?.care_plan ?? null)
  const action = firstAction(current?.care_plan ?? null)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2 text-forest-600"><Sprout className="w-5 h-5" /><p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Plano de Autocuidado</p></div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Seu cuidado deste mês</h1>
        <p className="mt-2 text-ink-soft leading-relaxed">Primeiro, veja só o essencial. O roteiro completo continua disponível quando você quiser aprofundar.</p>
      </header>

      <section className="rounded-3xl border border-forest-100 bg-gradient-to-br from-mint/45 via-paper-soft to-sand-50 p-5 sm:p-7" aria-labelledby="care-plan-focus-heading">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{monthLabel(current!.month_reference)}</p>
        <h2 id="care-plan-focus-heading" className="font-serif text-2xl sm:text-3xl text-forest-900 mt-1">{focus || current?.care_plan?.title || 'Um cuidado possível para este ciclo'}</h2>
        {current?.care_plan?.why_this_focus && <p className="text-sm text-ink-soft mt-2 max-w-2xl leading-relaxed">{current.care_plan.why_this_focus}</p>}
      </section>

      {action && (
        <section aria-labelledby="care-plan-action-heading">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Uma possibilidade</p>
          <h2 id="care-plan-action-heading" className="font-serif text-2xl text-forest-900 mt-1">Algo pequeno para considerar</h2>
          <p className="text-sm text-ink-soft mt-2 max-w-2xl leading-relaxed">{action}</p>
          <p className="text-xs text-ink-soft mt-2">Não é uma tarefa nem uma meta. Use apenas se combinar com o seu momento.</p>
        </section>
      )}

      <section className="border-t border-line pt-5">
        <button type="button" onClick={() => setShowDetails(true)} className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800">
          Explorar meu plano <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-xs text-ink-soft">Prioridades, microações, ritmo semanal, conteúdos relacionados, base do plano e roteiros anteriores continuam na visão completa.</p>
      </section>
    </div>
  )
}
