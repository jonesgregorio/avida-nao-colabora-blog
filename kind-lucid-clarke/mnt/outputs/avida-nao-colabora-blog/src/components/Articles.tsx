import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { Search, Clock, ArrowRight, X, BookOpen, Lock } from 'lucide-react'
import type { Article } from '../types'
import { hasPlanAccess } from '../lib/officialPlans'
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

// Filtros por tema (§3 / §10). Cada filtro casa por radicais no "haystack" do
// conteúdo (categoria + tags + temas emocionais + palavras-chave + título).
interface Filter { label: string; match: string[] }

// Os temas agora vêm da tabela `categories` (admin → Conteúdo & IA → Categorias):
// nome = rótulo do chip; match_terms = radicais buscados. Esta lista é só o
// FALLBACK, usado se a busca das categorias falhar ou vier vazia — assim o blog
// nunca fica sem filtros.
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

// Quebra "ansiedad, respira" (match_terms) em radicais normalizados.
function parseTerms(raw: string | null | undefined): string[] {
  return (raw || '').split(/[,;\n]/).map(t => deburr(t.trim())).filter(Boolean)
}

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
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

export default function Articles({ onSelectArticle, user, profile, onNavigateDiary, onNavigatePricing }: ArticlesProps) {
  const { track } = useAnalytics()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
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

  // Monta os chips de tema a partir das categorias ativas do admin. "Todos" é
  // sempre o primeiro (opção do próprio blog). Se falhar, mantém o FALLBACK.
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
    const f = filters.find(x => x.label === filter)
    if (f && f.label !== 'Todos') {
      // Casa pela categoria do artigo (igualdade) OU por qualquer radical do tema.
      // A igualdade garante que todo artigo marcado com a categoria apareça no
      // chip dela, mesmo que a categoria não tenha match_terms cadastrados.
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
  }, [catalog, filter, search, filters])

  // Analytics: registra o termo buscado para o relatório "Termos mais buscados"
  // no admin. Debounce de 900ms para gravar só a busca "final", não cada tecla.
  // Grava APENAS o termo (nunca dado sensível): entity_id normalizado (sem acento,
  // minúsculo) agrupa variações; entity_title guarda o texto exibível.
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) return
    const t = setTimeout(() => {
      track('blog_search', {
        entity_id: deburr(q).slice(0, 60),
        entity_title: q.slice(0, 60),
        metadata: { results: filtered.length, filter },
      })
    }, 900)
    return () => clearTimeout(t)
  }, [search, filtered.length, filter, track])

  const handleSelect = (it: CatalogItem) => {
    if (!it.slug) return
    track('article_click', { entity_id: it.id, entity_title: it.title })
    onSelectArticle(it.slug)
  }

  const isDefault = filter === 'Todos' && !search

  return (
    <section id="articles" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900">Conteúdos Guiados</h1>
        <p className="mt-2 text-ink-soft max-w-xl leading-relaxed">
          Práticas, reflexões e leituras para apoiar sua organização emocional.
        </p>
      </header>

      {/* ── Bloco 1 — Recomendados para você (só logado) ── */}
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
            onSeeAll={() => { setFilter('Todos'); setSearch('') }}
          />
        </div>
      )}

      {/* ── Bloco 2 — Todos os conteúdos guiados ── */}
      <h2 className="font-serif text-xl sm:text-2xl text-forest-900 mb-1">Todos os conteúdos guiados</h2>
      <p className="text-sm text-ink-soft mb-4">Explore por tema ou busque pelo que faz sentido para o seu momento.</p>

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
          <button onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-ink-soft hover:text-forest-900 hover:bg-mint/60 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Filtros por tema */}
      <div className="flex flex-wrap gap-2 mb-8">
        {filters.map(f => {
          const active = filter === f.label
          return (
            <button
              key={f.label}
              onClick={() => setFilter(f.label)}
              aria-pressed={active}
              className={`px-3.5 py-1.5 rounded-full text-sm transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
                active ? 'bg-forest-900 text-white border-forest-900'
                       : 'bg-paper-soft border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'
              }`}
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
          <p className="mb-2 font-medium text-forest-900">Nenhum conteúdo encontrado.</p>
          {(!isDefault) ? (
            <button onClick={() => { setFilter('Todos'); setSearch('') }} className="text-sm text-forest-700 underline underline-offset-2">Ver todos os conteúdos</button>
          ) : (
            <p className="text-sm">Novos conteúdos são publicados regularmente. Volte em breve.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(it => {
            const locked = !hasPlanAccess(plan, it.plan_required ?? 'free')
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

function LibraryCard({ item, locked, onOpen, onUpgrade }: { item: CatalogItem; locked: boolean; onOpen: () => void; onUpgrade?: () => void }) {
  const time = item.estimated_time_minutes ?? item.read_time ?? null
  const badge = planBadge(item.plan_required)
  return (
    <div className="group flex flex-col text-left bg-paper-soft border border-line rounded-2xl overflow-hidden hover:shadow-md hover:border-forest-200 transition-all">
      <div className="relative aspect-video bg-mint overflow-hidden">
        <img
          src={item.image_url || FALLBACK_IMAGE}
          alt={item.title}
          className={`w-full h-full object-cover transition-transform duration-500 ${locked ? 'opacity-60' : 'group-hover:scale-105'}`}
          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE }}
        />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-forest-900/25">
            <span className="inline-flex items-center gap-1.5 bg-white/90 text-forest-800 text-xs font-medium px-3 py-1.5 rounded-full">
              <Lock size={12} /> Disponível no {badge?.label ?? 'Plus'}
            </span>
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest-600">
            <BookOpen size={12} /> {item.content_type === 'practice' ? 'Prática' : item.content_type === 'meditation' ? 'Meditação' : 'Conteúdo'}
          </span>
          {badge
            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
            : time && <span className="text-xs text-ink-soft flex items-center gap-1"><Clock size={12} /> {time} min</span>}
        </div>
        <h3 className="font-serif text-lg text-forest-900 leading-snug mb-2 line-clamp-2">{item.title}</h3>
        {item.summary && <p className="text-ink-soft text-sm leading-relaxed line-clamp-3 mb-4">{item.summary}</p>}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-forest-700 bg-mint px-2.5 py-1 rounded-full truncate max-w-[55%]">{item.category || 'Conteúdo'}</span>
          {locked ? (
            <button onClick={onUpgrade} className="inline-flex items-center gap-1 text-sm font-medium text-[#7a3320] hover:gap-1.5 transition-all flex-shrink-0">
              Conhecer o {badge?.label ?? 'Plus'} <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={onOpen} className="inline-flex items-center gap-1 text-sm font-medium text-forest-700 group-hover:gap-1.5 transition-all flex-shrink-0">
              Abrir conteúdo <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
