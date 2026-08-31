export interface TemporalComparisonEntry {
  date?: string | null
  created_at?: string | null
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
  emotional_tags?: string[] | string | null
  context_tags?: string[] | string | null
  trigger_tags?: string[] | string | null
}

export type ComparisonDirection = 'higher' | 'lower' | 'similar' | 'unavailable'
export type SignalDirection = 'more' | 'less' | 'similar'

export interface MetricWindowValue {
  average: number | null
  days: number
}

export interface MetricComparison {
  current: MetricWindowValue
  previous: MetricWindowValue
  delta: number | null
  direction: ComparisonDirection
}

export interface SignalComparison {
  label: string
  currentDays: number
  previousDays: number
  currentShare: number
  previousShare: number
  deltaPoints: number
  direction: SignalDirection
}

export interface ComparisonWindow {
  start: string
  end: string
  activeDays: number
  recordCount: number
}

export interface TemporalComparisonModel {
  status: 'ready' | 'forming'
  windowDays: number
  current: ComparisonWindow
  previous: ComparisonWindow
  metrics: {
    energy: MetricComparison
    anxiety: MetricComparison
    sleep: MetricComparison
  }
  emotion: SignalComparison | null
  context: SignalComparison | null
  trigger: SignalComparison | null
}

type DayBucket = {
  date: string
  rows: TemporalComparisonEntry[]
  emotions: Set<string>
  contexts: Set<string>
  triggers: Set<string>
}

const WINDOW_DAYS = 30
const MIN_ACTIVE_DAYS = 3
const MIN_METRIC_DAYS = 2
const METRIC_SIMILAR_THRESHOLD = 0.3
const SIGNAL_SIMILAR_THRESHOLD_POINTS = 10

function normalize(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR')
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseYmd(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function entryDate(entry: TemporalComparisonEntry) {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  const created = String(entry.created_at ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : ''
}

function parseTags(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  const raw = value.trim()
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String).map(item => item.trim()).filter(Boolean)
    } catch { /* formato legado abaixo */ }
  }
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function safeMood(value: string | number | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || raw === 'null' || raw === 'undefined' || /^\d+(?:[.,]\d+)?$/.test(raw)) return null
  return raw
}

function unique(values: string[]) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const key = normalize(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function numeric(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round1(value: number | null) {
  return value == null ? null : Math.round(value * 10) / 10
}

function buildBuckets(entries: TemporalComparisonEntry[]) {
  const map = new Map<string, DayBucket>()
  for (const entry of entries) {
    const date = entryDate(entry)
    if (!date) continue
    let bucket = map.get(date)
    if (!bucket) {
      bucket = { date, rows: [], emotions: new Set(), contexts: new Set(), triggers: new Set() }
      map.set(date, bucket)
    }
    bucket.rows.push(entry)
    const mood = safeMood(entry.mood)
    if (mood) bucket.emotions.add(mood)
    unique(parseTags(entry.emotional_tags)).forEach(value => bucket!.emotions.add(value))
    unique(parseTags(entry.context_tags)).forEach(value => bucket!.contexts.add(value))
    unique(parseTags(entry.trigger_tags)).forEach(value => bucket!.triggers.add(value))
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function dailyMetric(days: DayBucket[], field: 'energy' | 'anxiety_level' | 'sleep_quality'): MetricWindowValue {
  const daily = days
    .map(day => average(day.rows.map(row => numeric(row[field])).filter((value): value is number => value != null)))
    .filter((value): value is number => value != null)
  return { average: round1(average(daily)), days: daily.length }
}

function compareMetric(current: MetricWindowValue, previous: MetricWindowValue): MetricComparison {
  if (current.average == null || previous.average == null || current.days < MIN_METRIC_DAYS || previous.days < MIN_METRIC_DAYS) {
    return { current, previous, delta: null, direction: 'unavailable' }
  }
  const delta = round1(current.average - previous.average)
  if (delta == null) return { current, previous, delta: null, direction: 'unavailable' }
  const direction: ComparisonDirection = Math.abs(delta) < METRIC_SIMILAR_THRESHOLD
    ? 'similar'
    : delta > 0 ? 'higher' : 'lower'
  return { current, previous, delta, direction }
}

function countByDays(days: DayBucket[], select: (day: DayBucket) => Set<string>) {
  const counts = new Map<string, { label: string; days: number }>()
  for (const day of days) {
    for (const value of select(day)) {
      const key = normalize(value)
      if (!key) continue
      const current = counts.get(key)
      counts.set(key, { label: current?.label ?? value, days: (current?.days ?? 0) + 1 })
    }
  }
  return counts
}

function compareSignals(currentDays: DayBucket[], previousDays: DayBucket[], select: (day: DayBucket) => Set<string>): SignalComparison | null {
  if (!currentDays.length || !previousDays.length) return null
  const current = countByDays(currentDays, select)
  const previous = countByDays(previousDays, select)
  const keys = new Set([...current.keys(), ...previous.keys()])
  const candidates: SignalComparison[] = []

  for (const key of keys) {
    const currentItem = current.get(key)
    const previousItem = previous.get(key)
    const currentCount = currentItem?.days ?? 0
    const previousCount = previousItem?.days ?? 0
    if (currentCount + previousCount < 2) continue
    const currentShare = Math.round((currentCount / currentDays.length) * 100)
    const previousShare = Math.round((previousCount / previousDays.length) * 100)
    const deltaPoints = currentShare - previousShare
    const direction: SignalDirection = Math.abs(deltaPoints) < SIGNAL_SIMILAR_THRESHOLD_POINTS
      ? 'similar'
      : deltaPoints > 0 ? 'more' : 'less'
    candidates.push({
      label: currentItem?.label ?? previousItem?.label ?? key,
      currentDays: currentCount,
      previousDays: previousCount,
      currentShare,
      previousShare,
      deltaPoints,
      direction,
    })
  }

  return candidates.sort((a, b) => {
    const byDifference = Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints)
    if (byDifference !== 0) return byDifference
    const byPresence = (b.currentDays + b.previousDays) - (a.currentDays + a.previousDays)
    if (byPresence !== 0) return byPresence
    return a.label.localeCompare(b.label, 'pt-BR')
  })[0] ?? null
}

function inRange(day: DayBucket, start: string, end: string) {
  return day.date >= start && day.date <= end
}

export function buildTemporalComparison(
  entries: TemporalComparisonEntry[],
  options: { now?: Date; includeTriggers?: boolean } = {},
): TemporalComparisonModel {
  const now = options.now ? new Date(options.now) : new Date()
  now.setHours(12, 0, 0, 0)

  const currentEnd = toYmd(now)
  const currentStart = toYmd(addDays(now, -(WINDOW_DAYS - 1)))
  const previousEndDate = addDays(parseYmd(currentStart), -1)
  const previousEnd = toYmd(previousEndDate)
  const previousStart = toYmd(addDays(previousEndDate, -(WINDOW_DAYS - 1)))

  const buckets = buildBuckets(entries)
  const currentDays = buckets.filter(day => inRange(day, currentStart, currentEnd))
  const previousDays = buckets.filter(day => inRange(day, previousStart, previousEnd))

  const current: ComparisonWindow = {
    start: currentStart,
    end: currentEnd,
    activeDays: currentDays.length,
    recordCount: currentDays.reduce((sum, day) => sum + day.rows.length, 0),
  }
  const previous: ComparisonWindow = {
    start: previousStart,
    end: previousEnd,
    activeDays: previousDays.length,
    recordCount: previousDays.reduce((sum, day) => sum + day.rows.length, 0),
  }

  const metrics = {
    energy: compareMetric(dailyMetric(currentDays, 'energy'), dailyMetric(previousDays, 'energy')),
    anxiety: compareMetric(dailyMetric(currentDays, 'anxiety_level'), dailyMetric(previousDays, 'anxiety_level')),
    sleep: compareMetric(dailyMetric(currentDays, 'sleep_quality'), dailyMetric(previousDays, 'sleep_quality')),
  }

  return {
    status: current.activeDays >= MIN_ACTIVE_DAYS && previous.activeDays >= MIN_ACTIVE_DAYS ? 'ready' : 'forming',
    windowDays: WINDOW_DAYS,
    current,
    previous,
    metrics,
    emotion: compareSignals(currentDays, previousDays, day => day.emotions),
    context: compareSignals(currentDays, previousDays, day => day.contexts),
    trigger: options.includeTriggers ? compareSignals(currentDays, previousDays, day => day.triggers) : null,
  }
}
