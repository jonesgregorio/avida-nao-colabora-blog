import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarRange, Check, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { formatPeriodShort, getCurrentWeeklyPeriod } from '../lib/reportPeriods'
import { hasPlanAccess, type PlanKey } from '../lib/officialPlans'
import { buildWeeklyFocusSuggestions, type WeeklyFocusEntry, type WeeklyFocusSuggestion } from '../lib/weeklyFocus'
import {
  closeWeeklyFocus,
  loadWeeklyFocusState,
  saveWeeklyFocus,
  type SavedWeeklyFocus,
  type WeeklyFocusOutcome,
} from '../lib/weeklyFocusStore'

interface Props {
  userId: string
  plan: PlanKey
  entries: WeeklyFocusEntry[]
}

const OUTCOMES: { value: WeeklyFocusOutcome; label: string }[] = [
  { value: 'helped', label: 'Me ajudou' },
  { value: 'somewhat', label: 'Ajudou um pouco' },
  { value: 'not_much', label: 'Não fez diferença' },
  { value: 'not_used', label: 'Não usei' },
]

export default function WeeklyFocusCard({ userId, plan, entries }: Props) {
  const hasAccess = hasPlanAccess(plan, 'essential')
  const period = useMemo(() => getCurrentWeeklyPeriod(null), [])
  const suggestions = useMemo(() => buildWeeklyFocusSuggestions(entries, {
    weekStart: period.start,
    includeTriggers: plan === 'plus',
    limit: 3,
  }), [entries, period.start, plan])

  const [current, setCurrent] = useState<SavedWeeklyFocus | null>(null)
  const [previousOpen, setPreviousOpen] = useState<SavedWeeklyFocus | null>(null)
  const [loading, setLoading] = useState(hasAccess)
  const [saving, setSaving] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!hasAccess || !userId) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      try {
        const state = await loadWeeklyFocusState(userId, period.start)
        if (!active) return
        setCurrent(state.current)
        setPreviousOpen(state.previousOpen)
        setFailed(false)
      } catch {
        if (active) setFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [hasAccess, period.start, userId])

  if (!hasAccess || failed) return null

  async function choose(suggestion: WeeklyFocusSuggestion) {
    if (saving) return
    setSaving(true)
    try {
      const saved = await saveWeeklyFocus(userId, period.start, suggestion)
      setCurrent(saved)
      setChoosing(false)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  async function reflect(outcome: WeeklyFocusOutcome) {
    if (!previousOpen || saving) return
    setSaving(true)
    try {
      await closeWeeklyFocus(userId, previousOpen.id, outcome)
      setPreviousOpen(null)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6" role="status">
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin text-forest-600" /> Organizando seu foco da semana…
        </div>
      </section>
    )
  }

  if (previousOpen) {
    return (
      <section className="rounded-3xl border border-line bg-lilac/30 p-5 sm:p-6" aria-labelledby="weekly-focus-reflection-title">
        <div className="flex items-start gap-4">
          <span className="w-11 h-11 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Antes de começar outra semana</p>
            <h2 id="weekly-focus-reflection-title" className="font-serif text-2xl text-forest-900 mt-1">Como foi carregar esse foco?</h2>
            <p className="mt-3 rounded-2xl bg-white/80 border border-line px-4 py-3 text-sm font-medium text-forest-900">
              {previousOpen.focus_title}
            </p>
            <p className="text-sm text-ink-soft mt-3 leading-relaxed">
              Não é uma avaliação de desempenho. Esta resposta só ajuda a registrar se esse foco teve algum valor para você naquela semana.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {OUTCOMES.map(option => (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  onClick={() => void reflect(option.value)}
                  className="rounded-2xl border border-line bg-white hover:bg-mint/40 disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-forest-800 transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (current && !choosing) {
    return (
      <section className="rounded-3xl border border-forest-100 bg-gradient-to-br from-mint/70 via-paper-soft to-sand-50 p-5 sm:p-6" aria-labelledby="weekly-focus-title">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <span className="w-11 h-11 rounded-2xl bg-white border border-forest-100 text-forest-700 flex items-center justify-center flex-shrink-0">
            <CalendarRange className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Seu foco da semana</p>
              <span className="text-[10px] rounded-full bg-white border border-line px-2.5 py-1 text-ink-soft">{formatPeriodShort(period)}</span>
            </div>
            <h2 id="weekly-focus-title" className="font-serif text-2xl text-forest-900 mt-2">{current.focus_title}</h2>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-3xl">
              Leve isso como um lembrete, não como uma meta. Você não precisa marcar dias, manter sequência nem provar que conseguiu.
            </p>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
            >
              Trocar foco <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6" aria-labelledby="weekly-focus-choose-title">
      <div className="flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-mint text-forest-700 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Foco da semana</p>
              <h2 id="weekly-focus-choose-title" className="font-serif text-2xl text-forest-900 mt-1">O que vale carregar com você nesta semana?</h2>
            </div>
            {current && (
              <button type="button" onClick={() => setChoosing(false)} className="text-xs font-medium text-forest-700 hover:text-forest-900">
                Voltar ao foco atual
              </button>
            )}
          </div>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-3xl">
            Escolha só se alguma opção fizer sentido. O foco acompanha a semana, mas não vira obrigação nem lista de tarefas.
          </p>

          <div className="grid md:grid-cols-3 gap-3 mt-5">
            {suggestions.map(suggestion => (
              <button
                key={suggestion.key}
                type="button"
                disabled={saving}
                onClick={() => void choose(suggestion)}
                className="text-left rounded-2xl border border-line bg-white hover:border-forest-200 hover:bg-mint/20 disabled:opacity-60 p-4 transition-all"
              >
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-semibold text-forest-600">
                  {suggestion.source === 'history' ? <><Check className="w-3 h-3" /> Dos seus registros</> : 'Opção geral'}
                </span>
                <p className="font-serif text-lg text-forest-900 mt-2 leading-snug">{suggestion.title}</p>
                <p className="text-xs text-ink-soft mt-2 leading-relaxed">{suggestion.reason}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 mt-4">
                  Quero levar este foco <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-ink-soft mt-4 leading-relaxed">
            As opções baseadas no histórico usam somente sinais estruturados dos 14 dias anteriores ao início desta semana. Nenhum texto livre do Diário é relido aqui.
          </p>
        </div>
      </div>
    </section>
  )
}
