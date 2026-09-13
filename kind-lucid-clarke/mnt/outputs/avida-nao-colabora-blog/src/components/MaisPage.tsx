import {
  ArrowRight, Bell, CreditCard, LifeBuoy, ShieldCheck, User as UserIcon, CircleUserRound,
} from 'lucide-react'
import type { Profile } from '../types'

interface Props { profile: Profile | null; onNavigate: (section: string) => void }

export default function MaisPage({ profile, onNavigate }: Props) {
  const planLabel = profile?.plan === 'plus' || profile?.plan === 'therapeutic' || profile?.plan === 'therapeutic-plus'
    ? 'Plus'
    : profile?.plan === 'essential'
      ? 'Essencial'
      : 'Gratuito'

  const items = [
    { icon:<UserIcon className="w-5 h-5"/>, eyebrow:'Identidade e preferências', title:'Perfil', description:'Nome, foto, privacidade, personalização, e-mails e exportação dos seus dados.', onClick:()=>onNavigate('profile') },
    { icon:<CreditCard className="w-5 h-5"/>, eyebrow:'Assinatura', title:'Meu Plano', description:`Você está no ${planLabel}. Veja recursos, cobrança e opções de mudança de plano.`, onClick:()=>onNavigate('my-plan') },
    { icon:<Bell className="w-5 h-5"/>, eyebrow:'Acompanhamento', title:'Notificações', description:'Avisos sobre relatórios, orientações, descobertas e outras atualizações do seu espaço.', onClick:()=>onNavigate('notifications') },
    { icon:<LifeBuoy className="w-5 h-5"/>, eyebrow:'Ajuda', title:'Suporte', description:'Abra um chamado ou acompanhe uma conversa já iniciada com a equipe.', onClick:()=>onNavigate('support') },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:py-10">
      <header className="max-w-3xl border-b border-line pb-7 sm:pb-9">
        <div className="flex items-center gap-2 text-forest-600"><CircleUserRound className="w-5 h-5"/><p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Sua conta</p></div>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-forest-900 mt-1.5">Conta</h1>
        <p className="mt-2 text-ink-soft max-w-2xl leading-relaxed">Tudo o que diz respeito ao seu acesso, assinatura, privacidade, notificações e suporte fica reunido aqui.</p>
      </header>

      <section className="py-7 sm:py-9" aria-labelledby="account-options-heading">
        <h2 id="account-options-heading" className="sr-only">Opções da conta</h2>
        <div className="divide-y divide-line border-y border-line">
          {items.map(item => (
            <button key={item.title} onClick={item.onClick} className="group grid w-full gap-4 py-5 text-left sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center sm:py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300">
              <span className="w-11 h-11 rounded-2xl bg-mint text-forest-700 flex items-center justify-center">{item.icon}</span>
              <span className="min-w-0"><span className="block text-[10px] uppercase tracking-[0.14em] font-semibold text-forest-600">{item.eyebrow}</span><span className="block font-serif text-xl text-forest-900 mt-1">{item.title}</span><span className="block text-sm text-ink-soft mt-1.5 leading-relaxed max-w-2xl">{item.description}</span></span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700 sm:justify-self-end">Abrir <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/></span>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-sand-50 rounded-3xl px-5 py-5 sm:px-6 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0"><span className="w-10 h-10 rounded-2xl bg-white text-forest-700 flex items-center justify-center flex-shrink-0"><ShieldCheck className="w-5 h-5"/></span><div><p className="text-sm font-semibold text-forest-900">Privacidade e controle dos seus dados</p><p className="text-xs sm:text-sm text-ink-soft mt-1 leading-relaxed">A personalização com o histórico, preferências de conteúdo, segurança e exportação de dados ficam dentro de Perfil.</p></div></div>
        <button onClick={()=>onNavigate('profile')} className="inline-flex items-center justify-center gap-2 text-sm font-medium text-forest-800 border border-line bg-white rounded-2xl px-4 py-2.5 hover:bg-mint/40 transition-colors flex-shrink-0">Abrir perfil <ArrowRight className="w-4 h-4"/></button>
      </section>
    </div>
  )
}
