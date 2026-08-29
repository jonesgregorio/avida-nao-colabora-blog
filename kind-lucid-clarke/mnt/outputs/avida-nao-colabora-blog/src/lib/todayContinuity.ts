export interface ContinuityEntry {
  created_at?: string | null
  date?: string | null
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
  context_tags?: string[] | null
  trigger_tags?: string[] | null
}

export type ContinuityKind =
  | 'return'
  | 'yesterday_anxiety'
  | 'yesterday_energy'
  | 'yesterday_sleep'
  | 'yesterday_mood'
  | 'repeated_trigger'
  | 'repeated_context'
  | 'repeated_mood'

export interface ContinuityPrompt {
  id: string
  kind: ContinuityKind
  eyebrow: string
  title: string
  description: string
  action: string
  sourceDay: string | null
}

const MOOD_LABELS: Record<string, string> = {
  bem_estar: 'bem-estar',
  tranquilidade: 'tranquilidade',
  cansaco: 'cansaço',
  sem_energia: 'falta de energia',
  ansiedade: 'ansiedade',
  sobrecarga: 'sobrecarga',
  tristeza: 'tristeza',
  irritacao: 'irritação',
  desanimo: 'desânimo',
  confusao: 'confusão',
}

// Só temas estruturados e já oferecidos pela interface podem voltar para a Home.
// Texto livre do diário nunca entra nesta camada de continuidade.
const SAFE_CONTEXTS = new Set([
  'trabalho', 'família', 'relacionamento', 'amizades', 'dinheiro', 'saúde', 'corpo',
  'casa', 'estudos', 'redes sociais', 'solidão', 'rotina', 'futuro', 'autoimagem',
  'sono', 'alimentação', 'responsabilidades',
])

const SAFE_TRIGGERS = new Set([
  'cobrança', 'conflito', 'excesso de tarefas', 'crítica', 'rejeição', 'comparação',
  'incerteza', 'falta de descanso', 'mudança de planos', 'sensação de fracasso',
  'dificuldade financeira', 'conversa difícil', 'pressão familiar', 'exposição em redes sociais',
])

function entryDay(entry: ContinuityEntry): string {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  const raw = String(entry.created_at ?? '')
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : ''
}

function dayNumber(key: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return Number.NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000
}

function daysBetween(older: string, newer: string): number {
  const a = dayNumber(older)
  const b = dayNumber(newer)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN
  return Math.round(b - a)
}

function latestByDay(entries: ContinuityEntry[]): ContinuityEntry[] {
  return [...entries]
    .filter(entry => entryDay(entry))
    .sort((a, b) => {
      const dayDiff = entryDay(b).localeCompare(entryDay(a))
      if (dayDiff !== 0) return dayDiff
      return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    })
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function countDistinctDays(entries: ContinuityEntry[], tags: 'context_tags' | 'trigger_tags', allowed: Set<string>) {
  const byTag = new Map<string, Set<string>>()
  for (const entry of entries) {
    const day = entryDay(entry)
    if (!day) continue
    for (const raw of entry[tags] ?? []) {
      const tag = String(raw).trim().toLowerCase()
      if (!allowed.has(tag)) continue
      const days = byTag.get(tag) ?? new Set<string>()
      days.add(day)
      byTag.set(tag, days)
    }
  }
  return [...byTag.entries()]
    .map(([tag, days]) => ({ tag, count: days.size }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'pt-BR'))
}

function countMoodsByDay(entries: ContinuityEntry[]) {
  const byMood = new Map<string, Set<string>>()
  for (const entry of entries) {
    const day = entryDay(entry)
    const mood = String(entry.mood ?? '')
    if (!day || !MOOD_LABELS[mood]) continue
    const days = byMood.get(mood) ?? new Set<string>()
    days.add(day)
    byMood.set(mood, days)
  }
  return [...byMood.entries()]
    .map(([mood, days]) => ({ mood, count: days.size }))
    .sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood))
}

function promptId(kind: ContinuityKind, sourceDay: string | null, subject = '') {
  return [kind, sourceDay ?? 'none', subject].filter(Boolean).join(':')
}

/**
 * Escolhe no máximo uma retomada para a Home Hoje.
 *
 * Regras:
 * - usa somente dados estruturados comprováveis;
 * - nunca lê texto livre do diário;
 * - prioriza o dia anterior antes de padrões mais amplos;
 * - conta recorrência por dias distintos, não por quantidade de cliques no mesmo dia;
 * - não cria diagnóstico nem causalidade;
 * - se já há registro hoje, a Home não insiste em uma pergunta antiga.
 */
export function buildContinuityPrompt(
  entries: ContinuityEntry[],
  todayKey: string,
  hasEntryToday = false,
): ContinuityPrompt | null {
  if (hasEntryToday) return null

  const ordered = latestByDay(entries).filter(entry => entryDay(entry) !== todayKey)
  if (!ordered.length) return null

  const latest = ordered[0]
  const latestDay = entryDay(latest)
  const gap = daysBetween(latestDay, todayKey)

  if (Number.isFinite(gap) && gap >= 3) {
    return {
      id: promptId('return', latestDay),
      kind: 'return',
      eyebrow: 'Continuamos daqui',
      title: 'Faz alguns dias desde o seu último registro',
      description: 'Você não precisa recuperar o que ficou para trás. Se quiser, basta começar por como você está agora.',
      action: 'Retomar meu momento',
      sourceDay: latestDay,
    }
  }

  const yesterday = ordered.find(entry => daysBetween(entryDay(entry), todayKey) === 1) ?? null
  if (yesterday) {
    const anxiety = numberOrNull(yesterday.anxiety_level)
    if (anxiety != null && anxiety >= 4) {
      return {
        id: promptId('yesterday_anxiety', entryDay(yesterday)),
        kind: 'yesterday_anxiety',
        eyebrow: 'Lembra de ontem?',
        title: 'Ontem sua ansiedade ficou alta no seu registro',
        description: 'Hoje ela parece melhor, parecida ou mais intensa? Você pode responder começando por um check-in rápido.',
        action: 'Como está hoje?',
        sourceDay: entryDay(yesterday),
      }
    }

    const energy = numberOrNull(yesterday.energy)
    if (energy != null && energy <= 2) {
      return {
        id: promptId('yesterday_energy', entryDay(yesterday)),
        kind: 'yesterday_energy',
        eyebrow: 'Lembra de ontem?',
        title: 'Ontem sua energia ficou baixa no seu registro',
        description: 'Vale perceber se isso continua hoje, melhorou ou mudou de alguma forma — sem precisar explicar tudo.',
        action: 'Continuar daqui',
        sourceDay: entryDay(yesterday),
      }
    }

    const sleep = numberOrNull(yesterday.sleep_quality)
    if (sleep != null && sleep <= 2) {
      return {
        id: promptId('yesterday_sleep', entryDay(yesterday)),
        kind: 'yesterday_sleep',
        eyebrow: 'Lembra de ontem?',
        title: 'Seu sono apareceu mais difícil ontem',
        description: 'Se fizer sentido, registre como você acordou e como sua energia está hoje. Isso ajuda a acompanhar mudanças ao longo do tempo.',
        action: 'Registrar como estou',
        sourceDay: entryDay(yesterday),
      }
    }

    const mood = String(yesterday.mood ?? '')
    if (MOOD_LABELS[mood]) {
      return {
        id: promptId('yesterday_mood', entryDay(yesterday), mood),
        kind: 'yesterday_mood',
        eyebrow: 'Lembra de ontem?',
        title: `Ontem ${MOOD_LABELS[mood]} apareceu no seu registro`,
        description: 'Hoje está diferente, parecido ou ainda é algo presente? Seu próximo check-in pode começar exatamente daí.',
        action: 'Como está hoje?',
        sourceDay: entryDay(yesterday),
      }
    }
  }

  const recent = ordered.filter(entry => {
    const diff = daysBetween(entryDay(entry), todayKey)
    return Number.isFinite(diff) && diff >= 1 && diff <= 7
  })

  const repeatedTrigger = countDistinctDays(recent, 'trigger_tags', SAFE_TRIGGERS)[0]
  if (repeatedTrigger && repeatedTrigger.count >= 2) {
    return {
      id: promptId('repeated_trigger', null, repeatedTrigger.tag),
      kind: 'repeated_trigger',
      eyebrow: 'Algo vem se repetindo',
      title: `“${repeatedTrigger.tag}” apareceu como gatilho em ${repeatedTrigger.count} dias recentes`,
      description: 'Isso continua presente hoje? Estamos apenas retomando o que você mesmo marcou, sem concluir que uma coisa causa a outra.',
      action: 'Observar hoje',
      sourceDay: null,
    }
  }

  const repeatedContext = countDistinctDays(recent, 'context_tags', SAFE_CONTEXTS)[0]
  if (repeatedContext && repeatedContext.count >= 3) {
    return {
      id: promptId('repeated_context', null, repeatedContext.tag),
      kind: 'repeated_context',
      eyebrow: 'Algo vem aparecendo bastante',
      title: `“${repeatedContext.tag}” apareceu em ${repeatedContext.count} dias recentes`,
      description: 'Se esse contexto ainda estiver importante hoje, seu check-in pode começar por ele. Se não estiver, tudo bem seguir por outro caminho.',
      action: 'Continuar a partir disso',
      sourceDay: null,
    }
  }

  const repeatedMood = countMoodsByDay(recent)[0]
  if (repeatedMood && repeatedMood.count >= 3) {
    return {
      id: promptId('repeated_mood', null, repeatedMood.mood),
      kind: 'repeated_mood',
      eyebrow: 'Seu histórico recente',
      title: `${MOOD_LABELS[repeatedMood.mood]} apareceu em ${repeatedMood.count} dias recentes`,
      description: 'Hoje pode ser um bom momento para perceber se esse estado continua presente, diminuiu ou mudou.',
      action: 'Registrar como estou hoje',
      sourceDay: null,
    }
  }

  return null
}
