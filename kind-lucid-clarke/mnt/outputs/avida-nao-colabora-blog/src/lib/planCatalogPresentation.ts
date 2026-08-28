import { PLAN_COMPARE_ROWS, type PlanCompareRow, type PlanCompareValue } from './planComparison'
import { type PlanKey } from './officialPlans'
import {
  getCatalogPlanBenefits,
  type CatalogSurface,
  type PlanFeatureCatalog,
} from './planFeatureCatalog'

const COMPARISON_FEATURE_BY_ROW: Record<string, string> = {
  'Diário emocional': 'wellbeing_diary_5_month',
  'Questionário inicial': 'basic_self_assessment',
  'Mapa emocional e gráficos': 'diary_mood_symptoms_summary',
  'Conteúdos guiados': 'emotional_exercise_library',
  'Relatório semanal automático': 'weekly_assessments',
  'Plano de autocuidado mensal': 'personalized_self_care_plan',
  'Relatório mensal aprofundado': 'advanced_monthly_report',
  'Comentário profissional sobre o relatório': 'professional_comment_on_monthly_report',
  'Orientação mensal por mensagem': 'monthly_message_guidance',
}

export interface CatalogBenefitView {
  key: string
  label: string
  description: string
}

export function buildCatalogPlanLabels(
  catalog: PlanFeatureCatalog,
  surface: CatalogSurface,
): Record<PlanKey, string[]> {
  return {
    free: getCatalogPlanBenefits(catalog, 'free', surface).map(item => item.label),
    essential: getCatalogPlanBenefits(catalog, 'essential', surface).map(item => item.label),
    plus: getCatalogPlanBenefits(catalog, 'plus', surface).map(item => item.label),
  }
}

export function buildCatalogPlanBenefits(
  catalog: PlanFeatureCatalog,
  plan: PlanKey,
  surface: CatalogSurface,
): CatalogBenefitView[] {
  return getCatalogPlanBenefits(catalog, plan, surface).map(item => ({
    key: item.key,
    label: item.label,
    description: item.description,
  }))
}

export function buildCatalogComparisonRows(catalog: PlanFeatureCatalog): PlanCompareRow[] {
  const byKey = new Map(catalog.items.map(item => [item.key, item]))
  const official = PLAN_COMPARE_ROWS.flatMap(row => {
    const featureKey = COMPARISON_FEATURE_BY_ROW[row.label]
    if (!featureKey) return [{ ...row, values: { ...row.values } }]
    const item = byKey.get(featureKey)
    if (item && (!item.isActive || !item.showOnComparison)) return []
    return [{ ...row, label: item?.name || row.label, values: { ...row.values } }]
  })

  const commercial: PlanCompareRow[] = catalog.items
    .filter(item => item.kind === 'commercial' && item.isActive && item.showOnComparison)
    .map(item => ({
      label: item.name,
      values: {
        free: item.plans.free.enabled,
        essential: item.plans.essential.enabled,
        plus: item.plans.plus.enabled,
      } as Record<PlanKey, PlanCompareValue>,
    }))

  return [...official, ...commercial]
}
