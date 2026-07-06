import { Fragment } from 'react'
import {
  ClipboardCheck, PenLine, PieChart, Sparkles, Sprout, Star, Heart,
  ShieldCheck, HeartHandshake, ArrowRight, Check,
} from 'lucide-react'

interface HomeContentProps {
  onNavigate: (section: string) => void
}

// ── Tudo em um fluxo simples de cuidado (5 passos) ──
const FLOW = [
  { n: '1', Icon: ClipboardCheck, bg: 'bg-mint', color: 'text-forest-600', title: 'Faça seu check-in', desc: 'Conte como está se sentindo em poucos segundos.' },
  { n: '2', Icon: PenLine, bg: 'bg-sky', color: 'text-[#3d6ea5]', title: 'Escreva no diário', desc: 'Registre o que viveu, reflexões e aprendizados do seu dia.' },
  { n: '3', Icon: PieChart, bg: 'bg-coral', color: 'text-[#c05f3c]', title: 'Descubra padrões', desc: 'Seu mapa emocional mostra o que se repete e o que melhora.' },
  { n: '4', Icon: Sparkles, bg: 'bg-lilac', color: 'text-[#7c5cbf]', title: 'Receba sugestões', desc: 'Conteúdos e práticas personalizadas para seu momento.' },
  { n: '5', Icon: Sprout, bg: 'bg-mint', color: 'text-forest-600', title: 'Dê pequenos passos', desc: 'Ações simples que fazem sentido para sua rotina.' },
]

// ── Planos que crescem com você ──
const PLANS = [
  {
    key: 'free', name: 'Gratuito', promise: 'Comece a se entender', price: 'R$ 0', per: false,
    Icon: Sprout, iconBg: 'bg-mint', iconColor: 'text-forest-600',
    benefits: ['Blog aberto', 'Diário emocional básico', 'Questionário inicial', 'Algumas práticas guiadas'],
    cta: 'Começar agora', variant: 'outline' as const,
  },
  {
    key: 'essential', name: 'Essencial', promise: 'Acompanhe seus padrões', price: 'R$ 19,90', per: true,
    Icon: Star, iconBg: 'bg-sky', iconColor: 'text-[#3d6ea5]', featured: true,
    benefits: ['Diário ilimitado', 'Mapa emocional completo', 'Histórico e gráficos', 'Conteúdos guiados completos', 'Relatório semanal automático'],
    cta: 'Assinar Essencial', variant: 'solid' as const,
  },
  {
    key: 'plus', name: 'Plus', promise: 'Receba orientação para agir', price: 'R$ 39,90', per: true,
    Icon: Heart, iconBg: 'bg-coral', iconColor: 'text-[#c05f3c]', coral: true,
    benefits: ['Tudo do Essencial', 'Plano de autocuidado mensal', 'Relatório mensal aprofundado', 'Comentário profissional mensal', 'Orientação mensal por mensagem'],
    cta: 'Assinar Plus', variant: 'coral' as const,
  },
]

// ── Um apoio, não um diagnóstico ──
const SUPPORT = [
  { Icon: ShieldCheck, bg: 'bg-mint', color: 'text-forest-600', title: 'Privacidade em primeiro lugar', desc: 'Seus dados são seus. Nada é compartilhado sem sua permissão.' },
  { Icon: HeartHandshake, bg: 'bg-sky', color: 'text-[#3d6ea5]', title: 'Autoconhecimento com respeito', desc: 'Ferramentas para você entender a si mesmo sem julgamento.' },
  { Icon: Heart, bg: 'bg-coral', color: 'text-[#c05f3c]', title: 'Você no centro', desc: 'Cuidado prático e humano para viver melhor, um dia de cada vez.' },
]

export default function HomeContent({ onNavigate }: HomeContentProps) {
  return (
    <>
      {/* ── Tudo em um fluxo simples de cuidado ── */}
      <section className="bg-paper">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl text-forest-900">Tudo em um fluxo simples de cuidado</h2>
          </div>
          <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-2">
            {FLOW.map((step, i) => (
              <Fragment key={step.n}>
                <div className="flex-1 flex flex-col items-center text-center">
                  <span className={`w-14 h-14 rounded-full ${step.bg} flex items-center justify-center mb-4`}>
                    <step.Icon className={`w-6 h-6 ${step.color}`} />
                  </span>
                  <h3 className="font-serif text-lg text-forest-900">{step.n}. {step.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-soft leading-relaxed max-w-[210px]">{step.desc}</p>
                </div>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="hidden md:block w-5 h-5 text-line flex-shrink-0 mt-5" />
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos que crescem com você ── */}
      <section className="bg-paper-soft border-y border-line">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl md:text-4xl text-forest-900">Planos que crescem com você</h2>
            <p className="mt-2 text-ink-soft">Comece grátis. Evolua quando fizer sentido.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {PLANS.map(p => {
              const featured = 'featured' in p && p.featured
              return (
                <div
                  key={p.key}
                  className={`relative bg-white rounded-3xl p-6 flex flex-col ${
                    featured ? 'border-2 border-forest-900 shadow-md md:-mt-2' : 'border border-line'
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-900 text-white text-[11px] font-medium px-4 py-1 rounded-full whitespace-nowrap">
                      Mais escolhido
                    </span>
                  )}
                  <span className={`w-14 h-14 rounded-full ${p.iconBg} flex items-center justify-center mx-auto mt-2`}>
                    <p.Icon className={`w-7 h-7 ${p.iconColor}`} />
                  </span>
                  <h3 className="font-serif text-2xl text-forest-900 text-center mt-4">{p.name}</h3>
                  <p className="text-sm text-ink-soft text-center">{p.promise}</p>
                  <div className="text-center mt-4">
                    <span className="font-serif text-3xl text-forest-900">{p.price}</span>
                    {p.per && <span className="text-sm text-ink-soft">/mês</span>}
                  </div>
                  <div className="border-t border-line my-5" />
                  <ul className="space-y-3 flex-1 mb-6">
                    {p.benefits.map(b => (
                      <li key={b} className="flex items-start gap-2.5 text-sm">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${p.variant === 'coral' ? 'text-[#c05f3c]' : 'text-forest-600'}`} />
                        <span className="text-ink">{b}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => onNavigate('pricing')}
                    className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors ${
                      p.variant === 'solid'
                        ? 'bg-forest-900 hover:bg-forest-800 text-white'
                        : p.variant === 'coral'
                          ? 'border border-[#e8664d] text-[#c8502f] hover:bg-[#fbeae4]'
                          : 'border border-forest-800 text-forest-900 hover:bg-forest-900 hover:text-white'
                    }`}
                  >
                    {p.cta}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Um apoio, não um diagnóstico ── */}
      <section className="bg-paper">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-4">
            <h2 className="font-serif text-3xl md:text-4xl text-forest-900">Um apoio, não um diagnóstico</h2>
          </div>
          <p className="text-center text-sm text-ink-soft max-w-2xl mx-auto leading-relaxed mb-10">
            O A Vida Não Colabora é uma ferramenta de apoio ao autoconhecimento e à organização emocional.
            Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SUPPORT.map(({ Icon, bg, color, title, desc }) => (
              <div key={title} className="bg-paper-soft border border-line rounded-3xl p-6 text-center">
                <span className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </span>
                <h3 className="font-serif text-lg text-forest-900">{title}</h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
