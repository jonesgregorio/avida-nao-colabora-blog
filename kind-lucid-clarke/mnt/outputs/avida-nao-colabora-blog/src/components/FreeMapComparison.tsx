import { useEffect, useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  buildMapComparisonSnapshot,
  buildMapComparisonText,
  mapComparisonMonthLabel,
  type MapComparisonRow,
  type MapComparisonSnapshot,
} from '../lib/mapPeriodComparison'

interface Props {
  userId: string
}

function previousMonthKey() {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function currentMonthKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(key: string) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month, 1, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function metric(value: number | null) {
  return value === null ? '—' : value.toFixed(1)
}

function difference(first: number | null, second: number | null) {
  if (first === null || second === null) return '—'
  const delta = +(second - first).toFixed(1)
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`
}

export default function FreeMapComparison({ userId }: Props) {
  const [firstMonth, setFirstMonth] = useState(previousMonthKey())
  const [secondMonth, setSecondMonth] = useState(currentMonthKey())
  const [first, setFirst] = useState<MapComparisonSnapshot | null>(null)
  const [second, setSecond] = useState<MapComparisonSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const maxMonth = currentMonthKey()

  useEffect(() => {
    if (!userId || !firstMonth || !secondMonth || firstMonth === secondMonth) {
      setLoading(false)
      setFirst(null)
      setSecond(null)
      return
    }

    let active = true
    setLoading(true)
    setError('')
    const columns = 'mood_score,energy,anxiety_level,sleep_quality,emotional_tags,date,created_at'
    const loadMonth = (key: string) => supabase
      .from('diary_entries')
      .select(columns)
      .eq('user_id', userId)
      .gte('date', `${key}-01`)
      .lt('date', `${nextMonth(key)}-01`)

    Promise.all([loadMonth(firstMonth), loadMonth(secondMonth)]).then(([firstResult, secondResult]) => {
      if (!active) return
      if (firstResult.error || secondResult.error) {
        setError('Não foi possível carregar um dos períodos agora. Tente novamente em instantes.')
        setFirst(null)
        setSecond(null)
      } else {
        setFirst(buildMapComparisonSnapshot((firstResult.data ?? []) as MapComparisonRow[]))
        setSecond(buildMapComparisonSnapshot((secondResult.data ?? []) as MapComparisonRow[]))
      }
      setLoading(false)
    }, () => {
      if (!active) return
      setError('Não foi possível carregar um dos períodos agora. Tente novamente em instantes.')
      setFirst(null)
      setSecond(null)
      setLoading(false)
    })

    return () => { active = false }
  }, [firstMonth, secondMonth, userId])

  const hasBothMonths = Boolean(firstMonth && secondMonth)
  const firstLabel = firstMonth ? mapComparisonMonthLabel(firstMonth) : 'Primeiro período'
  const secondLabel = secondMonth ? mapComparisonMonthLabel(secondMonth) : 'Segundo período'
  const summary = first && second ? buildMapComparisonText(first, second, firstLabel, secondLabel) : ''

  return (
    <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6" aria-labelledby="free-map-comparison-title">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center flex-shrink-0">
          <ArrowLeftRight className="w-5 h-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Comparação livre</p>
          <h2 id="free-map-comparison-title" className="font-serif text-xl sm:text-2xl text-forest-900 mt-0.5">Compare dois meses</h2>
          <p className="text-sm text-ink-soft mt-1 leading-relaxed">Escolha dois meses do seu histórico. O segundo período é comparado ao primeiro, sem transformar diferenças em desempenho.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <label className="text-sm text-forest-900">
          Primeiro período
          <input
            type="month"
            value={firstMonth}
            max={maxMonth}
            onChange={event => setFirstMonth(event.target.value)}
            className="mt-1.5 w-full border border-line rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
          />
        </label>
        <label className="text-sm text-forest-900">
          Segundo período
          <input
            type="month"
            value={secondMonth}
            max={maxMonth}
            onChange={event => setSecondMonth(event.target.value)}
            className="mt-1.5 w-full border border-line rounded-xl px-3 py-2.5 bg-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
          />
        </label>
      </div>

      {!hasBothMonths ? (
        <p className="mt-4 rounded-xl bg-mint/35 px-4 py-3 text-sm text-forest-800" role="status">Selecione os dois meses para fazer a comparação.</p>
      ) : firstMonth === secondMonth ? (
        <p className="mt-4 rounded-xl bg-mint/35 px-4 py-3 text-sm text-forest-800" role="status">Escolha dois meses diferentes para fazer a comparação.</p>
      ) : loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-ink-soft" role="status" aria-live="polite"><Loader2 className="w-4 h-4 animate-spin" /> Carregando os dois períodos…</div>
      ) : error ? (
        <p className="mt-4 rounded-xl bg-coral/20 border border-coral/40 px-4 py-3 text-sm text-[#8a3b23]" role="alert">{error}</p>
      ) : first && second ? (
        <div className="mt-5 space-y-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm border-separate border-spacing-0">
              <caption className="sr-only">Comparação entre {firstLabel} e {secondLabel}</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-left font-medium text-ink-soft border-b border-line py-2 pr-3">Indicador</th>
                  <th scope="col" className="text-right font-medium text-forest-900 border-b border-line py-2 px-3">{firstLabel}</th>
                  <th scope="col" className="text-right font-medium text-forest-900 border-b border-line py-2 px-3">{secondLabel}</th>
                  <th scope="col" className="text-right font-medium text-ink-soft border-b border-line py-2 pl-3">Diferença</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Dias com registros" first={String(first.activeDays)} second={String(second.activeDays)} diff={String(second.activeDays - first.activeDays)} />
                <ComparisonRow label="Total de registros" first={String(first.totalEntries)} second={String(second.totalEntries)} diff={String(second.totalEntries - first.totalEntries)} />
                <ComparisonRow label="Humor médio (1–5)" first={metric(first.avgMood)} second={metric(second.avgMood)} diff={difference(first.avgMood, second.avgMood)} />
                <ComparisonRow label="Energia média (1–5)" first={metric(first.avgEnergy)} second={metric(second.avgEnergy)} diff={difference(first.avgEnergy, second.avgEnergy)} />
                <ComparisonRow label="Ansiedade percebida (1–5)" first={metric(first.avgAnxiety)} second={metric(second.avgAnxiety)} diff={difference(first.avgAnxiety, second.avgAnxiety)} />
                <ComparisonRow label="Qualidade do sono (1–5)" first={metric(first.avgSleep)} second={metric(second.avgSleep)} diff={difference(first.avgSleep, second.avgSleep)} />
              </tbody>
            </table>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <EmotionSummary label={firstLabel} emotion={first.topEmotion} />
            <EmotionSummary label={secondLabel} emotion={second.topEmotion} />
          </div>

          <div className="rounded-2xl bg-mint/35 p-4" aria-labelledby="free-map-text-summary-title" aria-live="polite">
            <h3 id="free-map-text-summary-title" className="font-serif text-base text-forest-900">Resumo da comparação em texto</h3>
            <p className="text-sm text-forest-800 mt-2 leading-relaxed">{summary}</p>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-ink-soft mt-5 pt-4 border-t border-line">A comparação usa apenas humor, energia, ansiedade, sono, datas e emoções estruturadas dos registros. O texto livre do Diário não é lido aqui.</p>
    </section>
  )
}

function ComparisonRow({ label, first, second, diff }: { label: string; first: string; second: string; diff: string }) {
  return (
    <tr>
      <th scope="row" className="text-left font-normal text-ink py-2.5 pr-3 border-b border-line/70">{label}</th>
      <td className="text-right text-forest-900 py-2.5 px-3 border-b border-line/70 tabular-nums">{first}</td>
      <td className="text-right text-forest-900 py-2.5 px-3 border-b border-line/70 tabular-nums">{second}</td>
      <td className="text-right text-ink-soft py-2.5 pl-3 border-b border-line/70 tabular-nums">{diff}</td>
    </tr>
  )
}

function EmotionSummary({ label, emotion }: { label: string; emotion: { label: string; count: number } | null }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs text-ink-soft">Emoção estruturada mais frequente · {label}</p>
      <p className="font-serif text-lg text-forest-900 mt-1">{emotion ? emotion.label : 'Sem dados suficientes'}</p>
      {emotion && <p className="text-xs text-ink-soft mt-1">Apareceu {emotion.count} {emotion.count === 1 ? 'vez' : 'vezes'} nos registros do período.</p>}
    </div>
  )
}
