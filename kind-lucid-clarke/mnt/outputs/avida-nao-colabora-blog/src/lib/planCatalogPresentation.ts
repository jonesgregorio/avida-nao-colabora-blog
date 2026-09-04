import { type PlanCompareRow, type PlanCompareValue } from './planComparison'
import { type PlanKey } from './officialPlans'
import {
  getCatalogPlanBenefits,
  type CatalogSurface,
  type PlanFeatureCatalog,
} from './planFeatureCatalog'

export interface CatalogBenefitView {
  key: string
  label: string
  description: string
}

const CURRENT_PLAN_BENEFITS: Record<PlanKey, CatalogBenefitView[]> = {
  free: [
    { key: 'checkin', label: 'Check-in diário — 1 por dia', description: 'Um momento rápido para registrar como você está hoje.' },
    { key: 'diary', label: 'Diário emocional — Até 5 dias/mês', description: 'Um espaço para registrar pensamentos, sentimentos e acontecimentos no seu ritmo.' },
    { key: 'voice', label: 'Diário por voz', description: 'Fale no seu ritmo e transforme sua fala em um registro.' },
    { key: 'questionnaires', label: 'Questionários de autoconhecimento — Seleção do Gratuito', description: 'Questionários para ajudar você a refletir e compreender diferentes aspectos do seu momento.' },
    { key: 'articles', label: 'Artigos e conteúdos', description: 'Informações e reflexões sobre emoções, autocuidado e bem-estar.' },
    { key: 'guided', label: 'Conteúdos Guiados — Seleção para começar', description: 'Uma seleção de exercícios, reflexões e práticas guiadas para começar.' },
    { key: 'history', label: 'Minha História — Visão inicial', description: 'Comece a visualizar os momentos que fazem parte da sua trajetória.' },
  ],
  essential: [
    { key: 'checkin', label: 'Check-in diário — 1 por dia', description: 'Um momento rápido para registrar como você está hoje.' },
    { key: 'diary', label: 'Diário emocional — Sem limite mensal', description: 'Registre seus dias no seu ritmo, sem limite de registros mensais.' },
    { key: 'voice', label: 'Diário por voz', description: 'Fale no seu ritmo e transforme sua fala em um registro.' },
    { key: 'questionnaires', label: 'Questionários de autoconhecimento — Questionários do Essencial', description: 'Acesso aos questionários disponíveis para o plano Essencial.' },
    { key: 'articles', label: 'Artigos e conteúdos', description: 'Informações e reflexões sobre emoções, autocuidado e bem-estar.' },
    { key: 'guided', label: 'Conteúdos Guiados — Acesso completo', description: 'Exercícios, reflexões e práticas para diferentes momentos e necessidades.' },
    { key: 'map', label: 'Mapa Emocional — Completo', description: 'Visualize como emoções, contextos e sintomas aparecem e evoluem nos seus registros.' },
    { key: 'discoveries', label: 'Descobertas', description: 'Perceba padrões, repetições e conexões que podem passar despercebidos no dia a dia.' },
    { key: 'history', label: 'Minha História — Completa', description: 'Acompanhe mudanças, períodos marcantes e temas que atravessam sua trajetória ao longo do tempo.' },
    { key: 'weekly', label: 'Relatório Semanal', description: 'Uma leitura organizada dos principais pontos que apareceram nos seus registros durante a semana.' },
    { key: 'garden', label: 'Meu Jardim', description: 'Veja sua jornada ganhar vida em um espaço que cresce junto com seus momentos de cuidado.' },
  ],
  plus: [
    { key: 'checkin', label: 'Check-in diário — 1 por dia', description: 'Um momento rápido para registrar como você está hoje.' },
    { key: 'diary', label: 'Diário emocional — Sem limite mensal', description: 'Registre seus dias no seu ritmo, sem limite de registros mensais.' },
    { key: 'voice', label: 'Diário por voz', description: 'Fale no seu ritmo e transforme sua fala em um registro.' },
    { key: 'deepening', label: 'Aprofundamentos do Diário — Até 3 por dia', description: 'Volte ao seu registro ao longo do dia para acrescentar novos momentos, pensamentos ou sentimentos.' },
    { key: 'questionnaires', label: 'Questionários de autoconhecimento — Questionários do Plus', description: 'Acesso aos questionários disponíveis para o plano Plus.' },
    { key: 'articles', label: 'Artigos e conteúdos', description: 'Informações e reflexões sobre emoções, autocuidado e bem-estar.' },
    { key: 'guided', label: 'Conteúdos Guiados — Acesso completo', description: 'Exercícios, reflexões e práticas para diferentes momentos e necessidades.' },
    { key: 'map', label: 'Mapa Emocional — Completo', description: 'Visualize como emoções, contextos e sintomas aparecem e evoluem nos seus registros.' },
    { key: 'discoveries', label: 'Descobertas', description: 'Perceba padrões, repetições e conexões que podem passar despercebidos no dia a dia.' },
    { key: 'history', label: 'Minha História — Completa', description: 'Acompanhe mudanças, períodos marcantes e temas que atravessam sua trajetória ao longo do tempo.' },
    { key: 'weekly', label: 'Relatório Semanal', description: 'Uma leitura organizada dos principais pontos que apareceram nos seus registros durante a semana.' },
    { key: 'garden', label: 'Meu Jardim', description: 'Veja sua jornada ganhar vida em um espaço que cresce junto com seus momentos de cuidado.' },
    { key: 'monthly-report', label: 'Relatório Mensal Aprofundado', description: 'Entenda o que o mês mostrou sobre seus padrões, mudanças, conexões e momentos importantes.' },
    { key: 'self-care', label: 'Plano de Autocuidado Mensal', description: 'Transforme o que apareceu nos seus registros em pequenas possibilidades de cuidado para o próximo período.' },
    { key: 'guidance', label: 'Orientação Mensal', description: 'Escolha uma questão importante do seu momento e receba uma orientação personalizada para organizar seus próximos passos.' },
  ],
}

const OWN_PLAN_LABELS: Record<PlanKey, string[]> = {
  free: CURRENT_PLAN_BENEFITS.free.map(item => item.label),
  essential: [
    'Diário emocional — Sem limite mensal',
    'Questionários de autoconhecimento — Questionários do Essencial',
    'Conteúdos Guiados — Acesso completo',
    'Mapa Emocional — Completo',
    'Descobertas',
    'Minha História — Completa',
    'Relatório Semanal',
    'Meu Jardim',
  ],
  plus: [
    'Aprofundamentos do Diário — Até 3 por dia',
    'Questionários de autoconhecimento — Questionários do Plus',
    'Relatório Mensal Aprofundado',
    'Plano de Autocuidado Mensal',
    'Orientação Mensal',
  ],
}

// catalogKey liga cada linha ao catálogo (plan_features) — permite que o Admin
// renomeie a linha e o texto por plano (aba "Catálogo de funcionalidades")
// sem editar código; ver buildCatalogComparisonRows abaixo.
const CURRENT_COMPARISON_ROWS: PlanCompareRow[] = [
  { label: 'Check-in diário', catalogKey: 'checkin_daily', values: { free: '1 por dia', essential: '1 por dia', plus: '1 por dia' } },
  { label: 'Diário emocional', catalogKey: 'diary_unlimited', values: { free: 'Até 5 dias/mês', essential: 'Sem limite', plus: 'Sem limite' } },
  { label: 'Diário por voz', catalogKey: 'diary_voice', values: { free: true, essential: true, plus: true } },
  { label: 'Aprofundamentos do Diário', catalogKey: 'diary_deepenings', values: { free: false, essential: false, plus: 'Até 3 por dia' } },
  { label: 'Questionários de autoconhecimento', catalogKey: 'basic_self_assessment', values: { free: 'Seleção', essential: 'Essencial', plus: 'Plus' } },
  { label: 'Artigos e conteúdos', catalogKey: 'articles_free', values: { free: true, essential: true, plus: true } },
  { label: 'Conteúdos Guiados', catalogKey: 'emotional_exercise_library', values: { free: 'Seleção', essential: 'Completo', plus: 'Completo' } },
  { label: 'Mapa Emocional', catalogKey: 'diary_mood_symptoms_summary', values: { free: false, essential: 'Completo', plus: 'Completo' } },
  { label: 'Descobertas', catalogKey: 'discoveries', values: { free: false, essential: true, plus: true } },
  { label: 'Minha História', catalogKey: 'full_history', values: { free: 'Visão inicial', essential: 'Completa', plus: 'Completa' } },
  { label: 'Relatório Semanal', catalogKey: 'weekly_assessments', values: { free: false, essential: true, plus: true } },
  { label: 'Meu Jardim', catalogKey: 'my_garden', values: { free: false, essential: true, plus: true } },
  { label: 'Relatório Mensal Aprofundado', catalogKey: 'advanced_monthly_report', values: { free: false, essential: false, plus: true } },
  { label: 'Plano de Autocuidado Mensal', catalogKey: 'personalized_self_care_plan', values: { free: false, essential: false, plus: true } },
  { label: 'Orientação Mensal', catalogKey: 'monthly_message_guidance', values: { free: false, essential: false, plus: true } },
]

function commercialBenefits(catalog: PlanFeatureCatalog, plan: PlanKey, surface: CatalogSurface): CatalogBenefitView[] {
  return getCatalogPlanBenefits(catalog, plan, surface)
    .filter(item => item.key.startsWith('commercial:') && item.key !== 'professional_comment_on_monthly_report')
    .map(item => ({ key: item.key, label: item.label, description: item.description }))
}

export function buildCatalogPlanLabels(
  catalog: PlanFeatureCatalog,
  surface: CatalogSurface,
): Record<PlanKey, string[]> {
  return {
    free: [...OWN_PLAN_LABELS.free, ...commercialBenefits(catalog, 'free', surface).map(item => item.label)],
    essential: [...OWN_PLAN_LABELS.essential, ...commercialBenefits(catalog, 'essential', surface).map(item => item.label)],
    plus: [...OWN_PLAN_LABELS.plus, ...commercialBenefits(catalog, 'plus', surface).map(item => item.label)],
  }
}

export function buildCatalogPlanBenefits(
  catalog: PlanFeatureCatalog,
  plan: PlanKey,
  surface: CatalogSurface,
): CatalogBenefitView[] {
  return [...CURRENT_PLAN_BENEFITS[plan], ...commercialBenefits(catalog, plan, surface)]
}

export function buildCatalogComparisonRows(catalog: PlanFeatureCatalog): PlanCompareRow[] {
  const byKey = new Map(catalog.items.map(item => [item.key, item]))

  const system: PlanCompareRow[] = CURRENT_COMPARISON_ROWS
    .filter(row => {
      const item = row.catalogKey ? byKey.get(row.catalogKey) : null
      return !item || (item.isActive && item.showOnComparison)
    })
    .map(row => {
      const item = row.catalogKey ? byKey.get(row.catalogKey) : null
      if (!item) return row
      return {
        label: item.name.trim() || row.label,
        catalogKey: row.catalogKey,
        values: {
          free: item.plans.free.label?.trim() || row.values.free,
          essential: item.plans.essential.label?.trim() || row.values.essential,
          plus: item.plans.plus.label?.trim() || row.values.plus,
        } as Record<PlanKey, PlanCompareValue>,
      }
    })

  const commercial: PlanCompareRow[] = catalog.items
    .filter(item => {
      if (!item.isActive || !item.showOnComparison) return false
      return item.kind === 'commercial' && item.key !== 'professional_comment_on_monthly_report'
    })
    .map(item => ({
      label: item.name,
      values: {
        free: item.plans.free.enabled,
        essential: item.plans.essential.enabled,
        plus: item.plans.plus.enabled,
      } as Record<PlanKey, PlanCompareValue>,
    }))

  return [...system, ...commercial]
}
