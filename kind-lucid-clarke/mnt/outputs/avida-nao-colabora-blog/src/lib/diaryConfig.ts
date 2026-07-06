import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────
// Configuração do diário por plano.
// Fonte única compartilhada entre:
//   - AdminDiaryConfig (admin edita e salva em diary_plan_configs)
//   - DiaryPage (usuário: respeita limites, campos, PDF e perguntas)
// ─────────────────────────────────────────────────────────────

export type PlanKey = 'free' | 'essential' | 'plus'

export interface DiaryPlanConfig {
  plan: PlanKey
  label: string
  entriesPerMonth: number | null // null = ilimitado
  fields: Record<string, boolean>
  guidedQuestions: string[]
  exportPDF: boolean
  history: string
  graphs: string[]
  reports: string[]
}

// Campos configuráveis (rótulos usados no admin).
export const DIARY_FIELDS = [
  { key: 'mood', label: 'Humor (escala simples)' },
  { key: 'mood_emoji', label: 'Emoji de humor' },
  { key: 'free_note', label: 'Campo livre' },
  { key: 'guided_question', label: 'Pergunta guiada' },
  { key: 'emotional_tags', label: 'Tags emocionais' },
  { key: 'energy', label: 'Energia' },
  { key: 'anxiety_level', label: 'Nível de ansiedade' },
  { key: 'stress_level', label: 'Nível de estresse' },
  { key: 'sleep_quality', label: 'Qualidade do sono' },
  { key: 'self_esteem', label: 'Autoestima' },
  { key: 'irritability', label: 'Irritabilidade' },
  { key: 'overload', label: 'Sobrecarga' },
  { key: 'emotional_triggers', label: 'Gatilhos emocionais' },
  { key: 'recurring_thoughts', label: 'Pensamentos recorrentes' },
  { key: 'emotional_need', label: 'Necessidade emocional' },
  { key: 'relationships', label: 'Relacionamentos' },
  { key: 'habits', label: 'Hábitos' },
  { key: 'gratitude', label: 'Gratidão' },
  { key: 'small_pride', label: 'Pequeno orgulho' },
] as const

export const DEFAULT_DIARY_CONFIGS: DiaryPlanConfig[] = [
  {
    plan: 'free', label: 'Gratuito', entriesPerMonth: 5, exportPDF: false,
    history: '30 dias',
    fields: { mood: true, free_note: true, guided_question: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?'],
    graphs: [], reports: [],
  },
  {
    plan: 'essential', label: 'Essencial', entriesPerMonth: null, exportPDF: true,
    history: 'Completo',
    fields: { mood: true, mood_emoji: true, free_note: true, guided_question: true, emotional_tags: true, energy: true, anxiety_level: true, sleep_quality: true, gratitude: true, small_pride: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?', 'Tem algo que gostaria de mudar amanhã?'],
    graphs: ['Humor ao longo do tempo', 'Nível de energia'], reports: ['Relatório mensal simples'],
  },
  {
    plan: 'plus', label: 'Plus', entriesPerMonth: null, exportPDF: true,
    history: 'Completo',
    fields: { mood: true, mood_emoji: true, free_note: true, guided_question: true, emotional_tags: true, energy: true, anxiety_level: true, stress_level: true, sleep_quality: true, self_esteem: true, irritability: true, overload: true, emotional_triggers: true, recurring_thoughts: true, emotional_need: true, relationships: true, habits: true, gratitude: true, small_pride: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?', 'Quais padrões você percebeu esta semana?', 'O que você precisa mais de você mesmo hoje?', 'Como posso me preparar melhor para o próximo mês?'],
    graphs: ['Humor ao longo do tempo', 'Nível de energia', 'Padrões emocionais', 'Mapa de gatilhos', 'Evolução semanal'],
    reports: ['Relatório mensal simples', 'Relatório avançado', 'Plano de autocuidado'],
  },
]

// Normaliza qualquer valor de plano (inclusive legado do banco) para os 3 atuais.
export function normalizeDiaryPlan(raw: string): PlanKey {
  if (raw === 'essential') return 'essential'
  if (raw === 'plus' || raw === 'therapeutic' || raw === 'therapeutic-plus' || raw === 'therapeutic_plus') return 'plus'
  return 'free'
}

export function defaultDiaryConfig(plan: string): DiaryPlanConfig {
  const key = normalizeDiaryPlan(plan)
  return DEFAULT_DIARY_CONFIGS.find(c => c.plan === key) ?? DEFAULT_DIARY_CONFIGS[0]
}

// Busca a config do plano em diary_plan_configs e mescla sobre o padrão.
// Se não houver linha salva (ou erro), retorna o padrão — nunca quebra o diário.
export async function fetchDiaryConfig(plan: string): Promise<DiaryPlanConfig> {
  const key = normalizeDiaryPlan(plan)
  const base = defaultDiaryConfig(key)
  try {
    const { data } = await supabase
      .from('diary_plan_configs')
      .select('config')
      .eq('plan_key', key)
      .maybeSingle()
    const saved = (data as { config?: Partial<DiaryPlanConfig> } | null)?.config
    if (saved && typeof saved === 'object') {
      return { ...base, ...saved, fields: { ...base.fields, ...(saved.fields ?? {}) } }
    }
  } catch {
    /* usa o padrão */
  }
  return base
}
