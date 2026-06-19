import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { ArrowLeft, Lock, CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import type { Plan } from '../types'
import { UpgradeModal } from './UpgradeModal'

interface TrailsPageProps {
  user: any
  profile: { plan: Plan } | null
  navigate: (v: string, slug?: string) => void
  onBack: () => void
}

interface TrailDef {
  id: string
  title: string
  description: string
  category: string
  plan_required: 'free' | 'essential'
  color: string
  slugs: string[]
}

const TRAILS: TrailDef[] = [
  {
    id: 'ansiedade',
    title: 'Trilha: Ansiedade no Dia a Dia',
    description: 'Um caminho guiado para entender e lidar com a ansiedade cotidiana.',
    category: 'Ansiedade',
    plan_required: 'free',
    color: 'blue',
    slugs: [
      'quando-a-cabeca-nao-desliga',
      'ansiedade-nas-pequenas-coisas',
      'perceber-gatilhos-emocionais',
      'diario-para-organizar-pensamentos',
      'rotina-emocional-sem-pressao',
    ],
  },
  {
    id: 'autoestima',
    title: 'Trilha: Autoestima Sem Cobrança',
    description: 'Como cuidar da sua relação consigo mesmo com mais gentileza.',
    category: 'Autoestima',
    plan_required: 'essential',
    color: 'emerald',
    slugs: [
      'autoestima-em-dias-dificeis',
      'autocobranca-no-dia-a-dia',
      'pequenas-conquistas-importam',
      'autocuidado-nao-precisa-ser-perfeito',
      'vivendo-no-automatico',
    ],
  },
  {
    id: 'cansaco',
    title: 'Trilha: Cansaço Emocional',
    description: 'Para quando você está esgotado e não sabe mais por onde começar.',
    category: 'Cansaço emocional',
    plan_required: 'essential',
    color: 'amber',
    slugs: [
      'cansado-de-tentar',
      'descansar-sem-culpa',
      'sobrecarregado',
      'rotina-emocional-sem-pressao',
      'limites-sem-culpa',
    ],
  },
  {
    id: 'limites',
    title: 'Trilha: Relações e Limites',
    description: 'Como se proteger emocionalmente sem se isolar.',
    category: 'Relações e limites',
    plan_required: 'essential',
    color: 'rose',
    slugs: [
      'limites-sem-culpa',
      'perceber-gatilhos-emocionais',
      'autocobranca-no-dia-a-dia',
      'como-entender-o-que-voce-sente',
      'padroes-emocionais-repetidos',
    ],
  },
  {
    id: 'diario',
    title: 'Trilha: Diário Emocional',
    description: 'Use o diário para se conhecer melhor e organizar o que você sente.',
    category: 'Diário emocional',
    plan_required: 'free',
    color: 'purple',
    slugs: [
      'diario-para-organizar-pensamentos',
      'o-que-escrever-no-diario',
      'pensamentos-confusos-em-palavras',
      'padroes-emocionais-repetidos',
      'como-entender-o-que-voce-sente',
    ],
  },
]

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; badge: string; bar: string }> = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-700',
    bar: 'bg-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-400',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-400',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
    badge: 'bg-rose-100 text-rose-700',
    bar: 'bg-rose-400',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    badge: 'bg-purple-100 text-purple-700',
    bar: 'bg-purple-400',
  },
}

export default function TrailsPage({ user, profile, navigate, onBack }: TrailsPageProps) {
  const { track } = useAnalytics(user?.id)
  const [readSlugs, setReadSlugs] = useState<Set<string>>(new Set())
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [expandedTrail, setExpandedTrail] = useState<string | null>(null)

  const plan: Plan = profile?.plan || 'free'
  const isPremium = plan !== 'free'

  useEffect(() => {
    if (!user) return
    supabase
      .from('reading_history')
      .select('article_slug')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setReadSlugs(new Set(data.map((r: any) => r.article_slug)))
      })
  }, [user])

  const getProgress = (trail: TrailDef) => {
    if (!isPremium) return null
    const read = trail.slugs.filter(s => readSlugs.has(s)).length
    return Math.round((read / trail.slugs.length) * 100)
  }

  const handleArticleClick = (trail: TrailDef, slug: string, index: number) => {
    // Free plan: only first article of each trail
    if (!isPremium && index > 0) {
      setUpgradeModal(true)
      return
    }
    // Locked trails require premium
    if (trail.plan_required === 'essential' && !isPremium) {
      setUpgradeModal(true)
      return
    }
    navigate('article', slug)
  }

  const canAccessTrail = (trail: TrailDef) => {
    if (trail.plan_required === 'free') return true
    return isPremium
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-8 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-10">
        <p className="text-sage-500 text-sm uppercase tracking-widest mb-2">Trilhas de Leitura</p>
        <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-3">Trilhas de Autocuidado</h1>
        <p className="text-sage-600 max-w-xl">
          Leitura guiada em sequência. Cada trilha reúne artigos complementares para aprofundar um tema no seu ritmo.
        </p>
      </div>

      {!isPremium && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Plano gratuito:</strong> você pode acessar o primeiro artigo de cada trilha.
          Para desbloquear todas,{' '}
          <button onClick={() => navigate('pricing')} className="underline font-medium">
            conheça o plano Essencial
          </button>
          .
        </div>
      )}

      {/* Trail cards */}
      <div className="space-y-6">
        {TRAILS.map(trail => {
          const colors = COLOR_CLASSES[trail.color] || COLOR_CLASSES.emerald
          const progress = getProgress(trail)
          const accessible = canAccessTrail(trail)
          const isExpanded = expandedTrail === trail.id

          return (
            <div
              key={trail.id}
              className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}
            >
              {/* Trail header */}
              <button
                className="w-full text-left p-5 flex items-start justify-between gap-4"
                onClick={() => {
                  if (!isExpanded) track('trail_start', { entity_id: trail.id, entity_title: trail.title })
                  setExpandedTrail(isExpanded ? null : trail.id)
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className={`font-bold text-lg ${colors.text}`}>{trail.title}</h2>
                    {!accessible && (
                      <span className="flex items-center gap-1 text-xs bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                        <Lock size={10} /> Essencial
                      </span>
                    )}
                    {accessible && trail.plan_required === 'free' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>Gratuito</span>
                    )}
                  </div>
                  <p className="text-sm text-stone-600">{trail.description}</p>

                  {/* Progress bar (premium only) */}
                  {isPremium && progress !== null && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                        <span>Progresso</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.bar} rounded-full transition-all`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <ChevronRight
                  size={18}
                  className={`flex-shrink-0 mt-1 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Article list (expanded) */}
              {isExpanded && (
                <div className="border-t border-white/50 px-5 pb-4 pt-2 space-y-2">
                  {trail.slugs.map((slug, index) => {
                    const isRead = readSlugs.has(slug)
                    const locked = (!isPremium && index > 0) || (!accessible && index > 0)

                    return (
                      <button
                        key={slug}
                        onClick={() => handleArticleClick(trail, slug, index)}
                        className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition-all ${
                          locked
                            ? 'opacity-60 cursor-pointer'
                            : 'hover:bg-white/60'
                        }`}
                      >
                        <span className="flex-shrink-0">
                          {locked ? (
                            <Lock size={16} className="text-stone-400" />
                          ) : isRead ? (
                            <CheckCircle2 size={16} className="text-emerald-500" />
                          ) : (
                            <Circle size={16} className="text-stone-300" />
                          )}
                        </span>
                        <span className="text-xs text-stone-400 w-4 flex-shrink-0">{index + 1}</span>
                        <span className={`text-sm font-medium ${locked ? 'text-stone-400' : 'text-stone-700'}`}>
                          {slug.replace(/-/g, ' ')}
                        </span>
                        {locked && (
                          <span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Essencial
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {upgradeModal && (
        <UpgradeModal
          isOpen={upgradeModal}
          requiredPlan="essential"
          featureName="Trilhas premium"
          onClose={() => setUpgradeModal(false)}
          navigate={navigate as any}
        />
      )}
    </div>
  )
}
