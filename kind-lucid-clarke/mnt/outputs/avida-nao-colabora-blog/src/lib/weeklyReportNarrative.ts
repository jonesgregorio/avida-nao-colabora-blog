export interface WeeklyNarrativePoint {
  day: number
  value: number
}

export interface WeeklyNarrativeContent {
  interpretation?: string
  patterns?: string[]
  improvementMoments?: string
  topEmotions?: { label: string; count: number }[]
  emotionalMarkers?: { tag: string; count: number }[]
  topContexts?: { tag: string; count: number }[]
  avgEnergy?: number
  avgAnxiety?: number
  energyByDay?: WeeklyNarrativePoint[]
  anxietyByDay?: WeeklyNarrativePoint[]
  checkinCount?: number
  diaryCount?: number
  data_quality?: {
    has_enough_data?: boolean
    total_entries?: number
    active_days?: number
    message?: string
  }
}

const POSITIVE_MOODS = new Set(['Bem-estar', 'Tranquilidade'])

const GENERIC_QUALITY_PHRASES = [
  'há registros suficientes para uma leitura cuidadosa do período',
  'seus registros desta semana ainda são poucos',
  'ainda há poucos registros',
]

const GENERIC_IMPROVEMENT_PHRASES = [
  'continue observando os pequenos momentos que ajudaram',
  'continue registrando para que seus momentos de melhora fiquem mais visíveis',
]

function normalized(text: string | null | undefined): string {
  return String(text ?? '').trim().toLocaleLowerCase('pt-BR')
}

export function isGenericWeeklyQualityText(text: string | null | undefined): boolean {
  const value = normalized(text)
  if (!value) return true
  return GENERIC_QUALITY_PHRASES.some(phrase => value.includes(phrase))
}

export function isGenericWeeklyImprovementText(text: string | null | undefined): boolean {
  const value = normalized(text)
  if (!value) return true
  return GENERIC_IMPROVEMENT_PHRASES.some(phrase => value.includes(phrase))
}

function countEntries(content: WeeklyNarrativeContent): number {
  const explicit = Number(content.data_quality?.total_entries)
  if (Number.isFinite(explicit) && explicit >= 0) return explicit
  return Math.max(0, Number(content.checkinCount) || 0) + Math.max(0, Number(content.diaryCount) || 0)
}

function activeDays(content: WeeklyNarrativeContent): number {
  const explicit = Number(content.data_quality?.active_days)
  if (Number.isFinite(explicit) && explicit >= 0) return explicit
  const days = new Set([
    ...(content.energyByDay ?? []).map(point => point.day),
    ...(content.anxietyByDay ?? []).map(point => point.day),
  ])
  return days.size
}

function topRepeated<T extends { count: number }>(items: T[] | undefined): T | null {
  return (items ?? []).find(item => Number(item.count) >= 2) ?? null
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function pairedEnergyAnxietyPattern(content: WeeklyNarrativeContent): string | null {
  const energy = new Map((content.energyByDay ?? []).map(point => [point.day, point.value]))
  const anxiety = new Map((content.anxietyByDay ?? []).map(point => [point.day, point.value]))
  const paired = [...energy.keys()]
    .filter(day => anxiety.has(day))
    .map(day => ({ day, energy: Number(energy.get(day)), anxiety: Number(anxiety.get(day)) }))
    .filter(day => Number.isFinite(day.energy) && Number.isFinite(day.anxiety) && day.energy > 0 && day.anxiety > 0)

  if (paired.length < 4) return null
  const lowEnergy = paired.filter(day => day.energy <= 2)
  const other = paired.filter(day => day.energy > 2)
  if (lowEnergy.length < 2 || other.length === 0) return null

  const lowAnxiety = average(lowEnergy.map(day => day.anxiety))
  const otherAnxiety = average(other.map(day => day.anxiety))
  if (lowAnxiety > otherAnxiety + 0.4) {
    return 'Nos dias de energia mais baixa, a ansiedade percebida também apareceu mais alta.'
  }
  return null
}

export function deriveWeeklyInterpretationFallback(content: WeeklyNarrativeContent): string {
  const entries = countEntries(content)
  const days = activeDays(content)
  if (entries < 3 || days < 2) {
    return 'Ainda há poucos registros para interpretar esta semana com segurança. Continue registrando em dias diferentes para que a leitura ganhe contexto.'
  }

  const topEmotion = content.topEmotions?.[0]
  const repeatedContext = topRepeated(content.topContexts)
  const pieces: string[] = []

  if (topEmotion) pieces.push(`${topEmotion.label.toLowerCase()} foi a emoção que mais apareceu nos registros`)
  if ((content.avgEnergy ?? 0) > 0) pieces.push(`a energia média ficou em ${content.avgEnergy}/5`)
  if ((content.avgAnxiety ?? 0) > 0) pieces.push(`a ansiedade percebida ficou em ${content.avgAnxiety}/5`)
  if (repeatedContext) pieces.push(`o contexto “${repeatedContext.tag}” se repetiu em ${repeatedContext.count} registros`)

  if (!pieces.length) {
    return 'Seus registros desta semana já permitem observar como suas emoções variaram ao longo dos dias, mas ainda não mostram uma relação específica forte entre os indicadores.'
  }

  const [first, ...rest] = pieces
  const detail = rest.length ? `; ${rest.join('; ')}` : ''
  return `Seus registros desta semana indicam que ${first}${detail}. Esta é uma leitura dos registros do período, não uma conclusão sobre você.`
}

export function deriveWeeklyPatternsFallback(content: WeeklyNarrativeContent): string[] {
  const entries = countEntries(content)
  const days = activeDays(content)
  if (entries < 4 || days < 2) {
    return ['Ainda não apareceu uma recorrência suficiente para identificar padrões nesta semana.']
  }

  const patterns: string[] = []
  const relation = pairedEnergyAnxietyPattern(content)
  if (relation) patterns.push(relation)

  const repeatedEmotion = topRepeated(content.topEmotions)
  if (repeatedEmotion) patterns.push(`${repeatedEmotion.label} apareceu em ${repeatedEmotion.count} registros da semana.`)

  const repeatedContext = topRepeated(content.topContexts)
  if (repeatedContext) patterns.push(`O contexto “${repeatedContext.tag}” apareceu em ${repeatedContext.count} registros.`)

  const repeatedMarker = topRepeated(content.emotionalMarkers)
  if (repeatedMarker) patterns.push(`O marcador emocional “${repeatedMarker.tag}” se repetiu em ${repeatedMarker.count} registros.`)

  return patterns.length
    ? [...new Set(patterns)].slice(0, 4)
    : ['Ainda não apareceu uma recorrência suficiente para identificar padrões nesta semana.']
}

export function deriveWeeklyImprovementFallback(content: WeeklyNarrativeContent): string {
  const positives = (content.topEmotions ?? []).filter(item => POSITIVE_MOODS.has(item.label))
  const positiveCount = positives.reduce((sum, item) => sum + Number(item.count || 0), 0)
  const bestEnergy = [...(content.energyByDay ?? [])]
    .filter(point => Number(point.value) > 0)
    .sort((a, b) => b.value - a.value)[0]

  if (positiveCount > 0) {
    const labels = positives.map(item => item.label.toLowerCase()).join(' e ')
    const energyNote = bestEnergy ? ` O melhor nível de energia registrado foi ${bestEnergy.value}/5 no dia ${bestEnergy.day}.` : ''
    return `Houve ${positiveCount} registro(s) de ${labels} nesta semana.${energyNote} Esses são os sinais positivos que aparecem nos dados do período.`
  }

  if (bestEnergy && bestEnergy.value >= 4) {
    return `Entre os indicadores disponíveis, o ponto mais positivo foi a energia de ${bestEnergy.value}/5 registrada no dia ${bestEnergy.day}. Ainda não há outros sinais suficientes para afirmar uma melhora recorrente.`
  }

  return 'Ainda não foi possível identificar um momento de melhora com base nos registros desta semana.'
}

export function normalizeWeeklyNarrative<T extends WeeklyNarrativeContent>(content: T): T {
  const currentPatterns = Array.isArray(content.patterns) ? content.patterns.filter(Boolean) : []
  const patternsAreGeneric = currentPatterns.length === 0 || currentPatterns.every(isGenericWeeklyQualityText)
  const next = {
    ...content,
    interpretation: isGenericWeeklyQualityText(content.interpretation)
      ? deriveWeeklyInterpretationFallback(content)
      : content.interpretation,
    patterns: patternsAreGeneric ? deriveWeeklyPatternsFallback(content) : currentPatterns,
    improvementMoments: isGenericWeeklyImprovementText(content.improvementMoments)
      ? deriveWeeklyImprovementFallback(content)
      : content.improvementMoments,
  }
  return next as T
}
