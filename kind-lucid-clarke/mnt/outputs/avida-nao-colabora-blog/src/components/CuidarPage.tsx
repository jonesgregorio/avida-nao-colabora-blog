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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header>
        <div className="flex items-center gap-2 text-forest-600">
          <Sprout className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Cuidado</p>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Cuidar</h1>
        <p className="mt-2 text-ink-soft max-w-2xl leading-relaxed">
          Quando você não quer olhar gráficos nem entender padrões — só quer escolher um próximo cuidado possível para agora.
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

      <section>
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Escolha como quer cuidar agora</p>
        <p className="text-sm text-ink-soft mt-1 mb-4">Você pode explorar algo rápido, seguir um plano ou pedir uma orientação mais individual.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<BookOpen className="w-5 h-5" />}
            title="Conteúdos Guiados"
            description="Reflexões, práticas e pausas emocionais para usar no seu tempo."
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
