import { useState, useEffect } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { Plan } from '../types'
import { supabase } from '../lib/supabase'

interface PricingProps {
  user: unknown
  currentPlan: Plan
  onNavigateAuth: () => void
}

interface Feature {
  text: string
  included: boolean
  note?: boolean
}

interface PlanConfig {
  id: Plan
  name: string
  price: string
  period: string
  tagline: string
  color: string
  badge?: string
  badgeColor?: string
  buttonColor: string
  buttonLabel: string
  features: Feature[]
}

const STATIC_PLANS: PlanConfig[] = [
  {
    id: 'free', name: 'Gratuito', price: 'R$ 0', period: 'para sempre',
    tagline: 'Para começar a se conhecer melhor, sem custo.',
    color: 'border-sand-200', buttonColor: 'bg-sand-200 hover:bg-sand-300 text-sand-800', buttonLabel: 'Começar grátis',
    features: [
      { text: 'Artigos gratuitos', included: true },
      { text: 'Questionário básico de autoavaliação', included: true },
      { text: 'Diário de bem-estar com até 5 entradas por mês', included: true },
      { text: 'Registro simples de humor', included: true },
      { text: 'Mini-desafios quinzenais automatizados', included: true },
      { text: 'Histórico limitado', included: true },
      { text: 'Conteúdos com anúncios', included: true, note: true },
    ],
  },
  {
    id: 'essential', name: 'Essencial', price: 'R$ 19,90', period: '/mês',
    tagline: 'Para acompanhar sua evolução emocional com continuidade.',
    color: 'border-sage-300', buttonColor: 'bg-sage-600 hover:bg-sage-700 text-white', buttonLabel: 'Assinar Essencial',
    features: [
      { text: 'Tudo do Gratuito', included: true },
      { text: 'Diário ilimitado', included: true },
      { text: 'Histórico completo', included: true },
      { text: 'Avaliações semanais', included: true },
      { text: 'Gráficos simples de evolução', included: true },
      { text: 'Meditações guiadas em texto', included: true },
      { text: 'Notas guiadas no diário', included: true },
      { text: 'Relatórios mensais em PDF', included: true },
      { text: 'Resumo do diário, humor e sintomas', included: true },
      { text: 'Destaques de evolução, sem análise clínica', included: true },
      { text: 'Biblioteca de exercícios emocionais', included: true },
      { text: 'Sem anúncios', included: true },
      { text: 'Suporte por e-mail prioritário', included: true },
    ],
  },
  {
    id: 'therapeutic', name: 'Terapêutico', price: 'R$ 39,90', period: '/mês',
    tagline: 'Para uma experiência personalizada de autocuidado.',
    color: 'border-purple-400', badge: 'Mais recomendado', badgeColor: 'bg-purple-600 text-white',
    buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white', buttonLabel: 'Assinar Terapêutico',
    features: [
      { text: 'Tudo do Essencial', included: true },
      { text: 'Questionário aprofundado', included: true },
      { text: 'Plano de autocuidado personalizado', included: true },
      { text: 'Diário avançado', included: true },
      { text: 'Marcadores extras: sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia', included: true },
      { text: 'Gráficos comparativos mensais', included: true },
      { text: 'Relatório mensal avançado', included: true },
      { text: 'Recomendações personalizadas de conteúdo', included: true },
      { text: 'Plano semanal de autocuidado', included: true },
      { text: 'Acesso antecipado a novos conteúdos', included: true },
      { text: 'Orientação mensal por mensagem', included: true },
    ],
  },
  {
    id: 'therapeutic-plus', name: 'Terapêutico Plus', price: 'R$ 79,90', period: '/mês',
    tagline: 'Para quem deseja acompanhamento individual mensal.',
    color: 'border-ocean-300', buttonColor: 'bg-ocean-600 hover:bg-ocean-700 text-white', buttonLabel: 'Assinar Plus',
    features: [
      { text: 'Tudo do Terapêutico', included: true },
      { text: '1 sessão mensal de 30 minutos com Psicanalista', included: true },
      { text: 'Revisão mensal do plano de autocuidado', included: true },
      { text: 'Comentário individual sobre o relatório do mês', included: true },
      { text: 'Suporte prioritário máximo', included: true },
    ],
  },
]

export default function Pricing({ user, currentPlan, onNavigateAuth }: PricingProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [displayPlans, setDisplayPlans] = useState(STATIC_PLANS)

  // Merge DB plan_configs + plan_feature_access into display
  useEffect(() => {
    async function loadFromDB() {
      const [{ data: cfgData }, { data: featData }, { data: accessData }] = await Promise.all([
        supabase.from('plan_configs').select('*').eq('active', true),
        supabase.from('plan_features').select('*').order('category').order('display_order'),
        supabase.from('plan_feature_access').select('*').eq('enabled', true),
      ])

      if (!cfgData && !accessData) return

      setDisplayPlans(prev => prev.map(pl => {
        const cfg = cfgData?.find((d: { plan_key: string }) => d.plan_key === pl.id)
        let features = pl.features

        // If we have plan_feature_access data, build features from it
        if (featData && accessData) {
          const enabledKeys = accessData
            .filter((a: { plan_key: string }) => a.plan_key === pl.id)
            .map((a: { feature_key: string }) => a.feature_key)

          const enabledFeatures = featData
            .filter((f: { feature_key: string }) => enabledKeys.includes(f.feature_key))
            .map((f: { feature_name: string }) => ({ text: f.feature_name, included: true }))

          if (enabledFeatures.length > 0) features = enabledFeatures
        }

        return {
          ...pl,
          name: cfg?.label || pl.name,
          price: cfg?.price || pl.price,
          tagline: cfg?.description || pl.tagline,
          badge: cfg?.recommended || cfg?.is_recommended ? 'Mais recomendado' : pl.badge,
          features,
        }
      }))
    }
    loadFromDB()
  }, [])

  const handleSubscribe = async (planId: Plan) => {
    if (!user) { onNavigateAuth(); return }
    setLoadingPlan(planId)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { plan: planId },
      })
      if (fnError || !data?.url) throw new Error(fnError?.message || 'Erro ao criar sessão de pagamento')
      window.location.href = data.url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao redirecionar para pagamento.'
      setError(msg)
      setLoadingPlan(null)
    }
  }

  return (
    <section id="pricing" className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <p className="text-purple-400 text-sm uppercase tracking-widest mb-2">Planos</p>
        <h2 className="font-serif text-4xl text-sage-800 mb-4">Escolha seu caminho</h2>
        <p className="text-sage-500 max-w-lg mx-auto">
          Comece gratuitamente e faça upgrade quando sentir que precisa de mais suporte.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {displayPlans.map(plan => (
          <div
            key={plan.id}
            className={`bg-white rounded-2xl border-2 ${plan.color} ${plan.id === 'therapeutic' ? 'ring-2 ring-purple-200' : ''} p-6 flex flex-col relative shadow-sm`}
          >
            {plan.badge && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${plan.badgeColor} text-xs px-4 py-1 rounded-full font-medium whitespace-nowrap`}>
                {plan.badge}
              </div>
            )}

            <div className="mb-5">
              <h3 className="font-serif text-xl text-sage-800 mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold text-sage-700">{plan.price}</span>
                <span className="text-sage-400 text-xs">{plan.period}</span>
              </div>
              <p className="text-sage-500 text-xs leading-relaxed italic">{plan.tagline}</p>
            </div>

            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  {f.included ? (
                    <Check className="w-3.5 h-3.5 text-sage-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-sand-300 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`text-xs leading-relaxed ${f.note ? 'text-sage-400 italic' : f.included ? 'text-sage-600' : 'text-sage-300'}`}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            {currentPlan === plan.id ? (
              <button disabled className="w-full py-2.5 rounded-xl text-xs font-medium bg-sage-50 text-sage-400 border border-sage-200 cursor-default">
                ✓ Plano atual
              </button>
            ) : plan.id === 'free' ? (
              <button
                onClick={() => !user && onNavigateAuth()}
                disabled={!!user}
                className={`w-full py-2.5 rounded-xl text-xs font-medium transition-colors ${plan.buttonColor} ${user ? 'opacity-50 cursor-default' : ''}`}
              >
                {plan.buttonLabel}
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className={`w-full py-2.5 rounded-xl text-xs font-medium transition-colors ${plan.buttonColor} disabled:opacity-70 flex items-center justify-center gap-2`}
              >
                {loadingPlan === plan.id ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirecionando...</>
                ) : (
                  user ? plan.buttonLabel : 'Criar conta para assinar'
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 max-w-2xl mx-auto text-center">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="mt-6 bg-sand-50 border border-sand-200 rounded-xl p-4 max-w-2xl mx-auto text-center">
        <p className="text-xs text-sage-500 leading-relaxed">
          <strong>Nota sobre o Plano Terapêutico Plus:</strong> A sessão individual é realizada por profissional parceiro habilitado, respeitando as regras éticas e profissionais aplicáveis. Este serviço não constitui atendimento clínico, diagnóstico ou tratamento.
        </p>
      </div>

      <p className="text-center text-xs text-sage-400 mt-4">
        Os planos pagos são processados via Stripe. Você pode cancelar a qualquer momento.
        Este serviço não substitui acompanhamento clínico profissional.
      </p>
    </section>
  )
}
