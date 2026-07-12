import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { Search, Clock, ArrowRight, X, BookOpen, Sparkles } from 'lucide-react'
import type { Article } from '../types'
import { recommendGuidedContent } from '../lib/questionnaireResult'

interface ArticlesProps {
  onSelectArticle: (article: Article | string) => void
  user?: { id: string } | null
  profile?: { plan?: string } | null
}

const FALLBACK_CATEGORIES = [
  'Ansiedade', 'Autoestima', 'Cansaço emocional', 'Autoconhecimento',
  'Relações e limites', 'Rotina e hábitos', 'Sono e descanso',
  'Pensamentos difíceis', 'Diário emocional', 'Autocuidado possível', 'Vida real',
]

// Rótulos neutros (substantivos) — sem marcação de gênero.
const MOODS = [
  'Ansiedade',
  'Cansaço',
  'Sobrecarga',
  'Confusão',
  'Irritação',
  'Solidão',
  'Falta de energia',
  'Pensamentos acelerados',
  'Vontade de acolhimento',
  'Organização da rotina',
] as const

type Mood = typeof MOODS[number]

const MOOD_MAP: Record<Mood, string[]> = {
  'Ansiedade': ['Ansiedade', 'Pensamentos difíceis'],
  'Cansaço': ['Cansaço emocional', 'Autocuidado possível'],
  'Sobrecarga': ['Cansaço emocional', 'Rotina e hábitos'],
  'Confusão': ['Autoconhecimento', 'Diário emocional'],
  'Irritação': ['Autoconhecimento', 'Relações e limites'],
  'Solidão': ['Relações e limites', 'Autoestima'],
  'Falta de energia': ['Cansaço emocional', 'Autocuidado possível'],
  'Pensamentos acelerados': ['Ansiedade', 'Pensamentos difíceis'],
  'Vontade de acolhimento': ['Autoestima', 'Autocuidado possível'],
  'Organização da rotina': ['Rotina e hábitos', 'Diário emocional'],
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

// Plano de acesso — só aparece quando o conteúdo exige um plano pago.
const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  essential: { label: 'Essencial', cls: 'bg-mint text-forest-700' },
  plus: { label: 'Plus', cls: 'bg-coral/60 text-[#7a3320]' },
  therapeutic: { label: 'Plus', cls: 'bg-coral/60 text-[#7a3320]' },
  'therapeutic-plus': { label: 'Plus', cls: 'bg-coral/60 text-[#7a3320]' },
}

function getImage(article: Pick<Article, 'image_url' | 'cover_image_url' | 'cover_image'>) {
  return article.image_url || article.cover_image_url || article.cover_image || FALLBACK_IMAGE
}
function getSummary(article: Article) {
  return article.summary || article.excerpt || ''
}
function getReadTime(article: Article) {
  return article.read_time || article.reading_time_minutes
}
function planBadge(article: Article) {
  const p = article.plan_required
  if (!p || p === 'free') return null
  return PLAN_BADGE[p] ?? null
}

export default function Articles({ onSelectArticle, user, profile }: ArticlesProps) {
  const { track } = useAnalytics()
  const [articles, setArticles] = useState<Article[]>([])
  const [filtered, setFiltered] = useState<Article[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null)
  const [dbCategories, setDbCategories] = useState<string[]>([])
  // "Recomendados para você" — a partir das tags do último questionário (§8.2).
  const [recommended, setRecommended] = useState<Article[]>([])

  const allCategories = ['Todos', ...(dbCategories.length > 0 ? dbCategories : FALLBACK_CATEGORIES)]

  const loadArticles = async () => {
    const now = new Date().toISOString()
    setLoading(true)
    setLoadError(false)
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`)
        .order('published_at', { ascending: false, nullsFirst: false })
      if (error) { setLoadError(true); return }
      setArticles(data || [])
      setFiltered(data || [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArticles()

    supabase
      .from('categories')
      .select('name')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) setDbCategories(data.map((c: { name: string }) => c.name))
      })
  }, []) // loadArticles is stable within mount — categories fetch also only needed once

  // Recomendações personalizadas: pega as tags do último questionário concluído
  // e busca conteúdos compatíveis com o plano (respeita hasPlanAccess).
  useEffect(() => {
    if (!user) { setRecommended([]); return }
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('questionnaire_responses')
        .select('generated_tags')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const tags = String((data as { generated_tags?: string } | null)?.generated_tags ?? '')
        .split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length === 0) { if (active) setRecommended([]); return }
      try {
        const recs = await recommendGuidedContent(profile?.plan, tags, 3)
        if (active) setRecommended(recs.map(r => r.raw))
      } catch { if (active) setRecommended([]) }
    })()
    return () => { active = false }
  }, [user, profile?.plan])

  useEffect(() => {
    let result = articles

    if (selectedMood) {
      const moodCategories = MOOD_MAP[selectedMood]
      result = result.filter(a => moodCategories.includes(a.category))
    } else if (category !== 'Todos') {
      result = result.filter(a => a.category === category)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.summary || a.excerpt || '').toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [search, category, articles, selectedMood])

  const handleMoodSelect = (mood: Mood) => {
    if (selectedMood === mood) {
      setSelectedMood(null)
    } else {
      setSelectedMood(mood)
      setCategory('Todos')
    }
  }

  const clearMood = () => setSelectedMood(null)

  const handleSelect = (article: Article) => {
    if (article.slug) {
      track('article_click', { entity_id: article.id, entity_title: article.title })
      onSelectArticle(article)
    }
  }

  const isDefault = category === 'Todos' && !selectedMood && !search
  const featured = isDefault && filtered.length > 0 ? filtered[0] : null
  const gridItems = featured ? filtered.slice(1) : filtered

  return (
    <section id="articles" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Cabeçalho da página */}
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900">Conteúdos guiados</h1>
        <p className="mt-2 text-ink-soft max-w-xl leading-relaxed">
          Práticas, leituras e reflexões para o seu momento.
        </p>
      </header>

      {/* Busca */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar conteúdo, emoção ou tema"
          aria-label="Buscar conteúdo, emoção ou tema"
          className="w-full pl-11 pr-11 py-3 rounded-2xl border border-line bg-paper-soft text-ink placeholder:text-ink-soft/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 focus:border-forest-300 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink-soft hover:text-forest-900 hover:bg-mint/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Filtros por tema */}
      <div className="flex flex-wrap gap-2 mb-4">
        {allCategories.map(cat => {
          const active = !selectedMood && category === cat
          return (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setSelectedMood(null) }}
              aria-pressed={active}
              className={`px-3.5 py-1.5 rounded-full text-sm transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
                active
                  ? 'bg-forest-900 text-white border-forest-900'
                  : 'bg-paper-soft border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Filtro por sentimento — alternativa acolhedora ao filtro por tema */}
      <div className="mb-8 bg-paper-soft rounded-2xl p-4 sm:p-5 border border-line">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-forest-900 flex items-center gap-2">
            <Sparkles size={15} className="text-forest-500" /> Filtre pelo seu momento
          </p>
          {selectedMood && (
            <button
              onClick={clearMood}
              className="flex items-center gap-1 text-xs text-ink-soft hover:text-forest-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 rounded"
            >
              <X size={12} /> limpar
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(mood => {
            const active = selectedMood === mood
            return (
              <button
                key={mood}
                onClick={() => handleMoodSelect(mood)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
                  active
                    ? 'bg-forest-100 text-forest-800 border-forest-300'
                    : 'bg-white border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'
                }`}
              >
                {mood}
              </button>
            )
          })}
        </div>
        {selectedMood && (
          <p className="text-xs text-forest-600 mt-3">
            Mostrando conteúdos sobre: <strong>{MOOD_MAP[selectedMood].join(', ')}</strong>
          </p>
        )}
      </div>

      {/* Recomendados para você — só na visão padrão, sem poluir filtros/busca */}
      {recommended.length > 0 && isDefault && !loading && (
        <div className="mb-10">
          <h2 className="font-serif text-xl sm:text-2xl text-forest-900 mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-forest-500" /> Recomendados para você
          </h2>
          <p className="text-sm text-ink-soft mb-4">Com base no seu último questionário.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recommended.map(a => <ContentCard key={'rec-' + a.id} article={a} onSelect={() => handleSelect(a)} />)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-paper-soft border border-line rounded-2xl h-80 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-20 text-ink-soft">
          <p className="mb-2 font-medium text-forest-900">Não foi possível carregar os conteúdos agora.</p>
          <p className="text-sm mb-4">Tente novamente em alguns instantes.</p>
          <button onClick={loadArticles} className="text-sm text-forest-700 underline underline-offset-2">
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-ink-soft">
          <p className="mb-2 font-medium text-forest-900">Nenhum conteúdo encontrado.</p>
          {(selectedMood || search || category !== 'Todos') ? (
            <button
              onClick={() => { clearMood(); setSearch(''); setCategory('Todos') }}
              className="text-sm text-forest-700 underline underline-offset-2"
            >
              Ver todos os conteúdos
            </button>
          ) : (
            <p className="text-sm">Novos conteúdos são publicados regularmente. Volte em breve.</p>
          )}
        </div>
      ) : (
        <>
          {/* Destaque — recomendação principal */}
          {featured && (
            <div className="mb-10">
              <p className="text-sm font-semibold text-forest-700 mb-3">Para o que você está sentindo hoje</p>
              <FeaturedCard article={featured} onSelect={() => handleSelect(featured)} />
            </div>
          )}

          {/* Grade de conteúdos */}
          {gridItems.length > 0 && (
            <div>
              <h2 className="font-serif text-xl sm:text-2xl text-forest-900 mb-4">
                {isDefault
                  ? 'Todos os conteúdos'
                  : `${filtered.length} ${filtered.length === 1 ? 'conteúdo encontrado' : 'conteúdos encontrados'}`}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {gridItems.map(article => (
                  <ContentCard key={article.id} article={article} onSelect={() => handleSelect(article)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ── Card de destaque (recomendação principal) ──
function FeaturedCard({ article, onSelect }: { article: Article; onSelect: () => void }) {
  const readTime = getReadTime(article)
  const plan = planBadge(article)
  return (
    <button
      onClick={onSelect}
      className="group w-full text-left grid md:grid-cols-5 bg-paper-soft border border-line rounded-2xl overflow-hidden hover:shadow-md hover:border-forest-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <div className="md:col-span-2 aspect-video md:aspect-auto md:min-h-[220px] bg-mint overflow-hidden">
        <img
          src={getImage(article)}
          alt={article.image_alt || article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE }}
        />
      </div>
      <div className="md:col-span-3 p-6 sm:p-7 flex flex-col">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest-600">
            <BookOpen size={13} /> Artigo
          </span>
          {plan && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${plan.cls}`}>{plan.label}</span>
          )}
        </div>
        <h3 className="font-serif text-xl sm:text-2xl text-forest-900 leading-snug mb-2 group-hover:text-forest-700 transition-colors">
          {article.title}
        </h3>
        <p className="text-ink-soft text-sm leading-relaxed line-clamp-3 mb-4">{getSummary(article)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-medium text-forest-700 bg-mint px-2.5 py-1 rounded-full">{article.category}</span>
          {readTime && (
            <span className="text-xs text-ink-soft flex items-center gap-1">
              <Clock size={12} /> {readTime} min
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 group-hover:gap-2 transition-all">
            Ler conteúdo <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Card de conteúdo (grade) ──
function ContentCard({ article, onSelect }: { article: Article; onSelect: () => void }) {
  const readTime = getReadTime(article)
  const plan = planBadge(article)
  return (
    <button
      onClick={onSelect}
      className="group flex flex-col text-left bg-paper-soft border border-line rounded-2xl overflow-hidden hover:shadow-md hover:border-forest-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <div className="aspect-video bg-mint overflow-hidden">
        <img
          src={getImage(article)}
          alt={article.image_alt || article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE }}
        />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest-600">
            <BookOpen size={12} /> Artigo
          </span>
          {plan
            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${plan.cls}`}>{plan.label}</span>
            : readTime && (
              <span className="text-xs text-ink-soft flex items-center gap-1">
                <Clock size={12} /> {readTime} min
              </span>
            )}
        </div>
        <h3 className="font-serif text-lg text-forest-900 leading-snug mb-2 line-clamp-2 group-hover:text-forest-700 transition-colors">
          {article.title}
        </h3>
        <p className="text-ink-soft text-sm leading-relaxed line-clamp-3 mb-4">{getSummary(article)}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-forest-700 bg-mint px-2.5 py-1 rounded-full truncate max-w-[60%]">
            {article.category}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-forest-700 group-hover:gap-1.5 transition-all flex-shrink-0">
            Ler conteúdo <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </button>
  )
}
