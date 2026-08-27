import { useEffect, useState, type ComponentProps } from 'react'
import MyPlanPageCore from './MyPlanPageCore'
import {
  buildFallbackPlanFeatureCatalog,
  getCatalogPlanBenefits,
  loadPlanFeatureCatalog,
  type PlanFeatureCatalog,
} from '../lib/planFeatureCatalog'
import { PUBLIC_PLAN_FEATURES, type PlanKey } from '../lib/officialPlans'
import { PLAN_COMPARE_ROWS, type PlanCompareRow } from '../lib/planComparison'

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

const BASE_COMPARE_ROWS: PlanCompareRow[] = PLAN_COMPARE_ROWS.map(row => ({
  label: row.label,
  values: { ...row.values },
}))

function applyCatalogPresentation(catalog: PlanFeatureCatalog) {
  for (const plan of ['free', 'essential', 'plus'] as PlanKey[]) {
    PUBLIC_PLAN_FEATURES[plan] = getCatalogPlanBenefits(catalog, plan, 'upgrade').map(item => item.label)
  }

  const byKey = new Map(catalog.items.map(item => [item.key, item]))
  const officialRows = BASE_COMPARE_ROWS.flatMap(row => {
    const featureKey = COMPARISON_FEATURE_BY_ROW[row.label]
    if (!featureKey) return [row]
    const item = byKey.get(featureKey)
    if (item && (!item.isActive || !item.showOnComparison)) return []
    return [{ ...row, label: item?.name || row.label, values: { ...row.values } }]
  })
  const commercialRows: PlanCompareRow[] = catalog.items
    .filter(item => item.kind === 'commercial' && item.isActive && item.showOnComparison)
    .map(item => ({
      label: item.name,
      values: {
        free: item.plans.free.enabled,
        essential: item.plans.essential.enabled,
        plus: item.plans.plus.enabled,
      },
    }))

  PLAN_COMPARE_ROWS.splice(0, PLAN_COMPARE_ROWS.length, ...officialRows, ...commercialRows)
}

export default function MyPlanPage(props: ComponentProps<typeof MyPlanPageCore>) {
  const [catalog, setCatalog] = useState<PlanFeatureCatalog>(() => buildFallbackPlanFeatureCatalog())

  // O núcleo financeiro/assinatura permanece intocado. Esta camada altera
  // exclusivamente os rótulos de apresentação consumidos por ele.
  applyCatalogPresentation(catalog)

  useEffect(() => {
    let active = true
    void loadPlanFeatureCatalog().then(next => {
      if (active) setCatalog(next)
    })
    return () => { active = false }
  }, [])

  return <MyPlanPageCore {...props} />
}
