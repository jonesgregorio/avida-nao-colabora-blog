export type WeeklyRetrospectiveSource = {
  summary?: string | null
  interpretation?: string | null
  patterns?: string[] | null
  attentionPoints?: string[] | null
  improvementMoments?: string | null
  topEmotions?: { label: string; count: number }[] | null
  emotionalMarkers?: { tag: string; count: number }[] | null
  triggers?: { tag: string; count: number }[] | null
  topContexts?: { tag: string; count: number }[] | null
  comparison?: string[] | null
  nextSteps?: string[] | null
  avgEnergy?: number | null
  avgAnxiety?: number | null
  checkinCount?: number | null
  diaryCount?: number | null
  dominantEmotion?: string | null
  topEmotionalMarker?: string | null
  topTrigger?: string | null
  hasEnoughData?: boolean | null
  data_quality?: {
    has_enough_data?: boolean
    total_entries?: number
    active_days?: number
    message?: string
  } | null
}

export type RetrospectiveHighlight = {
  label: string
  value: string
  evidence?: string
}

export type WeeklyRetrospectiveModel = {
  summary: string
  hasEnoughData: boolean
  evidenceLine: string
  highlights: RetrospectiveHighlight[]
  comparison: string[]
  perceptions: string[]
  attention: string[]
  relief: string | null
  carryForward: string | null
  otherNextSteps: string[]
}

function clean(value: unknown): string {
  return String(value ?? '').trim()
}

function finitePositive(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function uniqueText(values: unknown[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const text = clean(value)
    const key = text.toLocaleLowerCase('pt-BR')
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= limit) break
  }
  return result
}

function markerList(source: WeeklyRetrospectiveSource) {
  return (source.emotionalMarkers?.length ?? 0) > 0 ? source.emotionalMarkers ?? [] : source.triggers ?? []
}

export function buildWeeklyRetrospective(source: WeeklyRetrospectiveSource): WeeklyRetrospectiveModel {
  const checkins = Math.max(0, Number(source.checkinCount) || 0)
  const diaries = Math.max(0, Number(source.diaryCount) || 0)
  const total = finitePositive(source.data_quality?.total_entries) ?? (checkins + diaries)
  const activeDays = finitePositive(source.data_quality?.active_days)
  const hasEnoughData = source.data_quality?.has_enough_data ?? source.hasEnoughData ?? total >= 3

  const dominant = clean(source.dominantEmotion) || clean(source.topEmotions?.[0]?.label)
  const dominantCount = source.topEmotions?.find(item => clean(item.label) === dominant)?.count ?? source.topEmotions?.[0]?.count
  const marker = clean(source.topEmotionalMarker) || clean(source.topTrigger) || clean(markerList(source)[0]?.tag)
  const markerCount = markerList(source).find(item => clean(item.tag) === marker)?.count ?? markerList(source)[0]?.count
  const context = source.topContexts?.[0]
  const energy = finitePositive(source.avgEnergy)
  const anxiety = finitePositive(source.avgAnxiety)

  const highlights: RetrospectiveHighlight[] = []
  if (dominant) highlights.push({
    label: 'Emoção que mais apareceu',
    value: dominant,
    evidence: finitePositive(dominantCount) ? `${dominantCount} ocorrência${Number(dominantCount) === 1 ? '' : 's'} marcada${Number(dominantCount) === 1 ? '' : 's'}` : undefined,
  })
  if (marker) highlights.push({
    label: 'Marcador que mais apareceu',
    value: marker,
    evidence: finitePositive(markerCount) ? `${markerCount} ocorrência${Number(markerCount) === 1 ? '' : 's'} marcada${Number(markerCount) === 1 ? '' : 's'}` : undefined,
  })
  if (context?.tag) highlights.push({
    label: 'Contexto mais presente',
    value: clean(context.tag),
    evidence: finitePositive(context.count) ? `${context.count} ocorrência${Number(context.count) === 1 ? '' : 's'} marcada${Number(context.count) === 1 ? '' : 's'}` : undefined,
  })
  if (highlights.length < 3 && energy != null) highlights.push({ label: 'Energia média observada', value: `${energy.toFixed(1)}/5` })
  if (highlights.length < 3 && anxiety != null) highlights.push({ label: 'Ansiedade percebida média', value: `${anxiety.toFixed(1)}/5` })

  const evidenceParts: string[] = []
  if (total > 0) evidenceParts.push(`${total} registro${total === 1 ? '' : 's'}`)
  if (activeDays != null) evidenceParts.push(`${activeDays} dia${activeDays === 1 ? '' : 's'} com dados`)
  if (checkins > 0) evidenceParts.push(`${checkins} check-in${checkins === 1 ? '' : 's'}`)
  if (diaries > 0) evidenceParts.push(`${diaries} registro${diaries === 1 ? '' : 's'} no diário`)

  const perceptions = uniqueText([
    source.interpretation,
    ...(source.patterns ?? []),
  ], 3)

  const nextSteps = uniqueText(source.nextSteps ?? [], 4)

  return {
    summary: clean(source.summary) || (hasEnoughData
      ? 'Seus registros desta semana foram organizados em uma retrospectiva para ajudar você a olhar o período com mais distância.'
      : 'Ainda há poucos registros para uma retrospectiva mais completa. O que aparece abaixo deve ser lido como um sinal inicial, não como um padrão consolidado.'),
    hasEnoughData,
    evidenceLine: evidenceParts.length > 0
      ? `Esta síntese considera ${evidenceParts.join(' · ')}.`
      : 'Ainda não há registros estruturados suficientes para formar uma base consistente nesta semana.',
    highlights: highlights.slice(0, 3),
    comparison: uniqueText(source.comparison ?? [], 3),
    perceptions,
    attention: uniqueText(source.attentionPoints ?? [], 3),
    relief: clean(source.improvementMoments) || null,
    carryForward: nextSteps[0] ?? null,
    otherNextSteps: nextSteps.slice(1),
  }
}
