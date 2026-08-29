import { parseYmd, ymd } from './reportPeriods'

export type WeeklyFocusEntry = {
  date?: string | null
  created_at?: string | null
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
  stress_level?: number | null
  overload?: number | null
  emotional_tags?: string[] | string | null
  context_tags?: string[] | string | null
  need_tags?: string[] | string | null
  care_action_tags?: string[] | string | null
  trigger_tags?: string[] | string | null
}

export type WeeklyFocusSuggestion = {
  key: string
  title: string
  reason: string
  source: 'history' | 'general'
  score: number
}

type DayBucket = {
  date: string
  rows: WeeklyFocusEntry[]
  moods: string[]
  emotions: string[]
  contexts: string[]
  needs: string[]
  care: string[]
  triggers: string[]
  avgEnergy: number | null
  avgAnxiety: number | null
  avgSleep: number | null
  avgStress: number | null
  avgOverload: number | null
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
  return raw.split(',').map(v => v.trim()).filter(Boolean)
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = normalize(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}

function dayKey(entry: WeeklyFocusEntry): string {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  if (!entry.created_at) return ''
  const parsed = new Date(entry.created_at)
  return Number.isNaN(parsed.getTime()) ? '' : ymd(parsed)
}

function numeric(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function dayAverage(rows: WeeklyFocusEntry[], field: 'energy' | 'anxiety_level' | 'sleep_quality' | 'stress_level' | 'overload') {
  const values = rows.map(row => numeric(row[field])).filter((value): value is number => value != null)
  return average(values)
}

function addDays(key: string, amount: number) {
  const date = parseYmd(key)
  date.setUTCDate(date.getUTCDate() + amount)
  return ymd(date)
}

function buildDays(entries: WeeklyFocusEntry[], weekStart: string, includeTriggers: boolean) {
  const historyStart = addDays(weekStart, -14)
  const map = new Map<string, WeeklyFocusEntry[]>()
  for (const entry of entries) {
    const key = dayKey(entry)
    if (!key || key < historyStart || key >= weekStart) continue
    const rows = map.get(key) ?? []
    rows.push(entry)
    map.set(key, rows)
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rows]): DayBucket => ({
      date,
      rows,
      moods: unique(rows.flatMap(row => typeof row.mood === 'string' && !/^\d+(?:[.,]\d+)?$/.test(row.mood.trim()) ? [row.mood] : [])),
      emotions: unique(rows.flatMap(row => arr(row.emotional_tags))),
      contexts: unique(rows.flatMap(row => arr(row.context_tags))),
      needs: unique(rows.flatMap(row => arr(row.need_tags))),
      care: unique(rows.flatMap(row => arr(row.care_action_tags))),
      triggers: includeTriggers ? unique(rows.flatMap(row => arr(row.trigger_tags))) : [],
      avgEnergy: dayAverage(rows, 'energy'),
      avgAnxiety: dayAverage(rows, 'anxiety_level'),
      avgSleep: dayAverage(rows, 'sleep_quality'),
      avgStress: dayAverage(rows, 'stress_level'),
      avgOverload: dayAverage(rows, 'overload'),
    }))
}

function contains(values: string[], terms: string[]) {
  return values.some(value => {
    const key = normalize(value)
    return terms.some(term => key.includes(term))
  })
}

function countDays(days: DayBucket[], test: (day: DayBucket) => boolean) {
  return days.filter(test).length
}

function topTrigger(days: DayBucket[]) {
  const counts = new Map<string, { label: string; days: number }>()
  for (const day of days) {
    for (const trigger of day.triggers) {
      const key = normalize(trigger)
      if (!key) continue
      const current = counts.get(key)
      counts.set(key, { label: current?.label ?? trigger, days: (current?.days ?? 0) + 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.days - a.days || a.label.localeCompare(b.label, 'pt-BR'))[0] ?? null
}

const GENERAL: WeeklyFocusSuggestion[] = [
  {
    key: 'general:gentle_margin',
    title: 'Criar uma pequena margem para você durante a semana',
    reason: 'Ainda há poucos registros recentes para sugerir algo com base no histórico. Este é um foco geral, não uma conclusão sobre você.',
    source: 'general',
    score: 0,
  },
  {
    key: 'general:notice_before_rushing',
    title: 'Perceber o que pede atenção antes de tentar resolver tudo',
    reason: 'Este é um foco geral para observar a semana com menos pressa, sem meta de desempenho.',
    source: 'general',
    score: 0,
  },
  {
    key: 'general:protect_rest',
    title: 'Proteger ao menos um pequeno momento de descanso',
    reason: 'Este é um foco geral e opcional. Ele não pressupõe que exista um problema de sono ou energia.',
    source: 'general',
    score: 0,
  },
]

export function buildWeeklyFocusSuggestions(
  entries: WeeklyFocusEntry[],
  options: { weekStart: string; includeTriggers?: boolean; limit?: number },
): WeeklyFocusSuggestion[] {
  const limit = Math.max(1, Math.min(3, options.limit ?? 3))
  const days = buildDays(entries, options.weekStart, options.includeTriggers === true)
  if (days.length < 2) return GENERAL.slice(0, limit)

  const candidates: WeeklyFocusSuggestion[] = []
  const overloadDays = countDays(days, day =>
    (day.avgOverload ?? 0) >= 4 ||
    (day.avgStress ?? 0) >= 4 ||
    contains([...day.moods, ...day.emotions], ['sobrecarga', 'sobrecarreg', 'pressão', 'pressao']),
  )
  if (overloadDays >= 2) {
    candidates.push({
      key: 'history:reduce_overload',
      title: 'Diminuir um pouco a sensação de urgência quando tudo vier junto',
      reason: `Sobrecarga ou estresse alto apareceu em ${overloadDays} dias distintos dos registros recentes.`,
      source: 'history',
      score: overloadDays * 10 + 5,
    })
  }

  const anxietyDays = countDays(days, day => (day.avgAnxiety ?? 0) >= 4 || contains([...day.moods, ...day.emotions], ['ansiedade', 'ansioso', 'ansiosa']))
  if (anxietyDays >= 2) {
    candidates.push({
      key: 'history:pause_before_solving',
      title: 'Fazer uma pausa curta antes de tentar resolver tudo de uma vez',
      reason: `Ansiedade mais alta apareceu em ${anxietyDays} dias distintos dos registros recentes.`,
      source: 'history',
      score: anxietyDays * 10 + 4,
    })
  }

  const lowEnergyDays = countDays(days, day => day.avgEnergy != null && day.avgEnergy <= 2.5)
  if (lowEnergyDays >= 2) {
    candidates.push({
      key: 'history:protect_energy',
      title: 'Proteger um pouco mais sua energia antes de assumir outra coisa',
      reason: `Energia mais baixa apareceu em ${lowEnergyDays} dias distintos dos registros recentes.`,
      source: 'history',
      score: lowEnergyDays * 10 + 3,
    })
  }

  const difficultSleepDays = countDays(days, day => day.avgSleep != null && day.avgSleep <= 2.5)
  if (difficultSleepDays >= 2) {
    candidates.push({
      key: 'history:protect_evening',
      title: 'Criar uma pequena margem para desacelerar no fim do dia',
      reason: `Sono mais difícil apareceu em ${difficultSleepDays} dias distintos dos registros recentes.`,
      source: 'history',
      score: difficultSleepDays * 10 + 2,
    })
  }

  const restNeedDays = countDays(days, day => contains(day.needs, ['descanso', 'pausa', 'recuper', 'silêncio', 'silencio']))
  if (restNeedDays >= 2) {
    candidates.push({
      key: 'history:listen_to_rest_need',
      title: 'Levar seus sinais de necessidade de pausa um pouco mais a sério',
      reason: `Necessidade de descanso ou pausa foi marcada em ${restNeedDays} dias distintos dos registros recentes.`,
      source: 'history',
      score: restNeedDays * 10 + 1,
    })
  }

  const supportNeedDays = countDays(days, day => contains(day.needs, ['acolh', 'conversa', 'apoio', 'companhia', 'escuta']))
  if (supportNeedDays >= 2) {
    candidates.push({
      key: 'history:make_room_for_support',
      title: 'Criar espaço para pedir ou aceitar apoio sem precisar explicar tudo',
      reason: `Necessidade de apoio, acolhimento ou conversa apareceu em ${supportNeedDays} dias distintos dos registros recentes.`,
      source: 'history',
      score: supportNeedDays * 10,
    })
  }

  const trigger = options.includeTriggers ? topTrigger(days) : null
  if (trigger && trigger.days >= 2) {
    candidates.push({
      key: `history:notice_trigger:${normalize(trigger.label).replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`,
      title: `Observar como você quer responder quando “${trigger.label}” aparecer`,
      reason: `Esse gatilho foi reconhecido por você em ${trigger.days} dias distintos dos registros recentes.`,
      source: 'history',
      score: trigger.days * 10 + 6,
    })
  }

  const ranked = candidates
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt-BR'))
    .filter((item, index, all) => all.findIndex(other => other.key === item.key) === index)

  if (ranked.length >= limit) return ranked.slice(0, limit)
  return [...ranked, ...GENERAL.filter(general => !ranked.some(item => item.key === general.key))].slice(0, limit)
}
