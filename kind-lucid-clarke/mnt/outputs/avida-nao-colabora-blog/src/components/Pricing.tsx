import { Check, X } from 'lucide-react'
import { Plan } from '../types'

interface PricingProps {
  user: any
  currentPlan: Plan
  onSubscribe: (plan: Plan) => void
  onNavigateAuth: () => void
}

const plans = [
  {
    id: 'free' as Plan,
    name: 'Gratuito',
    price: 'R$ 0',
    period: 'para sempre',
    description: 'Comece sua jornada de bem-estar.',
    color: 'border-sand-200',
    buttonColor: 'bg-sand-200 hover:bg-sand-300 text-sand-800',
    features: [
      { text: 'Acesso a todos os artigos', included: true },
      { text: 'Questionário de autoavaliação', included: true },
      { text: 'Diário de bem-estar (até 5 entradas/mês)', included: true },
      { text: 'Mini-desafios mensais (7 Dias de Sono, 5 Dias de Autocuidado com Dor Crônica, 7 Dias de Respiração)', included: true },
      { text: 'Conteúdos podem conter anúncios', included: true, note: true },
      { text: 'Meditações guiadas', included: false },
      { text: 'Relatórios PDF mensais', included: false },
      { text: 'Avaliações semanais automáticas', included: false },
    ],
  },
  {
    id: 'essential' as Plan,
    name: 'Essencial',
    price: 'R$ 19,90',
    period: '/mês',
    description: 'Para quem quer acompanhar sua evolução de forma contínua.',
    color: 'border-sage-400 ring-2 ring-sage-200',
    badge: 'Mais popular',
    buttonColor: 'bg-sage-600 hover:bg-sage-700 text-white',
    features: [
      { text: 'Tudo do plano Gratuito', included: true },
      { text: 'Sem anúncios', included: true },
      { text: 'Diário ilimitado', included: true },
      { text: 'Meditações guiadas em texto (1 por dia da semana)', included: true },
      { text: 'Notas guiadas no diário (ex.: "Um pequeno orgulho do dia foi…")', included: true },
      { text: 'Avaliações semanais automáticas', included: true },
      { text: 'Resumo mensal do diário', included: true },
      { text: 'Relatório PDF mensal com evolução', included: true },
      { text: 'Gráficos detalhados / Chat com psicanalista', included: false },
    ],
  },
  {
    id: 'therapeutic' as Plan,
    name: 'Terapêutico',
    price: 'R$ 39,90',
    period: '/mês',
    description: 'Acompanhamento aprofundado para quem convive com condições de saúde complexas.',
    color: 'border-ocean-300',
    buttonColor: 'bg-ocean-600 hover:bg-ocean-700 text-white',
    features: [
      { text: 'Tudo do plano Essencial', included: true },
      { text: 'Sessões mensais via WhatsApp com psicanalista (30 min)', included: true },
      { text: 'Questionário aprofundado + plano de autocuidado personalizado', included: true },
      { text: 'Diário avançado com marcadores (sono, dor, compulsão, gatilhos)', included: true },
      { text: 'Gráficos detalhados e comparativos mensais', included: true },
      { text: 'Plano de autocuidado atualizado mensalmente', included: true },
    ],
  },
]

export default function Pricing({ user, currentPlan, onSubscribe, onNavigateAuth }: PricingProps) {
  return (
    <section id="pricing" className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <p className="text-sage-500 text-sm uppercase tracking-widest mb-2">Planos</p>
        <h2 className="font-serif text-4xl text-sage-800 mb-4">Escolha seu caminho</h2>
        <p className="text-sage-500 max-w-lg mx-auto">
          Comece gratuitamente e faça upgrade quando sentir que precisa de mais suporte.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`bg-white rounded-2xl border-2 ${plan.color} p-6 flex flex-col relative shadow-sm`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sage-600 text-white text-xs px-4 py-1 rounded-full font-medium">
                {plan.badge}
              </div>
            )}

            <div className="mb-5">
              <h3 className="font-serif text-2xl text-sage-800 mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-sage-700">{plan.price}</span>
                <span className="text-sage-400 text-sm">{plan.period}</span>
              </div>
              <p className="text-sage-500 text-sm leading-relaxed">{plan.description}</p>
            </div>

            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  {f.included ? (
                    <Check className="w-4 h-4 text-sage-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-sand-300 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm ${f.note ? 'text-sage-400 italic' : f.included ? 'text-sage-600' : 'text-sage-300'}`}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            {currentPlan === plan.id ? (
              <button disabled className="w-full py-3 rounded-xl text-sm font-medium bg-sage-50 text-sage-400 border border-sage-200 cursor-default">
                ✓ Plano atual
              </button>
            ) : plan.id === 'free' ? (
              <button disabled className="w-full py-3 rounded-xl text-sm font-medium bg-sand-100 text-sand-500 cursor-default">
                Plano gratuito
              </button>
            ) : (
              <button
                onClick={() => user ? onSubscribe(plan.id) : onNavigateAuth()}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${plan.buttonColor}`}
              >
                {user ? `Assinar ${plan.name}` : 'Criar conta para assinar'}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-sage-400 mt-8">
        Os planos pagos serão processados via Stripe. Você pode cancelar a qualquer momento.
        Este blog não substitui acompanhamento clínico profissional.
      </p>
    </section>
  )
}
