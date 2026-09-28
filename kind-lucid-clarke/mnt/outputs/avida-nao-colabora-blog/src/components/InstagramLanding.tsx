import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Heart, LockKeyhole, Map, Sparkles } from 'lucide-react'
import { trackEvent } from '../lib/analytics'
import { setPendingAction } from '../lib/pendingAction'
import { LogoIcon } from './Logo'

const MOODS = [
  { value: 'muito-bem', emoji: '🙂', label: 'Muito bem' },
  { value: 'bem', emoji: '😌', label: 'Bem' },
  { value: 'neutro', emoji: '😐', label: 'Mais ou menos' },
  { value: 'mal', emoji: '😔', label: 'Difícil' },
  { value: 'muito-mal', emoji: '😣', label: 'Muito difícil' },
] as const

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

function continueToSignup(position: string, mood?: string) {
  if (mood) setPendingAction({ view: 'diary', mood })
  trackEvent('signup_cta_click', { metadata: { source: 'instagram', cta_position: position, funnel_step: mood ? 'checkin_selected' : 'landing' } })
  window.location.assign(signupUrl(position))
}

function SignupButton({ position, children, mood }: { position: string; children: React.ReactNode; mood?: string }) {
  return <button type="button" onClick={() => continueToSignup(position, mood)} data-cta="ig-signup" data-cta-location={position} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400 focus-visible:ring-offset-2 sm:w-auto">{children}<ArrowRight className="h-4 w-4" /></button>
}

export default function InstagramLanding() {
  const [mood, setMood] = useState<string | null>(null)

  useEffect(() => {
    trackEvent('ig_landing_view', { metadata: { source: 'instagram', breakpoint: window.innerWidth <= 430 ? 'mobile' : 'desktop', funnel_step: 'landing' } })
    document.title = 'Seu momento de hoje | A Vida Não Colabora'
  }, [])

  const chooseMood = (value: string) => {
    setMood(value)
    // Não enviamos qual emoção foi escolhida para analytics.
    trackEvent('pre_signup_checkin_selected', { metadata: { source: 'instagram', funnel_step: 'checkin_selected' } })
  }

  return <div className="min-h-screen bg-paper text-ink">
    <header className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-5"><LogoIcon className="h-7 w-7 text-forest-800"/><span className="font-serif text-lg text-forest-900">A Vida Não Colabora</span></header>
    <main>
      <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 pb-10 pt-5 sm:px-8 md:grid-cols-2 md:pb-16 md:pt-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-forest-600">Seu momento de hoje</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-forest-900 sm:text-5xl">Como você está hoje?</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-soft">Escolha como este momento está para você. Depois de criar sua conta, continuamos exatamente daqui.</p>
          <div className="mt-6 grid grid-cols-5 gap-2" role="group" aria-label="Como você está hoje?">
            {MOODS.map(item => <button key={item.value} type="button" aria-pressed={mood === item.value} aria-label={item.label} onClick={() => chooseMood(item.value)} className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border px-1 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-400 ${mood === item.value ? 'border-forest-600 bg-mint shadow-sm' : 'border-line bg-white hover:border-forest-300'}`}><span className="text-2xl" aria-hidden="true">{item.emoji}</span><span className="mt-1 hidden text-[10px] leading-tight text-ink-soft sm:block">{item.label}</span></button>)}
          </div>
          <div className="mt-6"><SignupButton position="hero" mood={mood || undefined}>{mood ? 'Continuar meu check-in grátis' : 'Criar conta e fazer meu check-in'}</SignupButton></div>
          <p className="mt-3 text-xs text-ink-soft">Sem cartão. Privado. Leva cerca de 2 minutos. Sua escolha fica apenas nesta sessão até você entrar.</p>
          <ul className="mt-6 space-y-2 text-sm text-forest-900">{['Registre como você está.','Perceba padrões emocionais.','Acompanhe sua evolução com leveza.'].map(x=><li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600"/>{x}</li>)}</ul>
        </div>
        <div className="rounded-3xl border border-line bg-white p-4 shadow-sm" aria-label="Demonstração das principais ferramentas">
          <div className="rounded-2xl bg-mint/60 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-forest-600">Check-in</p><p className="mt-2 font-serif text-2xl text-forest-900">Seu primeiro registro continua após o cadastro</p><p className="mt-3 text-sm leading-6 text-ink-soft">A emoção escolhida antes de criar a conta é retomada no Diário. Você não precisa começar de novo.</p></div>
          <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-line p-4"><BookOpen className="h-5 w-5 text-forest-600"/><p className="mt-2 text-sm font-semibold">Diário</p><p className="mt-1 text-xs text-ink-soft">Continue seu primeiro registro.</p></div><div className="rounded-2xl border border-line p-4"><Map className="h-5 w-5 text-forest-600"/><p className="mt-2 text-sm font-semibold">Mapa emocional</p><p className="mt-1 text-xs text-ink-soft">Veja padrões ao longo do tempo.</p></div></div>
        </div>
      </section>
      <section className="border-y border-line bg-paper-soft"><div className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><h2 className="font-serif text-2xl text-forest-900">Comece em três passos</h2><div className="mt-6 grid gap-4 sm:grid-cols-3">{[['1','Marque seu momento','Escolha como você está agora, sem escrever nada.'],['2','Crie sua conta','Só e-mail, senha e aceite dos termos.'],['3','Continue de onde parou','Após entrar, o Diário abre com seu humor inicial já selecionado.']].map(([n,t,d])=><div key={n} className="rounded-2xl bg-white p-5"><span className="text-xs font-bold text-forest-600">{n}</span><h3 className="mt-2 font-semibold text-forest-900">{t}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{d}</p></div>)}</div></div></section>
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-line p-5"><LockKeyhole className="h-5 w-5 text-forest-600"/><h3 className="mt-3 font-semibold">Privacidade primeiro</h3><p className="mt-2 text-sm leading-6 text-ink-soft">A escolha pré-cadastro fica temporariamente na sessão do navegador e é removida ao ser retomada. O conteúdo emocional não é enviado ao analytics.</p></div><div className="rounded-2xl border border-line p-5"><Sparkles className="h-5 w-5 text-forest-600"/><h3 className="mt-3 font-semibold">Gratuito para começar</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Comece sem cartão e conheça as ferramentas disponíveis no plano gratuito.</p></div><div className="rounded-2xl border border-line p-5"><Heart className="h-5 w-5 text-forest-600"/><h3 className="mt-3 font-semibold">Autocuidado sem pressão</h3><p className="mt-2 text-sm leading-6 text-ink-soft">A plataforma apoia organização e reflexão, mas não substitui psicoterapia, diagnóstico ou atendimento profissional.</p></div></div><div className="mt-9 rounded-3xl bg-mint/50 px-5 py-8 text-center"><h2 className="font-serif text-2xl text-forest-900">Seu primeiro registro pode começar agora.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-soft">Escolha seu momento acima ou crie sua conta gratuita e faça o check-in dentro do AVNC.</p><div className="mt-5"><SignupButton position="final" mood={mood || undefined}>{mood ? 'Continuar de onde parei' : 'Criar minha conta grátis'}</SignupButton></div></div></section>
    </main>
    <footer className="border-t border-line px-5 py-6 text-center text-xs text-ink-soft">A Vida Não Colabora • Privacidade e autocuidado com responsabilidade.</footer>
  </div>
}
