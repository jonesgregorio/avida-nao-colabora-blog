import type { User } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, Lock, Sprout } from 'lucide-react'
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
// analisar mais, quero algo que possa me ajudar agora". Fase 19R.1: reúne os
// recursos de cuidado que JÁ existem (Plano de Autocuidado, Conteúdos Guiados e a
// recomendação contextual). Nada de card para módulo inexistente.
export default function CuidarPage({ user, profile, onNavigate, onOpenArticle }: Props) {
  const plan = normalizePlan(profile?.plan)
  const selfCareAccess = hasPlanAccess(plan, 'plus')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header>
        <div className="flex items-center gap-2 text-forest-600">
          <Sprout className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Cuidado</p>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Cuidar</h1>
        <p className="mt-2 text-ink-soft max-w-2xl leading-relaxed">
          Quando você não quer olhar gráficos nem entender padrões — só quer algo que possa ajudar agora.
        </p>
      </header>

      {user && (
        <section className="rounded-3xl border border-line bg-mint/25 p-5 sm:p-6">
          <RecommendedContent
            user={user}
            profile={profile}
            source="care"
            limit={3}
            title="Talvez isso ajude agora"
            description="Sugestões escolhidas a partir dos seus registros recentes."
            variant="compact"
            showEmpty
            onOpen={onOpenArticle}
            onCheckin={() => onNavigate('diary')}
            onDiary={() => onNavigate('diary')}
            onSeeAll={() => onNavigate('articles')}
          />
        </section>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <HubCard
          icon={<BookOpen className="w-5 h-5" />}
          title="Conteúdos Guiados"
          description="Artigos, reflexões, práticas e pausas emocionais. As recomendações se ligam ao seu momento."
          cta="Explorar conteúdos"
          onClick={() => onNavigate('articles')}
        />
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
      </div>
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
      className="group text-left rounded-3xl border border-line bg-paper-soft p-5 sm:p-6 hover:border-forest-200 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="w-11 h-11 rounded-2xl bg-mint text-forest-700 flex items-center justify-center">{icon}</span>
        {locked && <Lock className="w-4 h-4 text-ink-soft" />}
      </div>
      <h2 className="font-serif text-xl text-forest-900 mt-4">{title}</h2>
      <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 mt-3">
        {cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
