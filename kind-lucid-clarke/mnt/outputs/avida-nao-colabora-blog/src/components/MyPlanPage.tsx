import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import MyPlanPageCore from './MyPlanPageCore'
import { buildFallbackPlanFeatureCatalog, loadPlanFeatureCatalog, type PlanFeatureCatalog } from '../lib/planFeatureCatalog'
import { buildCatalogComparisonRows, buildCatalogPlanBenefits, buildCatalogPlanLabels } from '../lib/planCatalogPresentation'
import { normalizePlan } from '../lib/officialPlans'
import { applyPlainPlanLanguage } from '../lib/plainPlanLanguage'

export default function MyPlanPage(props: ComponentProps<typeof MyPlanPageCore>) {
  const [catalog, setCatalog] = useState<PlanFeatureCatalog>(() => buildFallbackPlanFeatureCatalog())
  const languageRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    void loadPlanFeatureCatalog().then(next => {
      if (active) setCatalog(next)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const root = languageRootRef.current
    if (!root) return

    applyPlainPlanLanguage(root)
    const observer = new MutationObserver(() => applyPlainPlanLanguage(root))
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title'],
    })

    return () => observer.disconnect()
  }, [])

  const currentPlan = normalizePlan(props.profile?.plan)
  const planFeatures = useMemo(() => buildCatalogPlanLabels(catalog, 'upgrade'), [catalog])
  const compareRows = useMemo(() => buildCatalogComparisonRows(catalog), [catalog])
  const currentPlanBenefits = useMemo(() => buildCatalogPlanBenefits(catalog, currentPlan, 'my_plan'), [catalog, currentPlan])

  return (
    <div ref={languageRootRef}>
      <MyPlanPageCore {...props} planFeatures={planFeatures} compareRows={compareRows} currentPlanBenefits={currentPlanBenefits} />
    </div>
  )
}
