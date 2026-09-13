import type { User } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, ClipboardList, Lock, MessageSquareText, Sprout } from 'lucide-react'
import type { Profile } from '../types'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import RecommendedContent from './RecommendedContent'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigate: (section: string) => void
  onOpenArticle: (slug: string) => void
}

export default function CuidarPage({ user, profile, onNavigate, onOpenArticle }: Props) {
  const plan = normalizePlan(profile?.plan)
  const selfCareAccess = hasPlanAccess(plan, 'plus')
  const guidanceAccess = hasPlanAccess(plan, 'plus')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:py-10">
      <header className="max-w-3xl border-b border-line pb-7 sm:pb-9">
        <div className="flex items-center gap-2 text-forest-600">
          <Sprout className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Cuidar</p>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-forest-900 mt-1.5">Você não precisa analisar mais nada agora.</h1>
        <p className="mt-3 text-ink-soft leading-relaxed max-w-2xl">
          Escolha apenas o tipo de apoio que combina com este momento: uma ação prática, uma orientação, uma avaliação ou algo para ler e praticar no seu tempo.
        </p>
      </header>

      {user && (
        <section className="py-7 sm:py-9 border-b border-line" aria-labelledby="care-now-heading">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Talvez ajude agora</p>
          <h2 id="care-now-heading" className="font-serif text-2xl text-forest-900 mt-1 mb-4">Uma possibilidade escolhida a partir do seu momento</h2>
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

      <section className="py-7 sm:py-9" aria-labelledby="care-options-heading">
        <div className="max-w-2xl mb-5">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Escolha pelo que você precisa</p>
          <h2 id="care-options-heading" className="font-serif text-2xl sm:text-3xl text-forest-900 mt-1">Quatro caminhos, sem virar uma lista de tarefas</h2>
        </div>

        <div className="divide-y divide-line border-y border-line">
          <CareRow
            icon={<Sprout className="w-5 h-5" />}
            eyebrow="Agir"
            title="Plano de Autocuidado"
            description={selfCareAccess
              ? 'Ações pequenas com frequência sugerida, dificuldade, duração e revisão do ciclo.'
              : 'Um plano mensal de ações práticas construído a partir dos seus registros — disponível no Plus.'}
            cta={selfCareAccess ? 'Abrir meu plano' : 'Conhecer o Plus'}
            locked={!selfCareAccess}
            onClick={() => onNavigate(selfCareAccess ? 'self-care' : 'pricing')}
          />
          <CareRow
            icon={<MessageSquareText className="w-5 h-5" />}
            eyebrow="Conversar"
            title="Orientação mensal"
            description={guidanceAccess
              ? 'Envie uma pergunta específica e acompanhe o estágio da orientação até a resposta.'
              : 'Uma orientação mensal individual por mensagem, preparada por profissional habilitado — disponível no Plus.'}
            cta={guidanceAccess ? 'Abrir orientação' : 'Conhecer o Plus'}
            locked={!guidanceAccess}
            onClick={() => onNavigate(guidanceAccess ? 'monthly-guidance' : 'pricing')}
          />
          <CareRow
            icon={<ClipboardList className="w-5 h-5" />}
            eyebrow="Avaliar"
            title="Questionários"
            description="Avaliações estruturadas de autoconhecimento com resultado, evolução e linguagem não diagnóstica."
            cta="Ver questionários"
            onClick={() => onNavigate('questionarios')}
          />
          <CareRow
            icon={<BookOpen className="w-5 h-5" />}
            eyebrow="Ler ou praticar"
            title="Conteúdos"
            description="Leituras para compreender um tema e práticas guiadas por etapas quando você quiser fazer algo agora."
            cta="Explorar conteúdos"
            onClick={() => onNavigate('articles')}
          />
        </div>
      </section>

      <p className="mb-2 text-xs text-ink-soft border-l-2 border-forest-300 pl-3 leading-relaxed">
        Cuidar não exige completar uma sequência. Use apenas o que fizer sentido para o seu momento.
      </p>
    </div>
  )
}

function CareRow({
  icon, eyebrow, title, description, cta, locked = false, onClick,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  description: string
  cta: string
  locked?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group grid w-full gap-4 py-5 text-left sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:items-center sm:py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <span className="w-11 h-11 rounded-2xl bg-mint text-forest-700 flex items-center justify-center">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-forest-600">{eyebrow}{locked && <Lock className="w-3.5 h-3.5 text-ink-soft" />}</span>
        <span className="block font-serif text-xl text-forest-900 mt-1">{title}</span>
        <span className="block text-sm text-ink-soft mt-1.5 leading-relaxed max-w-2xl">{description}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 sm:justify-self-end">
        {cta} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
