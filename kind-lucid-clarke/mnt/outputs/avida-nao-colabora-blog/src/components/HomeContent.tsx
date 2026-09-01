import { ArrowRight, BookOpen, Heart, HeartHandshake, LineChart, PenLine, ShieldCheck, Sparkles, Sprout } from 'lucide-react'
import { usePlanPricing } from '../lib/planPricing'

interface HomeContentProps {
  onNavigate: (section: string) => void
}

const EXPERIENCE = [
  {
    eyebrow: 'Você registra',
    title: 'Coloque o dia em palavras',
    description: 'Diário e momentos do dia ajudam você a guardar o que viveu sem precisar organizar tudo de uma vez.',
    Icon: PenLine,
  },
  {
    eyebrow: 'O sistema percebe',
    title: 'Algumas repetições começam a aparecer',
    description: 'Com o tempo, sinais estruturados podem mostrar o que costuma pesar, ajudar ou voltar em determinados contextos.',
    Icon: Sparkles,
  },
  {
    eyebrow: 'Você entende',
    title: 'Olhe sua história com mais distância',
    description: 'Descobertas, Mapa Emocional e retrospectivas ajudam a enxergar o caminho sem transformar tudo em conclusão.',
    Icon: LineChart,
  },
  {
    eyebrow: 'Você cuida',
    title: 'Escolha uma possibilidade para agora',
    description: 'Conteúdos, pequenas práticas e apoios ficam disponíveis quando fizerem sentido para o seu momento.',
    Icon: Sprout,
  },
]

const PLANS = [
  { key: 'free', name: 'Gratuito', promise: 'Para começar no seu ritmo', fallbackPrice: 'R$ 0', per: false },
  { key: 'essential', name: 'Essencial', promise: 'Para acompanhar padrões e retrospectivas', fallbackPrice: 'R$ 19,90', per: true },
  { key: 'plus', name: 'Plus', promise: 'Para aprofundar o cuidado e a orientação', fallbackPrice: 'R$ 39,90', per: true },
]

const SUPPORT = [
  { Icon: ShieldCheck, title: 'Privacidade em primeiro lugar', description: 'Seus dados são seus e o texto livre do Diário não vira uma vitrine pública.' },
  { Icon: HeartHandshake, title: 'Sem julgamento', description: 'A experiência foi pensada para ajudar a observar, não para cobrar desempenho ou perfeição.' },
  { Icon: Heart, title: 'Apoio, não diagnóstico', description: 'O site apoia autoconhecimento e organização emocional, sem substituir cuidado profissional.' },
]

export default function HomeContent({ onNavigate }: HomeContentProps) {
  const { prices } = usePlanPricing()

  return (
    <>
      <section className="bg-paper border-t border-line/70" aria-labelledby="experience-heading">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-16">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Uma experiência que acompanha o tempo</p>
            <h2 id="experience-heading" className="font-serif text-3xl sm:text-4xl text-forest-900 mt-2">Você não precisa entender tudo hoje</h2>
            <p className="text-sm sm:text-base text-ink-soft mt-3 leading-relaxed">Primeiro você registra. Depois, aos poucos, o que aconteceu pode ganhar contexto e virar uma possibilidade de cuidado.</p>
          </div>

          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXPERIENCE.map(({ eyebrow, title, description, Icon }, index) => (
              <article key={eyebrow} className="relative rounded-3xl border border-line bg-paper-soft p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center"><Icon className="w-5 h-5" /></span>
                  <span className="text-xs text-ink-soft">0{index + 1}</span>
                </div>
                <p className="mt-5 text-[10px] uppercase tracking-[0.13em] font-semibold text-forest-600">{eyebrow}</p>
                <h3 className="font-serif text-xl text-forest-900 mt-1">{title}</h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button onClick={() => onNavigate('diary')} className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 hover:text-forest-900">
              Começar pelo meu primeiro registro <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="bg-paper-soft border-y border-line" aria-labelledby="plans-home-heading">
        <div className="max-w-5xl mx-auto px-4 py-14 sm:py-16">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Planos</p>
            <h2 id="plans-home-heading" className="font-serif text-3xl sm:text-4xl text-forest-900 mt-2">Comece gratuitamente. Aprofunde quando fizer sentido.</h2>
            <p className="text-sm text-ink-soft mt-3">A comparação completa continua na página de planos; aqui, basta entender onde cada opção entra na experiência.</p>
          </div>

          <div className="mt-9 grid md:grid-cols-3 gap-4">
            {PLANS.map(plan => (
              <article key={plan.key} className="rounded-3xl border border-line bg-white p-5 sm:p-6 flex flex-col">
                <h3 className="font-serif text-2xl text-forest-900">{plan.name}</h3>
                <p className="text-sm text-ink-soft mt-1 min-h-10">{plan.promise}</p>
                <p className="mt-5 font-serif text-3xl text-forest-900">
                  {prices[plan.key as keyof typeof prices]?.display ?? plan.fallbackPrice}
                  {plan.per && <span className="font-sans text-xs text-ink-soft ml-1">/mês</span>}
                </p>
                <div className="mt-5 border-t border-line pt-4">
                  <button onClick={() => onNavigate('pricing')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900">
                    Ver detalhes <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-7 text-center">
            <button onClick={() => onNavigate('pricing')} className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors">
              Comparar todos os planos <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="bg-paper" aria-labelledby="support-home-heading">
        <div className="max-w-5xl mx-auto px-4 py-14 sm:py-16">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">No seu ritmo</p>
            <h2 id="support-home-heading" className="font-serif text-3xl sm:text-4xl text-forest-900 mt-2">Um apoio para organizar, perceber e cuidar</h2>
          </div>

          <div className="mt-9 grid md:grid-cols-3 gap-4">
            {SUPPORT.map(({ Icon, title, description }) => (
              <article key={title} className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6 text-center">
                <span className="w-11 h-11 rounded-full bg-mint text-forest-700 flex items-center justify-center mx-auto"><Icon className="w-5 h-5" /></span>
                <h3 className="font-serif text-lg text-forest-900 mt-4">{title}</h3>
                <p className="text-sm text-ink-soft mt-2 leading-relaxed">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-line bg-white px-4 py-3 text-xs text-ink-soft leading-relaxed flex items-start gap-2 max-w-3xl mx-auto">
            <BookOpen className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" />
            <p>O A Vida Não Colabora é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.</p>
          </div>
        </div>
      </section>
    </>
  )
}
