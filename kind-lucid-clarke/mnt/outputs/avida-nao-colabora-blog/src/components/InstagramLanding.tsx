import { useEffect } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Heart, LockKeyhole, Map, Sparkles } from 'lucide-react'
import { trackEvent } from '../lib/analytics'
import { LogoIcon } from './Logo'

function signupUrl(position: string) {
  const current = new URL(window.location.href)
  const params = new URLSearchParams()
  params.set('modo', 'cadastro')
  ;['utm_source','utm_medium','utm_campaign','utm_content'].forEach((key) => {
    const value = current.searchParams.get(key)
    if (value) params.set(key, value)
  })
  params.set('origem', 'instagram')
  params.set('cta', position)
  return `/login?${params.toString()}`
}

function SignupButton({ position, children }: { position: string; children: React.ReactNode }) {
  return <a href={signupUrl(position)} data-cta="ig-signup" data-cta-location={position} onClick={() => trackEvent('signup_cta_click', { metadata: { source: 'instagram', cta_position: position, funnel_step: 'landing' } })} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 sm:w-auto">{children}<ArrowRight className="h-4 w-4" /></a>
}

export default function InstagramLanding() {
  useEffect(() => {
    trackEvent('ig_landing_view', { metadata: { source: 'instagram', breakpoint: window.innerWidth <= 430 ? 'mobile' : 'desktop', funnel_step: 'landing' } })
    document.title = 'Seu momento de hoje | A Vida Não Colabora'
  }, [])

  return <div className="min-h-screen bg-paper text-ink">
    <header className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-5"><LogoIcon className="h-7 w-7 text-forest-800"/><span className="font-serif text-lg text-forest-900">A Vida Não Colabora</span></header>
    <main>
      <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 pb-10 pt-5 sm:px-8 md:grid-cols-2 md:pb-16 md:pt-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-forest-600">Seu momento de hoje</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-forest-900 sm:text-5xl">Como você está hoje?</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-soft">Faça um check-in emocional de poucos minutos e comece a perceber o que se repete nos seus dias.</p>
          <div className="mt-6"><SignupButton position="hero">Fazer meu primeiro check-in grátis</SignupButton></div>
          <p className="mt-3 text-xs text-ink-soft">Sem cartão. Privado. Leva cerca de 2 minutos.</p>
          <ul className="mt-6 space-y-2 text-sm text-forest-900">{['Registre como você está.','Perceba padrões emocionais.','Acompanhe sua evolução com leveza.'].map(x=><li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600"/>{x}</li>)}</ul>
        </div>
        <div className="rounded-3xl border border-line bg-white p-4 shadow-sm" aria-label="Demonstração das principais ferramentas">
          <div className="rounded-2xl bg-mint/60 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-forest-600">Check-in</p><p className="mt-2 font-serif text-2xl text-forest-900">Como foi seu dia?</p><div className="mt-4 grid grid-cols-5 gap-2">{['🙂','😌','😐','😔','😣'].map(x=><span key={x} className="grid aspect-square place-items-center rounded-xl bg-white text-xl">{x}</span>)}</div></div>
          <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-line p-4"><BookOpen className="h-5 w-5 text-forest-600"/><p className="mt-2 text-sm font-semibold">Diário</p><p className="mt-1 text-xs text-ink-soft">Registre o que viveu.</p></div><div className="rounded-2xl border border-line p-4"><Map className="h-5 w-5 text-forest-600"/><p className="mt-2 text-sm font-semibold">Mapa emocional</p><p className="mt-1 text-xs text-ink-soft">Veja padrões ao longo do tempo.</p></div></div>
        </div>
      </section>
      <section className="border-y border-line bg-paper-soft"><div className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><h2 className="font-serif text-2xl text-forest-900">Comece em três passos</h2><div className="mt-6 grid gap-4 sm:grid-cols-3">{[['1','Crie sua conta','Só e-mail, senha e aceite dos termos.'],['2','Faça seu check-in','Reserve cerca de dois minutos para registrar seu momento.'],['3','Observe sua evolução','Use diário e mapa emocional para perceber o que muda e o que se repete.']].map(([n,t,d])=><div key={n} className="rounded-2xl bg-white p-5"><span className="text-xs font-bold text-forest-600">{n}</span><h3 className="mt-2 font-semibold text-forest-900">{t}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{d}</p></div>)}</div></div></section>
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-line p-5"><LockKeyhole className="h-5 w-5 text-forest-600"/><h3 className="mt-3 font-semibold">Privacidade primeiro</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Seus registros são pessoais. Não usamos o conteúdo emocional do check-in em analytics.</p></div><div className="rounded-2xl border border-line p-5"><Sparkles className="h-5 w-5 text-forest-600"/><h3 className="mt-3 font-semibold">Gratuito para começar</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Comece sem cartão e conheça as ferramentas disponíveis no plano gratuito.</p></div><div className="rounded-2xl border border-line p-5"><Heart className="h-5 w-5 text-forest-600"/><h3 className="mt-3 font-semibold">Autocuidado sem pressão</h3><p className="mt-2 text-sm leading-6 text-ink-soft">A plataforma apoia organização e reflexão, mas não substitui psicoterapia, diagnóstico ou atendimento profissional.</p></div></div><div className="mt-9 rounded-3xl bg-mint/50 px-5 py-8 text-center"><h2 className="font-serif text-2xl text-forest-900">Seu primeiro registro pode começar hoje.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-soft">Crie sua conta gratuita e faça seu primeiro check-in.</p><div className="mt-5"><SignupButton position="final">Começar meu check-in grátis</SignupButton></div></div></section>
    </main>
    <footer className="border-t border-line px-5 py-6 text-center text-xs text-ink-soft">A Vida Não Colabora • Privacidade e autocuidado com responsabilidade.</footer>
  </div>
}
