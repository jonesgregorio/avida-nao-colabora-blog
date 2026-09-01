export type MapComparisonRow = {
  mood_score?: number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
  emotional_tags?: string[] | string | null
  date?: string | null
  created_at?: string | null
}

export type MapComparisonSnapshot = {
  totalEntries: number
  activeDays: number
  avgMood: number | null
  avgEnergy: number | null
  avgAnxiety: number | null
  avgSleep: number | null
  topEmotion: { label: string; count: number } | null
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function validMetric(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function dayKey(row: MapComparisonRow) {
  const raw = row.date || row.created_at || ''
  return String(raw).slice(0, 10)
}

function averageByDay(rows: MapComparisonRow[], pick: (row: MapComparisonRow) => number | null) {
  const days = new Map<string, number[]>()
  for (const row of rows) {
    const value = pick(row)
    const day = dayKey(row)
    if (value === null || !day) continue
    const values = days.get(day) ?? []
    values.push(value)
    days.set(day, values)
  }
  const dayAverages = [...days.values()].map(values => average(values)).filter((value): value is number => value !== null)
  return average(dayAverages)
}

function parseTags(value: MapComparisonRow['emotional_tags']) {
  if (Array.isArray(value)) return value.map(String).map(tag => tag.trim()).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.map(String).map(tag => tag.trim()).filter(Boolean)
  } catch { /* formato legado separado por vírgulas */ }
  return value.split(',').map(tag => tag.trim()).filter(Boolean)
}

export function buildMapComparisonSnapshot(rows: MapComparisonRow[]): MapComparisonSnapshot {
  const emotionCounts = new Map<string, number>()
  for (const row of rows) {
    for (const emotion of parseTags(row.emotional_tags)) {
      emotionCounts.set(emotion, (emotionCounts.get(emotion) ?? 0) + 1)
    }
  }
  const topEmotionEntry = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  return {
    totalEntries: rows.length,
    activeDays: new Set(rows.map(dayKey).filter(Boolean)).size,
    avgMood: averageByDay(rows, row => {
      const value = validMetric(row.mood_score)
      return value === null ? null : Math.min(5, Math.max(1, value))
    }),
    avgEnergy: averageByDay(rows, row => validMetric(row.energy)),
    avgAnxiety: averageByDay(rows, row => validMetric(row.anxiety_level)),
    avgSleep: averageByDay(rows, row => validMetric(row.sleep_quality)),
    topEmotion: topEmotionEntry ? { label: topEmotionEntry[0], count: topEmotionEntry[1] } : null,
  }
}

export function mapComparisonMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const value = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function metricSentence(label: string, a: number | null, b: number | null, labelA: string, labelB: string) {
  if (a === null || b === null) return null
  const delta = +(b - a).toFixed(1)
  if (delta === 0) return `${label} teve a mesma média nos dois períodos: ${a.toFixed(1)} de 5.`
  const direction = delta > 0 ? 'acima' : 'abaixo'
  return `${label} passou de ${a.toFixed(1)} em ${labelA} para ${b.toFixed(1)} em ${labelB}; em ${labelB}, ficou ${Math.abs(delta).toFixed(1)} ponto${Math.abs(delta) === 1 ? '' : 's'} ${direction}.`
}

export function buildMapComparisonText(
  first: MapComparisonSnapshot,
  second: MapComparisonSnapshot,
  firstLabel: string,
  secondLabel: string,
) {
  if (!first.totalEntries && !second.totalEntries) {
    return `Não há registros suficientes em ${firstLabel} nem em ${secondLabel} para comparar os períodos.`
  }
  if (!first.totalEntries) {
    return `${firstLabel} não tem registros suficientes para comparação. Em ${secondLabel}, há ${second.totalEntries} ${second.totalEntries === 1 ? 'registro' : 'registros'} distribuídos por ${second.activeDays} ${second.activeDays === 1 ? 'dia' : 'dias'}.`
  }
  if (!second.totalEntries) {
    return `${secondLabel} não tem registros suficientes para comparação. Em ${firstLabel}, há ${first.totalEntries} ${first.totalEntries === 1 ? 'registro' : 'registros'} distribuídos por ${first.activeDays} ${first.activeDays === 1 ? 'dia' : 'dias'}.`
  }

  const sentences = [
    `A comparação considera ${first.activeDays} ${first.activeDays === 1 ? 'dia com registro' : 'dias com registros'} em ${firstLabel} e ${second.activeDays} em ${secondLabel}.`,
    metricSentence('O humor médio', first.avgMood, second.avgMood, firstLabel, secondLabel),
    metricSentence('A energia média', first.avgEnergy, second.avgEnergy, firstLabel, secondLabel),
    metricSentence('A ansiedade percebida', first.avgAnxiety, second.avgAnxiety, firstLabel, secondLabel),
    metricSentence('A qualidade do sono', first.avgSleep, second.avgSleep, firstLabel, secondLabel),
  ].filter((sentence): sentence is string => Boolean(sentence))

  if (first.topEmotion || second.topEmotion) {
    const firstEmotion = first.topEmotion ? `“${first.topEmotion.label}” (${first.topEmotion.count}x)` : 'sem emoção predominante registrada'
    const secondEmotion = second.topEmotion ? `“${second.topEmotion.label}” (${second.topEmotion.count}x)` : 'sem emoção predominante registrada'
    sentences.push(`Entre as emoções estruturadas mais frequentes, ${firstLabel} teve ${firstEmotion} e ${secondLabel} teve ${secondEmotion}.`)
  }

  sentences.push('Essas diferenças descrevem somente os registros disponíveis; não significam melhora ou piora e não são diagnóstico.')
  return sentences.join(' ')
}
