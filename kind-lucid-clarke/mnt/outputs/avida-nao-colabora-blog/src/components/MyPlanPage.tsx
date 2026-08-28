import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import MyPlanPageCore from './MyPlanPageCore'
import { buildFallbackPlanFeatureCatalog, loadPlanFeatureCatalog, type PlanFeatureCatalog } from '../lib/planFeatureCatalog'
import { buildCatalogComparisonRows, buildCatalogPlanBenefits, buildCatalogPlanLabels } from '../lib/planCatalogPresentation'
import { normalizePlan } from '../lib/officialPlans'

export default function MyPlanPage(props: ComponentProps<typeof MyPlanPageCore>) {
  const [catalog, setCatalog] = useState<PlanFeatureCatalog>(() => buildFallbackPlanFeatureCatalog())

  useEffect(() => {
    let active = true
    void loadPlanFeatureCatalog().then(next => {
      if (active) setCatalog(next)
    })
    return () => { active = false }
  }, [])

  const currentPlan = normalizePlan(props.profile?.plan)
  const planFeatures = useMemo(() => buildCatalogPlanLabels(catalog, 'upgrade'), [catalog])
  const compareRows = useMemo(() => buildCatalogComparisonRows(catalog), [catalog])
  const currentPlanBenefits = useMemo(() => buildCatalogPlanBenefits(catalog, currentPlan, 'my_plan'), [catalog, currentPlan])

  return <MyPlanPageCore {...props} planFeatures={planFeatures} compareRows={compareRows} currentPlanBenefits={currentPlanBenefits} />
}
