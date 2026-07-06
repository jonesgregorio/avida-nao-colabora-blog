import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Bookmark, Trash2, FileText, NotebookPen, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react'
import type { Plan } from '../types'
import type { User } from '@supabase/supabase-js'
import { UpgradeModal } from './UpgradeModal'

interface SavedItem {
  id: string
  item_type: 'article' | 'quote' | 'diary_prompt' | 'exercise' | 'meditation' | 'trail'
  item_id: string | null
  title: string
  category: string | null
  notes: string | null
  created_at: string
}

interface SavedItemsPageProps {
  user: User | null
  profile: { plan: Plan } | null
  navigate: (v: string, slug?: string) => void
  onBack: () => void
}

const TYPE_LABELS: Record<SavedItem['item_type'], string> = {
  article: 'Artigo',
  quote: 'Citação',
  diary_prompt: 'Pergunta de diário',
  exercise: 'Exercício',
  meditation: 'Meditação',
  trail: 'Trilha',
}

const TYPE_ICONS: Record<SavedItem['item_type'], React.ReactNode> = {
  article: <FileText size={16} />,
  quote: <span className="text-sm">❝</span>,
  diary_prompt: <NotebookPen size={16} />,
  exercise: <Dumbbell size={16} />,
  meditation: <span className="text-sm">🧘</span>,
  trail: <span className="text-sm">🗺️</span>,
}

const TYPE_COLORS: Record<SavedItem['item_type'], string> = {
  article: 'bg-emerald-50 text-emerald-700',
  quote: 'bg-purple-50 text-purple-700',
  diary_prompt: 'bg-blue-50 text-blue-700',
  exercise: 'bg-amber-50 text-amber-700',
  meditation: 'bg-teal-50 text-teal-700',
  trail: 'bg-rose-50 text-rose-700',
}

const PLAN_LIMITS: Record<Plan, number | null> = {
  free: 3,
  essential: null,
  plus: null,
  therapeutic: null,
  'therapeutic-plus': null,
}

export default function SavedItemsPage({ user, profile, navigate, onBack }: SavedItemsPageProps) {
  const [items, setItems] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const plan: Plan = profile?.plan || 'free'
  const isPremium = plan !== 'free'
  const isPlus = plan === 'therapeutic-plus'
  const limit = PLAN_LIMITS[plan]

  const loadItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('saved_items')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return
    loadItems()
  }, [user, loadItems])

  async function removeItem(id: string) {
    setRemoving(id)
    setRemoveError(null)
    const { error } = await supabase.from('saved_items').delete().eq('id', id)
    if (error) {
      setRemoveError('Não foi possível remover o item. Tente novamente.')
    } else {
      setItems(prev => prev.filter(i => i.id !== id))
    }
    setRemoving(null)
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) { next.delete(cat) } else { next.add(cat) }
      return next
    })
  }

  const handleItemClick = (item: SavedItem) => {
    if (item.item_type === 'article' && item.item_id) {
      navigate('article', item.item_id)
    }
  }

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Bookmark size={40} className="mx-auto text-stone-300 mb-4" />
        <p className="text-stone-500 mb-4">Faça login para ver sua Caixa de Cuidado.</p>
        <button
          onClick={() => navigate('auth')}
          className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          Entrar
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-8 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Bookmark size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sage-500 text-sm uppercase tracking-widest">Minha</p>
            <h1 className="font-serif text-3xl text-sage-800">Caixa de Cuidado</h1>
          </div>
        </div>
        <p className="text-sage-600 mt-2">
          Seus artigos, perguntas e recursos salvos para acessar quando precisar.
        </p>
      </div>

      {/* Quota info for free users */}
      {!isPremium && limit !== null && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-800">
              <strong>{items.length}/{limit}</strong> itens salvos no plano gratuito.
            </p>
            {items.length >= limit && (
              <button
                onClick={() => setUpgradeModal(true)}
                className="text-xs text-amber-700 underline font-medium"
              >
                Fazer upgrade
              </button>
            )}
          </div>
          <div className="h-1.5 bg-amber-200 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (items.length / limit) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {removeError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {removeError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark size={48} className="mx-auto text-stone-200 mb-4" />
          <p className="text-stone-400 mb-2">Sua Caixa de Cuidado está vazia.</p>
          <p className="text-stone-400 text-sm mb-6">
            Salve artigos e recursos enquanto lê para encontrá-los aqui depois.
          </p>
          <button
            onClick={() => navigate('articles')}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            Ver artigos
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(
            items.reduce((acc, item) => {
              const cat = item.category || 'Sem categoria'
              if (!acc.has(cat)) acc.set(cat, [])
              acc.get(cat)!.push(item)
              return acc
            }, new Map<string, SavedItem[]>())
          ).map(([cat, catItems]) => (
            <div key={cat}>
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">{cat}</span>
                <span className="text-xs text-stone-300">({catItems.length})</span>
                <span className="ml-auto text-stone-300">
                  {collapsedCategories.has(cat) ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </span>
              </button>
              {!collapsedCategories.has(cat) && (
                <div className="space-y-3">
                  {catItems.map(item => (
                    <div
                      key={item.id}
                      className="bg-white border border-stone-100 rounded-xl p-4 flex items-start gap-4 hover:shadow-sm transition-shadow group"
                    >
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${TYPE_COLORS[item.item_type]}`}>
                        {TYPE_ICONS[item.item_type]}
                      </div>

                      <div className="flex-1 min-w-0">
                        <button onClick={() => handleItemClick(item)} className="text-left w-full">
                          <p className="font-medium text-stone-800 text-sm leading-snug mb-0.5 group-hover:text-emerald-700 transition-colors">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[item.item_type]}`}>
                              {TYPE_LABELS[item.item_type]}
                            </span>
                            <span className="text-xs text-stone-300">·</span>
                            <span className="text-xs text-stone-400">{formatDate(item.created_at)}</span>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-stone-500 mt-1.5 line-clamp-2">{item.notes}</p>
                          )}
                        </button>
                        {isPlus && item.item_type === 'article' && (
                          <button
                            onClick={() => navigate('diary')}
                            className="mt-2 text-xs text-purple-600 hover:text-purple-700 underline"
                          >
                            Levar para sessão →
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={removing === item.id}
                        className="flex-shrink-0 p-1.5 rounded-lg text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        title="Remover"
                      >
                        {removing === item.id ? (
                          <div className="w-4 h-4 border border-red-300 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {upgradeModal && (
        <UpgradeModal
          isOpen={upgradeModal}
          featureName="Caixa de Cuidado ilimitada"
          requiredPlan="essential"
          onClose={() => setUpgradeModal(false)}
          navigate={(v) => navigate(v)}
        />
      )}
    </div>
  )
}
