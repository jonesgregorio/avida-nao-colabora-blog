import {
  NotebookPen, Compass, BookOpen, CalendarCheck, MessageSquare,
  Lock, ArrowRight, CreditCard, LifeBuoy, HeartPulse, Sparkles,
} from 'lucide-react'
import type { Profile } from '../types'

interface LoggedHomeProps {
  profile: Profile | null
  onNavigate: (section: string) => void
}

const normalizePlan = (p?: string | null): 'free' | 'essential' | 'plus' => {
  if (p === 'therapeutic' || p === 'therapeutic-plus' || p === 'therapeutic_plus' || p === 'plus') return 'plus'
  if (p === 'essential') return 'essential'
  return 'free'
}

const PLAN_LABEL: Record<string, string> = { free: 'Gratuito', essential: 'Essencial', plus: 'Plus' }

export default function LoggedHome({ profile, onNavigate }: LoggedHomeProps) {
  const plan = normalizePlan(profile?.plan)
  const isPlus = plan === 'plus'
  const paid = plan === 'essential' || plan === 'plus'
  const name = profile?.preferred_name || profile?.display_name || profile?.full_name?.split(' ')[0] || 'você'

  const features = [
    {
      Icon: NotebookPen, bg: 'bg-mint', color: 'text-forest-600',
      title: 'Diário emocional',
      desc: paid ? 'Registre o que viveu e sentiu, sem limite.' : 'Registre como está e crie seu histórico.',
      to: 'diary', locked: false,
    },
    {
      Icon: Compass, bg: 'bg-sky', color: 'text-[#3d6ea5]',
      title: 'Mapa emocional',
      desc: paid ? 'Padrões, gráficos, histórico e relatórios.' : 'Versão inicial — complete no Essencial.',
      to: 'my-evolution', locked: false,
    },
    {
      Icon: BookOpen, bg: 'bg-lilac', color: 'text-[#7c5cbf]',
      title: 'Conteúdos guiados',
      desc: paid ? 'Artigos, práticas, trilhas e meditações.' : 'Conteúdos abertos e algumas práticas guiadas.',
      to: 'articles', locked: false,
    },
    {
      Icon: CalendarCheck, bg: 'bg-coral', color: 'text-[#c05f3c]',
      title: 'Plano de autocuidado',
      desc: 'Plano mensal com ações práticas para o seu momento.',
      to: isPlus ? 'my-evolution' : 'pricing', locked: !isPlus, plus: true,
    },
    {
      Icon: MessageSquare, bg: 'bg-mint', color: 'text-forest-600',
      title: 'Orientação profissional',
      desc: 'Comentário e orientação mensal por mensagem.',
      to: isPlus ? 'my-evolution' : 'pricing', locked: !isPlus, plus: true,
    },
  ]

  const upgrade =
    plan === 'free'
      ? { text: 'Desbloqueie o Mapa emocional completo, os conteúdos guiados e o relatório semanal.', cta: 'Conhecer o Essencial' }
      : plan === 'essential'
        ? { text: 'Ative o Plano de autocuidado, o Relatório aprofundado e a Orientação profissional.', cta: 'Conhecer o Plus' }
        : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Saudação */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900">Olá, {name}</h1>
          <p className="mt-2 text-ink-soft">Que bom ter você aqui. Por onde quer começar hoje?</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-mint text-forest-700">
            Plano {PLAN_LABEL[plan]}
          </span>
          <button
            onClick={() => onNavigate('diary')}
            className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
          >
            <HeartPulse className="w-4 h-4" />
            Fazer check-in
          </button>
        </div>
      </div>

      {/* 5 funcionalidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(f => (
          <button
            key={f.title}
            onClick={() => onNavigate(f.to)}
            className={`relative text-left bg-white border border-line rounded-3xl p-6 hover:shadow-md hover:border-forest-200 transition-all group ${f.locked ? 'opacity-95' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className={`w-12 h-12 rounded-full ${f.bg} flex items-center justify-center`}>
                <f.Icon className={`w-6 h-6 ${f.color}`} />
              </span>
              {'plus' in f && f.plus && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-coral text-[#b0532f]">Plus</span>
              )}
            </div>
            <h3 className="mt-4 font-serif text-xl text-forest-900">{f.title}</h3>
            <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{f.desc}</p>
            <span className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${f.locked ? 'text-[#c05f3c]' : 'text-forest-700'}`}>
              {f.locked ? <><Lock className="w-3.5 h-3.5" /> Disponível no Plus</> : <>Abrir <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}
            </span>
          </button>
        ))}

        {/* Meu plano + Suporte */}
        <button
          onClick={() => onNavigate('my-plan')}
          className="text-left bg-paper-soft border border-line rounded-3xl p-6 hover:shadow-md hover:border-forest-200 transition-all group flex items-center gap-4"
        >
          <span className="w-12 h-12 rounded-full bg-mint flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-6 h-6 text-forest-600" />
          </span>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-forest-900">Meu plano</h3>
            <p className="text-sm text-ink-soft">Gerencie sua assinatura.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-ink-soft group-hover:text-forest-700 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* Suporte (linha) */}
      <button
        onClick={() => onNavigate('support')}
        className="mt-4 w-full text-left bg-paper-soft border border-line rounded-3xl p-5 hover:shadow-md hover:border-forest-200 transition-all group flex items-center gap-4"
      >
        <span className="w-11 h-11 rounded-full bg-sky flex items-center justify-center flex-shrink-0">
          <LifeBuoy className="w-5 h-5 text-[#3d6ea5]" />
        </span>
        <div className="flex-1">
          <h3 className="font-serif text-lg text-forest-900">Suporte</h3>
          <p className="text-sm text-ink-soft">Precisa de ajuda? Fale com a gente.</p>
        </div>
        <ArrowRight className="w-5 h-5 text-ink-soft group-hover:text-forest-700 group-hover:translate-x-0.5 transition-all" />
      </button>

      {/* Convite de upgrade conforme o plano */}
      {upgrade && (
        <div className="mt-8 bg-forest-900 rounded-3xl px-6 py-7 text-white flex flex-col md:flex-row md:items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </span>
          <p className="flex-1 text-sm leading-relaxed text-forest-50">{upgrade.text}</p>
          <button
            onClick={() => onNavigate('pricing')}
            className="inline-flex items-center gap-2 bg-white text-forest-900 hover:bg-forest-50 text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors whitespace-nowrap"
          >
            {upgrade.cta}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
