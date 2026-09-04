import { ArrowRight, Leaf, Lock } from 'lucide-react'
import HeroArt from './HeroArt'
import { useSiteSnippet } from '../lib/siteContent'

interface HeroProps {
  onNavigate: (section: string) => void
}

export default function Hero({ onNavigate }: HeroProps) {
  const kicker = useSiteSnippet('hero_kicker', 'A Vida Não Colabora')
  const title = useSiteSnippet('hero_title', 'A vida nem sempre colabora.')
  const titleAccent = useSiteSnippet('hero_title_accent', 'Você não precisa organizar tudo sozinho.')
  const subtitle = useSiteSnippet('hero_subtitle', 'Escreva como foi seu dia. Aos poucos, o A Vida Não Colabora ajuda você a perceber o que pesa, o que ajuda e o que está mudando.')
  const cta = useSiteSnippet('hero_cta', 'Começar gratuitamente')
  const reassurance = useSiteSnippet('hero_reassurance', 'Privado · sem julgamentos · no seu ritmo')
  return (
    <section id="home" className="bg-paper overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-14 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-forest-600">
              <Leaf className="w-4 h-4" />
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">{kicker}</span>
            </div>

            <h1 className="mt-4 font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.06] text-forest-900">
              {title}<br />
              <span className="text-forest-700">{titleAccent}</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-ink-soft leading-relaxed max-w-xl">
              {subtitle}
            </p>

            <div className="mt-7">
              <button
                data-cta="hero-comecar-gratis"
                data-cta-location="hero"
                onClick={() => onNavigate('diary')}
                className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white font-medium text-sm px-6 py-3.5 rounded-2xl transition-colors shadow-sm"
              >
                {cta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-4 inline-flex items-center gap-2 text-xs text-ink-soft">
              <Lock className="w-3.5 h-3.5 text-forest-500" />
              {reassurance}
            </p>
          </div>

          <div className="relative min-h-[300px] sm:min-h-[390px] flex items-end justify-center lg:justify-end" aria-hidden>
            <div className="absolute inset-6 rounded-full bg-mint/50 blur-3xl" />
            <HeroArt className="relative w-full max-w-[500px] h-auto" />
          </div>
        </div>
      </div>
    </section>
  )
}
