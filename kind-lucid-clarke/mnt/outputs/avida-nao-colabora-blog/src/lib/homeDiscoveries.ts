import {
  diaryPatternDayKey,
  getDiaryPatternTags,
  type DiaryPatternEntry,
} from './diaryPatternRules.ts'

export type HomeDiscoveryPlan = 'free' | 'essential' | 'plus'
// 'weakening' só é aplicada quando há histórico suficiente (>=10 dias com registro) pra comparar
// a metade mais recente do período com a mais antiga — nunca inferida com poucos dias.
export type HomeDiscoveryStatus = 'forming' | 'ready' | 'weakening'
export type HomeDiscoveryKind =
  | 'mood'
  | 'emotion'
  | 'context'
  | 'trigger'
  | 'context_emotion'
  | 'trigger_emotion'
  | 'sleep_anxiety'
  | 'energy_anxiety'

export interface HomeDiscoveryEntry extends DiaryPatternEntry {
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
}

export interface HomeDiscovery {
  id: string
  /**
   * Chave estável da descoberta (tipo + assunto, sem a contagem de dias). O `id`
   * muda conforme a pessoa registra mais; a `stableKey` não. É a chave usada para
   * guardar o feedback do usuário e para "não quero acompanhar isso".
   */
  stableKey: string
  status: HomeDiscoveryStatus
  kind: HomeDiscoveryKind
  eyebrow: string
  title: string
  description: string
  evidence: string
  question: string
  matchedDays: number
  baseDays: number
  /** Dia (YYYY-MM-DD) mais antigo em que o sinal apareceu. */
  firstSeen: string
  /** Dia (YYYY-MM-DD) mais recente em que o sinal apareceu. */
  lastSeen: string
  /** Início do período de dias com registro analisado (não só os dias do sinal). */
  periodStart: string
  /** Fim do período de dias com registro analisado. */
  periodEnd: string
  /** Todos os dias (YYYY-MM-DD, ordem crescente) em que o sinal apareceu — só datas, nunca texto do Diário. */
  matchedDates: string[]
}

interface DaySignals {
  key: string
  moods: Set<string>
  emotions: Set<string>
  contexts: Set<string>
  triggers: Set<string>
  energy: number[]
  anxiety: number[]
  sleep: number[]
}

interface Candidate extends HomeDiscovery {
  priority: number
  ratio: number
}

const MOOD_LABELS: Record<string, string> = {
  bem_estar: 'Bem-estar',
  'bem-estar': 'Bem-estar',
  tranquilidade: 'Tranquilidade',
  cansaco: 'Cansaço',
  'cansaço': 'Cansaço',
  sem_energia: 'Sem energia',
  'sem energia': 'Sem energia',
  ansiedade: 'Ansiedade',
  sobrecarga: 'Sobrecarga',
  tristeza: 'Tristeza',
  irritacao: 'Irritação',
  'irritação': 'Irritação',
  desanimo: 'Desânimo',
  'desânimo': 'Desânimo',
  confusao: 'Confusão',
  'confusão': 'Confusão',
}

function normalizeMood(value: unknown): string | null {
  const key = String(value ?? '').trim().toLowerCase()
  return MOOD_LABELS[key] ?? null
}

function numeric(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) && number >= 1 && number <= 5 ? number : null
}

function avg(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function ucfirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Normaliza um rótulo para compor a chave estável: sem acento, minúsculo,
// só letras/dígitos separados por "_". Estável mesmo que a contagem mude.
function deburrKey(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function aggregateByDay(entries: HomeDiscoveryEntry[]): DaySignals[] {
  const byDay = new Map<string, DaySignals>()

  for (const entry of entries) {
    const key = diaryPatternDayKey(entry)
    if (!key) continue
    const day = byDay.get(key) ?? {
      key,
      moods: new Set<string>(),
      emotions: new Set<string>(),
      contexts: new Set<string>(),
      triggers: new Set<string>(),
      energy: [],
      anxiety: [],
      sleep: [],
    }

    const mood = normalizeMood(entry.mood)
    if (mood) day.moods.add(mood)
    getDiaryPatternTags(entry, 'emotion').forEach(tag => day.emotions.add(tag))
    getDiaryPatternTags(entry, 'context').forEach(tag => day.contexts.add(tag))
    getDiaryPatternTags(entry, 'trigger').forEach(tag => day.triggers.add(tag))

    const energy = numeric(entry.energy)
    const anxiety = numeric(entry.anxiety_level)
    const sleep = numeric(entry.sleep_quality)
    if (energy != null) day.energy.push(energy)
    if (anxiety != null) day.anxiety.push(anxiety)
    if (sleep != null) day.sleep.push(sleep)

    byDay.set(key, day)
  }

  return [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key))
}

function statusFor(matchedDays: number, baseDays: number): HomeDiscoveryStatus | null {
  if (baseDays >= 5 && matchedDays >= 3 && matchedDays / baseDays >= 0.5) return 'ready'
  if (baseDays >= 3 && matchedDays >= 2) return 'forming'
  return null
}

// Um sinal só "enfraquece" quando há histórico suficiente (>=10 dias com registro, ambas as
// metades com >=4 dias) pra comparar a metade mais recente do período com a mais antiga — e
// quando a metade mais ANTIGA sozinha já seria forte o bastante pra ser um padrão. A checagem
// não depende do status calculado sobre o período inteiro (que cai junto com a queda recente):
// um sinal forte há um mês e ausente agora deve aparecer como "enfraquecendo", não sumir
// silenciosamente por a média do período inteiro ter descido junto.
function applyTrend(status: HomeDiscoveryStatus, dayKeys: Set<string>, days: DaySignals[]): HomeDiscoveryStatus {
  if (days.length < 10) return status
  const half = Math.ceil(days.length / 2)
  const recentDays = days.slice(0, half) // `days` vem ordenado do mais recente pro mais antigo
  const olderDays = days.slice(half)
  if (recentDays.length < 4 || olderDays.length < 4) return status
  const recentMatched = recentDays.filter(d => dayKeys.has(d.key)).length
  const olderMatched = olderDays.filter(d => dayKeys.has(d.key)).length
  const recentRatio = recentMatched / recentDays.length
  const olderRatio = olderMatched / olderDays.length
  const olderWasEstablished = olderMatched >= 3 && olderRatio >= 0.5
  if (olderWasEstablished && recentRatio < 0.4 && olderRatio - recentRatio >= 0.34) return 'weakening'
  return status
}

function firstLast(dayKeys: Set<string>): { firstSeen: string; lastSeen: string; matchedDates: string[] } {
  const sorted = [...dayKeys].sort()
  return { firstSeen: sorted[0] ?? '', lastSeen: sorted[sorted.length - 1] ?? '', matchedDates: sorted }
}

function periodBounds(days: DaySignals[]): { periodStart: string; periodEnd: string } {
  if (!days.length) return { periodStart: '', periodEnd: '' }
  return { periodStart: days[days.length - 1].key, periodEnd: days[0].key } // desc-sorted
}

function stageEyebrow(status: HomeDiscoveryStatus): string {
  if (status === 'ready') return 'Descoberta do seu histórico'
  if (status === 'weakening') return 'Um sinal que vem aparecendo com menos frequência'
  return 'Uma descoberta está se formando'
}

function recurrenceCandidate(
  kind: 'mood' | 'emotion' | 'context' | 'trigger',
  label: string,
  dayKeys: Set<string>,
  days: DaySignals[],
  priority: number,
): Candidate | null {
  const activeDays = days.length
  const matchedDays = dayKeys.size
  const baseStatus = statusFor(matchedDays, activeDays)
  if (!baseStatus) return null
  const status = applyTrend(baseStatus, dayKeys, days)
  const display = kind === 'mood' ? label : ucfirst(label)
  const subject = status === 'weakening'
    ? `“${display}” apareceu com menos frequência nos dias mais recentes`
    : kind === 'trigger'
      ? `“${display}” apareceu como gatilho em mais de um dia`
      : kind === 'context'
        ? `“${display}” tem aparecido em vários dias`
        : `“${display}” vem aparecendo com frequência`

  return {
    id: `${kind}:${label.toLowerCase()}:${matchedDays}:${activeDays}`,
    stableKey: `${kind}:${deburrKey(label)}`,
    kind,
    status,
    priority,
    ratio: matchedDays / activeDays,
    eyebrow: stageEyebrow(status),
    title: subject,
    description: status === 'weakening'
      ? `Esse sinal apareceu em ${matchedDays} dos seus ${activeDays} dias com registro no período, mas ficou bem menos presente na metade mais recente desse período do que estava antes.`
      : status === 'ready'
        ? `Esse sinal apareceu em ${matchedDays} dos seus ${activeDays} dias com registro no período. Há repetição suficiente para valer uma observação mais atenta.`
        : `Esse sinal apareceu em ${matchedDays} dos seus ${activeDays} dias com registro. Ainda é cedo para chamar isso de padrão, mas já existe repetição para acompanhar.`,
    evidence: `${matchedDays} dias distintos de ${activeDays} dias registrados. A contagem é por dia, não pela quantidade de registros feitos no mesmo dia.`,
    question: status === 'weakening'
      ? `O que mudou entre os dias mais antigos e os mais recentes em que “${display}” apareceu?`
      : `O que você percebe quando compara os dias em que “${display}” apareceu?`,
    matchedDays,
    baseDays: activeDays,
    ...firstLast(dayKeys),
    ...periodBounds(days),
  }
}

function relationCandidate(
  kind: 'context_emotion' | 'trigger_emotion',
  left: string,
  right: string,
  dayKeys: Set<string>,
  days: DaySignals[],
  priority: number,
): Candidate | null {
  const activeDays = days.length
  const matchedDays = dayKeys.size
  const baseStatus = statusFor(matchedDays, activeDays)
  if (!baseStatus) return null
  const status = applyTrend(baseStatus, dayKeys, days)
  const leftLabel = ucfirst(left)
  const rightLabel = ucfirst(right)

  return {
    id: `${kind}:${left}:${right}:${matchedDays}:${activeDays}`,
    stableKey: `${kind}:${deburrKey(left)}:${deburrKey(right)}`,
    kind,
    status,
    priority,
    ratio: matchedDays / activeDays,
    eyebrow: stageEyebrow(status),
    title: status === 'weakening'
      ? `“${leftLabel}” e “${rightLabel}” apareceram juntos com menos frequência recentemente`
      : `“${leftLabel}” e “${rightLabel}” apareceram juntos em mais de um dia`,
    description: status === 'weakening'
      ? `Os dois marcadores já apareceram juntos em ${matchedDays} dos seus ${activeDays} dias, mas essa coocorrência ficou mais rara na metade mais recente do período.`
      : status === 'ready'
        ? `Os dois marcadores apareceram juntos em ${matchedDays} dos seus ${activeDays} dias registrados no período. Isso mostra uma coocorrência que pode valer observar.`
        : `Os dois marcadores já apareceram juntos em ${matchedDays} dias diferentes. Ainda faltam registros para tratar isso como uma relação recorrente.`,
    evidence: `Coocorrência em ${matchedDays} dias distintos. Isso não significa que um marcador cause o outro.`,
    question: `O que você nota quando compara os dias em que “${leftLabel}” e “${rightLabel}” apareceram juntos?`,
    matchedDays,
    baseDays: activeDays,
    ...firstLast(dayKeys),
    ...periodBounds(days),
  }
}

function scaleRelationCandidate(
  kind: 'sleep_anxiety' | 'energy_anxiety',
  dayKeys: Set<string>,
  baseDayKeys: Set<string>,
  days: DaySignals[],
  priority: number,
): Candidate | null {
  const matchedDays = dayKeys.size
  const baseDays = baseDayKeys.size
  if (baseDays < 3 || matchedDays < 2) return null
  const baseStatus: HomeDiscoveryStatus = baseDays >= 4 && matchedDays >= 3 && matchedDays / baseDays >= 0.6 ? 'ready' : 'forming'
  // pra tendência, a "atividade" relevante é entre os dias em que os dois sinais foram marcados
  // (baseDayKeys), não o período inteiro — senão dias sem os dois sinais marcados contariam como
  // enfraquecimento.
  const baseDaysList = days.filter(d => baseDayKeys.has(d.key))
  const status = applyTrend(baseStatus, dayKeys, baseDaysList)
  const sleep = kind === 'sleep_anxiety'
  const title = status === 'weakening'
    ? (sleep ? 'Sono difícil e ansiedade alta apareceram juntos com menos frequência recentemente' : 'Energia baixa e ansiedade alta apareceram juntas com menos frequência recentemente')
    : sleep
      ? 'Sono mais difícil e ansiedade mais alta apareceram juntos'
      : 'Energia mais baixa e ansiedade mais alta apareceram juntas'
  const first = sleep ? 'sono e ansiedade' : 'energia e ansiedade'

  return {
    id: `${kind}:${matchedDays}:${baseDays}`,
    stableKey: kind,
    kind,
    status,
    priority,
    ratio: matchedDays / baseDays,
    eyebrow: stageEyebrow(status),
    title,
    description: status === 'weakening'
      ? `Isso já aconteceu em ${matchedDays} dos ${baseDays} dias em que você marcou os dois sinais, mas ficou mais raro na parte mais recente desses dias.`
      : status === 'ready'
        ? `Isso aconteceu em ${matchedDays} dos ${baseDays} dias em que você marcou os dois sinais. É uma repetição que pode valer acompanhar com mais distância.`
        : `Isso já aconteceu em ${matchedDays} dos ${baseDays} dias em que você marcou os dois sinais. Ainda é cedo para chamar de padrão.`,
    evidence: `A comparação usa médias do mesmo dia para ${first}. Coocorrência não significa causa nem diagnóstico.`,
    question: 'O que mais estava diferente nesses dias quando você olha para eles em conjunto?',
    matchedDays,
    baseDays,
    ...firstLast(dayKeys),
    ...periodBounds(days),
  }
}

function countBySignal(days: DaySignals[], getValues: (day: DaySignals) => Set<string>) {
  const dayKeysBySignal = new Map<string, Set<string>>()
  for (const day of days) {
    for (const value of getValues(day)) {
      const set = dayKeysBySignal.get(value) ?? new Set<string>()
      set.add(day.key)
      dayKeysBySignal.set(value, set)
    }
  }
  return [...dayKeysBySignal.entries()]
    .map(([label, dayKeys]) => ({ label, count: dayKeys.size, dayKeys }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
}

function pairCounts(days: DaySignals[], left: (day: DaySignals) => Set<string>, right: (day: DaySignals) => Set<string>) {
  const dayKeysByPair = new Map<string, { left: string; right: string; dayKeys: Set<string> }>()
  for (const day of days) {
    for (const a of left(day)) {
      for (const b of right(day)) {
        const key = a + '\u0000' + b
        const current = dayKeysByPair.get(key) ?? { left: a, right: b, dayKeys: new Set<string>() }
        current.dayKeys.add(day.key)
        dayKeysByPair.set(key, current)
      }
    }
  }
  return [...dayKeysByPair.values()]
    .map(({ left, right, dayKeys }) => ({ left, right, count: dayKeys.size, dayKeys }))
    .sort((a, b) => b.count - a.count || a.left.localeCompare(b.left, 'pt-BR') || a.right.localeCompare(b.right, 'pt-BR'))
}

const STATUS_RANK: Record<HomeDiscoveryStatus, number> = { ready: 2, weakening: 1, forming: 0 }

function sortCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    const status = STATUS_RANK[b.status] - STATUS_RANK[a.status]
    if (status !== 0) return status
    if (b.matchedDays !== a.matchedDays) return b.matchedDays - a.matchedDays
    if (Math.abs(b.ratio - a.ratio) > 0.0001) return b.ratio - a.ratio
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.id.localeCompare(b.id, 'pt-BR')
  })
}

function stripCandidate({ priority: _priority, ratio: _ratio, ...rest }: Candidate): HomeDiscovery {
  return rest
}

/**
 * Lista todas as descobertas (em formação + prontas) sustentadas pelos registros
 * estruturados do usuário, já ordenadas por relevância. É a fonte da área
 * "Descobertas". Mesmos princípios da Home:
 * - usa somente sinais estruturados do próprio usuário;
 * - conta dias distintos, não quantidade de registros;
 * - Gratuito recebe apenas recorrência simples de humor;
 * - Essencial acrescenta sentimentos, contextos e relações entre escalas;
 * - Plus acrescenta gatilhos reconhecidos pelo próprio usuário;
 * - relações são descritas como coocorrência, nunca causalidade;
 * - nenhum texto livre do Diário entra aqui.
 */
export function buildHomeDiscoveries(
  entries: HomeDiscoveryEntry[],
  plan: HomeDiscoveryPlan,
): HomeDiscovery[] {
  const candidates = collectDiscoveryCandidates(entries, plan)
  return sortCandidates(candidates).map(stripCandidate)
}

/**
 * Escolhe no máximo uma descoberta para a Home Hoje.
 */
export function buildHomeDiscovery(
  entries: HomeDiscoveryEntry[],
  plan: HomeDiscoveryPlan,
): HomeDiscovery | null {
  return buildHomeDiscoveries(entries, plan)[0] ?? null
}

function collectDiscoveryCandidates(
  entries: HomeDiscoveryEntry[],
  plan: HomeDiscoveryPlan,
): Candidate[] {
  const days = aggregateByDay(entries)
  const activeDays = days.length
  if (activeDays < 3) return []

  const candidates: Candidate[] = []

  for (const signal of countBySignal(days, day => day.moods)) {
    const candidate = recurrenceCandidate('mood', signal.label, signal.dayKeys, days, 80)
    if (candidate) candidates.push(candidate)
  }

  if (plan === 'essential' || plan === 'plus') {
    for (const signal of countBySignal(days, day => day.emotions)) {
      const candidate = recurrenceCandidate('emotion', signal.label, signal.dayKeys, days, 50)
      if (candidate) candidates.push(candidate)
    }
    for (const signal of countBySignal(days, day => day.contexts)) {
      const candidate = recurrenceCandidate('context', signal.label, signal.dayKeys, days, 60)
      if (candidate) candidates.push(candidate)
    }

    for (const pair of pairCounts(days, day => day.contexts, day => day.emotions)) {
      const candidate = relationCandidate('context_emotion', pair.left, pair.right, pair.dayKeys, days, 25)
      if (candidate) candidates.push(candidate)
    }

    const sleepAnxietyBase = new Set(days.filter(day => avg(day.sleep) != null && avg(day.anxiety) != null).map(d => d.key))
    const sleepAnxietyMatched = new Set(days.filter(day => sleepAnxietyBase.has(day.key) && (avg(day.sleep) ?? 5) <= 2 && (avg(day.anxiety) ?? 0) >= 4).map(d => d.key))
    const sleepAnxiety = scaleRelationCandidate('sleep_anxiety', sleepAnxietyMatched, sleepAnxietyBase, days, 10)
    if (sleepAnxiety) candidates.push(sleepAnxiety)

    const energyAnxietyBase = new Set(days.filter(day => avg(day.energy) != null && avg(day.anxiety) != null).map(d => d.key))
    const energyAnxietyMatched = new Set(days.filter(day => energyAnxietyBase.has(day.key) && (avg(day.energy) ?? 5) <= 2 && (avg(day.anxiety) ?? 0) >= 4).map(d => d.key))
    const energyAnxiety = scaleRelationCandidate('energy_anxiety', energyAnxietyMatched, energyAnxietyBase, days, 15)
    if (energyAnxiety) candidates.push(energyAnxiety)
  }

  if (plan === 'plus') {
    for (const signal of countBySignal(days, day => day.triggers)) {
      const candidate = recurrenceCandidate('trigger', signal.label, signal.dayKeys, days, 35)
      if (candidate) candidates.push(candidate)
    }
    for (const pair of pairCounts(days, day => day.triggers, day => day.emotions)) {
      const candidate = relationCandidate('trigger_emotion', pair.left, pair.right, pair.dayKeys, days, 20)
      if (candidate) candidates.push(candidate)
    }
  }

  return candidates
}
