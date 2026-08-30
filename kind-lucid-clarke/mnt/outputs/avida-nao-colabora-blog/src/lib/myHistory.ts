export interface MyHistoryEntry {
  date?: string | null
  created_at?: string | null
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
  emotional_tags?: string[] | string | null
  context_tags?: string[] | string | null
  need_tags?: string[] | string | null
  trigger_tags?: string[] | string | null
  entry_type?: string | null
}

export interface MyHistoryReport {
  id?: string
  report_type: string
  period_start: string
  period_end: string
  generated_at?: string
  status: string
  title: string
  summary: string
}

export interface HistoryReportMilestone {
  id: string
  type: 'weekly' | 'monthly'
  date: string
  title: string
  summary: string
}

export interface HistoryMonth {
  key: string
  label: string
  activeDays: number
  entryCount: number
  checkinCount: number
  diaryCount: number
  topEmotion: { label: string; days: number } | null
  topContext: { label: string; days: number } | null
  topNeed: { label: string; days: number } | null
  topTrigger: { label: string; days: number } | null
  reports: HistoryReportMilestone[]
  summary: string
}

export interface HistoryMemory {
  id: string
  date: string
  dateLabel: string
  mood: string | null
  emotions: string[]
  contexts: string[]
  needs: string[]
  triggers: string[]
}

// Marcos da trajetória — só acontecimentos sustentados por dados reais.
// Nunca inventados para preencher a linha do tempo.
export type HistoryMilestoneKind = 'first_entry' | 'first_report' | 'first_steady_month'

export interface HistoryMilestone {
  id: string
  kind: HistoryMilestoneKind
  date: string
  dateLabel: string
  title: string
  description: string
}

export interface MyHistoryModel {
  months: HistoryMonth[]
  memories: HistoryMemory[]
  milestones: HistoryMilestone[]
  totals: {
    activeDays: number
    entries: number
    reports: number
    firstDate: string | null
  }
}

interface DayBucket {
  date: string
  entries: MyHistoryEntry[]
  moods: Set<string>
  emotions: Set<string>
  contexts: Set<string>
  needs: Set<string>
  triggers: Set<string>
}

function asTags(value: string[] | string | null | undefined): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [...new Set(raw.map(item => item.trim()).filter(Boolean))]
}

function entryDate(entry: MyHistoryEntry): string {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  if (!entry.created_at) return ''
  const parsed = new Date(entry.created_at)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function safeMood(value: string | number | null | undefined): string | null {
  const raw = String(value ?? '').trim()
  if (!raw || raw === 'null' || raw === 'undefined' || /^\d+(?:[.,]\d+)?$/.test(raw)) return null
  return raw
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1, 12))
}

function shortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day, 12))
    .replace('.', '')
}

function topByDays(days: DayBucket[], pick: (day: DayBucket) => Set<string>): { label: string; days: number } | null {
  const counts = new Map<string, number>()
  for (const day of days) {
    for (const value of pick(day)) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0]
  return top ? { label: top[0], days: top[1] } : null
}

function buildSummary(activeDays: number, topEmotion: HistoryMonth['topEmotion'], topContext: HistoryMonth['topContext']): string {
  if (activeDays === 0) return 'Ainda não há registros estruturados neste período.'
  if (activeDays === 1) return 'Há um dia registrado neste período. Ele já faz parte da sua história, sem precisar virar um padrão.'
  const parts = [`Você registrou algo em ${activeDays} dias deste período.`]
  if (topEmotion) parts.push(`${topEmotion.label} apareceu em ${topEmotion.days} ${topEmotion.days === 1 ? 'dia' : 'dias'}.`)
  if (topContext && topContext.days >= 2) parts.push(`${topContext.label} esteve presente em ${topContext.days} dias.`)
  return parts.join(' ')
}

function buildDayBuckets(entries: MyHistoryEntry[]): DayBucket[] {
  const map = new Map<string, DayBucket>()
  for (const entry of entries) {
    const date = entryDate(entry)
    if (!date) continue
    let bucket = map.get(date)
    if (!bucket) {
      bucket = {
        date,
        entries: [],
        moods: new Set(), emotions: new Set(), contexts: new Set(), needs: new Set(), triggers: new Set(),
      }
      map.set(date, bucket)
    }
    bucket.entries.push(entry)
    const mood = safeMood(entry.mood)
    if (mood) bucket.moods.add(mood)
    asTags(entry.emotional_tags).forEach(tag => bucket!.emotions.add(tag))
    asTags(entry.context_tags).forEach(tag => bucket!.contexts.add(tag))
    asTags(entry.need_tags).forEach(tag => bucket!.needs.add(tag))
    asTags(entry.trigger_tags).forEach(tag => bucket!.triggers.add(tag))
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export function buildMyHistory(
  entries: MyHistoryEntry[],
  reports: MyHistoryReport[],
  options: { includeTriggers?: boolean; now?: Date; memoryLimit?: number } = {},
): MyHistoryModel {
  const includeTriggers = options.includeTriggers === true
  const memoryLimit = Math.max(0, options.memoryLimit ?? 4)
  const now = options.now ?? new Date()
  const days = buildDayBuckets(entries)

  const reportsByMonth = new Map<string, HistoryReportMilestone[]>()
  for (const report of reports) {
    if (report.status !== 'generated') continue
    const monthKey = String(report.period_end ?? '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue
    const type = report.report_type === 'monthly' ? 'monthly' : report.report_type === 'weekly' ? 'weekly' : null
    if (!type) continue
    const item: HistoryReportMilestone = {
      id: report.id ?? `${type}:${report.period_start}:${report.period_end}`,
      type,
      date: report.period_end,
      title: report.title,
      summary: report.summary,
    }
    reportsByMonth.set(monthKey, [...(reportsByMonth.get(monthKey) ?? []), item])
  }

  const allMonthKeys = new Set<string>([
    ...days.map(day => day.date.slice(0, 7)),
    ...reportsByMonth.keys(),
  ])

  const months: HistoryMonth[] = [...allMonthKeys]
    .sort((a, b) => b.localeCompare(a))
    .map(key => {
      const monthDays = days.filter(day => day.date.startsWith(key))
      const monthEntries = monthDays.flatMap(day => day.entries)
      const topEmotion = topByDays(monthDays, day => new Set([...day.moods, ...day.emotions]))
      const topContext = topByDays(monthDays, day => day.contexts)
      const topNeed = topByDays(monthDays, day => day.needs)
      const topTrigger = includeTriggers ? topByDays(monthDays, day => day.triggers) : null
      const monthReports = [...(reportsByMonth.get(key) ?? [])].sort((a, b) => b.date.localeCompare(a.date))
      return {
        key,
        label: monthLabel(key),
        activeDays: monthDays.length,
        entryCount: monthEntries.length,
        checkinCount: monthEntries.filter(entry => entry.entry_type === 'checkin').length,
        diaryCount: monthEntries.filter(entry => (entry.entry_type ?? 'diary') === 'diary').length,
        topEmotion,
        topContext,
        topNeed,
        topTrigger,
        reports: monthReports,
        summary: buildSummary(monthDays.length, topEmotion, topContext),
      }
    })

  const memoryCutoff = new Date(now)
  memoryCutoff.setHours(12, 0, 0, 0)
  memoryCutoff.setDate(memoryCutoff.getDate() - 14)
  const cutoffKey = `${memoryCutoff.getFullYear()}-${String(memoryCutoff.getMonth() + 1).padStart(2, '0')}-${String(memoryCutoff.getDate()).padStart(2, '0')}`
  const seenMonths = new Set<string>()
  const memories: HistoryMemory[] = []
  for (const day of days) {
    if (memories.length >= memoryLimit) break
    if (day.date > cutoffKey) continue
    const monthKey = day.date.slice(0, 7)
    if (seenMonths.has(monthKey)) continue
    const mood = [...day.moods][0] ?? null
    const emotions = [...day.emotions].slice(0, 3)
    const contexts = [...day.contexts].slice(0, 3)
    const needs = [...day.needs].slice(0, 2)
    const triggers = includeTriggers ? [...day.triggers].slice(0, 2) : []
    if (!mood && !emotions.length && !contexts.length && !needs.length && !triggers.length) continue
    seenMonths.add(monthKey)
    memories.push({
      id: `memory:${day.date}`,
      date: day.date,
      dateLabel: shortDate(day.date),
      mood,
      emotions,
      contexts,
      needs,
      triggers,
    })
  }

  const firstDate = days.length ? days[days.length - 1].date : null

  // Acontecimentos — cada um vem de um dado que realmente existe.
  const milestones: HistoryMilestone[] = []
  if (firstDate) {
    milestones.push({
      id: `milestone:first_entry:${firstDate}`,
      kind: 'first_entry',
      date: firstDate,
      dateLabel: shortDate(firstDate),
      title: 'Você começou a registrar',
      description: 'Seu primeiro check-in ou registro no diário. Foi daqui que sua trajetória começou.',
    })
  }
  const generatedReports = reports
    .filter(report => report.status === 'generated' && /^\d{4}-\d{2}-\d{2}$/.test(String(report.period_end ?? '').slice(0, 10)))
    .sort((a, b) => String(a.period_end).localeCompare(String(b.period_end)))
  const firstReport = generatedReports[0]
  if (firstReport) {
    const date = String(firstReport.period_end).slice(0, 10)
    milestones.push({
      id: `milestone:first_report:${firstReport.id ?? date}`,
      kind: 'first_report',
      date,
      dateLabel: shortDate(date),
      title: 'Seu primeiro relatório ficou pronto',
      description: firstReport.report_type === 'monthly'
        ? 'A primeira retrospectiva mensal do que você vinha registrando.'
        : 'A primeira retrospectiva semanal do que você vinha registrando.',
    })
  }
  const steadyMonth = [...months]
    .filter(month => month.activeDays >= 12)
    .sort((a, b) => a.key.localeCompare(b.key))[0]
  if (steadyMonth) {
    const date = `${steadyMonth.key}-15`
    milestones.push({
      id: `milestone:first_steady_month:${steadyMonth.key}`,
      kind: 'first_steady_month',
      date,
      dateLabel: monthLabel(steadyMonth.key),
      title: 'Um mês de registro constante',
      description: `Em ${steadyMonth.label} você registrou algo em ${steadyMonth.activeDays} dias — o mês mais constante até aqui.`,
    })
  }
  milestones.sort((a, b) => a.date.localeCompare(b.date))

  return {
    months,
    memories,
    milestones,
    totals: {
      activeDays: days.length,
      entries: entries.filter(entry => Boolean(entryDate(entry))).length,
      reports: reports.filter(report => report.status === 'generated').length,
      firstDate,
    },
  }
}
