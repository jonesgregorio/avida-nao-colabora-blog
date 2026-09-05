import { BookOpen, Leaf, Sprout, Users } from 'lucide-react'
import { useSiteSnippet } from '../lib/siteContent'

interface HeroProps {
  onNavigate: (section: string) => void
}

const NEW_TITLE = 'Quando a vida não colabora, a gente se encontra.'
const NEW_SUBTITLE = 'Um espaço para refletir, se reconectar e dar pequenos passos, mesmo quando tudo parece difícil.'

export default function Hero({ onNavigate }: HeroProps) {
  const cmsTitle = useSiteSnippet('hero_title', NEW_TITLE)
  const cmsSubtitle = useSiteSnippet('hero_subtitle', NEW_SUBTITLE)
  const cmsCta = useSiteSnippet('hero_cta', 'Começar agora')

  const title = [
    'A vida nem sempre colabora.',
    'Entender o que você sente pode começar com um registro por dia.',
  ].includes(cmsTitle) ? NEW_TITLE : cmsTitle

  const subtitle = (
    cmsSubtitle.startsWith('Escreva como foi seu dia.') ||
    cmsSubtitle.startsWith('Um espaço para registrar seus dias')
  ) ? NEW_SUBTITLE : cmsSubtitle

  const cta = ['Começar gratuitamente', 'Criar minha conta gratuita'].includes(cmsCta)
    ? 'Começar agora'
    : cmsCta

  const scrollHowItWorks = () => onNavigate('pricing')

  return (
    <section id="home" className="overflow-hidden border-b border-line bg-[#f8f2e8]">
      <div className="relative mx-auto min-h-[520px] max-w-[1536px] overflow-hidden sm:min-h-[610px] lg:min-h-[670px]">
        <img
          data-testid="home-hero-image"
          src="/images/home/hero-person-approved.webp"
          alt="Mulher sentada em um mirante ao pôr do sol, em um momento de pausa e reflexão."
          className="absolute inset-0 h-full w-full object-cover object-[79%_center] sm:object-[72%_center] lg:object-[72%_center]"
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

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,234,216,0.97)_0%,rgba(244,223,197,0.88)_48%,rgba(244,223,197,0.48)_72%,rgba(244,223,197,0.12)_100%)] sm:bg-gradient-to-r sm:from-[#f7ead8]/96 sm:via-[#f4dfc5]/68 sm:to-transparent lg:via-[#f4dfc5]/30" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/15 to-transparent sm:hidden" />

        <div className="relative z-10 flex min-h-[520px] items-center px-5 py-10 sm:min-h-[610px] sm:px-8 sm:py-14 lg:min-h-[670px] lg:px-14 xl:px-24">
          <div className="max-w-[680px]">
            <p className="max-w-[300px] text-[10px] font-semibold uppercase leading-5 tracking-[0.17em] text-forest-800 sm:max-w-none sm:text-xs sm:tracking-[0.2em]">
              Pequenas reflexões. Grandes possibilidades.
              <span className="sr-only">Pequenos registros. Grandes percepções.</span>
            </p>

            <h1 className="mt-4 max-w-[610px] font-serif text-[2.28rem] leading-[1.01] tracking-[-0.025em] text-[#22150f] sm:mt-6 sm:text-6xl sm:leading-[1.04] sm:tracking-normal lg:max-w-[660px] lg:text-[4.35rem]">
              {title}
            </h1>

            <p className="mt-5 max-w-[520px] text-[0.98rem] leading-6 text-[#302b27] sm:mt-6 sm:max-w-[590px] sm:text-lg sm:leading-7">
              {subtitle}
              <span className="sr-only"> Registrar seus dias pode ajudar a perceber padrões e transformar o que você vive em possibilidades de cuidado.</span>
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <button
                data-cta="hero-comecar-gratis"
                data-cta-location="hero"
                onClick={() => onNavigate('auth')}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800 sm:min-h-0 sm:py-3.5"
              >
                {cta}
                <span className="sr-only">Criar minha conta gratuita</span>
              </button>

              <button
                type="button"
                onClick={scrollHowItWorks}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#5d5148]/55 bg-[#fffaf1]/82 px-8 py-3 text-sm font-semibold text-[#2d251f] shadow-sm backdrop-blur-[3px] transition-colors hover:bg-white sm:min-h-0 sm:bg-white/20 sm:py-3.5"
              >
                Conheça os planos
              </button>
            </div>
            <div className="sr-only">
              <span>Conhecer como funciona</span>
              <span>Gratuito para começar</span>
              <span>Seguro e privado</span>
              <span>Sem julgamentos</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#e6ded3] bg-[#fbf8f3]">
        <div className="mx-auto grid max-w-[1536px] gap-0 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Leaf,
              title: 'Reflexões do dia a dia',
              text: 'Conteúdos reais, sem julgamentos, para uma vida mais leve.',
            },
            {
              icon: BookOpen,
              title: 'Diário e autoconhecimento',
              text: 'Ferramentas para você se ouvir melhor e entender seus padrões.',
            },
            {
              icon: Sprout,
              title: 'Pequenas ações',
              text: 'Passos possíveis para transformar a sua rotina, no seu tempo.',
            },
            {
              icon: Users,
              title: 'Uma comunidade de apoio',
              text: 'Você não está só nessa. Aqui tem gente real, como você.',
            },
          ].map(({ icon: Icon, title: itemTitle, text }) => (
            <div key={itemTitle} className="px-6 py-8 text-center lg:px-8">
              <Icon className="mx-auto h-8 w-8 text-forest-700" strokeWidth={1.7} />
              <h2 className="mt-4 text-sm font-semibold text-ink">{itemTitle}</h2>
              <p className="mx-auto mt-2 max-w-[270px] text-sm leading-6 text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-[560px] items-center gap-4 px-6 pb-8 text-center text-[10px] uppercase tracking-[0.24em] text-[#665f59]">
          <span className="h-px flex-1 bg-[#cfc7bd]" />
          <span>A vida real também é uma grande história</span>
          <span className="h-px flex-1 bg-[#cfc7bd]" />
        </div>
      </div>
    </section>
  )
}
