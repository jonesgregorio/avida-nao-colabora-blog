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
  { key: 'articles_free',                          name: 'Artigos gratuitos',                                                                                          category: 'Conteúdo',           order: 1  },
  { key: 'basic_self_assessment',                  name: 'Questionário básico de autoavaliação',                                                                       category: 'Avaliações',         order: 2  },
  { key: 'wellbeing_diary_5_month',                name: 'Diário de bem-estar com até 5 entradas por mês',                                                             category: 'Diário',             order: 3,  aliases: ['wellbeing_diary_limited', 'diary_monthly_limit_5'] },
  { key: 'simple_mood_checkin',                    name: 'Registro simples de humor',                                                                                  category: 'Diário',             order: 4  },
  { key: 'biweekly_auto_challenges',               name: 'Mini-desafios quinzenais automatizados',                                                                     category: 'Avaliações',         order: 5  },
  { key: 'limited_history',                        name: 'Histórico limitado',                                                                                         category: 'Histórico',          order: 6  },
  { key: 'ads_enabled',                            name: 'Conteúdos com anúncios',                                                                                     category: 'Anúncios',           order: 7  },
  { key: 'diary_unlimited',                        name: 'Diário ilimitado',                                                                                           category: 'Diário',             order: 8  },
  { key: 'full_history',                           name: 'Histórico completo',                                                                                         category: 'Histórico',          order: 9  },
  { key: 'weekly_assessments',                     name: 'Avaliações semanais',                                                                                        category: 'Avaliações',         order: 10 },
  { key: 'simple_evolution_charts',                name: 'Gráficos simples de evolução',                                                                               category: 'Relatórios',         order: 11 },
  { key: 'guided_text_meditations',                name: 'Meditações guiadas em texto',                                                                                category: 'Conteúdo',           order: 12 },
  { key: 'guided_diary_notes',                     name: 'Notas guiadas no diário',                                                                                    category: 'Diário',             order: 13 },
  { key: 'monthly_pdf_reports',                    name: 'Relatórios mensais em PDF',                                                                                  category: 'Relatórios',         order: 14 },
  { key: 'diary_mood_symptoms_summary',            name: 'Resumo do diário, humor e sintomas',                                                                        category: 'Relatórios',         order: 15 },
  { key: 'evolution_highlights_no_clinical_analysis', name: 'Destaques de evolução, sem análise clínica',                                                             category: 'Relatórios',         order: 16 },
  { key: 'emotional_exercise_library',             name: 'Biblioteca de exercícios emocionais',                                                                        category: 'Conteúdo',           order: 17 },
  { key: 'no_ads',                                 name: 'Sem anúncios',                                                                                               category: 'Anúncios',           order: 18 },
  { key: 'priority_email_support',                 name: 'Suporte por e-mail prioritário',                                                                             category: 'Suporte',            order: 19 },
  { key: 'deep_questionnaire',                     name: 'Questionário aprofundado',                                                                                   category: 'Avaliações',         order: 20 },
  { key: 'personalized_self_care_plan',            name: 'Plano de autocuidado personalizado',                                                                         category: 'Autocuidado',        order: 21 },
  { key: 'advanced_diary',                         name: 'Diário avançado',                                                                                            category: 'Diário',             order: 22 },
  { key: 'extra_emotional_markers',                name: 'Marcadores extras: sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia',             category: 'Diário',             order: 23, aliases: ['extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy'] },
  { key: 'monthly_comparative_charts',             name: 'Gráficos comparativos mensais',                                                                              category: 'Relatórios',         order: 24 },
  { key: 'advanced_monthly_report',                name: 'Relatório mensal avançado',                                                                                  category: 'Relatórios',         order: 25 },
  { key: 'personalized_content_recommendations',   name: 'Recomendações personalizadas de conteúdo',                                                                   category: 'Conteúdo',           order: 26 },
  { key: 'weekly_self_care_plan',                  name: 'Plano semanal de autocuidado',                                                                               category: 'Autocuidado',        order: 27 },
  { key: 'early_access_content',                   name: 'Acesso antecipado a novos conteúdos',                                                                        category: 'Conteúdo',           order: 28 },
  { key: 'monthly_message_guidance',               name: 'Orientação mensal por mensagem',                                                                             category: 'Suporte',            order: 29 },
  { key: 'monthly_psychoanalyst_session_30min',    name: '1 sessão mensal de 30 minutos com Psicanalista',                                                             category: 'Sessão/Profissional', order: 30 },
  { key: 'monthly_self_care_plan_review',          name: 'Revisão mensal do plano de autocuidado',                                                                     category: 'Sessão/Profissional', order: 31 },
  { key: 'professional_comment_on_monthly_report', name: 'Comentário individual sobre o relatório do mês',                                                             category: 'Sessão/Profissional', order: 32 },
  { key: 'maximum_priority_support',              name: 'Suporte prioritário máximo',                                                                                  category: 'Suporte',            order: 33 },
]

// ─── Mapa de aliases → chave principal ───────────────────────────────────────

export const ALIAS_TO_KEY: Record<string, string> = {}
for (const f of OFFICIAL_FEATURES) {
  if (f.aliases) {
    for (const alias of f.aliases) ALIAS_TO_KEY[alias] = f.key
  }
}

// ─── Acesso padrão por plano (qual feature está ativa em cada plano) ─────────

export const DEFAULT_PLAN_ACCESS: Record<PlanKey, string[]> = {
  free: [
    'articles_free',
    'basic_self_assessment',
    'wellbeing_diary_5_month',
    'simple_mood_checkin',
    'biweekly_auto_challenges',
    'limited_history',
    'ads_enabled',
  ],
  essential: [
    'articles_free',
    'basic_self_assessment',
    'wellbeing_diary_5_month',
    'simple_mood_checkin',
    'biweekly_auto_challenges',
    'limited_history',
    'ads_enabled',
    'diary_unlimited',
    'full_history',
    'weekly_assessments',
    'simple_evolution_charts',
    'guided_text_meditations',
    'guided_diary_notes',
    'monthly_pdf_reports',
    'diary_mood_symptoms_summary',
    'evolution_highlights_no_clinical_analysis',
    'emotional_exercise_library',
    'no_ads',
    'priority_email_support',
  ],
  therapeutic: [
    'articles_free',
    'basic_self_assessment',
    'wellbeing_diary_5_month',
    'simple_mood_checkin',
    'biweekly_auto_challenges',
    'limited_history',
    'ads_enabled',
    'diary_unlimited',
    'full_history',
    'weekly_assessments',
    'simple_evolution_charts',
    'guided_text_meditations',
    'guided_diary_notes',
    'monthly_pdf_reports',
    'diary_mood_symptoms_summary',
    'evolution_highlights_no_clinical_analysis',
    'emotional_exercise_library',
    'no_ads',
    'priority_email_support',
    'deep_questionnaire',
    'personalized_self_care_plan',
    'advanced_diary',
    'extra_emotional_markers',
    'monthly_comparative_charts',
    'advanced_monthly_report',
    'personalized_content_recommendations',
    'weekly_self_care_plan',
    'early_access_content',
    'monthly_message_guidance',
  ],
  'therapeutic-plus': [
    'articles_free',
    'basic_self_assessment',
    'wellbeing_diary_5_month',
    'simple_mood_checkin',
    'biweekly_auto_challenges',
    'limited_history',
    'ads_enabled',
    'diary_unlimited',
    'full_history',
    'weekly_assessments',
    'simple_evolution_charts',
    'guided_text_meditations',
    'guided_diary_notes',
    'monthly_pdf_reports',
    'diary_mood_symptoms_summary',
    'evolution_highlights_no_clinical_analysis',
    'emotional_exercise_library',
    'no_ads',
    'priority_email_support',
    'deep_questionnaire',
    'personalized_self_care_plan',
    'advanced_diary',
    'extra_emotional_markers',
    'monthly_comparative_charts',
    'advanced_monthly_report',
    'personalized_content_recommendations',
    'weekly_self_care_plan',
    'early_access_content',
    'monthly_message_guidance',
    'monthly_psychoanalyst_session_30min',
    'monthly_self_care_plan_review',
    'professional_comment_on_monthly_report',
    'maximum_priority_support',
  ],
}

// ─── Configuração dos planos ──────────────────────────────────────────────────

export const OFFICIAL_PLANS: OfficialPlan[] = [
  {
    key: 'free',
    label: 'Gratuito',
    price: 'R$ 0',
    priceValue: 0,
    period: 'para sempre',
    tagline: 'Para começar a se conhecer melhor, sem custo.',
  },
  {
    key: 'essential',
    label: 'Essencial',
    price: 'R$ 19,90',
    priceValue: 19.9,
    period: '/mês',
    tagline: 'Para acompanhar sua evolução emocional com continuidade.',
  },
  {
    key: 'therapeutic',
    label: 'Terapêutico',
    price: 'R$ 39,90',
    priceValue: 39.9,
    period: '/mês',
    tagline: 'Para uma experiência personalizada de autocuidado.',
    recommended: true,
  },
  {
    key: 'therapeutic-plus',
    label: 'Terapêutico Plus',
    price: 'R$ 79,90',
    priceValue: 79.9,
    period: '/mês',
    tagline: 'Para quem deseja acompanhamento individual mensal.',
  },
]

export const PLAN_KEYS: PlanKey[] = ['free', 'essential', 'therapeutic', 'therapeutic-plus']

// ─── Lista de exibição pública (visual resumida, com "Tudo do X") ─────────────

export const PUBLIC_PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: [
    'Artigos gratuitos',
    'Questionário básico de autoavaliação',
    'Diário de bem-estar com até 5 entradas por mês',
    'Registro simples de humor',
    'Mini-desafios quinzenais automatizados',
    'Histórico limitado',
    'Conteúdos com anúncios',
  ],
  essential: [
    'Tudo do Gratuito',
    'Diário ilimitado',
    'Histórico completo',
    'Avaliações semanais',
    'Gráficos simples de evolução',
    'Meditações guiadas em texto',
    'Notas guiadas no diário',
    'Relatórios mensais em PDF',
    'Resumo do diário, humor e sintomas',
    'Destaques de evolução, sem análise clínica',
    'Biblioteca de exercícios emocionais',
    'Sem anúncios',
    'Suporte por e-mail prioritário',
  ],
  therapeutic: [
    'Tudo do Essencial',
    'Questionário aprofundado',
    'Plano de autocuidado personalizado',
    'Diário avançado',
    'Marcadores extras: sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia',
    'Gráficos comparativos mensais',
    'Relatório mensal avançado',
    'Recomendações personalizadas de conteúdo',
    'Plano semanal de autocuidado',
    'Acesso antecipado a novos conteúdos',
    'Orientação mensal por mensagem',
  ],
  'therapeutic-plus': [
    'Tudo do Terapêutico',
    '1 sessão mensal de 30 minutos com Psicanalista',
    'Revisão mensal do plano de autocuidado',
    'Comentário individual sobre o relatório do mês',
    'Suporte prioritário máximo',
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve chave de alias para chave principal */
export function resolveKey(key: string): string {
  return ALIAS_TO_KEY[key] ?? key
}

/** Constrói um AccessMap de AccessMap padrão { planKey: { featureKey: boolean } } */
export function buildDefaultAccessMap(): Record<string, Record<string, boolean>> {
  const map: Record<string, Record<string, boolean>> = {}
  for (const planKey of PLAN_KEYS) {
    map[planKey] = {}
    for (const f of OFFICIAL_FEATURES) {
      map[planKey][f.key] = DEFAULT_PLAN_ACCESS[planKey].includes(f.key)
    }
  }
  return map
}
