// Fonte oficial única dos planos — 3 planos: Gratuito, Essencial, Plus.
// 'therapeutic' / 'therapeutic-plus' são LEGADOS e são normalizados para 'plus'.
// Qualquer alteração nos planos, recursos, hierarquia ou comparação deve partir daqui.

export type PlanKey = 'free' | 'essential' | 'plus'

// Normaliza qualquer valor de plano (inclusive legado vindo do banco) para os 3 atuais.
export function normalizePlan(raw: string | null | undefined): PlanKey {
  if (raw === 'essential') return 'essential'
  if (raw === 'plus' || raw === 'therapeutic' || raw === 'therapeutic-plus' || raw === 'therapeutic_plus') return 'plus'
  return 'free'
}

export interface AccessProfileLike {
  plan?: string | null
  unlimited_access?: boolean | null
  unlimited_access_until?: string | null
}

/** Acesso administrativo temporário/permanente equivale ao Plus sem alterar o plano comercial. */
export function hasActiveUnlimitedAccess(profile: AccessProfileLike | null | undefined, now = new Date()): boolean {
  if (!profile?.unlimited_access) return false
  if (!profile.unlimited_access_until) return true
  const until = new Date(profile.unlimited_access_until)
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime()
}

/** Plano efetivo para autorização de recursos; preserva `profile.plan` para cobrança/exibição comercial. */
export function getEffectivePlan(profile: AccessProfileLike | null | undefined, now = new Date()): PlanKey {
  return hasActiveUnlimitedAccess(profile, now) ? 'plus' : normalizePlan(profile?.plan)
}

export interface OfficialFeature {
  key: string
  name: string
  category: string
  order: number
  aliases?: string[]
}

export interface OfficialPlan {
  key: PlanKey
  label: string
  price: string
  priceValue: number
  period: string
  tagline: string
  recommended?: boolean
}

// Catálogo oficial ENXUTO — somente os recursos dos 3 planos (§3).
export const OFFICIAL_FEATURES: OfficialFeature[] = [
  // Gratuito
  { key: 'articles_free',                          name: 'Blog aberto',                     category: 'Conteúdo',                order: 1, aliases: ['articles_free'] },
  { key: 'wellbeing_diary_5_month',                name: 'Diário emocional básico',         category: 'Diário',                  order: 2, aliases: ['wellbeing_diary_limited', 'diary_monthly_limit_5', 'simple_mood_checkin'] },
  { key: 'basic_self_assessment',                  name: 'Questionário inicial',            category: 'Questionários',           order: 3 },
  { key: 'biweekly_auto_challenges',               name: 'Algumas práticas guiadas',        category: 'Conteúdo',                order: 4 },
  // Essencial
  { key: 'diary_unlimited',                        name: 'Diário ilimitado',                category: 'Diário',                  order: 5 },
  { key: 'diary_mood_symptoms_summary',            name: 'Mapa emocional completo',         category: 'Mapa emocional',          order: 6, aliases: ['evolution_highlights_no_clinical_analysis', 'monthly_comparative_charts', 'extra_emotional_markers'] },
  { key: 'full_history',                           name: 'Histórico e gráficos',            category: 'Histórico',               order: 7, aliases: ['simple_evolution_charts', 'limited_history'] },
  { key: 'emotional_exercise_library',             name: 'Conteúdos guiados completos',     category: 'Conteúdo',                order: 8, aliases: ['guided_text_meditations', 'guided_diary_notes'] },
  { key: 'weekly_assessments',                     name: 'Relatório semanal automático',    category: 'Relatórios',              order: 9 },
  // Plus
  { key: 'personalized_self_care_plan',            name: 'Plano de autocuidado mensal',     category: 'Autocuidado',             order: 10, aliases: ['weekly_self_care_plan'] },
  { key: 'advanced_monthly_report',                name: 'Relatório mensal aprofundado',    category: 'Relatórios',              order: 11 },
  { key: 'monthly_message_guidance',               name: 'Orientação mensal por mensagem',  category: 'Orientação profissional', order: 12 },
]
// 'professional_comment_on_monthly_report' foi aposentado como recurso comercial
// (nunca mais como oferta ativa do Plus). Dados históricos permanecem no banco
// (professional_comments) apenas para compatibilidade; ver docs/archive e a
// migration de aposentadoria para o desligamento operacional completo.

// ─── Mapa de aliases → chave principal ───────────────────────────────────────

export const ALIAS_TO_KEY: Record<string, string> = {}
for (const f of OFFICIAL_FEATURES) {
  if (f.aliases) {
    for (const alias of f.aliases) ALIAS_TO_KEY[alias] = f.key
  }
}

/** Resolve chave de alias para chave principal. */
export function resolveKey(key: string): string {
  return ALIAS_TO_KEY[key] ?? key
}

// ─── Hierarquia de herança oficial ───────────────────────────────────────────

export const PLAN_INHERITS_FROM: Partial<Record<PlanKey, PlanKey>> = {
  essential: 'free',
  plus: 'essential',
}

export const INHERIT_LABEL: Partial<Record<PlanKey, string>> = {
  essential: 'Tudo do Gratuito',
  plus: 'Tudo do Essencial',
}

export const DEFAULT_INHERIT: Record<PlanKey, boolean> = {
  free: false,
  essential: true,
  plus: true,
}

// ─── Features PRÓPRIAS de cada plano (excluindo herdadas) ────────────────────

const FREE_KEYS = [
  'articles_free', 'wellbeing_diary_5_month', 'basic_self_assessment', 'biweekly_auto_challenges',
]
const ESSENTIAL_OWN_KEYS = [
  'diary_unlimited', 'diary_mood_symptoms_summary', 'full_history',
  'emotional_exercise_library', 'weekly_assessments',
]
const PLUS_OWN_KEYS = [
  'personalized_self_care_plan', 'advanced_monthly_report', 'monthly_message_guidance',
]

export const OWN_FEATURE_KEYS: Record<PlanKey, string[]> = {
  free: FREE_KEYS,
  essential: ESSENTIAL_OWN_KEYS,
  plus: PLUS_OWN_KEYS,
}

// ─── Acesso padrão completo por plano (próprios + herdados) ──────────────────

export const DEFAULT_PLAN_ACCESS: Record<PlanKey, string[]> = {
  free: FREE_KEYS,
  essential: [...FREE_KEYS, ...ESSENTIAL_OWN_KEYS],
  plus: [...FREE_KEYS, ...ESSENTIAL_OWN_KEYS, ...PLUS_OWN_KEYS],
}

// ─── Configuração dos planos ──────────────────────────────────────────────────

export const OFFICIAL_PLANS: OfficialPlan[] = [
  { key: 'free',      label: 'Gratuito',  price: 'R$ 0',     priceValue: 0,    period: 'para sempre', tagline: 'Comece a se entender.' },
  { key: 'essential', label: 'Essencial', price: 'R$ 19,90', priceValue: 19.9, period: '/mês',        tagline: 'Acompanhe seus padrões.', recommended: true },
  { key: 'plus',      label: 'Plus',      price: 'R$ 39,90', priceValue: 39.9, period: '/mês',        tagline: 'Receba orientação para agir.' },
]

export const PLAN_KEYS: PlanKey[] = ['free', 'essential', 'plus']

// ─── Hierarquia de acesso (free < essential < plus) ──────────────────────────

export const PLAN_RANK: Record<PlanKey, number> = { free: 0, essential: 1, plus: 2 }

/** Retorna true se `userPlan` dá acesso a um recurso que exige `requiredPlan`. */
export function hasPlanAccess(
  userPlan: string | null | undefined,
  requiredPlan: string | null | undefined,
): boolean {
  return PLAN_RANK[normalizePlan(userPlan)] >= PLAN_RANK[normalizePlan(requiredPlan)]
}

/** Plano mínimo que possui uma feature oficial como recurso próprio. */
export function getFeatureMinimumPlan(featureKey: string): PlanKey | null {
  const canonicalKey = resolveKey(featureKey)
  if (!OFFICIAL_FEATURES.some(feature => feature.key === canonicalKey)) return null
  return PLAN_KEYS.find(plan => OWN_FEATURE_KEYS[plan].includes(canonicalKey)) ?? null
}

// Níveis de acesso de CONTEÚDO (plan_required do artigo). Diferente de PlanKey:
// inclui 'account' — que NÃO é um plano, e sim "exige estar logado" (gratuito).
export type ContentAccess = 'free' | 'account' | 'essential' | 'plus'

export const CONTENT_ACCESS_LABEL: Record<ContentAccess, string> = {
  free: 'Público', account: 'Gratuito', essential: 'Essencial', plus: 'Plus',
}

/** Regra ÚNICA de bloqueio de conteúdo. */
export function isContentLocked(
  planRequired: string | null | undefined,
  userPlan: string | null | undefined,
  isLoggedIn: boolean,
): boolean {
  const req = planRequired || 'free'
  if (req === 'free') return false
  if (req === 'account') return !isLoggedIn
  return !hasPlanAccess(userPlan, req)
}

/** Objeto oficial do plano (sempre normalizado — nunca retorna undefined). */
export function getPlan(plan: string | null | undefined): OfficialPlan {
  const key = normalizePlan(plan)
  return OFFICIAL_PLANS.find(p => p.key === key) ?? OFFICIAL_PLANS[0]
}

/** Rótulo de exibição do plano: Gratuito / Essencial / Plus. */
export function getPlanLabel(plan: string | null | undefined): string {
  return getPlan(plan).label
}

/** true se o plano é pago (Essencial ou Plus). */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return normalizePlan(plan) !== 'free'
}

// ─── Helpers de herança ───────────────────────────────────────────────────────

/** Lista pública/comercial de benefícios de um plano, derivada do catálogo. */
export function getPublicPlanBenefits(planKey: PlanKey, inheritEnabled = true): string[] {
  const ownNames = OWN_FEATURE_KEYS[planKey].map(k => OFFICIAL_FEATURES.find(f => f.key === k)!.name)
  const label = INHERIT_LABEL[planKey]
  if (planKey === 'free' || !label || !inheritEnabled) return ownNames
  return [label, ...ownNames]
}

/** Lista pública pronta para telas; não mantém uma segunda relação manual. */
export const PUBLIC_PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: getPublicPlanBenefits('free'),
  essential: getPublicPlanBenefits('essential'),
  plus: getPublicPlanBenefits('plus'),
}

/** Feature keys efetivos de um plano (próprios + herdados em cadeia). */
export function getEffectiveFeatureKeys(planKey: PlanKey, inheritMap?: Record<string, boolean>): string[] {
  const own = [...OWN_FEATURE_KEYS[planKey]]
  const parent = PLAN_INHERITS_FROM[planKey]
  if (parent && ((inheritMap ?? DEFAULT_INHERIT)[planKey] ?? DEFAULT_INHERIT[planKey])) {
    return [...getEffectiveFeatureKeys(parent, inheritMap), ...own]
  }
  return own
}

/** Constrói AccessMap { planKey: { featureKey: boolean } } com base em herança. */
export function buildDefaultAccessMap(inheritMap?: Record<string, boolean>): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {}
  for (const planKey of PLAN_KEYS) {
    result[planKey] = {}
    const effective = new Set(getEffectiveFeatureKeys(planKey, inheritMap))
    for (const f of OFFICIAL_FEATURES) {
      result[planKey][f.key] = effective.has(f.key)
    }
  }
  return result
}

/** Para cada plano, retorna quais features são herdadas (vêm do parent). */
export function getInheritedFeatureKeys(planKey: PlanKey, inheritMap?: Record<string, boolean>): string[] {
  const parent = PLAN_INHERITS_FROM[planKey]
  if (!parent) return []
  if (!((inheritMap ?? DEFAULT_INHERIT)[planKey] ?? DEFAULT_INHERIT[planKey])) return []
  return getEffectiveFeatureKeys(parent, inheritMap)
}

// ─── Matriz oficial para comparação pública ──────────────────────────────────
// É a mesma regra que alimenta Pricing e Meu Plano. Linhas booleanas são
// calculadas a partir de DEFAULT_PLAN_ACCESS; as poucas células textuais apenas
// descrevem intensidade do mesmo recurso (diário e conteúdos guiados).

export type PlanCompareValue = boolean | string
export interface OfficialPlanCompareRow {
  key: string
  label: string
  values: Record<PlanKey, PlanCompareValue>
}

function hasDefaultFeature(plan: PlanKey, featureKey: string): boolean {
  return DEFAULT_PLAN_ACCESS[plan].includes(resolveKey(featureKey))
}

function featureRow(key: string, label: string, featureKey: string): OfficialPlanCompareRow {
  return {
    key,
    label,
    values: {
      free: hasDefaultFeature('free', featureKey),
      essential: hasDefaultFeature('essential', featureKey),
      plus: hasDefaultFeature('plus', featureKey),
    },
  }
}

export const OFFICIAL_PLAN_COMPARISON: OfficialPlanCompareRow[] = [
  {
    key: 'diary',
    label: 'Diário emocional',
    values: { free: 'Básico (5/mês)', essential: 'Ilimitado', plus: 'Ilimitado' },
  },
  featureRow('questionnaire', 'Questionário inicial', 'basic_self_assessment'),
  featureRow('emotional-map', 'Mapa emocional e gráficos', 'diary_mood_symptoms_summary'),
  {
    key: 'guided-content',
    label: 'Conteúdos guiados',
    values: { free: 'Algumas práticas', essential: 'Completos', plus: 'Completos' },
  },
  featureRow('weekly-report', 'Relatório semanal automático', 'weekly_assessments'),
  featureRow('self-care', 'Plano de autocuidado mensal', 'personalized_self_care_plan'),
  featureRow('monthly-report', 'Relatório mensal aprofundado', 'advanced_monthly_report'),
  featureRow('monthly-guidance', 'Orientação mensal por mensagem', 'monthly_message_guidance'),
]
