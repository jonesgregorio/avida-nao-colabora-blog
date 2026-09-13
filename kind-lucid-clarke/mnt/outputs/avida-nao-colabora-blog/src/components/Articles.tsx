import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { Search, Clock, ArrowRight, X, BookOpen, Lock, Compass, PlayCircle, History } from 'lucide-react'
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

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'
interface Filter { label: string; match: string[] }
type LibraryMode = 'all' | 'continue' | 'practice'
type ReadingHistory = Record<string, number>

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
function isPractice(it: CatalogItem) {
  return it.content_type === 'practice' || it.content_type === 'meditation'
}
function readingHistoryKey(userId?: string) { return `avnc-reading-history:${userId || 'visitor'}` }

export default function Articles({ onSelectArticle, user, profile, onNavigateDiary, onNavigatePricing }: ArticlesProps) {
  const { track } = useAnalytics()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [filters, setFilters] = useState<Filter[]>(FALLBACK_FILTERS)
  const [mode, setMode] = useState<LibraryMode>('all')
  const [readingHistory, setReadingHistory] = useState<ReadingHistory>({})
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
          ...(data as { name: string; match_terms: string | null }[]).map(c => ({ label: c.name, match: parseTerms(c.match_terms) })),
        ])
      }
    } catch { /* mantém fallback */ }
  }

  useEffect(() => { load(); loadFilters() }, [])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(readingHistoryKey(user?.id))
      const parsed = raw ? JSON.parse(raw) as ReadingHistory : {}
      setReadingHistory(parsed && typeof parsed === 'object' ? parsed : {})
    } catch { setReadingHistory({}) }
  }, [user?.id])

  const filtered = useMemo(() => {
    let result = catalog
    if (mode === 'continue') {
      result = result
        .filter(it => !isPractice(it) && Boolean(it.slug && readingHistory[it.slug]))
        .sort((a, b) => (readingHistory[b.slug || ''] || 0) - (readingHistory[a.slug || ''] || 0))
    }
    if (mode === 'practice') result = result.filter(isPractice)
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
  }, [catalog, filter, search, filters, mode, readingHistory])

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
    if (!isPractice(it)) {
      const next = { ...readingHistory, [it.slug]: Date.now() }
      setReadingHistory(next)
      try { localStorage.setItem(readingHistoryKey(user?.id), JSON.stringify(next)) } catch { /* histórico local opcional */ }
    }
    track('article_click', { entity_id: it.id, entity_title: it.title })
    onSelectArticle(it.slug)
  }

  const isDefault = filter === 'Todos' && !search && mode === 'all'
  const resetLibrary = () => { setFilter('Todos'); setSearch(''); setMode('all') }

  return (
    <section id="articles" className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
      <header className="mb-6 sm:mb-8 max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Aprender e praticar</p>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1">Conteúdos</h1>
        <p className="mt-2 text-ink-soft max-w-2xl leading-relaxed">Explore a biblioteca, retome leituras que já abriu ou escolha uma prática guiada para fazer no seu ritmo.</p>
      </header>

      <div className="mb-7 grid grid-cols-3 rounded-2xl border border-line bg-paper-soft p-1" role="tablist" aria-label="Tipo de conteúdo">
        {([
          ['all', 'Biblioteca', Compass],
          ['continue', 'Continuar', History],
          ['practice', 'Praticar', PlayCircle],
        ] as const).map(([key, label, Icon]) => {
          const active = mode === key
          return <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setMode(key)} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors ${active ? 'bg-white text-forest-900 shadow-sm' : 'text-ink-soft hover:text-forest-900'}`}><Icon className="w-4 h-4 flex-shrink-0" /><span className="truncate">{label}</span></button>
        })}
      </div>

      {mode === 'continue' && <div className="mb-7 rounded-2xl border border-forest-100 bg-mint/30 px-4 py-3.5 text-xs sm:text-sm text-forest-900"><strong>Continuar</strong> mostra leituras que você já abriu neste dispositivo, das mais recentes para as mais antigas. Como o site ainda não mede leitura integral com precisão, não marcamos um artigo como “100% lido” sem evidência real.</div>}

      <a href="/guias" className="mb-8 flex items-center gap-4 border-y border-line py-5 transition-colors hover:bg-mint/20 px-1">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-mint text-forest-700"><Compass className="h-5 w-5" /></span>
        <span className="flex-1"><strong className="block font-serif text-lg text-forest-900">Não sabe por onde começar?</strong><span className="mt-0.5 block text-sm leading-5 text-ink-soft">Veja os guias essenciais para escolher um primeiro caminho.</span></span>
        <ArrowRight className="h-5 w-5 flex-shrink-0 text-forest-700" />
      </a>

      {user && mode === 'all' && <div className="mb-9"><RecommendedContent user={user} profile={profile} catalog={catalog.length ? catalog : null} source="guided_page" limit={3} showEmpty onOpen={onSelectArticle} onCheckin={onNavigateDiary} onDiary={onNavigateDiary} onSeeAll={resetLibrary} /></div>}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <div><h2 className="font-serif text-xl sm:text-2xl text-forest-900">{mode === 'continue' ? 'Continuar lendo' : mode === 'practice' ? 'Práticas guiadas' : 'Biblioteca'}</h2><p className="text-sm text-ink-soft mt-1">{mode === 'continue' ? 'Leituras que você já iniciou, mais recentes primeiro.' : mode === 'practice' ? 'Exercícios, pausas e conteúdos guiados para fazer no seu ritmo.' : 'Todos os conteúdos disponíveis, organizados por tema.'}</p></div>
        <span className="text-xs text-ink-soft">{filtered.length} {filtered.length === 1 ? 'conteúdo' : 'conteúdos'}</span>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conteúdo, emoção ou tema" aria-label="Buscar conteúdo, emoção ou tema" className="w-full pl-11 pr-11 py-3 rounded-2xl border border-line bg-white text-ink placeholder:text-ink-soft/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300" />
        {search && <button onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink-soft hover:text-forest-900 hover:bg-mint/60"><X size={15} /></button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 snap-x">
        {filters.map(f => {
          const active = filter === f.label
          return <button key={f.label} onClick={() => setFilter(f.label)} aria-pressed={active} className={`snap-start whitespace-nowrap px-3.5 py-2 rounded-full text-sm transition-colors border ${active ? 'bg-forest-900 text-white border-forest-900' : 'bg-paper-soft border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'}`}>{f.label}</button>
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-paper-soft border border-line rounded-2xl h-72 animate-pulse" />)}</div>
      ) : loadError ? (
        <div className="text-center py-20 text-ink-soft"><p className="mb-2 font-medium text-forest-900">Não foi possível carregar os conteúdos agora.</p><button onClick={load} className="text-sm text-forest-700 underline underline-offset-2">Tentar novamente</button></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-paper-soft/35 text-center py-14 px-5 text-ink-soft"><History className="mx-auto h-7 w-7 text-forest-500" /><p className="mt-3 mb-2 font-medium text-forest-900">{mode === 'continue' && !search && filter === 'Todos' ? 'Você ainda não iniciou uma leitura por aqui.' : 'Nenhum conteúdo encontrado.'}</p><p className="mx-auto max-w-lg text-sm">{mode === 'continue' && !search && filter === 'Todos' ? 'Abra uma leitura na Biblioteca e ela ficará disponível aqui para você retomar depois.' : 'Tente outro tema ou volte para a biblioteca completa.'}</p>{!isDefault && <button onClick={resetLibrary} className="mt-4 text-sm font-medium text-forest-700 underline underline-offset-2">Ver biblioteca completa</button>}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(it => <LibraryCard key={it.id} item={it} locked={isContentLocked(it.plan_required, plan, !!user)} onOpen={() => handleSelect(it)} onUpgrade={onNavigatePricing} continued={Boolean(it.slug && readingHistory[it.slug])} />)}
        </div>
      )}
    </section>
  )
}

function LibraryCard({ item, locked, onOpen, onUpgrade, continued }: { item: CatalogItem; locked: boolean; onOpen: () => void; onUpgrade?: () => void; continued?: boolean }) {
  const time = item.estimated_time_minutes ?? item.read_time ?? null
  const badge = planBadge(item.plan_required)
  const practice = isPractice(item)
  const handleCardClick = locked && item.plan_required !== 'account' ? onUpgrade : onOpen
  return <div onClick={handleCardClick} className="group flex flex-col text-left bg-white border border-line rounded-2xl overflow-hidden hover:shadow-md hover:border-forest-200 transition-all cursor-pointer">
    <div className="relative aspect-video bg-mint overflow-hidden"><img src={item.image_url || FALLBACK_IMAGE} alt={item.title} className={`w-full h-full object-cover transition-transform duration-500 ${locked ? 'opacity-60' : 'group-hover:scale-105'}`} onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE }} />{continued && !practice && !locked && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-forest-800 shadow-sm"><History size={12} /> Em andamento</span>}{locked && <div className="absolute inset-0 flex items-center justify-center bg-forest-900/25"><span className="inline-flex items-center gap-1.5 bg-white/90 text-forest-800 text-xs font-medium px-3 py-1.5 rounded-full"><Lock size={12} /> {item.plan_required === 'account' ? 'Crie sua conta grátis' : `Disponível no ${badge?.label ?? 'Plus'}`}</span></div>}</div>
    <div className="p-5 flex flex-col flex-1"><div className="flex items-center justify-between gap-2 mb-2"><span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest-600">{practice ? <PlayCircle size={12} /> : <BookOpen size={12} />}{practice ? 'Prática guiada' : 'Leitura'}</span>{badge ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span> : time && <span className="text-xs text-ink-soft flex items-center gap-1"><Clock size={12} /> {time} min</span>}</div><h3 className="font-serif text-lg text-forest-900 leading-snug mb-2 line-clamp-2">{item.title}</h3>{item.summary && <p className="text-ink-soft text-sm leading-relaxed line-clamp-3 mb-4">{item.summary}</p>}<div className="mt-auto flex items-center justify-between gap-2"><span className="text-xs font-medium text-forest-700 bg-mint px-2.5 py-1 rounded-full truncate max-w-[55%]">{item.category || 'Conteúdo'}</span>{locked ? item.plan_required === 'account' ? <button onClick={e => { e.stopPropagation(); onOpen() }} className="inline-flex items-center gap-1 text-sm font-medium text-forest-700">Criar conta <ArrowRight size={14} /></button> : <button onClick={e => { e.stopPropagation(); onUpgrade?.() }} className="inline-flex items-center gap-1 text-sm font-medium text-[#7a3320]">Conhecer o {badge?.label ?? 'Plus'} <ArrowRight size={14} /></button> : <button onClick={e => { e.stopPropagation(); onOpen() }} className="inline-flex items-center gap-1 text-sm font-medium text-forest-700">{practice ? 'Começar' : continued ? 'Continuar' : 'Ler'} <ArrowRight size={14} /></button>}</div></div>
  </div>
}