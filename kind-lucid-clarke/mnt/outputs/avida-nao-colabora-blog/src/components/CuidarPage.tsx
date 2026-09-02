import type { User } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, Lock, MessageSquareText, Sprout } from 'lucide-react'
import type { Profile } from '../types'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import RecommendedContent from './RecommendedContent'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigate: (section: string) => void
  onOpenArticle: (slug: string) => void
}

// "Cuidar" responde a uma pergunta diferente das áreas de análise: "não quero
// analisar mais, quero algo que possa me ajudar agora". Só reúne recursos reais.
export default function CuidarPage({ user, profile, onNavigate, onOpenArticle }: Props) {
  const plan = normalizePlan(profile?.plan)
  const selfCareAccess = hasPlanAccess(plan, 'plus')
  const guidanceAccess = hasPlanAccess(plan, 'plus')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <header className="max-w-2xl">
        <div className="flex items-center gap-2 text-forest-600">
          <Sprout className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Cuidado</p>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Cuidar</h1>
        <p className="mt-2 text-ink-soft leading-relaxed">
          Você não precisa analisar mais nada agora. Escolha só o que parecer possível para este momento.
        </p>
      </header>

      {user && (
        <section className="rounded-3xl border border-forest-100 bg-gradient-to-br from-mint/45 via-paper-soft to-sand-50 p-5 sm:p-6" aria-labelledby="care-now-heading">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Talvez ajude agora</p>
          <h2 id="care-now-heading" className="font-serif text-2xl text-forest-900 mt-1 mb-4">Uma possibilidade para este momento</h2>
          <RecommendedContent
            user={user}
            profile={profile}
            source="care"
            limit={1}
            title="Talvez isso ajude agora"
            description="Uma sugestão escolhida a partir dos seus registros recentes."
            variant="compact"
            showEmpty
            onOpen={onOpenArticle}
            onCheckin={() => onNavigate('diary')}
            onDiary={() => onNavigate('diary')}
            onSeeAll={() => onNavigate('articles')}
          />
        </section>
      )}

      <section aria-labelledby="your-care-heading">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Seu cuidado</p>
        <h2 id="your-care-heading" className="font-serif text-2xl text-forest-900 mt-1">Apoios que acompanham você por mais tempo</h2>
        <p className="text-sm text-ink-soft mt-1 mb-4 max-w-2xl">Abra apenas se quiser um cuidado mais estruturado ou uma orientação mais individual.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <HubCard
            icon={<Sprout className="w-5 h-5" />}
            title="Plano de Autocuidado"
            description={selfCareAccess
              ? 'Um plano mensal de ações práticas, feito a partir dos seus registros.'
              : 'Plano mensal de ações práticas — disponível no Plus.'}
            cta={selfCareAccess ? 'Abrir meu plano' : 'Conhecer o Plus'}
            locked={!selfCareAccess}
            onClick={() => onNavigate(selfCareAccess ? 'self-care' : 'pricing')}
          />
          <HubCard
            icon={<MessageSquareText className="w-5 h-5" />}
            title="Orientação mensal"
            description={guidanceAccess
              ? 'Envie uma pergunta sobre o que está vivendo e receba uma orientação de apoio dentro do site.'
              : 'Uma orientação mensal individual por mensagem — disponível no Plus.'}
            cta={guidanceAccess ? 'Pedir orientação' : 'Conhecer o Plus'}
            locked={!guidanceAccess}
            onClick={() => onNavigate(guidanceAccess ? 'guidance' : 'pricing')}
          />
        </div>
      </section>

      <section className="border-t border-line pt-6" aria-labelledby="care-explore-heading">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Explorar</p>
        <h2 id="care-explore-heading" className="font-serif text-2xl text-forest-900 mt-1">Quando quiser procurar algo no seu tempo</h2>
        <p className="text-sm text-ink-soft mt-1 mb-4 max-w-2xl">Reflexões, práticas e pausas ficam aqui, sem competir com a recomendação principal.</p>
        <div className="max-w-md">
          <HubCard
            icon={<BookOpen className="w-5 h-5" />}
            title="Conteúdos Guiados"
            description="Reflexões, práticas e pausas emocionais para usar no seu tempo."
            cta="Explorar conteúdos"
            onClick={() => onNavigate('articles')}
          />
        </div>
      </section>

      <p className="text-xs text-ink-soft border-l-2 border-forest-300 pl-3 leading-relaxed">
        Cuidar não exige completar uma sequência. Use apenas o que fizer sentido para o seu momento.
      </p>
    </div>
  )
}

function HubCard({
  icon, title, description, cta, locked = false, onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  locked?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-3xl border border-line bg-paper-soft p-5 sm:p-6 hover:border-forest-200 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="w-11 h-11 rounded-2xl bg-mint text-forest-700 flex items-center justify-center">{icon}</span>
        {locked && <Lock className="w-4 h-4 text-ink-soft" />}
      </div>
      <h3 className="font-serif text-xl text-forest-900 mt-4">{title}</h3>
      <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 mt-3">
        {cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
