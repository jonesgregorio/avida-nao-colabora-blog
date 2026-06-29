import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, Lock, ChevronRight, HelpCircle, ArrowLeft } from 'lucide-react'

interface QItem {
  id: string
  title: string
  slug: string
  description: string        // campo real salvo pelo admin
  short_description?: string // fallback
  category: string
  plan_required: string
  estimated_time: string | number
  status: string
  show_on_questionnaires_page: boolean
  question_count?: number
  questions?: any[]          // JSONB do admin
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
}

const PLAN_ORDER: Record<string, number> = {
  free: 0, essential: 1, therapeutic: 2, 'therapeutic-plus': 3,
}

const CATEGORY_COLORS: Record<string, string> = {
  'Ansiedade':          'bg-violet-100 text-violet-700',
  'Autoestima':         'bg-pink-100 text-pink-700',
  'Rotina emocional':   'bg-amber-100 text-amber-700',
  'Autoconhecimento':   'bg-emerald-100 text-emerald-700',
  'Relacionamentos':    'bg-blue-100 text-blue-700',
  'Cansaço emocional':  'bg-orange-100 text-orange-700',
  'Autocuidado':        'bg-teal-100 text-teal-700',
  'Limites':            'bg-red-100 text-red-700',
  'Geral':              'bg-stone-100 text-stone-600',
}

interface Props {
  user: any
  profile: any
  onStart: (id: string) => void
  onBack: () => void
  onNavigatePricing: () => void
  onNavigateAuth: () => void
}

export default function QuestionnairesPage({
  user, profile, onStart, onBack, onNavigatePricing, onNavigateAuth,
}: Props) {
  const [items, setItems] = useState<QItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [lockedModal, setLockedModal] = useState<QItem | null>(null)

  const userPlanLevel = PLAN_ORDER[profile?.plan || 'free'] ?? 0

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('questionnaires')
        .select('id,title,slug,description,category,plan_required,estimated_time,status,show_on_questionnaires_page,scheduled_at,questions,created_at')
        .eq('show_on_questionnaires_page', true)
        .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`)
        .order('created_at', { ascending: false })

      if (!data) { setLoading(false); return }

      // Conta perguntas a partir do JSONB inline (sem precisar de tabela separada)
      const withCounts = data.map((q: any) => ({
        ...q,
        question_count: Array.isArray(q.questions) ? q.questions.length : 0,
      }))
      setItems(withCounts)
      setLoading(false)
    }
    load()
  }, [])

  const categories = ['Todos', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))]
  const filtered = selectedCategory === 'Todos' ? items : items.filter(i => i.category === selectedCategory)

  function handleStart(item: QItem) {
    const requiredLevel = PLAN_ORDER[item.plan_required] ?? 0
    if (requiredLevel > 0 && !user) { setLockedModal(item); return }
    if (requiredLevel > userPlanLevel) { setLockedModal(item); return }
    onStart(item.id)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button onClick={onBack} className="flex items-center gap-2 text-stone-400 hover:text-stone-700 text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">Questionários de autoconhecimento</h1>
          </div>
          <p className="text-stone-500 text-sm max-w-xl">
            Ferramentas para explorar como você está se sentindo, identificar padrões emocionais e encontrar conteúdos que fazem sentido para o seu momento.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Category filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === cat ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum questionário disponível ainda.</p>
            <p className="text-xs mt-1">Volte em breve — novos conteúdos são adicionados regularmente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(item => {
              const requiredLevel = PLAN_ORDER[item.plan_required] ?? 0
              const locked = requiredLevel > 0 && (!user || requiredLevel > userPlanLevel)
              const catColor = CATEGORY_COLORS[item.category] || 'bg-stone-100 text-stone-600'

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all group ${locked ? 'border-stone-100 opacity-90' : 'border-stone-200 hover:border-purple-200 hover:shadow-sm cursor-pointer'}`}
                  onClick={() => !locked && handleStart(item)}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      {item.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>
                          {item.category}
                        </span>
                      )}
                      {locked && (
                        <span className="flex items-center gap-1 text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full ml-auto">
                          <Lock className="w-3 h-3" /> {PLAN_LABELS[item.plan_required]}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-stone-800 leading-snug mb-2 group-hover:text-purple-700 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-stone-500 text-xs leading-relaxed mb-4 line-clamp-2">
                      {item.short_description || item.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-stone-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {item.estimated_time}
                        </span>
                        {item.question_count != null && item.question_count > 0 && (
                          <span>{item.question_count} perguntas</span>
                        )}
                      </div>
                      {locked ? (
                        <button
                          onClick={e => { e.stopPropagation(); setLockedModal(item) }}
                          className="flex items-center gap-1.5 text-xs bg-stone-100 text-stone-500 px-3 py-1.5 rounded-lg"
                        >
                          <Lock className="w-3 h-3" /> Ver planos
                        </button>
                      ) : (
                        <button className="flex items-center gap-1.5 text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                          Responder <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Locked modal */}
      {lockedModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-stone-800 mb-1">{lockedModal.title}</h3>
              <p className="text-stone-500 text-sm">
                {!user
                  ? 'Crie uma conta gratuita para acessar este questionário.'
                  : `Este questionário requer o plano ${PLAN_LABELS[lockedModal.plan_required]}.`
                }
              </p>
            </div>
            <div className="space-y-2">
              {!user ? (
                <>
                  <button
                    onClick={() => { setLockedModal(null); onNavigateAuth() }}
                    className="w-full bg-stone-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-stone-700"
                  >
                    Criar conta gratuita
                  </button>
                  <button onClick={() => setLockedModal(null)} className="w-full border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setLockedModal(null); onNavigatePricing() }}
                    className="w-full bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700"
                  >
                    Ver planos
                  </button>
                  <button onClick={() => setLockedModal(null)} className="w-full border border-stone-200 text-stone-600 py-2.5 rounded-xl text-sm hover:bg-stone-50">
                    Fechar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
