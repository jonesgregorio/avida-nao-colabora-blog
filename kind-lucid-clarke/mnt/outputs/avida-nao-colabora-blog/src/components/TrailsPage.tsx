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

interface DbTrail {
  id: string
  title: string
  description: string
  plan_required: string
  is_active: boolean
  active?: boolean
  category?: string
  articles: { id: string; title: string; slug: string; order_index: number }[]
}

const COLORS = ['blue', 'emerald', 'amber', 'rose', 'purple', 'teal']

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; badge: string; bar: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',    badge: 'bg-blue-100 text-blue-700',    bar: 'bg-blue-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   badge: 'bg-amber-100 text-amber-700',   bar: 'bg-amber-400' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-800',    badge: 'bg-rose-100 text-rose-700',     bar: 'bg-rose-400' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-800',  badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-400' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-800',    badge: 'bg-teal-100 text-teal-700',     bar: 'bg-teal-400' },
}

export default function TrailsPage({ user, profile, navigate, onBack }: TrailsPageProps) {
  const { track } = useAnalytics(user?.id)
  const [trails, setTrails] = useState<DbTrail[]>([])
  const [loading, setLoading] = useState(true)
  const [readSlugs, setReadSlugs] = useState<Set<string>>(new Set())
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [expandedTrail, setExpandedTrail] = useState<string | null>(null)

  const plan: Plan = profile?.plan || 'free'
  const isPremium = plan !== 'free'

  useEffect(() => {
    async function loadTrails() {
      const { data, error } = await supabase
        .from('trails')
        .select(`
          id, title, description, plan_required, is_active, active, category,
          trail_articles (
            order_index, position,
            article:articles ( id, title, slug )
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (!error && data && data.length > 0) {
        const mapped: DbTrail[] = data.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          plan_required: t.plan_required || 'free',
          is_active: t.is_active ?? t.active ?? true,
          category: t.category,
          articles: ((t.trail_articles || []) as any[])
            .filter((ta: any) => ta.article)
            .sort((a: any, b: any) => (a.order_index ?? a.position ?? 0) - (b.order_index ?? b.position ?? 0))
            .map((ta: any) => ({
              id: ta.article.id,
              title: ta.article.title,
              slug: ta.article.slug,
              order_index: ta.order_index ?? ta.position ?? 0,
            })),
        }))
        setTrails(mapped)
      }
      setLoading(false)
    }
    loadTrails()
  }, [])

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

  const getProgress = (trail: DbTrail) => {
    if (!isPremium || trail.articles.length === 0) return null
    const read = trail.articles.filter(a => readSlugs.has(a.slug)).length
    return Math.round((read / trail.articles.length) * 100)
  }

  const handleArticleClick = (trail: DbTrail, slug: string, index: number) => {
    if (!isPremium && index > 0) { setUpgradeModal(true); return }
    if (trail.plan_required !== 'free' && !isPremium) { setUpgradeModal(true); return }
    navigate('article', slug)
  }

  const canAccessTrail = (trail: DbTrail) => {
    if (trail.plan_required === 'free') return true
    return isPremium
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="text-center py-20 text-stone-400">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Carregando trilhas...</p>
        </div>
      </div>
    )
  }

  if (trails.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg font-medium mb-2">Nenhuma trilha disponível</p>
          <p className="text-sm">As trilhas de autocuidado serão publicadas em breve.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-8 text-sm">
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

      <div className="space-y-6">
        {trails.map((trail, trailIdx) => {
          const colorKey = COLORS[trailIdx % COLORS.length]
          const colors = COLOR_CLASSES[colorKey]
          const progress = getProgress(trail)
          const accessible = canAccessTrail(trail)
          const isExpanded = expandedTrail === trail.id

          return (
            <div key={trail.id} className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}>
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

                  {isPremium && progress !== null && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                        <span>Progresso</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <ChevronRight
                  size={18}
                  className={`flex-shrink-0 mt-1 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-white/50 px-5 pb-4 pt-2 space-y-2">
                  {trail.articles.length === 0 ? (
                    <p className="text-sm text-stone-400 py-2">Nenhum artigo nesta trilha ainda.</p>
                  ) : trail.articles.map((article, index) => {
                    const isRead = readSlugs.has(article.slug)
                    const locked = (!isPremium && index > 0) || (!accessible && index > 0)

                    return (
                      <button
                        key={article.slug}
                        onClick={() => handleArticleClick(trail, article.slug, index)}
                        className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition-all ${
                          locked ? 'opacity-60 cursor-pointer' : 'hover:bg-white/60'
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
                          {article.title}
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
