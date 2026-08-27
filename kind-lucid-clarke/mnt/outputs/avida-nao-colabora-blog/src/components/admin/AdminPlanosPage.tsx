import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ArrowLeft, SlidersHorizontal, Tags } from 'lucide-react'
import AdminPlans from './AdminPlans'
import AdminPlanFeatureCatalog from './AdminPlanFeatureCatalog'
import AdminBillingPriceEditor from './AdminBillingPriceEditor'
import { supabase } from '../../lib/supabase'
import { OFFICIAL_PLANS, type PlanKey } from '../../lib/officialPlans'
import {
  buildFallbackPlanFeatureCatalog,
  getCatalogPlanBenefits,
  loadPlanFeatureCatalog,
  type PlanFeatureCatalog,
} from '../../lib/planFeatureCatalog'

type View = 'overview' | 'permissions' | 'catalog'

const RULE_FEATURES: { key: string; values: Record<PlanKey, string> }[] = [
  { key: 'wellbeing_diary_5_month', values: { free: 'Básico', essential: 'Completo', plus: 'Completo' } },
  { key: 'diary_mood_symptoms_summary', values: { free: 'Inicial', essential: 'Completo', plus: 'Completo' } },
  { key: 'emotional_exercise_library', values: { free: 'Parcial', essential: 'Completo', plus: 'Completo' } },
  { key: 'personalized_self_care_plan', values: { free: 'Não incluso', essential: 'Não incluso', plus: 'Mensal' } },
  { key: 'monthly_message_guidance', values: { free: 'Não incluso', essential: 'Não incluso', plus: '1 por mês' } },
]

export default function AdminPlanosPage() {
  const [view, setView] = useState<View>('overview')
  const [dynamicPrices, setDynamicPrices] = useState<Record<string, string>>({})
  const [catalog, setCatalog] = useState<PlanFeatureCatalog>(() => buildFallbackPlanFeatureCatalog())

  useEffect(() => {
    if (view !== 'overview') return
    void supabase.rpc('get_public_plan_pricing').then(({ data }) => {
      if (!Array.isArray(data)) return
      const next: Record<string, string> = {}
      for (const row of data as { plan_key: string; display_price: string }[]) next[row.plan_key] = row.display_price
      setDynamicPrices(next)
    })
    void loadPlanFeatureCatalog().then(setCatalog)
  }, [view])

  const displayPlans = useMemo(() => OFFICIAL_PLANS.map(plan => {
    const price = dynamicPrices[plan.key] || plan.price
    return {
      ...plan,
      displayPrice: plan.key === 'free' ? price : `${price}/mês`,
      benefits: getCatalogPlanBenefits(catalog, plan.key, 'pricing').map(item => item.label),
    }
  }), [dynamicPrices, catalog])

  const rules = useMemo(() => {
    const byKey = new Map(catalog.items.map(item => [item.key, item]))
    const official = RULE_FEATURES.map(rule => ({
      key: rule.key,
      label: byKey.get(rule.key)?.name || rule.key,
      values: rule.values,
    }))
    const commercial = catalog.items
      .filter(item => item.kind === 'commercial' && item.isActive && item.showOnComparison)
      .map(item => ({
        key: item.key,
        label: item.name,
        values: {
          free: item.plans.free.enabled ? 'Incluído' : 'Não incluso',
          essential: item.plans.essential.enabled ? 'Incluído' : 'Não incluso',
          plus: item.plans.plus.enabled ? 'Incluído' : 'Não incluso',
        } as Record<PlanKey, string>,
      }))
    return [...official, ...commercial]
  }, [catalog])

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
        <strong>Como funciona:</strong> em “Funcionalidades e textos” você altera o que o cliente lê. Em “Preços e permissões” ficam as regras técnicas que realmente liberam recursos. Renomear um benefício nunca muda sua chave interna nem o acesso do plano.
      </div>

      <AdminBillingPriceEditor />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayPlans.map(plan => (
          <div key={plan.key} className={`bg-white rounded-2xl p-6 flex flex-col ${plan.recommended ? 'border-2 border-forest-900 shadow-md' : 'border border-line'}`}>
            {plan.recommended && <span className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full bg-mint text-forest-700 mb-2">Mais escolhido</span>}
            <h2 className="font-serif text-2xl text-forest-900">{plan.label}</h2>
            <p className="text-sm text-ink-soft">{plan.tagline}</p>
            <div className="font-serif text-3xl text-forest-900 my-3">{plan.displayPrice}</div>
            <ul className="space-y-2 flex-1 mb-5">
              {plan.benefits.map(benefit => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-ink"><span className="text-forest-600 font-bold leading-5">✓</span>{benefit}</li>
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
            <h2 className="font-serif text-2xl text-forest-900">Regras de acesso</h2>
            <p className="text-xs text-ink-soft mt-1">Os nomes vêm do mesmo catálogo usado no site; os valores abaixo continuam representando a regra de cada plano.</p>
          </div>
          <button onClick={() => setView('permissions')} className="text-xs font-medium text-forest-700 hover:text-forest-900">Editar permissões técnicas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead><tr className="border-b border-line"><th className="text-left px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Funcionalidade</th><th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Gratuito</th><th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide bg-mint/30">Essencial</th><th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Plus</th></tr></thead>
            <tbody>{rules.map(rule => <tr key={rule.key} className="border-b border-line last:border-0"><td className="px-4 py-3 text-forest-900 font-medium">{rule.label}</td><td className="px-4 py-3 text-center text-ink">{rule.values.free}</td><td className="px-4 py-3 text-center text-ink bg-mint/30">{rule.values.essential}</td><td className="px-4 py-3 text-center text-ink">{rule.values.plus}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
