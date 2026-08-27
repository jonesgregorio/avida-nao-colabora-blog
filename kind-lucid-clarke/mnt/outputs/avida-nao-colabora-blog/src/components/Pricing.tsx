import { useEffect, useMemo, useState } from 'react'
import { Plan } from '../types'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'
import { Check, Loader2, Sprout, Star, LineChart, ShieldCheck } from 'lucide-react'
import { PLAN_COMPARE_ROWS, type PlanCompareValue } from '../lib/planComparison'
import { OFFICIAL_PLANS, normalizePlan, type PlanKey } from '../lib/officialPlans'
import {
  buildFallbackPlanFeatureCatalog,
  getCatalogPlanBenefits,
  loadPlanFeatureCatalog,
  type PlanFeatureCatalog,
} from '../lib/planFeatureCatalog'
import { resolvePricingPlanAction } from '../lib/pricingPlanAction'

interface PricingProps {
  user: unknown
  currentPlan: Plan
  onNavigateAuth: () => void
}

const PLAN_PRESENTATION: Record<PlanKey, {
  Icon: typeof Sprout
  iconBg: string
  iconColor: string
  cta: string
  coral?: boolean
}> = {
  free: { Icon: Sprout, iconBg: 'bg-mint', iconColor: 'text-forest-600', cta: 'Começar agora' },
  essential: { Icon: LineChart, iconBg: 'bg-mint', iconColor: 'text-forest-600', cta: 'Assinar Essencial' },
  plus: { Icon: Star, iconBg: 'bg-coral', iconColor: 'text-[#c05f3c]', cta: 'Assinar Plus', coral: true },
}

const PLANS = OFFICIAL_PLANS.map(plan => ({
  key: plan.key,
  name: plan.label,
  promise: plan.tagline,
  price: plan.price,
  period: plan.key === 'free' ? '' : plan.period,
  featured: plan.recommended ?? false,
  ...PLAN_PRESENTATION[plan.key],
}))

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

function Cell({ value }: { value: PlanCompareValue }) {
  if (value === true) return <Check className="w-4 h-4 text-forest-600 inline" aria-label="incluído" />
  if (value === false || value === '—') return <span className="text-ink-soft/50">—</span>
  return <span className="text-ink">{value}</span>
}

export default function Pricing({ user, currentPlan, onNavigateAuth }: PricingProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = normalizePlan(currentPlan)
  const isPaidSubscriber = !!user && current !== 'free'
  const [dynamicPrices, setDynamicPrices] = useState<Record<string, string>>({})
  const [catalog, setCatalog] = useState<PlanFeatureCatalog>(() => buildFallbackPlanFeatureCatalog())

  useEffect(() => {
    void supabase.rpc('get_public_plan_pricing').then(({ data }) => {
      if (!Array.isArray(data)) return
      const next: Record<string, string> = {}
      for (const row of data as { plan_key: string; display_price: string }[]) next[row.plan_key] = row.display_price
      setDynamicPrices(next)
    })
    void loadPlanFeatureCatalog().then(setCatalog)
  }, [])

  const displayPlans = useMemo(() => PLANS.map(p => ({
    ...p,
    price: dynamicPrices[p.key] || p.price,
    benefits: getCatalogPlanBenefits(catalog, p.key, 'pricing').map(item => item.label),
  })), [dynamicPrices, catalog])

  const comparisonRows = useMemo(() => {
    const byKey = new Map(catalog.items.map(item => [item.key, item]))
    const official = PLAN_COMPARE_ROWS.map(row => {
      const featureKey = COMPARISON_FEATURE_BY_ROW[row.label]
      const item = featureKey ? byKey.get(featureKey) : null
      return { ...row, label: item?.isActive && item.showOnComparison ? item.name : row.label }
    })
    const commercial = catalog.items
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
  }, [catalog])

  const handlePlanAction = async (planKey: PlanKey) => {
    trackEvent('plan_click', { entity_id: planKey, entity_title: `Plano ${planKey}`, metadata: { location: 'pricing', plan: planKey } })
    const action = resolvePricingPlanAction(!!user, current, planKey)
    if (action === 'auth') {
      trackEvent('signup_click', { entity_id: planKey, metadata: { location: 'pricing', plan: planKey } })
      onNavigateAuth()
      return
    }
    if (action === 'current') return
    if (action === 'manage') { window.location.assign('/meu-plano'); return }
    setLoadingPlan(planKey)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { plan: planKey, origin: window.location.origin },
      })
      if (fnError || !data?.url) throw new Error(fnError?.message || 'Erro ao iniciar o pagamento')
      trackEvent('checkout_started', { entity_id: planKey, entity_title: `Plano ${planKey}`, metadata: { location: 'pricing', plan: planKey } })
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao redirecionar para pagamento.')
      setLoadingPlan(null)
    }
  }

  return (
    <section id="pricing" className="bg-paper">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl md:text-5xl text-forest-900">Planos que crescem com você</h1>
          <p className="mt-3 text-ink-soft">Comece grátis. Evolua quando fizer sentido.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {displayPlans.map(plan => {
            const action = resolvePricingPlanAction(!!user, current, plan.key)
            const isCurrent = action === 'current'
            const featured = plan.featured
            const coral = plan.coral ?? false
            const isCheckoutLoading = action === 'checkout' && loadingPlan === plan.key
            return (
              <div key={plan.key} className={`relative bg-paper-soft rounded-3xl p-6 flex flex-col ${featured ? 'border-2 border-forest-900 shadow-md md:-mt-2' : coral ? 'border border-[#f0997b]' : 'border border-line'}`}>
                {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-900 text-white text-xs font-medium px-4 py-1 rounded-full whitespace-nowrap">Mais escolhido</span>}
                <span className={`w-14 h-14 rounded-full ${plan.iconBg} flex items-center justify-center mx-auto mt-2`}><plan.Icon className={`w-7 h-7 ${plan.iconColor}`} /></span>
                <h2 className="font-serif text-2xl text-forest-900 text-center mt-4">{plan.name}</h2>
                <p className="text-sm text-ink-soft text-center">{plan.promise}</p>
                <div className="text-center mt-4"><span className="font-serif text-3xl text-forest-900">{plan.price}</span>{plan.period && <span className="text-sm text-ink-soft">{plan.period}</span>}</div>
                <div className="border-t border-line my-5" />
                <ul className="space-y-3 flex-1 mb-6">{plan.benefits.map(b => <li key={b} className="flex items-start gap-2.5 text-sm"><Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${coral ? 'text-[#c05f3c]' : 'text-forest-600'}`} /><span className="text-ink">{b}</span></li>)}</ul>

                {isCurrent ? (
                  <button disabled className="w-full py-3 rounded-2xl text-sm font-medium bg-mint/60 text-forest-700 cursor-default">✓ Plano atual</button>
                ) : plan.key === 'free' ? (
                  <button onClick={() => handlePlanAction(plan.key)} className="w-full py-3 rounded-2xl text-sm font-medium border border-forest-800 text-forest-900 hover:bg-forest-900 hover:text-white transition-colors">{action === 'manage' ? 'Gerenciar mudança' : plan.cta}</button>
                ) : (
                  <button data-cta={`assinar-${plan.key}`} data-cta-location="pricing" data-cta-plan={plan.key} onClick={() => handlePlanAction(plan.key)} disabled={isCheckoutLoading} className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${coral ? 'border border-[#e8664d] text-[#c8502f] hover:bg-[#fbeae4]' : 'bg-forest-900 hover:bg-forest-800 text-white'}`}>
                    {isCheckoutLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando...</> : action === 'manage' ? 'Gerenciar mudança' : (user ? plan.cta : 'Criar conta para assinar')}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {isPaidSubscriber && <div className="mt-6 bg-mint/40 border border-line rounded-2xl p-4 max-w-2xl mx-auto text-center"><p className="text-forest-800 text-sm">Você já possui uma assinatura. Ao escolher outro plano, a mudança será concluída em Meu Plano sem criar uma segunda assinatura no Stripe.</p></div>}
        {error && <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 max-w-2xl mx-auto text-center"><p className="text-red-600 text-sm">{error}</p></div>}

        <div className="mt-14">
          <h2 className="font-serif text-2xl md:text-3xl text-forest-900 text-center mb-6">O que muda em cada plano</h2>
          <div className="border border-line rounded-3xl overflow-hidden bg-paper-soft">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead><tr className="text-sm bg-white/50"><th className="text-left px-4 py-4 text-xs font-semibold text-forest-700">Recurso</th><th className="px-4 py-4"><span className="flex items-center justify-center gap-1.5"><Sprout className="w-4 h-4 text-forest-600" /><span className="font-serif text-lg text-forest-900">Gratuito</span></span></th><th className="px-4 py-4 bg-mint/40"><span className="flex items-center justify-center gap-1.5"><LineChart className="w-4 h-4 text-forest-600" /><span className="font-serif text-lg text-forest-900">Essencial</span></span></th><th className="px-4 py-4"><span className="flex items-center justify-center gap-1.5"><Star className="w-4 h-4 text-[#c05f3c]" /><span className="font-serif text-lg text-forest-900">Plus</span></span></th></tr></thead>
                <tbody>{comparisonRows.map(row => <tr key={row.label} className="border-t border-line"><td className="px-4 py-4 text-sm font-medium text-forest-900">{row.label}</td><td className="px-4 py-4 text-center text-sm"><Cell value={row.values.free} /></td><td className="px-4 py-4 text-center text-sm bg-mint/40"><Cell value={row.values.essential} /></td><td className="px-4 py-4 text-center text-sm"><Cell value={row.values.plus} /></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-10 max-w-2xl mx-auto bg-paper-soft border border-line rounded-2xl px-5 py-4 flex items-start gap-3"><span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center flex-shrink-0 text-forest-600"><ShieldCheck className="w-4 h-4" /></span><p className="text-sm text-forest-800 leading-relaxed">Todos os planos podem ser cancelados a qualquer momento, sem taxas escondidas. Pagamentos são processados com segurança pelo Stripe — seu plano só é ativado após a confirmação.</p></div>
        <p className="text-center text-xs text-ink-soft mt-5 max-w-2xl mx-auto leading-relaxed">Seus dados são privados e protegidos. A plataforma não substitui acompanhamento psicológico, psiquiátrico ou atendimento de emergência.</p>
      </div>
    </section>
  )
}
