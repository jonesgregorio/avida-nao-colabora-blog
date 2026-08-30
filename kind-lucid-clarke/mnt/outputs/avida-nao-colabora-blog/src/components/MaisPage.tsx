import {
  ArrowRight, Bell, ClipboardList, CreditCard, LifeBuoy, MessageCircle,
  MoreHorizontal, ShieldCheck, User as UserIcon,
} from 'lucide-react'
import type { Profile } from '../types'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'

interface Props {
  profile: Profile | null
  onNavigate: (section: string) => void
}

// "Mais" tira as ferramentas de conta e uso menos frequente da navegação
// principal, para elas não competirem com a jornada diária. Nada é removido —
// só reorganizado. Fase 19R.1.
export default function MaisPage({ profile, onNavigate }: Props) {
  const plan = normalizePlan(profile?.plan)
  const guidanceAccess = hasPlanAccess(plan, 'plus')

  const items = [
    {
      icon: <ClipboardList className="w-5 h-5" />,
      title: 'Questionários',
      description: 'Avaliações pontuais e a sua evolução ao longo do tempo.',
      onClick: () => onNavigate('questionarios'),
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: 'Orientação por mensagem',
      description: guidanceAccess
        ? 'Tire dúvidas e receba orientação durante o mês.'
        : 'Orientação por mensagem — disponível no Plus.',
      onClick: () => onNavigate(guidanceAccess ? 'monthly-guidance' : 'pricing'),
    },
    {
      icon: <Bell className="w-5 h-5" />,
      title: 'Notificações',
      description: 'Acompanhamentos, descobertas e retrospectivas.',
      onClick: () => onNavigate('notifications'),
    },
    {
      icon: <UserIcon className="w-5 h-5" />,
      title: 'Perfil',
      description: 'Nome, foto, preferências de e-mail e de temas de conteúdo.',
      onClick: () => onNavigate('profile'),
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      title: 'Meu Plano',
      description: 'Sua assinatura, mudança de plano e faturamento.',
      onClick: () => onNavigate('my-plan'),
    },
    {
      icon: <LifeBuoy className="w-5 h-5" />,
      title: 'Suporte',
      description: 'Abrir chamado e acompanhar respostas.',
      onClick: () => onNavigate('support'),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header>
        <div className="flex items-center gap-2 text-forest-600">
          <MoreHorizontal className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Conta e ajustes</p>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Mais</h1>
        <p className="mt-2 text-ink-soft max-w-2xl leading-relaxed">
          Suas ferramentas de conta e ajustes, fora do caminho do dia a dia.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(item => (
          <button
            key={item.title}
            onClick={item.onClick}
            className="group text-left rounded-2xl border border-line bg-paper-soft p-4 sm:p-5 hover:border-forest-200 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
          >
            <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center">{item.icon}</span>
            <h2 className="font-serif text-lg text-forest-900 mt-3">{item.title}</h2>
            <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">{item.description}</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 mt-3">
              Abrir <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-forest-900">Privacidade, preferências e exportação de dados</p>
            <p className="text-xs text-ink-soft mt-0.5">
              A personalização com o histórico, os temas de conteúdo e a exportação dos seus dados ficam no seu perfil.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('profile')}
          className="inline-flex items-center justify-center gap-2 text-sm font-medium text-forest-800 border border-line rounded-2xl px-4 py-2.5 hover:bg-mint/40 transition-colors flex-shrink-0"
        >
          Abrir perfil <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  )
}
