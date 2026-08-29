import type { DiaryRowLite } from './emotionalAnalytics'

export type RankedSignal = { label: string; days: number }

export type RelatedEmotionalDay = {
  date: string
  recordCount: number
  moods: string[]
  contexts: string[]
  triggers: string[]
  avgEnergy: number | null
  avgAnxiety: number | null
  avgSleep: number | null
}

export type EmotionalDrilldown = {
  emotion: string
  occurrenceDays: number
  matchingRecords: number
  totalActiveDays: number
  shareOfActiveDays: number
  mostCommonWeekday: string | null
  topContexts: RankedSignal[]
  topTriggers: RankedSignal[]
  coEmotions: RankedSignal[]
  averages: {
    energy: number | null
    anxiety: number | null
    sleep: number | null
  }
  trend: {
    recentDays: number
    previousDays: number
    label: 'mais presente' | 'menos presente' | 'parecido' | 'sem comparação'
  }
  relatedDays: RelatedEmotionalDay[]
  lowSample: boolean
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR')
}

function arr(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  const raw = value.trim()
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String).map(v => v.trim()).filter(Boolean)
    } catch { /* legado simples abaixo */ }
  }
  return [raw]
}

function dayKey(entry: DiaryRowLite): string {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  const raw = String(entry.created_at ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

function numeric(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function round1(value: number | null) {
  return value == null ? null : Math.round(value * 10) / 10
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = normalize(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function hasEmotion(entry: DiaryRowLite, emotion: string) {
  const target = normalize(emotion)
  if (!target) return false
  if (normalize(entry.mood) === target) return true
  return arr(entry.emotional_tags).some(tag => normalize(tag) === target)
}

function dayAverage(rows: DiaryRowLite[], field: 'energy' | 'anxiety_level' | 'sleep_quality') {
  return avg(rows.map(row => numeric(row[field])).filter((value): value is number => value != null))
}

function rankByDistinctDay(days: Map<string, DiaryRowLite[]>, getValues: (rows: DiaryRowLite[]) => string[], limit: number, exclude?: string) {
  const counts = new Map<string, { label: string; days: number }>()
  const excluded = normalize(exclude)
  for (const rows of days.values()) {
    const values = unique(getValues(rows))
    for (const value of values) {
      const key = normalize(value)
      if (!key || key === excluded) continue
      const current = counts.get(key)
      counts.set(key, { label: current?.label ?? value, days: (current?.days ?? 0) + 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, limit)
}

function parseDate(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function mostCommonWeekday(keys: string[]) {
  if (!keys.length) return null
  const counts = new Map<number, number>()
  for (const key of keys) {
    const day = parseDate(key).getDay()
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
  return top ? WEEKDAYS[top[0]] : null
}

function trendForDays(emotionDayKeys: string[], periodEnd?: string | null) {
  if (!periodEnd || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return { recentDays: 0, previousDays: 0, label: 'sem comparação' as const }
  }
  const end = parseDate(periodEnd)
  const recentStart = new Date(end); recentStart.setDate(recentStart.getDate() - 14)
  const previousStart = new Date(end); previousStart.setDate(previousStart.getDate() - 28)
  const keys = emotionDayKeys.map(key => ({ key, date: parseDate(key) }))
  const recentDays = keys.filter(item => item.date >= recentStart && item.date < end).length
  const previousDays = keys.filter(item => item.date >= previousStart && item.date < recentStart).length
  if (recentDays === 0 && previousDays === 0) return { recentDays, previousDays, label: 'sem comparação' as const }
  if (recentDays >= previousDays + 2) return { recentDays, previousDays, label: 'mais presente' as const }
  if (previousDays >= recentDays + 2) return { recentDays, previousDays, label: 'menos presente' as const }
  return { recentDays, previousDays, label: 'parecido' as const }
}

export function listDrilldownEmotions(entries: DiaryRowLite[]): { label: string; days: number }[] {
  const byDay = new Map<string, DiaryRowLite[]>()
  for (const entry of entries) {
    const key = dayKey(entry)
    if (!key) continue
    const rows = byDay.get(key) ?? []
    rows.push(entry)
    byDay.set(key, rows)
  }
  return rankByDistinctDay(byDay, rows => rows.flatMap(row => [String(row.mood ?? ''), ...arr(row.emotional_tags)]), 10)
}

export function buildEmotionalDrilldown(
  entries: DiaryRowLite[],
  emotion: string,
  options: { includeTriggers?: boolean; periodEnd?: string | null } = {},
): EmotionalDrilldown | null {
  const allDays = new Map<string, DiaryRowLite[]>()
  for (const entry of entries) {
    const key = dayKey(entry)
    if (!key) continue
    const rows = allDays.get(key) ?? []
    rows.push(entry)
    allDays.set(key, rows)
  }

  const matchingDays = new Map<string, DiaryRowLite[]>()
  let matchingRecords = 0
  for (const [key, rows] of allDays) {
    const matched = rows.filter(row => hasEmotion(row, emotion))
    if (!matched.length) continue
    matchingRecords += matched.length
    // As relações do dia usam todos os registros estruturados daquele mesmo dia,
    // mas o dia só entra se a emoção selecionada realmente apareceu nele.
    matchingDays.set(key, rows)
  }

  if (!matchingDays.size) return null

  const occurrenceKeys = [...matchingDays.keys()].sort()
  const dayEnergy = [...matchingDays.values()].map(rows => dayAverage(rows, 'energy')).filter((value): value is number => value != null)
  const dayAnxiety = [...matchingDays.values()].map(rows => dayAverage(rows, 'anxiety_level')).filter((value): value is number => value != null)
  const daySleep = [...matchingDays.values()].map(rows => dayAverage(rows, 'sleep_quality')).filter((value): value is number => value != null)

  const relatedDays: RelatedEmotionalDay[] = [...matchingDays.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8)
    .map(([date, rows]) => ({
      date,
      recordCount: rows.length,
      moods: unique(rows.flatMap(row => [String(row.mood ?? ''), ...arr(row.emotional_tags)]).filter(Boolean)),
      contexts: unique(rows.flatMap(row => arr(row.context_tags))).slice(0, 4),
      triggers: options.includeTriggers ? unique(rows.flatMap(row => arr(row.trigger_tags))).slice(0, 4) : [],
      avgEnergy: round1(dayAverage(rows, 'energy')),
      avgAnxiety: round1(dayAverage(rows, 'anxiety_level')),
      avgSleep: round1(dayAverage(rows, 'sleep_quality')),
    }))

  return {
    emotion,
    occurrenceDays: matchingDays.size,
    matchingRecords,
    totalActiveDays: allDays.size,
    shareOfActiveDays: allDays.size ? Math.round((matchingDays.size / allDays.size) * 100) : 0,
    mostCommonWeekday: mostCommonWeekday(occurrenceKeys),
    topContexts: rankByDistinctDay(matchingDays, rows => rows.flatMap(row => arr(row.context_tags)), 4),
    topTriggers: options.includeTriggers ? rankByDistinctDay(matchingDays, rows => rows.flatMap(row => arr(row.trigger_tags)), 4) : [],
    coEmotions: rankByDistinctDay(matchingDays, rows => rows.flatMap(row => [String(row.mood ?? ''), ...arr(row.emotional_tags)]), 5, emotion),
    averages: {
      energy: round1(avg(dayEnergy)),
      anxiety: round1(avg(dayAnxiety)),
      sleep: round1(avg(daySleep)),
    },
    trend: trendForDays(occurrenceKeys, options.periodEnd),
    relatedDays,
    lowSample: matchingDays.size < 3,
  }
}
