import { useState } from 'react'
import { ChevronRight, Lock, BookOpen } from 'lucide-react'
import type { Plan, View } from '../types'
import { UpgradeModal } from './UpgradeModal'

interface Trail {
  id: string
  title: string
  description: string
  category: string
  planRequired: Plan
  articles: { slug: string; title: string }[]
}

const TRAILS: Trail[] = [
  {
    id: 'ansiedade',
    title: 'Trilha: Ansiedade no Dia a Dia',
    description: 'Um caminho guiado para entender e lidar com a ansiedade cotidiana.',
    category: 'Ansiedade',
    planRequired: 'free',
    articles: [
      { slug: 'quando-a-cabeca-nao-desliga', title: 'Quando a cabeça não desliga' },
      { slug: 'perceber-gatilhos-emocionais', title: 'Como perceber gatilhos emocionais' },
      { slug: 'ansiedade-nas-pequenas-coisas', title: 'Ansiedade nas pequenas coisas' },
      { slug: 'pensamentos-confusos-em-palavras', title: 'Transformar pensamentos confusos em palavras' },
      { slug: 'rotina-emocional-sem-pressao', title: 'Rotina emocional sem pressão' },
    ],
  },
  {
    id: 'autoestima',
    title: 'Trilha: Autoestima Sem Cobrança',
    description: 'Cuidar da forma como você se vê e fala consigo mesmo.',
    category: 'Autoestima',
    planRequired: 'essential',
    articles: [
      { slug: 'autoestima-em-dias-dificeis', title: 'Autoestima nos dias difíceis' },
      { slug: 'autocobranca-no-dia-a-dia', title: 'Autocobrança no dia a dia' },
      { slug: 'pequenas-conquistas-importam', title: 'Pequenas conquistas importam' },
      { slug: 'autocuidado-nao-precisa-ser-perfeito', title: 'Autocuidado não precisa ser perfeito' },
    ],
  },
  {
    id: 'cansaco',
    title: 'Trilha: Cansaço Emocional',
    description: 'Para quando você está exausto e precisa de um caminho mais leve.',
    category: 'Cansaço emocional',
    planRequired: 'essential',
    articles: [
      { slug: 'cansado-de-tentar', title: 'Cansado de tentar' },
      { slug: 'descansar-sem-culpa', title: 'Descansar sem culpa' },
      { slug: 'sobrecarregado', title: 'Sobrecarregado' },
      { slug: 'rotina-emocional-sem-pressao', title: 'Rotina emocional sem pressão' },
      { slug: 'limites-sem-culpa', title: 'Limites sem culpa' },
    ],
  },
  {
    id: 'relacoes',
    title: 'Trilha: Relações e Limites',
    description: 'Entender o que você pode e não pode oferecer nas suas relações.',
    category: 'Relações e limites',
    planRequired: 'essential',
    articles: [
      { slug: 'limites-sem-culpa', title: 'Limites sem culpa' },
      { slug: 'como-impor-limites-sem-se-sentir-uma-pessoa-ruim', title: 'Como impor limites sem se sentir uma pessoa ruim' },
      { slug: 'perceber-gatilhos-emocionais', title: 'Perceber gatilhos emocionais' },
    ],
  },
  {
    id: 'diario',
    title: 'Trilha: Diário Emocional',
    description: 'Use a escrita para se conhecer melhor, um dia de cada vez.',
    category: 'Diário emocional',
    planRequired: 'free',
    articles: [
      { slug: 'diario-para-organizar-pensamentos', title: 'Diário para organizar pensamentos' },
      { slug: 'o-que-escrever-no-diario', title: 'O que escrever no diário' },
      { slug: 'pensamentos-confusos-em-palavras', title: 'Transformar pensamentos confusos' },
      { slug: 'padroes-emocionais-repetidos', title: 'Padrões emocionais repetidos' },
    ],
  },
]

interface Props {
  userPlan: Plan
  navigate: (v: View) => void
  onSelectArticle: (slug: string) => void
}

const planOrder: Plan[] = ['free', 'essential', 'therapeutic', 'therapeutic-plus']
const hasAccess = (userPlan: Plan, required: Plan) =>
  planOrder.indexOf(userPlan) >= planOrder.indexOf(required)

export function ReadingTrails({ userPlan, navigate, onSelectArticle }: Props) {
  const [expandedTrail, setExpandedTrail] = useState<string | null>(null)
  const [upgradeModal, setUpgradeModal] = useState<{ feature: string; plan: Plan } | null>(null)

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={20} className="text-emerald-600" />
          <p className="text-emerald-600 text-sm uppercase tracking-widest font-medium">Trilhas</p>
        </div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Trilhas de autocuidado</h1>
        <p className="text-stone-500">
          Caminhos guiados para explorar temas com profundidade, no seu ritmo.
        </p>
      </div>

      <div className="space-y-4">
        {TRAILS.map(trail => {
          const accessible = hasAccess(userPlan, trail.planRequired)
          const isExpanded = expandedTrail === trail.id

          return (
            <div
              key={trail.id}
              className={`bg-white rounded-2xl border ${
                accessible ? 'border-stone-200' : 'border-stone-100'
              } overflow-hidden`}
            >
              <button
                onClick={() => {
                  if (!accessible) {
                    setUpgradeModal({ feature: trail.title, plan: trail.planRequired })
                    return
                  }
                  setExpandedTrail(isExpanded ? null : trail.id)
                }}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {!accessible && (
                    <Lock size={16} className="text-stone-400 shrink-0" />
                  )}
                  <div>
                    <h3 className="font-bold text-stone-800">{trail.title}</h3>
                    <p className="text-stone-500 text-sm mt-0.5">{trail.description}</p>
                    <span className="inline-block mt-1.5 text-xs text-stone-400">
                      {trail.articles.length} artigos
                      {!accessible && (
                        <span className="ml-2 text-amber-600 font-medium">
                          · Plano Essencial
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-stone-400 shrink-0 transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {isExpanded && accessible && (
                <div className="border-t border-stone-100 p-5">
                  <div className="space-y-2">
                    {trail.articles.map((article, idx) => (
                      <button
                        key={article.slug}
                        onClick={() => onSelectArticle(article.slug)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 text-left group transition-colors"
                      >
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-stone-700 group-hover:text-emerald-700 text-sm">
                          {article.title}
                        </span>
                        <ChevronRight
                          size={14}
                          className="ml-auto text-stone-300 group-hover:text-emerald-500"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {upgradeModal && (
        <UpgradeModal
          feature={upgradeModal.feature}
          requiredPlan={upgradeModal.plan}
          onClose={() => setUpgradeModal(null)}
          navigate={navigate}
        />
      )}
    </div>
  )
}
