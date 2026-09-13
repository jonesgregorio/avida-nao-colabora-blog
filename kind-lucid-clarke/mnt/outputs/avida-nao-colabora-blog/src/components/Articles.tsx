import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { Search, Clock, ArrowRight, X, BookOpen, Lock, Compass, PlayCircle, Layers3 } from 'lucide-react'
import type { Article } from '../types'
import { isContentLocked } from '../lib/officialPlans'
import { fetchGuidedCatalog, type CatalogItem } from '../lib/contentRecommendation'
import RecommendedContent from './RecommendedContent'

interface ArticlesProps {
  onSelectArticle: (article: Article | string) => void
  user?: { id: string } | null
  profile?: { plan?: string } | null
  onNavigateDiary?: () => void
  onNavigatePricing?: () => void
}

type LibraryMode = 'all' | 'read' | 'practice'
type GuidedCatalogItem = CatalogItem & { has_steps?: boolean; objective?: string | null; intensity?: string | null }

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

interface Filter { label: string; match: string[] }

const FALLBACK_FILTERS: Filter[] = [
  { label: 'Todos', match: [] },
  { label: 'Ansiedade', match: ['ansiedad', 'respira'] },
  { label: 'Sobrecarga', match: ['sobrecarg'] },
  { label: 'Cansaço', match: ['cansa', 'exaust', 'fadiga'] },
  { label: 'Sono e energia', match: ['sono', 'energia', 'dormir', 'descanso'] },
  { label: 'Autocobrança', match: ['autocobr', 'cobranc', 'culpa', 'perfeccion'] },
  { label: 'Autoestima', match: ['autoestim', 'autocompaix'] },
  { label: 'Fome emocional', match: ['fome', 'compuls', 'comida', 'aliment'] },
  { label: 'Limites', match: ['limite', 'rela'] },
  { label: 'Rotina', match: ['rotina', 'habito', 'organiza'] },
  { label: 'Respiração', match: ['respira'] },
  { label: 'Escrita guiada', match: ['escrita'] },
  { label: 'Descanso emocional', match: ['descanso', 'pausa', 'acolhiment'] },
]

function parseTerms(raw: string | null | undefined): string[] {
  return (raw || '').split(/[,;\n]/).map(t => deburr(t.trim())).filter(Boolean)
}

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  account: { label: 'Gratuito', cls: 'bg-blue-50 text-blue-700' },
  essential: { label: 'Essencial', cls: 'bg-mint text-forest-700' },
  plus: { label: 'Plus', cls: 'bg-coral/60 text-[#7a3320]' },
}

function deburr(s: string): string {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
function itemHaystack(it: CatalogItem): string {
  return deburr([it.category, it.title, it.summary, ...(it.tags ?? []), ...(it.emotional_themes ?? []), ...(it.keywords ?? [])].filter(Boolean).join(' '))
}
function planBadge(planRequired: string | null | undefined) {
  if (!planRequired || planRequired === 'free') return null
  return PLAN_BADGE[planRequired] ?? PLAN_BADGE.plus
}
function isPracticeItem(item: CatalogItem): boolean {
  const guided = item as GuidedCatalogItem
  return Boolean(guided.has_steps) || item.content_type === 'practice' || item.content_type === 'meditation'
}

export default function Articles({ onSelectArticle, user, profile, onNavigateDiary, onNavigatePricing }: ArticlesProps) {
  const { track } = useAnalytics()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [mode, setMode] = useState<LibraryMode>('all')
  const [filters, setFilters] = useState<Filter[]>(FALLBACK_FILTERS)

  const plan = profile?.plan

  const load = async () => {
    setLoading(true); setLoadError(false)
    try {
      const cat = await fetchGuidedCatalog()
      if (cat.length === 0) setLoadError(true)
      setCatalog(cat)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const loadFilters = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('name, match_terms, order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .order('name', { ascending: true })
      if (data && data.length) {
        setFilters([
          { label: 'Todos', match: [] },
          ...(data as { name: string; match_terms: string | null }[]).map(c => ({
            label: c.name,
            match: parseTerms(c.match_terms),
          })),
        ])
      }
    } catch { /* mantém FALLBACK_FILTERS */ }
  }

  useEffect(() => { load(); loadFilters() }, [])

  const filtered = useMemo(() => {
    let result = catalog
    if (mode === 'read') result = result.filter(item => !isPracticeItem(item))
    if (mode === 'practice') result = result.filter(isPracticeItem)

    const f = filters.find(x => x.label === filter)
    if (f && f.label !== 'Todos') {
      const label = deburr(f.label)
      result = result.filter(it => {
        if (deburr(it.category || '') === label) return true
        if (!f.match.length) return false
        const hay = itemHaystack(it)
        return f.match.some(m => hay.includes(m))
      })
    }
    if (search.trim()) {
      const q = deburr(search)
      result = result.filter(it => itemHaystack(it).includes(q))
    }
    return result
  }, [catalog, filter, search, filters, mode])

  const counts = useMemo(() => ({
    all: catalog.length,
    read: catalog.filter(item => !isPracticeItem(item)).length,
    practice: catalog.filter(isPracticeItem).length,
  }), [catalog])

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) return
    const t = setTimeout(() => {
      track('blog_search', {
        entity_id: deburr(q).slice(0, 60),
        entity_title: q.slice(0, 60),
        metadata: { results: filtered.length, filter, mode },
      })
    }, 900)
    return () => clearTimeout(t)
  }, [search, filtered.length, filter, mode, track])

  const handleSelect = (it: CatalogItem) => {
    if (!it.slug) return
    track('article_click', { entity_id: it.id, entity_title: it.title, metadata: { experience: isPracticeItem(it) ? 'practice' : 'reading' } })
    onSelectArticle(it.slug)
  }

  const isDefault = filter === 'Todos' && !search && mode === 'all'

  return (
    <section id="articles" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-7 border-b border-line pb-7 sm:mb-9 sm:pb-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-600">Conteúdos</p>
        <h1 className="mt-1 font-serif text-3xl md:text-4xl lg:text-5xl text-forest-900">Você quer ler ou praticar?</h1>
        <p className="mt-3 text-ink-soft max-w-2xl leading-relaxed">
          Leituras ajudam a compreender um tema. Práticas guiadas oferecem etapas para fazer algo no seu ritmo — iniciar, pausar e retomar quando quiser.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-3" role="group" aria-label="Tipo de conteúdo">
          <ModeButton active={mode === 'all'} icon={<Layers3 className="h-5 w-5" />} title="Todos" description="Ver a biblioteca completa" count={counts.all} onClick={() => setMode('all')} />
          <ModeButton active={mode === 'read'} icon={<BookOpen className="h-5 w-5" />} title="Ler" description="Artigos, reflexões e explicações" count={counts.read} onClick={() => setMode('read')} />
          <ModeButton active={mode === 'practice'} icon={<PlayCircle className="h-5 w-5" />} title="Praticar" description="Práticas e pausas guiadas" count={counts.practice} onClick={() => setMode('practice')} />
        </div>
      </header>

      <a href="/guias" className="mb-8 flex items-center gap-4 border-y border-line py-4 transition-colors hover:bg-mint/25 sm:px-2">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-mint text-forest-700"><Compass className="h-5 w-5" /></span>
        <span className="flex-1"><strong className="block font-serif text-lg text-forest-900">Não sabe por onde começar?</strong><span className="mt-0.5 block text-sm leading-5 text-ink-soft">Veja os guias essenciais de diário emocional, padrões, ansiedade, limites e autocuidado.</span></span>
        <ArrowRight className="h-5 w-5 flex-shrink-0 text-forest-700" />
      </a>

      {user && (
        <div className="mb-10">
          <RecommendedContent
            user={user}
            profile={profile}
            catalog={catalog.length ? catalog : null}
            source="guided_page"
            limit={3}
            showEmpty
            onOpen={onSelectArticle}
            onCheckin={onNavigateDiary}
            onDiary={onNavigateDiary}
            onSeeAll={() => { setMode('all'); setFilter('Todos'); setSearch('') }}
          />
        </div>
      )}

      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl text-forest-900">
            {mode === 'read' ? 'Leituras' : mode === 'practice' ? 'Práticas guiadas' : 'Biblioteca completa'}
          </h2>
          <p className="text-sm text-ink-soft mt-1">
            {mode === 'read' ? 'Conteúdos para entender, refletir e encontrar palavras para o que você vive.' : mode === 'practice' ? 'Experiências com intenção prática, incluindo conteúdos com etapas quando disponíveis.' : 'Explore por tipo, tema ou busque pelo que faz sentido para o seu momento.'}
          </p>
        </div>
        {!loading && <p className="text-xs text-ink-soft">{filtered.length} {filtered.length === 1 ? 'conteúdo' : 'conteúdos'}</p>}
      </div>

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
          <button onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink-soft hover:text-forest-900 hover:bg-mint/60 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {filters.map(f => {
          const active = filter === f.label
          return (
            <button
              key={f.label}
              onClick={() => setFilter(f.label)}
              aria-pressed={active}
              className={`px-3.5 py-1.5 rounded-full text-sm transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${active ? 'bg-forest-900 text-white border-forest-900' : 'bg-paper-soft border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'}`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-paper-soft border border-line rounded-2xl h-72 animate-pulse" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-20 text-ink-soft">
          <p className="mb-2 font-medium text-forest-900">Não foi possível carregar os conteúdos agora.</p>
          <button onClick={load} className="text-sm text-forest-700 underline underline-offset-2">Tentar novamente</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-ink-soft">
          <p className="mb-2 font-medium text-forest-900">Nenhum conteúdo encontrado neste recorte.</p>
          {!isDefault ? (
            <button onClick={() => { setMode('all'); setFilter('Todos'); setSearch('') }} className="text-sm text-forest-700 underline underline-offset-2">Ver biblioteca completa</button>
          ) : (
            <p className="text-sm">Novos conteúdos são publicados regularmente. Volte em breve.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(it => {
            const locked = isContentLocked(it.plan_required, plan, !!user)
            return (
              <LibraryCard
                key={it.id}
                item={it}
                locked={locked}
                onOpen={() => handleSelect(it)}
                onUpgrade={onNavigatePricing}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function ModeButton({ active, icon, title, description, count, onClick }: { active: boolean; icon: React.ReactNode; title: string; description: string; count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${active ? 'border-forest-900 bg-forest-900 text-white shadow-sm' : 'border-line bg-white text-forest-900 hover:border-forest-300'}`}>
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/15' : 'bg-mint text-forest-700'}`}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className={`block text-[11px] mt-0.5 ${active ? 'text-white/70' : 'text-ink-soft'}`}>{description}</span></span>
      <span className={`text-xs font-semibold ${active ? 'text-white/75' : 'text-ink-soft'}`}>{count}</span>
    </button>
  )
}

function LibraryCard({ item, locked, onOpen, onUpgrade }: { item: CatalogItem; locked: boolean; onOpen: () => void; onUpgrade?: () => void }) {
  const time = item.estimated_time_minutes ?? item.read_time ?? null
  const badge = planBadge(item.plan_required)
  const practice = isPracticeItem(item)
  const handleCardClick = locked && item.plan_required !== 'account' ? onUpgrade : onOpen
  return (
    <div onClick={handleCardClick} className="group flex flex-col text-left bg-paper-soft border border-line rounded-2xl overflow-hidden hover:shadow-md hover:border-forest-200 transition-all cursor-pointer">
      <div className="relative aspect-video bg-mint overflow-hidden">
        <img
          src={item.image_url || FALLBACK_IMAGE}
          alt={item.title}
          className={`w-full h-full object-cover transition-transform duration-500 ${locked ? 'opacity-60' : 'group-hover:scale-105'}`}
          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE }}
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-forest-800 shadow-sm">
          {practice ? <PlayCircle size={12} /> : <BookOpen size={12} />} {practice ? 'Praticar' : 'Ler'}
        </span>
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-forest-900/25">
            <span className="inline-flex items-center gap-1.5 bg-white/90 text-forest-800 text-xs font-medium px-3 py-1.5 rounded-full">
              <Lock size={12} /> {item.plan_required === 'account' ? 'Crie sua conta grátis' : `Disponível no ${badge?.label ?? 'Plus'}`}
            </span>
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest-600">
            {practice ? <PlayCircle size={12} /> : <BookOpen size={12} />} {practice ? 'Prática guiada' : 'Leitura'}
          </span>
          {badge ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span> : time && <span className="text-xs text-ink-soft flex items-center gap-1"><Clock size={12} /> {time} min</span>}
        </div>
        <h3 className="font-serif text-lg text-forest-900 leading-snug mb-2 line-clamp-2">{item.title}</h3>
        {item.summary && <p className="text-ink-soft text-sm leading-relaxed line-clamp-3 mb-4">{item.summary}</p>}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-forest-700 bg-mint px-2.5 py-1 rounded-full truncate max-w-[55%]">{item.category || 'Conteúdo'}</span>
          {locked ? (
            item.plan_required === 'account' ? (
              <button onClick={e => { e.stopPropagation(); onOpen() }} className="inline-flex items-center gap-1 text-sm font-medium text-forest-700 hover:gap-1.5 transition-all flex-shrink-0">
                Criar conta <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={e => { e.stopPropagation(); onUpgrade?.() }} className="inline-flex items-center gap-1 text-sm font-medium text-[#7a3320] hover:gap-1.5 transition-all flex-shrink-0">
                Conhecer o {badge?.label ?? 'Plus'} <ArrowRight size={14} />
              </button>
            )
          ) : (
            <button onClick={e => { e.stopPropagation(); onOpen() }} className="inline-flex items-center gap-1 text-sm font-medium text-forest-700 group-hover:gap-1.5 transition-all flex-shrink-0">
              {practice ? 'Iniciar prática' : 'Ler conteúdo'} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
