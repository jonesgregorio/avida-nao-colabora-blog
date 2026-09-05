import { ArrowRight, BookOpen, Feather, HeartHandshake, Sprout } from 'lucide-react'
import type { NavigateFn } from '../lib/navigation'

interface HeroProps {
  onNavigate: NavigateFn
}

const benefits = [
  {
    icon: Feather,
    title: 'Reflexões do dia a dia',
    description: 'Conteúdos reais, sem julgamentos, para uma vida mais leve.',
  },
  {
    icon: BookOpen,
    title: 'Diário e autoconhecimento',
    description: 'Ferramentas para você se ouvir melhor e entender seus padrões.',
  },
  {
    icon: Sprout,
    title: 'Pequenas ações',
    description: 'Passos possíveis para transformar a sua rotina, no seu tempo.',
  },
  {
    icon: HeartHandshake,
    title: 'Uma comunidade de apoio',
    description: 'Você não está só nessa. Aqui tem gente real, como você.',
  },
]

export default function Hero({ onNavigate }: HeroProps) {
  return (
    <section id="home" className="overflow-hidden border-b border-line bg-[#f8f2e8]">
      <div className="relative mx-auto min-h-[650px] max-w-[1536px] overflow-hidden lg:min-h-[670px]">
        <img
          data-testid="home-hero-image"
          src="/images/home/hero-person-approved.webp"
          alt="Mulher em um momento de pausa e reflexão ao pôr do sol."
          className="absolute inset-0 h-full w-full object-cover object-[68%_center] sm:object-[70%_center] lg:object-[72%_center]"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          width="1536"
          height="1024"
          onError={(event) => {
            const img = event.currentTarget
            if (!img.src.endsWith('/images/home/hero-person-clean.webp')) {
              img.onerror = null
              img.src = '/images/home/hero-person-clean.webp'
            }
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#f7ead8]/96 via-[#f4dfc5]/68 to-transparent lg:via-[#f4dfc5]/30" />

        <div className="relative z-10 flex min-h-[650px] items-center px-5 py-14 sm:px-8 lg:min-h-[670px] lg:px-14 xl:px-24">
          <div className="max-w-[720px] pt-5 lg:max-w-[680px]">
            <p className="mb-5 text-[0.74rem] font-bold uppercase tracking-[0.34em] text-forest-800 sm:text-sm">
              Pequenas reflexões. Grandes possibilidades.
            </p>

            <h1 className="max-w-[760px] font-serif text-[3.35rem] leading-[0.98] tracking-[-0.04em] text-[#25140d] sm:text-6xl lg:text-[5.2rem]">
              Quando a vida não colabora, a gente se encontra.
            </h1>

            <p className="mt-7 max-w-[600px] text-xl leading-relaxed text-[#2c241f] sm:text-2xl">
              Um espaço para refletir, se reconectar e dar pequenos passos, mesmo quando tudo parece difícil.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => onNavigate('/cadastro')}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-forest-800 px-8 text-lg font-semibold text-white transition hover:bg-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-800 focus:ring-offset-2"
              >
                Começar agora
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/planos')}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[#5a514c]/55 bg-white/10 px-8 text-lg font-semibold text-[#241913] backdrop-blur-[2px] transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-forest-800 focus:ring-offset-2"
              >
                Conheça os planos
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-line/80 bg-[#fffdf9]">
        <div className="mx-auto grid max-w-[1536px] gap-8 px-5 py-9 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-14 xl:px-24">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article key={title} className="text-center">
              <Icon className="mx-auto h-9 w-9 text-forest-800" strokeWidth={1.7} aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold text-[#221b17]">{title}</h2>
              <p className="mx-auto mt-1 max-w-[270px] text-sm leading-relaxed text-[#6e6b67]">{description}</p>
            </article>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 px-5 pb-8 text-center text-[0.7rem] font-medium uppercase tracking-[0.22em] text-[#817c74] sm:text-xs">
          <span className="h-px w-16 bg-[#c9c2b7]" aria-hidden="true" />
          A vida real também é uma grande história
          <span className="h-px w-16 bg-[#c9c2b7]" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
