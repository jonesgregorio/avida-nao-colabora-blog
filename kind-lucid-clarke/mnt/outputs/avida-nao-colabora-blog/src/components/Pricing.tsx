import { useState } from 'react'
import { Plan } from '../types'
import { supabase } from '../lib/supabase'
import { Check, Loader2, Sprout, Star, LineChart, ShieldCheck } from 'lucide-react'
import { PLAN_COMPARE_ROWS, PLAN_BENEFITS, type PlanCompareValue } from '../lib/planComparison'

interface PricingProps {
  user: unknown
  currentPlan: Plan
  onNavigateAuth: () => void
}

type PlanKey = 'free' | 'essential' | 'plus'

// Legado → plano atual (para exibir "Plano atual" corretamente).
function normalize(p: Plan | string): PlanKey {
  if (p === 'therapeutic' || p === 'therapeutic-plus') return 'plus'
  if (p === 'essential' || p === 'plus') return p
  return 'free'
}

// O backend (create-checkout) já mapeia 'plus' para o price de R$ 39,90.
const CHECKOUT_PLAN: Record<string, string> = { essential: 'essential', plus: 'plus' }

const PLANS = [
  {
    key: 'free' as const, name: 'Gratuito', promise: 'Comece a se entender', price: 'R$ 0', period: '',
    Icon: Sprout, iconBg: 'bg-mint', iconColor: 'text-forest-600',
    benefits: PLAN_BENEFITS.free,
    cta: 'Começar agora',
  },
  {
    key: 'essential' as const, name: 'Essencial', promise: 'Acompanhe seus padrões', price: 'R$ 19,90', period: '/mês',
    Icon: LineChart, iconBg: 'bg-mint', iconColor: 'text-forest-600', featured: true,
    benefits: PLAN_BENEFITS.essential,
    cta: 'Assinar Essencial',
  },
  {
    key: 'plus' as const, name: 'Plus', promise: 'Receba orientação para agir', price: 'R$ 39,90', period: '/mês',
    Icon: Star, iconBg: 'bg-coral', iconColor: 'text-[#c05f3c]', coral: true,
    benefits: PLAN_BENEFITS.plus,
    cta: 'Assinar Plus',
  },
]

function Cell({ value }: { value: PlanCompareValue }) {
  if (value === true) return <Check className="w-4 h-4 text-forest-600 inline" aria-label="incluído" />
  if (value === false || value === '—') return <span className="text-ink-soft/50">—</span>
  return <span className="text-ink">{value}</span>
}

export default function Pricing({ user, currentPlan, onNavigateAuth }: PricingProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = normalize(currentPlan)

  const handleSubscribe = async (planKey: PlanKey) => {
    if (!user) { onNavigateAuth(); return }
    setLoadingPlan(planKey)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { plan: CHECKOUT_PLAN[planKey] ?? planKey, origin: window.location.origin },
      })
      if (fnError || !data?.url) throw new Error(fnError?.message || 'Erro ao iniciar o pagamento')
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

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map(plan => {
            const isCurrent = !!user && current === plan.key
            const featured = 'featured' in plan && plan.featured
            const coral = 'coral' in plan && plan.coral
            return (
              <div
                key={plan.key}
                className={`relative bg-paper-soft rounded-3xl p-6 flex flex-col ${
                  featured ? 'border-2 border-forest-900 shadow-md md:-mt-2' : coral ? 'border border-[#f0997b]' : 'border border-line'
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-900 text-white text-xs font-medium px-4 py-1 rounded-full whitespace-nowrap">
                    Mais escolhido
                  </span>
                )}
                <span className={`w-14 h-14 rounded-full ${plan.iconBg} flex items-center justify-center mx-auto mt-2`}>
                  <plan.Icon className={`w-7 h-7 ${plan.iconColor}`} />
                </span>
                <h2 className="font-serif text-2xl text-forest-900 text-center mt-4">{plan.name}</h2>
                <p className="text-sm text-ink-soft text-center">{plan.promise}</p>
                <div className="text-center mt-4">
                  <span className="font-serif text-3xl text-forest-900">{plan.price}</span>
                  {plan.period && <span className="text-sm text-ink-soft">{plan.period}</span>}
                </div>

                <div className="border-t border-line my-5" />

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.benefits.map(b => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${coral ? 'text-[#c05f3c]' : 'text-forest-600'}`} />
                      <span className="text-ink">{b}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button disabled className="w-full py-3 rounded-2xl text-sm font-medium bg-mint/60 text-forest-700 cursor-default">
                    ✓ Plano atual
                  </button>
                ) : plan.key === 'free' ? (
                  <button
                    onClick={() => !user && onNavigateAuth()}
                    disabled={!!user}
                    className="w-full py-3 rounded-2xl text-sm font-medium border border-forest-800 text-forest-900 hover:bg-forest-900 hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-forest-900"
                  >
                    {plan.cta}
                  </button>
                ) : (
                  <button
                    data-cta={`assinar-${plan.key}`}
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={loadingPlan === plan.key}
                    className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${
                      coral ? 'border border-[#e8664d] text-[#c8502f] hover:bg-[#fbeae4]' : 'bg-forest-900 hover:bg-forest-800 text-white'
                    }`}
                  >
                    {loadingPlan === plan.key
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando...</>
                      : (user ? plan.cta : 'Criar conta para assinar')}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 max-w-2xl mx-auto text-center">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Tabela comparativa */}
        <div className="mt-14">
          <h2 className="font-serif text-2xl md:text-3xl text-forest-900 text-center mb-6">O que muda em cada plano</h2>
          <div className="border border-line rounded-3xl overflow-hidden bg-paper-soft">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="text-sm bg-white/50">
                    <th className="text-left px-4 py-4 text-xs font-semibold text-forest-700">Recurso</th>
                    <th className="px-4 py-4">
                      <span className="flex items-center justify-center gap-1.5">
                        <Sprout className="w-4 h-4 text-forest-600" />
                        <span className="font-serif text-lg text-forest-900">Gratuito</span>
                      </span>
                    </th>
                    <th className="px-4 py-4 bg-mint/40">
                      <span className="flex items-center justify-center gap-1.5">
                        <LineChart className="w-4 h-4 text-forest-600" />
                        <span className="font-serif text-lg text-forest-900">Essencial</span>
                      </span>
                    </th>
                    <th className="px-4 py-4">
                      <span className="flex items-center justify-center gap-1.5">
                        <Star className="w-4 h-4 text-[#c05f3c]" />
                        <span className="font-serif text-lg text-forest-900">Plus</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_COMPARE_ROWS.map(row => (
                    <tr key={row.label} className="border-t border-line">
                      <td className="px-4 py-4 text-sm font-medium text-forest-900">{row.label}</td>
                      <td className="px-4 py-4 text-center text-sm"><Cell value={row.values.free} /></td>
                      <td className="px-4 py-4 text-center text-sm bg-mint/40"><Cell value={row.values.essential} /></td>
                      <td className="px-4 py-4 text-center text-sm"><Cell value={row.values.plus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-10 max-w-2xl mx-auto bg-paper-soft border border-line rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center flex-shrink-0 text-forest-600"><ShieldCheck className="w-4 h-4" /></span>
          <p className="text-sm text-forest-800 leading-relaxed">
            Todos os planos podem ser cancelados a qualquer momento, sem taxas escondidas. Pagamentos são processados com segurança pelo Stripe — seu plano só é ativado após a confirmação.
          </p>
        </div>
        <p className="text-center text-xs text-ink-soft mt-5 max-w-2xl mx-auto leading-relaxed">
          Seus dados são privados e protegidos. A plataforma não substitui acompanhamento psicológico, psiquiátrico ou atendimento de emergência.
        </p>
      </div>
    </section>
  )
}
