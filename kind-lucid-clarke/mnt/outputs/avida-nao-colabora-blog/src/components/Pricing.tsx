import { useState } from 'react'
import { Plan } from '../types'
import { supabase } from '../lib/supabase'
import {
  Check, Loader2, Sprout, Star, Heart,
  NotebookPen, Compass, BookOpen, CalendarCheck, MessageSquare,
} from 'lucide-react'

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
    benefits: ['Blog aberto', 'Diário emocional básico', 'Questionário inicial', 'Algumas práticas guiadas'],
    cta: 'Começar agora',
  },
  {
    key: 'essential' as const, name: 'Essencial', promise: 'Acompanhe seus padrões', price: 'R$ 19,90', period: '/mês',
    Icon: Star, iconBg: 'bg-mint', iconColor: 'text-forest-600', featured: true,
    benefits: ['Diário ilimitado', 'Mapa emocional completo', 'Histórico e gráficos', 'Conteúdos guiados completos', 'Relatório semanal automático'],
    cta: 'Assinar Essencial',
  },
  {
    key: 'plus' as const, name: 'Plus', promise: 'Receba orientação para agir', price: 'R$ 39,90', period: '/mês',
    Icon: Heart, iconBg: 'bg-coral', iconColor: 'text-[#c05f3c]', coral: true,
    benefits: ['Tudo do Essencial', 'Plano de autocuidado mensal', 'Relatório mensal aprofundado', 'Comentário profissional mensal', 'Orientação mensal por mensagem'],
    cta: 'Assinar Plus',
  },
]

const COMPARISON = [
  { Icon: NotebookPen, label: 'Diário emocional', free: 'Básico', essential: 'Ilimitado', plus: 'Ilimitado' },
  { Icon: Compass, label: 'Mapa emocional', free: 'Básico', essential: 'Completo', plus: 'Completo' },
  { Icon: BookOpen, label: 'Conteúdos guiados', free: 'Limitados', essential: 'Todos os conteúdos', plus: 'Todos os conteúdos' },
  // Plano de autocuidado e Orientação profissional são recursos exclusivos do Plus (gating real).
  { Icon: CalendarCheck, label: 'Plano de autocuidado', free: '—', essential: '—', plus: 'Incluído' },
  { Icon: MessageSquare, label: 'Orientação profissional', free: '—', essential: '—', plus: 'Incluída' },
] as const

function Cell({ value }: { value: string }) {
  if (value === '—') return <span className="text-ink-soft/50">—</span>
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
      if (fnError || !data?.url) throw new Error(fnError?.message || 'Erro ao criar sessão de pagamento')
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
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={loadingPlan === plan.key}
                    className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${
                      coral ? 'bg-[#d85a30] hover:bg-[#c34e28] text-white' : 'bg-forest-900 hover:bg-forest-800 text-white'
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="text-sm">
                  <th className="text-left font-medium text-ink-soft px-4 py-3"></th>
                  <th className="font-serif text-lg text-forest-900 px-4 py-3">Gratuito</th>
                  <th className="font-serif text-lg text-forest-900 px-4 py-3 bg-mint/40 rounded-t-2xl">Essencial</th>
                  <th className="font-serif text-lg text-forest-900 px-4 py-3">Plus</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} className={i > 0 ? 'border-t border-line' : ''}>
                    <td className="px-4 py-4 text-sm">
                      <span className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center flex-shrink-0">
                          <row.Icon className="w-4 h-4 text-forest-600" />
                        </span>
                        <span className="font-medium text-forest-900">{row.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm"><Cell value={row.free} /></td>
                    <td className="px-4 py-4 text-center text-sm bg-mint/40"><Cell value={row.essential} /></td>
                    <td className="px-4 py-4 text-center text-sm"><Cell value={row.plus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-ink-soft mt-10 max-w-2xl mx-auto leading-relaxed">
          Seus dados são privados e protegidos. A plataforma não substitui acompanhamento psicológico,
          psiquiátrico ou atendimento de emergência.
        </p>
      </div>
    </section>
  )
}
