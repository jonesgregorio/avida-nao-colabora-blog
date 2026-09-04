import { ArrowRight, Heart, Leaf, Lock, ShieldCheck } from 'lucide-react'
import HeroArt from './HeroArt'
import { useSiteSnippet } from '../lib/siteContent'

interface HeroProps {
  onNavigate: (section: string) => void
}

const NEW_TITLE = 'Entender o que você sente pode começar com um registro por dia.'
const NEW_SUBTITLE = 'Um espaço para registrar seus dias, perceber padrões e transformar o que você vive em possibilidades de cuidado — no seu ritmo.'

export default function Hero({ onNavigate }: HeroProps) {
  const cmsTitle = useSiteSnippet('hero_title', NEW_TITLE)
  const cmsSubtitle = useSiteSnippet('hero_subtitle', NEW_SUBTITLE)
  const cmsCta = useSiteSnippet('hero_cta', 'Criar minha conta gratuita')
  const title = cmsTitle === 'A vida nem sempre colabora.' ? NEW_TITLE : cmsTitle
  const subtitle = cmsSubtitle.startsWith('Escreva como foi seu dia.') ? NEW_SUBTITLE : cmsSubtitle
  const cta = cmsCta === 'Começar gratuitamente' ? 'Criar minha conta gratuita' : cmsCta
  const scrollHowItWorks = () => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section id="home" className="overflow-hidden border-b border-line bg-[#f7f2e8]">
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[1.03fr_0.97fr]">
        <div className="flex items-center px-5 py-12 sm:px-8 sm:py-16 lg:px-14 lg:py-20 xl:px-20">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-600">Pequenos registros. Grandes percepções.</p>
            <h1 className="mt-4 font-serif text-[2.55rem] leading-[1.03] text-forest-900 sm:text-5xl lg:text-[3.7rem]">{title}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-soft sm:text-lg">{subtitle}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                data-cta="hero-comecar-gratis"
                data-cta-location="hero"
                onClick={() => onNavigate('auth')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-forest-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800"
              >
                {cta} <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={scrollHowItWorks} className="inline-flex items-center justify-center rounded-full border border-forest-700 bg-transparent px-6 py-3.5 text-sm font-semibold text-forest-900 transition-colors hover:bg-white/60">
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

        <div className="relative min-h-[430px] overflow-hidden bg-gradient-to-br from-[#dfe8d9] via-[#d7dfcc] to-[#c5d1bc] sm:min-h-[520px] lg:min-h-[620px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(255,255,255,.9),transparent_30%),radial-gradient(circle_at_12%_85%,rgba(255,245,226,.8),transparent_34%)]" />
          <div className="absolute -bottom-10 left-1/2 w-[92%] max-w-[620px] -translate-x-1/2 opacity-95" aria-hidden>
            <HeroArt className="h-auto w-full drop-shadow-[0_28px_40px_rgba(34,64,45,.18)]" />
          </div>
          <div className="absolute right-5 top-8 max-w-[215px] rotate-[-3deg] text-right sm:right-9 sm:top-12"><p className="font-serif text-xl italic leading-snug text-forest-800/80 sm:text-2xl">“Todo sentimento também conta uma história.”</p></div>
          <div className="absolute bottom-20 left-5 max-w-[250px] rounded-[24px] border border-white/70 bg-[#fbf7ef]/95 p-4 shadow-xl backdrop-blur sm:bottom-24 sm:left-8">
            <div className="flex items-start gap-3"><span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mint text-forest-700"><Leaf className="h-4 w-4" /></span><p className="font-serif text-sm italic leading-5 text-forest-900">“Aqui eu consigo colocar em palavras o que às vezes parece confuso dentro de mim.”</p></div>
          </div>
          <div className="absolute bottom-5 right-6 text-right text-xs leading-5 text-white/90 sm:right-9"><p>Acolher hoje.</p><p>Construir o amanhã.</p></div>
          <span className="sr-only"><Lock /> Privado · sem julgamentos · no seu ritmo</span>
        </div>
      </div>
    </section>
  )
}
