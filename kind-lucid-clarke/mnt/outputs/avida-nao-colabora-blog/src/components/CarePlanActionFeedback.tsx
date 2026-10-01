import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const CARE_PLAN_FEEDBACK_OPTIONS = [
  { value: 'helpful', label: 'Fez sentido' },
  { value: 'later', label: 'Talvez depois' },
  { value: 'not_for_me', label: 'Não combinou comigo' },
] as const

// Com muitas ações, só as primeiras ficam à vista; o resto abre sob demanda.
const COLLAPSED_COUNT = 3

export type CarePlanActionFeedbackValue = typeof CARE_PLAN_FEEDBACK_OPTIONS[number]['value']

type FeedbackRow = {
  action_index: number
  feedback: CarePlanActionFeedbackValue
}

export default function CarePlanActionFeedback({
  userId,
  carePlanId,
  actions,
}: {
  userId: string
  carePlanId: string
  actions: string[]
}) {
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, CarePlanActionFeedbackValue>>({})
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('care_plan_action_feedback')
      .select('action_index, feedback')
      .eq('user_id', userId)
      .eq('care_plan_id', carePlanId)
      .then(({ data }) => {
        if (!active) return
        const next: Record<number, CarePlanActionFeedbackValue> = {}
        for (const row of (data ?? []) as FeedbackRow[]) {
          if (Number.isInteger(row.action_index) && CARE_PLAN_FEEDBACK_OPTIONS.some(option => option.value === row.feedback)) {
            next[row.action_index] = row.feedback
          }
        }
        setFeedbackByIndex(next)
      })
    return () => { active = false }
  }, [carePlanId, userId])

  async function choose(actionIndex: number, feedback: CarePlanActionFeedbackValue) {
    if (savingIndex !== null) return
    setSavingIndex(actionIndex)
    setError(null)

    const current = feedbackByIndex[actionIndex]
    if (current === feedback) {
      const { error: deleteError } = await supabase
        .from('care_plan_action_feedback')
        .delete()
        .eq('user_id', userId)
        .eq('care_plan_id', carePlanId)
        .eq('action_index', actionIndex)
      if (deleteError) {
        setError('Não foi possível limpar essa escolha agora.')
      } else {
        setFeedbackByIndex(previous => {
          const next = { ...previous }
          delete next[actionIndex]
          return next
        })
      }
      setSavingIndex(null)
      return
    }

    const { error: saveError } = await supabase
      .from('care_plan_action_feedback')
      .upsert({
        user_id: userId,
        care_plan_id: carePlanId,
        action_index: actionIndex,
        feedback,
      }, { onConflict: 'care_plan_id,action_index' })

    if (saveError) {
      setError('Não foi possível salvar essa percepção agora.')
    } else {
      setFeedbackByIndex(previous => ({ ...previous, [actionIndex]: feedback }))
    }
    setSavingIndex(null)
  }

  if (!actions.length) return null

  const answered = actions.filter((_, index) => feedbackByIndex[index]).length
  const collapsible = actions.length > COLLAPSED_COUNT
  const visible = collapsible && !expanded ? actions.slice(0, COLLAPSED_COUNT) : actions

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-ink-soft font-medium">Pequenas ações possíveis</p>
        <p className="text-[11px] text-ink-soft" aria-live="polite">
          {answered === 0 ? 'Marque o que combina com seu momento' : `${answered} de ${actions.length} com sua percepção`}
        </p>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft/80">Como isso combina com seu momento? Escolha uma opção em cada ação, no seu tempo.</p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white/70">
        {visible.map((action, index) => {
          const selected = feedbackByIndex[index]
          const saving = savingIndex === index
          return (
            <li key={`${carePlanId}-${index}`} className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4">
              <p className="flex min-w-0 flex-1 gap-2 text-sm leading-relaxed text-ink">
                <span className="mt-0.5 text-forest-400" aria-hidden="true">•</span>
                <span>{action}</span>
              </p>
              <div className="flex shrink-0 flex-wrap gap-1.5" role="group" aria-label={`Sua percepção sobre a ação ${index + 1}`}>
                {CARE_PLAN_FEEDBACK_OPTIONS.map(option => {
                  const active = selected === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      disabled={savingIndex !== null}
                      onClick={() => void choose(index, option.value)}
                      className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                        active
                          ? 'border-forest-500 bg-mint text-forest-800 font-medium'
                          : 'border-line bg-white text-ink-soft hover:border-forest-300 hover:text-forest-700'
                      }`}
                    >
                      {saving && active ? 'Salvando…' : option.label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          className="mt-2 text-xs font-medium text-forest-700 underline underline-offset-4 hover:text-forest-900"
        >
          {expanded ? 'Mostrar menos' : `Ver as outras ${actions.length - COLLAPSED_COUNT} ações`}
        </button>
      )}
      <p className="text-[11px] text-ink-soft/75 mt-2">Você pode mudar ou remover sua escolha quando quiser. Não há meta, pontuação ou sequência.</p>
      {error && <p role="alert" className="text-xs text-coral mt-2">{error}</p>}
    </div>
  )
}
