import { useEffect } from 'react'
import { ArrowRight, CheckCircle2, Heart, ShieldCheck, Sprout } from 'lucide-react'
import { trackEvent } from '../lib/analytics'
import Logo from './Logo'

interface InstagramLandingProps {
  onNavigate: (section: string) => void
}

const STEPS = [
  ['Registre', 'Responda a um check-in rápido sobre como você está.'],
  ['Perceba', 'Organize o que sente e reconheça padrões com mais clareza.'],
  ['Acompanhe', 'Veja sua história emocional ganhar forma ao longo dos dias.'],
] as const

export default function InstagramLanding({ onNavigate }: InstagramLandingProps) {
  useEffect(() => {
    trackEvent('ig_landing_view', { metadata: { location: 'instagram_landing' } })
  }, [])

  const startSignup = (position: string) => {
    trackEvent('signup_cta_click', { metadata: { location: 'instagram_landing', position } })
    onNavigate('auth-signup')
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo onClick={() => onNavigate('home')} compact />
          <button onClick={() => onNavigate('auth')} className="text-sm font-medium text-forest-800 hover:text-forest-950">
            Já tenho conta
          </button>
        </div>
      </header>

      <main>
        <section className="overflow-hidden px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-sm font-medium text-forest-800">
                <Sprout className="h-4 w-4" /> Seu momento de hoje
              </p>
              <h1 className="mt-5 font-serif text-4xl leading-tight text-forest-950 sm:text-5xl lg:text-6xl">
                Como você está hoje?
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                Faça um check-in emocional de poucos minutos e comece a perceber o que se repete nos seus dias.
              </p>
              <button
                onClick={() => startSignup('hero')}
                data-cta="ig-signup-hero"
                data-cta-location="instagram_landing"
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-forest-900 px-6 py-3.5 font-medium text-white transition-colors hover:bg-forest-800 sm:w-auto"
              >
                Fazer meu primeiro check-in grátis <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                <ShieldCheck className="h-4 w-4 text-forest-700" /> Sem cartão. Privado. Leva cerca de 2 minutos.
              </p>
            </div>

            <div className="rounded-[2rem] border border-line bg-paper-soft p-5 shadow-sm sm:p-7" aria-label="Exemplo de check-in emocional">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">Check-in de hoje</p>
                <h2 className="mt-2 font-serif text-2xl text-forest-950">O que mais combina com este momento?</h2>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {['Mais leve', 'Cansada(o)', 'Ansiosa(o)', 'Sobrecarregada(o)'].map((mood, index) => (
                    <div key={mood} className={`rounded-2xl border p-3 text-sm ${index === 2 ? 'border-forest-500 bg-mint text-forest-900' : 'border-line text-ink-soft'}`}>
                      <span className="mr-2" aria-hidden="true">{['🌿', '🌙', '🌊', '☁️'][index]}</span>{mood}
                    </div>
                  ))}
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-mint">
                  <div className="h-full w-1/3 rounded-full bg-forest-600" />
                </div>
                <p className="mt-2 text-right text-xs text-ink-soft">1 de 3</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-forest-600">Um começo simples</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-center font-serif text-3xl text-forest-950 sm:text-4xl">Menos cobrança. Mais clareza sobre você.</h2>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {STEPS.map(([title, description], index) => (
                <article key={title} className="rounded-3xl border border-line bg-paper-soft p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-900 text-sm font-semibold text-white">{index + 1}</span>
                  <h3 className="mt-4 font-serif text-2xl text-forest-950">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-line bg-paper-soft p-7">
              <ShieldCheck className="h-7 w-7 text-forest-700" />
              <h2 className="mt-4 font-serif text-2xl text-forest-950">Um espaço seu e privado</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">Seus registros ficam associados à sua conta. Você escolhe o que anotar e pode começar sem informar cartão.</p>
            </article>
            <article className="rounded-3xl border border-line bg-mint/60 p-7">
              <Heart className="h-7 w-7 text-forest-700" />
              <h2 className="mt-4 font-serif text-2xl text-forest-950">O gratuito já permite começar</h2>
              <ul className="mt-4 space-y-3 text-sm text-ink-soft">
                {['Primeiro check-in emocional', 'Registros para acompanhar seus dias', 'Conteúdos de apoio e autocuidado'].map(item => (
                  <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-forest-700" /> {item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="mx-auto max-w-4xl rounded-[2rem] bg-forest-950 px-6 py-10 text-center text-white sm:px-10">
            <h2 className="font-serif text-3xl sm:text-4xl">Comece pelo que você sente hoje.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/75">Crie sua conta grátis e faça seu primeiro registro em poucos minutos.</p>
            <button
              onClick={() => startSignup('final')}
              data-cta="ig-signup-final"
              data-cta-location="instagram_landing"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-medium text-forest-950 transition-colors hover:bg-mint sm:w-auto"
            >
              Criar minha conta grátis <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-xs text-white/60">A plataforma oferece recursos de bem-estar e não substitui acompanhamento profissional.</p>
          </div>
        </section>
      </main>
    </div>
  )
}
