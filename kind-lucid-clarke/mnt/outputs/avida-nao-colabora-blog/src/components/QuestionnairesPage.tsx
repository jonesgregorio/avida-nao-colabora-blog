import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, Lock, ChevronRight, HelpCircle, Sprout, ArrowRight, Crown, Check } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'

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
  questions?: unknown[]      // JSONB do admin
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus',
  therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}

interface Props {
  user: User | null
  profile: Profile | null
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
      const withCounts = data.map((q: Record<string, unknown>) => ({
        ...q,
        question_count: Array.isArray(q.questions) ? q.questions.length : 0,
      }))
      setItems(withCounts as unknown as QItem[])
      setLoading(false)
    }
    load()
  }, [])

  const categories = ['Todos', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))]
  const filtered = selectedCategory === 'Todos' ? items : items.filter(i => i.category === selectedCategory)
  const recommended = filtered.find(i => !isLocked(i)) ?? filtered[0]
  const isPlus = normalizePlan(profile?.plan) === 'plus'

  function isLocked(item: QItem) {
    const requiresPaid = normalizePlan(item.plan_required) !== 'free'
    return !hasPlanAccess(profile?.plan, item.plan_required) || (requiresPaid && !user)
  }

  function handleStart(item: QItem) {
    const requiresPaid = normalizePlan(item.plan_required) !== 'free'
    if (requiresPaid && !user) { setLockedModal(item); return }
    if (!hasPlanAccess(profile?.plan, item.plan_required)) { setLockedModal(item); return }
    onStart(item.id)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Questionários <Sprout className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft max-w-xl">Se conhecer é o primeiro passo para transformar. Responda com calma e acolha cada descoberta.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 lg:gap-6">
        {/* ─── Coluna principal ─── */}
        <div className="space-y-5 min-w-0">
          {/* Intro */}
          <div className="grid sm:grid-cols-[1fr_1.4fr] bg-paper-soft border border-line rounded-3xl overflow-hidden">
            <div className="hidden sm:block bg-mint min-h-[150px]">
              <img
                src="https://images.unsplash.com/photo-1494178270175-e96de2971df9?w=600&q=80"
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <div className="p-6 flex flex-col justify-center">
              <h2 className="font-serif text-xl sm:text-2xl text-forest-900">Aqui, cada resposta é um ato de cuidado com você.</h2>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                Nossos questionários ajudam você a olhar para dentro com mais clareza, entender o que sente e descobrir caminhos possíveis para o seu bem-estar.
              </p>
              <p className="text-xs text-forest-600 mt-3 flex items-center gap-1.5"><Sprout className="w-3.5 h-3.5" /> Não existe certo ou errado. Existe você, do seu jeito.</p>
            </div>
          </div>

          {/* Filtros por categoria */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const active = selectedCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    aria-pressed={active}
                    className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${active ? 'bg-forest-900 text-white border-forest-900' : 'bg-paper-soft border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'}`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          )}

          {/* Recomendado */}
          {!loading && recommended && (
            <div className="bg-mint/50 border border-forest-100 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-forest-600 flex-shrink-0"><Sprout className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-forest-600 font-medium">Recomendado para você</p>
                <p className="font-serif text-lg text-forest-900 leading-snug">{recommended.title}</p>
                <p className="text-sm text-ink-soft line-clamp-1">{recommended.short_description || recommended.description}</p>
              </div>
              <button
                onClick={() => handleStart(recommended)}
                className="inline-flex items-center gap-2 bg-forest-900 text-white text-sm font-medium px-4 py-2.5 rounded-2xl hover:bg-forest-800 transition-colors flex-shrink-0"
              >
                Responder agora <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Grade de questionários */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-44 bg-paper-soft border border-line rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-ink-soft">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-forest-900 mb-2">Ainda não há questionários publicados por aqui.</p>
              <p className="text-xs mb-6">Enquanto isso, explore os conteúdos guiados ou registre como está se sentindo hoje.</p>
              <button onClick={onBack} className="px-4 py-2 bg-forest-900 text-white rounded-xl text-sm hover:bg-forest-800">Voltar ao início</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(item => {
                const locked = isLocked(item)
                return (
                  <div
                    key={item.id}
                    className={`group bg-paper-soft rounded-2xl border transition-all flex flex-col ${locked ? 'border-line opacity-95' : 'border-line hover:border-forest-200 hover:shadow-md cursor-pointer'}`}
                    onClick={() => !locked && handleStart(item)}
                  >
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><HelpCircle className="w-5 h-5" /></span>
                        {locked && (
                          <span className="flex items-center gap-1 text-[11px] text-forest-700 bg-mint px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" /> {PLAN_LABELS[item.plan_required] ?? 'Plus'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif text-lg text-forest-900 leading-snug mb-1.5 group-hover:text-forest-700 transition-colors">{item.title}</h3>
                      <p className="text-ink-soft text-sm leading-relaxed mb-4 line-clamp-2">{item.short_description || item.description}</p>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="flex items-center gap-3 text-xs text-ink-soft">
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {item.estimated_time}</span>
                          {item.category && <span className="text-forest-700 bg-mint px-2 py-0.5 rounded-full">{item.category}</span>}
                        </span>
                        {locked ? (
                          <button onClick={e => { e.stopPropagation(); setLockedModal(item) }} className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-forest-700">
                            <Lock className="w-3 h-3" /> Ver planos
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-forest-700">Responder <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── Coluna lateral ─── */}
        <aside className="space-y-5">
          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <h2 className="font-serif text-lg text-forest-900">Seu progresso</h2>
            <p className="text-sm text-ink-soft mt-1">
              {items.length > 0 ? `${items.length} ${items.length === 1 ? 'questionário disponível' : 'questionários disponíveis'} para explorar.` : 'Novos questionários aparecerão aqui.'}
            </p>
            <p className="mt-3 text-xs text-ink-soft bg-mint/50 rounded-xl px-3 py-2.5 leading-relaxed">Cada reflexão te aproxima de mais leveza e equilíbrio.</p>
          </div>

          {!isPlus && (
            <div className="rounded-3xl bg-forest-900 text-white p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-serif text-lg">Aprofunde seu processo</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full flex items-center gap-1"><Crown className="w-3 h-3" /> Plus</span>
              </div>
              <p className="text-sm text-forest-50/90 leading-relaxed">Desbloqueie questionários avançados e conteúdos exclusivos com o Plus.</p>
              <ul className="mt-3 space-y-1.5 text-sm text-forest-50/90">
                {['Questionários exclusivos', 'Análises personalizadas', 'Acompanhamento de evolução'].map(t => (
                  <li key={t} className="flex items-center gap-2"><Check className="w-4 h-4 text-mint flex-shrink-0" /> {t}</li>
                ))}
              </ul>
              <button onClick={onNavigatePricing} className="mt-4 inline-flex items-center gap-2 bg-white text-forest-900 text-sm font-medium px-4 py-2 rounded-xl hover:bg-mint transition-colors">
                Conhecer o Plus <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <p className="font-serif text-lg text-forest-900 leading-snug">"Você não precisa ter todas as respostas agora. Só precisa estar disposta a se ouvir."</p>
            <p className="text-xs text-ink-soft mt-3">A Vida Não Colabora</p>
          </div>
        </aside>
      </div>

      {/* Locked modal */}
      {lockedModal && (
        <div className="fixed inset-0 z-50 bg-forest-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLockedModal(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-mint rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5 text-forest-600" />
              </div>
              <h3 className="font-serif text-lg text-forest-900 mb-1">{lockedModal.title}</h3>
              <p className="text-ink-soft text-sm">
                {!user
                  ? 'Crie uma conta gratuita para acessar este questionário.'
                  : `Este questionário está disponível no plano ${PLAN_LABELS[lockedModal.plan_required] ?? 'Plus'}.`}
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setLockedModal(null); if (user) onNavigatePricing(); else onNavigateAuth() }}
                className="w-full bg-forest-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800 transition-colors"
              >
                {user ? 'Ver planos' : 'Criar conta gratuita'}
              </button>
              <button onClick={() => setLockedModal(null)} className="w-full border border-line text-ink-soft py-2.5 rounded-xl text-sm hover:bg-mint/40 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
