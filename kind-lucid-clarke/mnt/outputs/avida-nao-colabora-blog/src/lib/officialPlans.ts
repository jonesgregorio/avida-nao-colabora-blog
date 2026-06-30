// Fonte oficial única dos planos — usada pelo site público, admin e permissões.
// Qualquer alteração nos planos deve ser feita aqui.

export type PlanKey = 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'

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

// ─── Catálogo completo de recursos oficiais ───────────────────────────────────

export const OFFICIAL_FEATURES: OfficialFeature[] = [
  { key: 'articles_free',                             name: 'Artigos gratuitos',                                                                                         category: 'Conteúdo',            order: 1  },
  { key: 'basic_self_assessment',                     name: 'Questionário básico de autoavaliação',                                                                      category: 'Avaliações',          order: 2  },
  { key: 'wellbeing_diary_5_month',                   name: 'Diário de bem-estar com até 5 entradas por mês',                                                            category: 'Diário',              order: 3,  aliases: ['wellbeing_diary_limited', 'diary_monthly_limit_5'] },
  { key: 'simple_mood_checkin',                       name: 'Registro simples de humor',                                                                                 category: 'Diário',              order: 4  },
  { key: 'biweekly_auto_challenges',                  name: 'Mini-desafios quinzenais automatizados',                                                                    category: 'Avaliações',          order: 5  },
  { key: 'limited_history',                           name: 'Histórico limitado',                                                                                        category: 'Histórico',           order: 6  },
  { key: 'ads_enabled',                               name: 'Conteúdos com anúncios',                                                                                    category: 'Anúncios',            order: 7  },
  { key: 'diary_unlimited',                           name: 'Diário ilimitado',                                                                                          category: 'Diário',              order: 8  },
  { key: 'full_history',                              name: 'Histórico completo',                                                                                        category: 'Histórico',           order: 9  },
  { key: 'weekly_assessments',                        name: 'Avaliações semanais',                                                                                       category: 'Avaliações',          order: 10 },
  { key: 'simple_evolution_charts',                   name: 'Gráficos simples de evolução',                                                                              category: 'Relatórios',          order: 11 },
  { key: 'guided_text_meditations',                   name: 'Meditações guiadas em texto',                                                                               category: 'Conteúdo',            order: 12 },
  { key: 'guided_diary_notes',                        name: 'Notas guiadas no diário',                                                                                   category: 'Diário',              order: 13 },
  { key: 'monthly_pdf_reports',                       name: 'Relatórios mensais em PDF',                                                                                 category: 'Relatórios',          order: 14 },
  { key: 'diary_mood_symptoms_summary',               name: 'Resumo do diário, humor e sintomas',                                                                       category: 'Relatórios',          order: 15 },
  { key: 'evolution_highlights_no_clinical_analysis', name: 'Destaques de evolução, sem análise clínica',                                                               category: 'Relatórios',          order: 16 },
  { key: 'emotional_exercise_library',                name: 'Biblioteca de exercícios emocionais',                                                                       category: 'Conteúdo',            order: 17 },
  { key: 'no_ads',                                    name: 'Sem anúncios',                                                                                              category: 'Anúncios',            order: 18 },
  { key: 'priority_email_support',                    name: 'Suporte por e-mail prioritário',                                                                            category: 'Suporte',             order: 19 },
  { key: 'deep_questionnaire',                        name: 'Questionário aprofundado',                                                                                  category: 'Avaliações',          order: 20 },
  { key: 'personalized_self_care_plan',               name: 'Plano de autocuidado personalizado',                                                                        category: 'Autocuidado',         order: 21 },
  { key: 'advanced_diary',                            name: 'Diário avançado',                                                                                           category: 'Diário',              order: 22 },
  { key: 'extra_emotional_markers',                   name: 'Marcadores extras: sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia',            category: 'Diário',              order: 23, aliases: ['extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy'] },
  { key: 'monthly_comparative_charts',                name: 'Gráficos comparativos mensais',                                                                             category: 'Relatórios',          order: 24 },
  { key: 'advanced_monthly_report',                   name: 'Relatório mensal avançado',                                                                                 category: 'Relatórios',          order: 25 },
  { key: 'personalized_content_recommendations',      name: 'Recomendações personalizadas de conteúdo',                                                                  category: 'Conteúdo',            order: 26 },
  { key: 'weekly_self_care_plan',                     name: 'Plano semanal de autocuidado',                                                                              category: 'Autocuidado',         order: 27 },
  { key: 'early_access_content',                      name: 'Acesso antecipado a novos conteúdos',                                                                       category: 'Conteúdo',            order: 28 },
  { key: 'monthly_message_guidance',                  name: 'Orientação mensal por mensagem',                                                                            category: 'Suporte',             order: 29 },
  { key: 'monthly_psychoanalyst_session_30min',       name: '1 sessão mensal de 30 minutos com Psicanalista',                                                            category: 'Sessão/Profissional', order: 30 },
  { key: 'monthly_self_care_plan_review',             name: 'Revisão mensal do plano de autocuidado',                                                                    category: 'Sessão/Profissional', order: 31 },
  { key: 'professional_comment_on_monthly_report',    name: 'Comentário individual sobre o relatório do mês',                                                            category: 'Sessão/Profissional', order: 32 },
  { key: 'maximum_priority_support',                  name: 'Suporte prioritário máximo',                                                                                category: 'Suporte',             order: 33 },
]

// ─── Mapa de aliases → chave principal ───────────────────────────────────────

export const ALIAS_TO_KEY: Record<string, string> = {}
for (const f of OFFICIAL_FEATURES) {
  if (f.aliases) {
    for (const alias of f.aliases) ALIAS_TO_KEY[alias] = f.key
  }
}

// ─── Hierarquia de herança oficial ───────────────────────────────────────────

export const PLAN_INHERITS_FROM: Partial<Record<PlanKey, PlanKey>> = {
  essential:          'free',
  therapeutic:        'essential',
  'therapeutic-plus': 'therapeutic',
}

// Label de herança para exibição (ex.: "Tudo do Essencial")
export const INHERIT_LABEL: Partial<Record<PlanKey, string>> = {
  essential:          'Tudo do Gratuito',
  therapeutic:        'Tudo do Essencial',
  'therapeutic-plus': 'Tudo do Terapêutico',
}

// Estado padrão de herança por plano
export const DEFAULT_INHERIT: Record<PlanKey, boolean> = {
  free:               false,
  essential:          true,
  therapeutic:        true,
  'therapeutic-plus': true,
}

// ─── Features PRÓPRIAS de cada plano (excluindo herdadas) ────────────────────

// free: todas as 7 são próprias
// essential: apenas as novas (não presentes no free)
// therapeutic: apenas as novas (não presentes no essential)
// therapeutic-plus: apenas as novas (não presentes no therapeutic)

const FREE_KEYS = [
  'articles_free', 'basic_self_assessment', 'wellbeing_diary_5_month',
  'simple_mood_checkin', 'biweekly_auto_challenges', 'limited_history', 'ads_enabled',
]
const ESSENTIAL_OWN_KEYS = [
  'diary_unlimited', 'full_history', 'weekly_assessments', 'simple_evolution_charts',
  'guided_text_meditations', 'guided_diary_notes', 'monthly_pdf_reports',
  'diary_mood_symptoms_summary', 'evolution_highlights_no_clinical_analysis',
  'emotional_exercise_library', 'no_ads', 'priority_email_support',
]
const THERAPEUTIC_OWN_KEYS = [
  'deep_questionnaire', 'personalized_self_care_plan', 'advanced_diary',
  'extra_emotional_markers', 'monthly_comparative_charts', 'advanced_monthly_report',
  'personalized_content_recommendations', 'weekly_self_care_plan',
  'early_access_content', 'monthly_message_guidance',
]
const PLUS_OWN_KEYS = [
  'monthly_psychoanalyst_session_30min', 'monthly_self_care_plan_review',
  'professional_comment_on_monthly_report', 'maximum_priority_support',
]

export const OWN_FEATURE_KEYS: Record<PlanKey, string[]> = {
  free:               FREE_KEYS,
  essential:          ESSENTIAL_OWN_KEYS,
  therapeutic:        THERAPEUTIC_OWN_KEYS,
  'therapeutic-plus': PLUS_OWN_KEYS,
}

// ─── Acesso padrão completo por plano (próprios + herdados) ──────────────────

export const DEFAULT_PLAN_ACCESS: Record<PlanKey, string[]> = {
  free:               FREE_KEYS,
  essential:          [...FREE_KEYS, ...ESSENTIAL_OWN_KEYS],
  therapeutic:        [...FREE_KEYS, ...ESSENTIAL_OWN_KEYS, ...THERAPEUTIC_OWN_KEYS],
  'therapeutic-plus': [...FREE_KEYS, ...ESSENTIAL_OWN_KEYS, ...THERAPEUTIC_OWN_KEYS, ...PLUS_OWN_KEYS],
}

// ─── Configuração dos planos ──────────────────────────────────────────────────

export const OFFICIAL_PLANS: OfficialPlan[] = [
  { key: 'free',              label: 'Gratuito',         price: 'R$ 0',    priceValue: 0,    period: 'para sempre', tagline: 'Para começar a se conhecer melhor, sem custo.' },
  { key: 'essential',         label: 'Essencial',        price: 'R$ 19,90', priceValue: 19.9, period: '/mês',        tagline: 'Para acompanhar sua evolução emocional com continuidade.' },
  { key: 'therapeutic',       label: 'Terapêutico',      price: 'R$ 39,90', priceValue: 39.9, period: '/mês',        tagline: 'Para uma experiência personalizada de autocuidado.', recommended: true },
  { key: 'therapeutic-plus',  label: 'Terapêutico Plus', price: 'R$ 79,90', priceValue: 79.9, period: '/mês',        tagline: 'Para quem deseja acompanhamento individual mensal.' },
]

export const PLAN_KEYS: PlanKey[] = ['free', 'essential', 'therapeutic', 'therapeutic-plus']

// ─── Lista de exibição PÚBLICA (curta, comercial) ─────────────────────────────
// Esta é a lista que aparece no site, com "Tudo do X" no lugar da herança.

export const PUBLIC_PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: FREE_KEYS.map(k => OFFICIAL_FEATURES.find(f => f.key === k)!.name),
  essential: [
    INHERIT_LABEL.essential!,
    ...ESSENTIAL_OWN_KEYS.map(k => OFFICIAL_FEATURES.find(f => f.key === k)!.name),
  ],
  therapeutic: [
    INHERIT_LABEL.therapeutic!,
    ...THERAPEUTIC_OWN_KEYS.map(k => OFFICIAL_FEATURES.find(f => f.key === k)!.name),
  ],
  'therapeutic-plus': [
    INHERIT_LABEL['therapeutic-plus']!,
    ...PLUS_OWN_KEYS.map(k => OFFICIAL_FEATURES.find(f => f.key === k)!.name),
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve chave de alias para chave principal */
export function resolveKey(key: string): string {
  return ALIAS_TO_KEY[key] ?? key
}

/**
 * Retorna a lista pública/comercial de benefícios de um plano.
 * Se inheritEnabled=true (padrão), usa "Tudo do X" para herança.
 * Se inheritEnabled=false, lista os próprios do plano sem o item de herança.
 */
export function getPublicPlanBenefits(planKey: PlanKey, inheritEnabled = true): string[] {
  const ownNames = OWN_FEATURE_KEYS[planKey].map(k => OFFICIAL_FEATURES.find(f => f.key === k)!.name)
  const label = INHERIT_LABEL[planKey]
  if (planKey === 'free' || !label || !inheritEnabled) return ownNames
  return [label, ...ownNames]
}

/**
 * Retorna todos os feature keys efetivos de um plano (próprios + herdados em cadeia).
 * Respeita o mapa de herança se inheritMap fornecido; caso contrário, usa DEFAULT_INHERIT.
 */
export function getEffectiveFeatureKeys(planKey: PlanKey, inheritMap?: Record<string, boolean>): string[] {
  const map = inheritMap ?? DEFAULT_INHERIT
  const own = [...OWN_FEATURE_KEYS[planKey]]
  const parent = PLAN_INHERITS_FROM[planKey]
  if (parent && (map[planKey] ?? DEFAULT_INHERIT[planKey])) {
    return [...getEffectiveFeatureKeys(parent, inheritMap), ...own]
  }
  return own
}

/** Constrói AccessMap { planKey: { featureKey: boolean } } com base em herança */
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

/**
 * Para cada plano, retorna quais features são herdadas (vêm de parent) vs próprias.
 * inherited = está no parent efetivo mas não em OWN_FEATURE_KEYS deste plano
 */
export function getInheritedFeatureKeys(planKey: PlanKey, inheritMap?: Record<string, boolean>): string[] {
  const parent = PLAN_INHERITS_FROM[planKey]
  if (!parent) return []
  const map = inheritMap ?? DEFAULT_INHERIT
  if (!(map[planKey] ?? DEFAULT_INHERIT[planKey])) return []
  return getEffectiveFeatureKeys(parent, inheritMap)
}
