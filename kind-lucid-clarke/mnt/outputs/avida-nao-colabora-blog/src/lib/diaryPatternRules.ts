export type DiaryPatternKind = 'trigger' | 'context' | 'emotion' | 'need'

export interface DiaryPatternEntry {
  id?: string | null
  date?: string | null
  created_at?: string | null
  emotional_tags?: string[] | null
  context_tags?: string[] | null
  need_tags?: string[] | null
  trigger_tags?: string[] | null
}

export interface DiaryPatternInsight {
  id: string
  kind: DiaryPatternKind
  tag: string
  previousDays: number
  totalDays: number
  eyebrow: string
  title: string
  description: string
  evidence: string
  question: string
}

const EMOTIONS = new Set([
  'ansiedade','medo','preocupação','insegurança','tristeza','desânimo','solidão','culpa',
  'irritação','raiva','frustração','cansaço','sobrecarga','confusão','calma','esperança','alegria','gratidão',
])
const CONTEXTS = new Set([
  'trabalho','família','relacionamento','amizades','dinheiro','saúde','corpo','casa','estudos',
  'redes sociais','solidão','rotina','futuro','autoimagem','sono','alimentação','responsabilidades',
])
const NEEDS = new Set([
  'descanso','acolhimento','clareza','silêncio','conversa','limite','organização','ajuda','pausa',
  'leveza','segurança','coragem','paciência','presença','menos cobrança',
])
const TRIGGERS = new Set([
  'cobrança','conflito','excesso de tarefas','crítica','rejeição','comparação','incerteza','falta de descanso',
  'mudança de planos','sensação de fracasso','dificuldade financeira','conversa difícil','pressão familiar','exposição em redes sociais',
])

/**
 * Taxonomia estruturada compartilhada pelas camadas de recorrência e descobertas.
 * Mantê-la aqui evita que uma superfície aceite marcadores que o Diário não oferece.
 */
export const DIARY_PATTERN_TAGS: Record<DiaryPatternKind, ReadonlySet<string>> = {
  trigger: TRIGGERS,
  context: CONTEXTS,
  emotion: EMOTIONS,
  need: NEEDS,
}

const FIELD_BY_KIND: Record<DiaryPatternKind, keyof DiaryPatternEntry> = {
  trigger: 'trigger_tags',
  context: 'context_tags',
  emotion: 'emotional_tags',
  need: 'need_tags',
}

const RULES: Array<{ kind: DiaryPatternKind; priority: number }> = [
  { kind: 'trigger', priority: 0 },
  { kind: 'context', priority: 1 },
  { kind: 'emotion', priority: 2 },
  { kind: 'need', priority: 3 },
]

export function diaryPatternDayKey(entry: DiaryPatternEntry): string {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  const raw = String(entry.created_at ?? '')
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : ''
}

export function getDiaryPatternTags(entry: DiaryPatternEntry, kind: DiaryPatternKind): string[] {
  const value = entry[FIELD_BY_KIND[kind]]
  if (!Array.isArray(value)) return []
  const allowed = DIARY_PATTERN_TAGS[kind]
  return [...new Set(value.map(item => String(item).trim().toLowerCase()).filter(item => allowed.has(item)))]
}

function ucfirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Encontra no máximo uma recorrência relacionada ao registro atual.
 *
 * Regras de segurança:
 * - usa apenas marcadores estruturados oficiais;
 * - o marcador precisa existir no registro atual;
 * - exige pelo menos dois OUTROS dias distintos, totalizando três dias;
 * - múltiplos registros no mesmo dia contam uma vez;
 * - registros do mesmo dia do registro atual não contam como histórico;
 * - não conclui causa, melhora, piora ou diagnóstico.
 */
export function buildDiaryPatternInsight(
  current: DiaryPatternEntry,
  recent: DiaryPatternEntry[],
): DiaryPatternInsight | null {
  const currentDay = diaryPatternDayKey(current)
  if (!currentDay) return null

  const candidates: Array<{ kind: DiaryPatternKind; tag: string; previousDays: number; priority: number }> = []

  for (const rule of RULES) {
    for (const tag of getDiaryPatternTags(current, rule.kind)) {
      const days = new Set<string>()
      for (const entry of recent) {
        const day = diaryPatternDayKey(entry)
        if (!day || day === currentDay) continue
        if (getDiaryPatternTags(entry, rule.kind).includes(tag)) days.add(day)
      }
      if (days.size >= 2) candidates.push({ kind: rule.kind, tag, previousDays: days.size, priority: rule.priority })
    }
  }

  const strongest = candidates.sort((a, b) => b.previousDays - a.previousDays || a.priority - b.priority || a.tag.localeCompare(b.tag, 'pt-BR'))[0]
  if (!strongest) return null

  const totalDays = strongest.previousDays + 1
  const label = ucfirst(strongest.tag)
  return {
    id: `${strongest.kind}:${strongest.tag}:${totalDays}`,
    kind: strongest.kind,
    tag: strongest.tag,
    previousDays: strongest.previousDays,
    totalDays,
    eyebrow: 'Algo vem se repetindo',
    title: 'Tem uma coisa que talvez valha observar',
    description: `“${label}” apareceu no registro de hoje e em ${strongest.previousDays} outros dias das últimas duas semanas.`,
    evidence: `São ${totalDays} dias distintos contando hoje. Isso mostra repetição nos marcadores que você escolheu, não uma causa nem um diagnóstico.`,
    question: `O que você percebe quando compara os dias em que “${label}” apareceu?`,
  }
}
