import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ArrowLeft, SlidersHorizontal, Tags, Info, X, Check, CreditCard, ShieldCheck } from 'lucide-react'
import AdminPlans from './AdminPlans'
import AdminPlanFeatureCatalog from './AdminPlanFeatureCatalog'
import AdminBillingPriceEditor from './AdminBillingPriceEditor'
import AdminPlanConsistencyCheck from './AdminPlanConsistencyCheck'
import { OFFICIAL_PLANS } from '../../lib/officialPlans'
import { usePlanPricing } from '../../lib/planPricing'
import {
  buildFallbackPlanFeatureCatalog,
  getCatalogPlanBenefits,
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
    const presentedBenefits = buildCatalogPlanBenefits(catalog, plan.key, 'pricing')
    const catalogBenefits = getCatalogPlanBenefits(catalog, plan.key, 'pricing')
    return {
      ...plan,
      displayPrice: plan.key === 'free' ? price : `${price}/mês`,
      benefits: presentedBenefits.length > 0
        ? presentedBenefits
        : catalogBenefits.map(item => ({ key: item.key, label: item.label, description: item.description })),
    }
  }), [prices, catalog])

  const rules = useMemo(() => buildCatalogComparisonRows(catalog), [catalog])

  if (view !== 'overview') {
    return (
      <div className="admin-page-pad">
        <button onClick={() => setView('overview')} className="admin-btn-secondary mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar aos planos
        </button>
        <section className="admin-card overflow-hidden">
          {view === 'permissions' ? <AdminPlans /> : <AdminPlanFeatureCatalog />}
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page-pad space-y-5">
      <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-kicker">Assinaturas e acesso</p>
          <h1 className="font-serif text-3xl text-forest-900">Planos e assinaturas</h1>
          <p className="admin-subtitle mt-1">Gerencie preços, textos comerciais e permissões sem misturar apresentação com regras técnicas de acesso.</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => setView('catalog')} className="admin-btn-soft"><Tags className="w-4 h-4" /> Funcionalidades e textos</button>
          <button onClick={() => setView('permissions')} className="admin-btn-secondary"><SlidersHorizontal className="w-4 h-4" /> Preços e permissões</button>
          <button onClick={() => { void loadPlanFeatureCatalog().then(setCatalog) }} title="Atualizar catálogo" className="admin-btn-secondary px-3">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </section>

      <div className="admin-metric-grid">
        <div className="admin-metric"><p className="admin-metric-label">Planos disponíveis</p><p className="admin-metric-value">{displayPlans.length}</p></div>
        <div className="admin-metric"><p className="admin-metric-label">Plano gratuito</p><p className="admin-metric-value">R$ 0</p></div>
        <div className="admin-metric"><p className="admin-metric-label">Gestão comercial</p><p className="text-sm font-semibold text-forest-900 mt-1">Stripe + catálogo interno</p></div>
        <div className="admin-metric"><p className="admin-metric-label">Consistência</p><p className="text-sm font-semibold text-forest-900 mt-1">Preços e permissões separados</p></div>
      </div>

      <section className="admin-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-mint flex items-center justify-center text-forest-700 flex-shrink-0"><ShieldCheck className="w-5 h-5" /></span>
          <div>
            <h2 className="font-serif text-lg text-forest-900">Estrutura segura de gestão</h2>
            <p className="text-sm text-ink-soft mt-1">Os cards usam a mesma nomenclatura comercial exibida ao usuário. As regras técnicas que liberam recursos continuam separadas em “Preços e permissões”.</p>
          </div>
        </div>
      </section>

      <AdminBillingPriceEditor />
      <AdminPlanConsistencyCheck />

      <section>
        <div className="admin-section-title">
          <div>
            <h2 className="font-serif text-xl text-forest-900">Planos atuais</h2>
            <p className="text-xs text-ink-soft mt-1">Edite apresentação, benefícios e regras sem perder a leitura comparativa.</p>
          </div>
          <CreditCard className="w-5 h-5 text-forest-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displayPlans.map(plan => (
            <div key={plan.key} className={`admin-card p-6 flex flex-col ${plan.recommended ? 'ring-1 ring-forest-700/20 shadow-md' : ''}`}>
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
              <button onClick={() => setView('catalog')} className={plan.recommended ? 'admin-btn-primary w-full' : 'admin-btn-secondary w-full'}>
                Editar textos e funcionalidades
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card p-5 sm:p-6">
        <div className="admin-section-title">
          <div>
            <h2 className="font-serif text-2xl text-forest-900">Matriz atual dos planos</h2>
            <p className="text-xs text-ink-soft mt-1">A comparação usa os mesmos nomes e níveis apresentados na experiência do usuário.</p>
          </div>
          <button onClick={() => setView('permissions')} className="admin-btn-secondary">Editar permissões técnicas</button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr>
                <th className="text-left px-4 py-3">Funcionalidade</th>
                <th className="px-4 py-3">Gratuito</th>
                <th className="px-4 py-3 bg-mint/30">Essencial</th>
                <th className="px-4 py-3">Plus</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.label}>
                  <td className="px-4 py-3 text-forest-900 font-medium">{rule.label}</td>
                  <td className="px-4 py-3 text-center text-ink"><AccessValue value={rule.values.free} /></td>
                  <td className="px-4 py-3 text-center text-ink bg-mint/30"><AccessValue value={rule.values.essential} /></td>
                  <td className="px-4 py-3 text-center text-ink"><AccessValue value={rule.values.plus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
