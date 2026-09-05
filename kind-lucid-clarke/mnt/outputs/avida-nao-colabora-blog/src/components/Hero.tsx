import { ArrowRight, BookOpen, Heart, Leaf, ShieldCheck, Sprout, Users } from 'lucide-react'
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

  const scrollHowItWorks = () => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section id="home" className="overflow-hidden border-b border-line bg-[#f8f2e8]">
      <div className="mx-auto grid max-w-[1536px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex items-center px-5 py-12 sm:px-8 sm:py-16 lg:px-14 lg:py-20 xl:px-24">
          <div className="max-w-[680px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-700">
              Pequenos registros. Grandes percepções.
            </p>

            <h1 className="mt-5 font-serif text-[2.65rem] leading-[1.04] text-[#22150f] sm:text-5xl lg:text-[3.85rem]">
              {title}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-ink-soft sm:text-lg">
              {subtitle}
              <span className="sr-only"> Registrar seus dias pode ajudar a perceber padrões e transformar o que você vive em possibilidades de cuidado.</span>
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                data-cta="hero-comecar-gratis"
                data-cta-location="hero"
                onClick={() => onNavigate('auth')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-forest-900 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800"
              >
                {cta} <ArrowRight className="h-4 w-4" />
                <span className="sr-only">Criar minha conta gratuita</span>
              </button>

              <button
                type="button"
                onClick={scrollHowItWorks}
                className="inline-flex items-center justify-center rounded-full border border-forest-700/70 bg-white/25 px-7 py-3.5 text-sm font-semibold text-forest-900 transition-colors hover:bg-white/60"
              >
                Conhecer como funciona
              </button>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs text-forest-800">
              <span className="inline-flex items-center gap-2"><Leaf className="h-4 w-4" /> Gratuito para começar</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Seguro e privado</span>
              <span className="inline-flex items-center gap-2"><Heart className="h-4 w-4" /> Sem julgamentos</span>
            </div>
          </div>
        </div>

        <div className="relative min-h-[430px] overflow-hidden bg-[#d9c8b6] sm:min-h-[520px] lg:min-h-[620px]">
          <img
            src="/images/home/hero-reflection-sunrise.webp"
            alt="Pessoa em um momento de pausa e reflexão ao nascer do sol, com uma caneca e um caderno."
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            width="776"
            height="675"
          />
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
              text: 'Um espaço acolhedor para seguir acompanhado, sem pressão.',
            },
          ].map(({ icon: Icon, title: itemTitle, text }) => (
            <div key={itemTitle} className="px-6 py-8 text-center lg:px-8">
              <Icon className="mx-auto h-8 w-8 text-forest-700" strokeWidth={1.7} />
              <h2 className="mt-4 text-sm font-semibold text-ink">{itemTitle}</h2>
              <p className="mx-auto mt-2 max-w-[270px] text-sm leading-6 text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
