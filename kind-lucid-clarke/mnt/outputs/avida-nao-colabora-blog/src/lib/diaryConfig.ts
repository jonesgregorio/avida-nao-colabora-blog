import { supabase } from './supabase'
import { getPlanLabel, normalizePlan, type PlanKey } from './officialPlans'
export type { PlanKey } from './officialPlans'

// ─────────────────────────────────────────────────────────────
// Configuração do diário por plano.
// Fonte única compartilhada entre AdminDiaryConfig e a experiência do usuário.
// Identidade e normalização dos planos vêm sempre de officialPlans.ts.
// ─────────────────────────────────────────────────────────────

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
  /** Regras não editáveis pelo admin: deixam a experiência de cada plano explícita. */
  diaryExperience?: 'basic' | 'complete' | 'advanced'
  mainEntriesPerDay?: number
  addonsEnabled?: boolean
}

// Campos configuráveis (rótulos usados no admin).
export const DIARY_FIELDS = [
  { key: 'mood', label: 'Humor (escala simples)' },
  { key: 'mood_emoji', label: 'Emoji de humor' },
  { key: 'free_note', label: 'Campo livre' },
  { key: 'guided_question', label: 'Pergunta guiada' },
  { key: 'emotional_tags', label: 'Tags emocionais' },
  { key: 'context_tags', label: 'Tags de contexto' },
  { key: 'need_tags', label: 'Tags de necessidade' },
  { key: 'care_action_tags', label: 'Tags de ações de cuidado' },
  { key: 'energy', label: 'Energia' },
  { key: 'anxiety_level', label: 'Nível de ansiedade' },
  { key: 'stress_level', label: 'Nível de estresse' },
  { key: 'sleep_quality', label: 'Qualidade do sono' },
  { key: 'self_esteem', label: 'Autoestima' },
  { key: 'irritability', label: 'Irritabilidade' },
  { key: 'overload', label: 'Sobrecarga' },
  { key: 'emotional_triggers', label: 'Gatilhos emocionais (texto livre)' },
  { key: 'trigger_tags', label: 'Gatilhos emocionais (tags)' },
  { key: 'recurring_thoughts', label: 'Pensamentos recorrentes' },
  { key: 'emotional_need', label: 'Necessidade emocional' },
  { key: 'relationships', label: 'Relacionamentos' },
  { key: 'habits', label: 'Hábitos' },
  { key: 'gratitude', label: 'Gratidão' },
  { key: 'small_pride', label: 'Pequeno orgulho' },
] as const

// Única matriz de campos que o Admin não pode liberar para um plano inferior.
// Antes ela ficava duplicada dentro de AdminDiaryConfig.tsx.
export const DIARY_LOCKED_FIELDS: Record<PlanKey, string[]> = {
  free: [
    'context_tags', 'need_tags', 'care_action_tags', 'trigger_tags', 'energy',
    'anxiety_level', 'stress_level', 'sleep_quality', 'self_esteem', 'irritability',
    'overload', 'emotional_triggers', 'recurring_thoughts', 'emotional_need',
    'relationships', 'habits',
  ],
  essential: [
    'trigger_tags', 'stress_level', 'self_esteem', 'irritability', 'overload',
    'emotional_triggers', 'recurring_thoughts', 'emotional_need', 'relationships', 'habits',
  ],
  plus: [],
}

export const DEFAULT_DIARY_CONFIGS: DiaryPlanConfig[] = [
  {
    plan: 'free', label: getPlanLabel('free'), entriesPerMonth: 5, exportPDF: false,
    history: '30 dias', diaryExperience: 'basic', mainEntriesPerDay: 1, addonsEnabled: false,
    fields: { mood: true, free_note: true, guided_question: true, emotional_tags: true, context_tags: false, need_tags: false, care_action_tags: false, trigger_tags: false },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?', 'O que ajudou um pouco?'],
    graphs: [], reports: [],
  },
  {
    plan: 'essential', label: getPlanLabel('essential'), entriesPerMonth: null, exportPDF: true,
    history: 'Completo', diaryExperience: 'complete', mainEntriesPerDay: 1, addonsEnabled: false,
    fields: { mood: true, mood_emoji: true, free_note: true, guided_question: true, emotional_tags: true, context_tags: true, need_tags: true, care_action_tags: true, trigger_tags: false, energy: true, anxiety_level: true, stress_level: false, sleep_quality: true, self_esteem: false, gratitude: true, small_pride: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que mais mexeu com você hoje?', 'O que parece ter contribuído para isso?', 'Que pequena coisa te trouxe algum alívio?'],
    graphs: ['Humor ao longo do tempo', 'Nível de energia', 'Ansiedade percebida', 'Sono', 'Tags emocionais', 'Contextos mais frequentes', 'Necessidades mais frequentes'],
    reports: ['Relatório semanal automático'],
  },
  {
    plan: 'plus', label: getPlanLabel('plus'), entriesPerMonth: null, exportPDF: true,
    history: 'Completo', diaryExperience: 'advanced', mainEntriesPerDay: 1, addonsEnabled: false,
    fields: { mood: true, mood_emoji: true, free_note: true, guided_question: true, emotional_tags: true, context_tags: true, need_tags: true, care_action_tags: true, trigger_tags: true, energy: true, anxiety_level: true, stress_level: true, sleep_quality: true, self_esteem: true, irritability: true, overload: true, emotional_triggers: true, recurring_thoughts: true, emotional_need: true, relationships: true, habits: true, gratitude: true, small_pride: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que mais mexeu com você hoje?', 'O que você gostaria apenas de observar, sem tentar resolver agora?', 'O que seu corpo parece ter pedido hoje?', 'Que situação você gostaria de entender melhor?'],
    graphs: ['Humor ao longo do tempo', 'Nível de energia', 'Ansiedade percebida', 'Sono', 'Tags emocionais', 'Contextos mais frequentes', 'Necessidades mais frequentes', 'Autoestima', 'Estresse', 'Sobrecarga', 'Mapa de gatilhos', 'Padrões avançados', 'Evolução semanal'],
    reports: ['Relatório semanal automático', 'Relatório mensal aprofundado', 'Plano de autocuidado mensal'],
  },
]

/** Aplica as travas comerciais do Diário antes de persistir configurações do Admin. */
export function enforceDiaryPlanRules(config: DiaryPlanConfig): DiaryPlanConfig {
  const fields = { ...config.fields }
  for (const key of DIARY_LOCKED_FIELDS[config.plan]) fields[key] = false

  if (config.plan === 'free') {
    return { ...config, label: getPlanLabel(config.plan), entriesPerMonth: 5, exportPDF: false, fields, reports: [], graphs: [], addonsEnabled: false }
  }
  if (config.plan === 'essential') {
    return { ...config, label: getPlanLabel(config.plan), entriesPerMonth: null, fields, reports: ['Relatório semanal automático'], addonsEnabled: false }
  }
  return { ...config, label: getPlanLabel(config.plan), entriesPerMonth: null, fields, addonsEnabled: false }
}

// Mantém o nome antigo por compatibilidade, mas delega a normalização oficial.
export function normalizeDiaryPlan(raw: string): PlanKey {
  return normalizePlan(raw)
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
      return enforceDiaryPlanRules({
        ...base,
        ...saved,
        plan: key,
        fields: { ...base.fields, ...(saved.fields ?? {}) },
        addonsEnabled: false,
      })
    }
  } catch {
    /* usa o padrão */
  }
  return base
}
