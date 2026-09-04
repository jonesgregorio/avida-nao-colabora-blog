import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ArrowLeft, SlidersHorizontal, Tags, Info, X, Check } from 'lucide-react'
import AdminPlans from './AdminPlans'
import AdminPlanFeatureCatalog from './AdminPlanFeatureCatalog'
import AdminBillingPriceEditor from './AdminBillingPriceEditor'
import AdminPlanConsistencyCheck from './AdminPlanConsistencyCheck'
import { OFFICIAL_PLANS } from '../../lib/officialPlans'
import { usePlanPricing } from '../../lib/planPricing'
import {
  buildFallbackPlanFeatureCatalog,
  loadPlanFeatureCatalog,
  type PlanFeatureCatalog,
} from '../../lib/planFeatureCatalog'
import {
  buildCatalogComparisonRows,
  buildCatalogPlanBenefits,
  type CatalogBenefitView,
} from '../../lib/planCatalogPresentation'

type View = 'overview' | 'permissions' | 'catalog'

export default function AdminPlanosPage() {
  const [view, setView] = useState<View>('overview')
  const { prices } = usePlanPricing()
  const [catalog, setCatalog] = useState<PlanFeatureCatalog>(() => buildFallbackPlanFeatureCatalog())
  const [infoBenefit, setInfoBenefit] = useState<CatalogBenefitView | null>(null)

  useEffect(() => {
    if (view !== 'overview') return
    void loadPlanFeatureCatalog().then(setCatalog)
  }, [view])

  const displayPlans = useMemo(() => OFFICIAL_PLANS.map(plan => {
    const price = prices[plan.key]?.display || plan.price
    return {
      ...plan,
      displayPrice: plan.key === 'free' ? price : `${price}/mês`,
      benefits: buildCatalogPlanBenefits(catalog, plan.key, 'pricing'),
    }
  }), [prices, catalog])

  const rules = useMemo(() => buildCatalogComparisonRows(catalog), [catalog])

  if (view !== 'overview') {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button onClick={() => setView('overview')} className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar aos planos
        </button>
        {view === 'permissions' ? <AdminPlans /> : <AdminPlanFeatureCatalog />}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Planos e assinaturas</h1>
          <p className="text-sm text-ink-soft mt-1">Preços, textos comerciais e permissões ficam separados para evitar alterações acidentais no acesso.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setView('catalog')} className="inline-flex items-center gap-2 border border-forest-200 bg-mint/40 px-4 py-2 rounded-xl text-sm text-forest-800 font-medium hover:bg-mint transition-colors">
            <Tags className="w-4 h-4" /> Funcionalidades e textos
          </button>
          <button onClick={() => setView('permissions')} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 font-medium hover:border-forest-300 transition-colors">
            <SlidersHorizontal className="w-4 h-4" /> Preços e permissões
          </button>
          <button onClick={() => { void loadPlanFeatureCatalog().then(setCatalog) }} title="Atualizar catálogo" className="inline-flex items-center justify-center border border-line bg-white p-2.5 rounded-xl text-forest-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-forest-100 bg-mint/30 p-4 text-sm text-forest-800">
        <strong>Como funciona:</strong> os cards abaixo usam a mesma nomenclatura comercial atual exibida ao usuário. O símbolo ⓘ mostra os detalhes sem poluir a leitura. Em “Preços e permissões” continuam as regras técnicas que realmente liberam recursos.
      </div>

      <AdminBillingPriceEditor />
      <AdminPlanConsistencyCheck />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayPlans.map(plan => (
          <div key={plan.key} className={`bg-white rounded-2xl p-6 flex flex-col ${plan.recommended ? 'border-2 border-forest-900 shadow-md' : 'border border-line'}`}>
            {plan.recommended && <span className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full bg-mint text-forest-700 mb-2">Mais escolhido</span>}
            <h2 className="font-serif text-2xl text-forest-900">{plan.label}</h2>
            <p className="text-sm text-ink-soft">{plan.tagline}</p>
            <div className="font-serif text-3xl text-forest-900 my-3">{plan.displayPrice}</div>
            <ul className="space-y-2 flex-1 mb-5">
              {plan.benefits.map(benefit => (
                <li key={benefit.key} className="flex items-start gap-2 text-sm text-ink">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-forest-600" />
                  <span className="min-w-0 inline-flex items-start gap-1.5">
                    <span>{benefit.label}</span>
                    {benefit.description ? (
                      <button
                        type="button"
                        onClick={() => setInfoBenefit(benefit)}
                        className="inline-flex items-center justify-center text-ink-soft hover:text-forest-800 transition-colors flex-shrink-0 mt-0.5"
                        aria-label={`Saiba mais sobre ${benefit.label}`}
                        title={`Detalhes de ${benefit.label}`}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={() => setView('catalog')} className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${plan.recommended ? 'bg-forest-900 text-white hover:bg-forest-800' : 'border border-line text-forest-800 hover:border-forest-300'}`}>
              Editar textos e funcionalidades
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 mt-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-serif text-2xl text-forest-900">Matriz atual dos planos</h2>
            <p className="text-xs text-ink-soft mt-1">A comparação abaixo usa os mesmos nomes e níveis apresentados na experiência do usuário.</p>
          </div>
          <button onClick={() => setView('permissions')} className="text-xs font-medium text-forest-700 hover:text-forest-900">Editar permissões técnicas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Funcionalidade</th>
                <th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Gratuito</th>
                <th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide bg-mint/30">Essencial</th>
                <th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Plus</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.label} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-forest-900 font-medium">{rule.label}</td>
                  <td className="px-4 py-3 text-center text-ink"><AccessValue value={rule.values.free} /></td>
                  <td className="px-4 py-3 text-center text-ink bg-mint/30"><AccessValue value={rule.values.essential} /></td>
                  <td className="px-4 py-3 text-center text-ink"><AccessValue value={rule.values.plus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {infoBenefit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Informações sobre ${infoBenefit.label}`}>
          <button type="button" className="absolute inset-0 bg-forest-950/35 backdrop-blur-[2px]" onClick={() => setInfoBenefit(null)} aria-label="Fechar informações" />
          <div className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] border border-line bg-paper shadow-2xl p-6 sm:p-7">
            <button type="button" onClick={() => setInfoBenefit(null)} className="absolute right-5 top-5 w-8 h-8 rounded-full hover:bg-mint/60 inline-flex items-center justify-center text-ink-soft hover:text-forest-900" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-mint flex items-center justify-center text-forest-700 mb-4"><Info className="w-5 h-5" /></div>
            <h3 className="font-serif text-2xl text-forest-950 pr-10">{infoBenefit.label}</h3>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{infoBenefit.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function AccessValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-forest-600 inline" aria-label="Incluído" />
  if (value === false) return <span className="text-ink-soft/50" aria-label="Não incluído">—</span>
  return <span>{value}</span>
}
