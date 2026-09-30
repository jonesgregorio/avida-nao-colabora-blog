import { useEffect, useMemo, useState } from 'react'
import { Eye, MousePointerClick, RefreshCw, ScrollText, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Period = '24h' | '7d' | '30d' | '90d'
const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: '24h', label: 'Últimas 24h', days: 1 },
  { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '90d', label: '90 dias', days: 90 },
]

type Ev = {
  event: string
  entity_id: string | null
  entity_title: string | null
  session_id: string | null
  user_id: string | null
  created_at: string
}

type Row = {
  slug: string
  title: string
  views: number
  uniqueReaders: number
  scroll50: number
  scroll75: number
  scroll100: number
  ctaAfterRead: number
  registrationsAfterRead: number
}

function percent(n: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

function eventPersonKey(e: Ev) {
  return e.user_id || e.session_id || ''
}

function uniqueBy(events: Ev[]) {
  return new Set(events.map(eventPersonKey).filter(Boolean)).size
}

function buildArticleRows(events: Ev[]): Row[] {
  const views = events.filter(e => e.event === 'article_view' && e.entity_id)
  const bySlug = new Map<string, Row>()

  for (const e of views) {
    const slug = e.entity_id!
    const current = bySlug.get(slug) || {
      slug,
      title: e.entity_title || slug,
      views: 0,
      uniqueReaders: 0,
      scroll50: 0,
      scroll75: 0,
      scroll100: 0,
      ctaAfterRead: 0,
      registrationsAfterRead: 0,
    }
    current.views += 1
    if (e.entity_title) current.title = e.entity_title
    bySlug.set(slug, current)
  }

  const sessions = new Map<string, Ev[]>()
  for (const e of events) {
    if (!e.session_id) continue
    if (!sessions.has(e.session_id)) sessions.set(e.session_id, [])
    sessions.get(e.session_id)!.push(e)
  }
  for (const list of sessions.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const row of bySlug.values()) {
    const slugViews = views.filter(e => e.entity_id === row.slug)
    row.uniqueReaders = uniqueBy(slugViews)
    row.scroll50 = uniqueBy(events.filter(e => e.event === 'article_scroll_50' && e.entity_id === row.slug))
    row.scroll75 = uniqueBy(events.filter(e => e.event === 'article_scroll_75' && e.entity_id === row.slug))
    row.scroll100 = uniqueBy(events.filter(e => e.event === 'article_scroll_100' && e.entity_id === row.slug))
  }

  const ctaSessions = new Map<string, Set<string>>()
  const registrationSessions = new Map<string, Set<string>>()
  for (const [sessionId, list] of sessions) {
    let currentArticle: string | null = null
    for (const e of list) {
      if (e.event === 'article_view' && e.entity_id) currentArticle = e.entity_id
      if (!currentArticle) continue
      if (e.event === 'cta_click' || e.event === 'article_click') {
        if (!ctaSessions.has(currentArticle)) ctaSessions.set(currentArticle, new Set())
        ctaSessions.get(currentArticle)!.add(sessionId)
      }
      if (e.event === 'registration_complete') {
        if (!registrationSessions.has(currentArticle)) registrationSessions.set(currentArticle, new Set())
        registrationSessions.get(currentArticle)!.add(sessionId)
      }
    }
  }

  for (const row of bySlug.values()) {
    row.ctaAfterRead = ctaSessions.get(row.slug)?.size ?? 0
    row.registrationsAfterRead = registrationSessions.get(row.slug)?.size ?? 0
  }

  return [...bySlug.values()].sort((a, b) => b.uniqueReaders - a.uniqueReaders || b.views - a.views)
}

export default function AdminArticleAnalytics() {
  const [period, setPeriod] = useState<Period>('30d')
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const days = PERIODS.find(p => p.id === period)!.days
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days])

  async function load() {
    setLoading(true)
    setError(null)
    const wanted = [
      'article_view', 'article_scroll_50', 'article_scroll_75', 'article_scroll_100',
      'article_click', 'cta_click', 'registration_complete',
    ]
    const { data, error: queryError } = await supabase
      .from('analytics_events')
      .select('event,entity_id,entity_title,session_id,user_id,created_at')
      .gte('created_at', since)
      .in('event', wanted)
      .order('created_at', { ascending: true })
      .limit(20000)

    if (queryError) setError(queryError.message)
    setEvents((data as Ev[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [since]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => buildArticleRows(events), [events])
  const totals = useMemo(() => ({
    views: events.filter(e => e.event === 'article_view').length,
    readers: uniqueBy(events.filter(e => e.event === 'article_view')),
    completed: uniqueBy(events.filter(e => e.event === 'article_scroll_100')),
    clicked: new Set(events.filter(e => e.event === 'cta_click' || e.event === 'article_click').map(e => e.session_id).filter(Boolean)).size,
    registered: new Set(events.filter(e => e.event === 'registration_complete').map(e => e.session_id).filter(Boolean)).size,
  }), [events])

  const cards = [
    { label: 'Visualizações de artigos', value: totals.views, icon: Eye },
    { label: 'Leitores únicos', value: totals.readers, icon: Users },
    { label: 'Chegaram ao fim', value: totals.completed, icon: ScrollText },
    { label: 'Clicaram após ler', value: rows.reduce((sum, row) => sum + row.ctaAfterRead, 0), icon: MousePointerClick },
    { label: 'Cadastros após leitura', value: rows.reduce((sum, row) => sum + row.registrationsAfterRead, 0), icon: UserPlus },
  ]

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="admin-kicker">Conteúdo</p>
          <h2 className="font-serif text-2xl text-forest-900">Leitura dos artigos</h2>
          <p className="mt-1 text-sm text-ink-soft">Veja quais artigos os visitantes realmente abriram, até onde leram e se clicaram ou se cadastraram depois.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-line bg-paper-soft p-1">
            {PERIODS.map(p => <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={`rounded-lg px-3 py-1.5 text-sm ${period === p.id ? 'bg-white text-forest-900 shadow-sm' : 'text-ink-soft'}`}>{p.label}</button>)}
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-800"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-line bg-white p-4"><Icon className="mb-2 h-4 w-4 text-forest-600" /><p className="font-serif text-3xl text-forest-900">{loading ? '—' : value}</p><p className="mt-1 text-xs text-ink-soft">{label}</p></div>)}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar os dados: {error}</div>}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-serif text-lg text-forest-900">Desempenho por artigo</h3>
          <p className="mt-1 text-xs text-ink-soft">Leitores e profundidade são contados por pessoa/sessão única. “Cliques” e “Cadastros” são atribuídos ao último artigo lido antes da ação, na mesma sessão.</p>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-ink-soft">Carregando leituras…</div> : rows.length === 0 ? <div className="p-8 text-center text-sm text-ink-soft">Nenhuma leitura de artigo registrada neste período.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="px-4 py-3">Artigo</th><th className="px-3 py-3 text-right">Views</th><th className="px-3 py-3 text-right">Leitores</th><th className="px-3 py-3 text-right">50%</th><th className="px-3 py-3 text-right">75%</th><th className="px-3 py-3 text-right">100%</th><th className="px-3 py-3 text-right">Cliques</th><th className="px-3 py-3 text-right">Cadastros</th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map(row => <tr key={row.slug} className="hover:bg-paper-soft/60"><td className="px-4 py-3"><p className="font-medium text-forest-900">{row.title}</p><p className="mt-0.5 max-w-md truncate font-mono text-[11px] text-ink-soft">{row.slug}</p></td><td className="px-3 py-3 text-right text-forest-900">{row.views}</td><td className="px-3 py-3 text-right text-forest-900">{row.uniqueReaders}</td><td className="px-3 py-3 text-right"><span className="font-medium text-forest-900">{row.scroll50}</span><span className="ml-1 text-xs text-ink-soft">{percent(row.scroll50, row.uniqueReaders)}</span></td><td className="px-3 py-3 text-right"><span className="font-medium text-forest-900">{row.scroll75}</span><span className="ml-1 text-xs text-ink-soft">{percent(row.scroll75, row.uniqueReaders)}</span></td><td className="px-3 py-3 text-right"><span className="font-medium text-forest-900">{row.scroll100}</span><span className="ml-1 text-xs text-ink-soft">{percent(row.scroll100, row.uniqueReaders)}</span></td><td className="px-3 py-3 text-right text-forest-900">{row.ctaAfterRead}</td><td className="px-3 py-3 text-right text-forest-900">{row.registrationsAfterRead}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">Importante: “cadastro após leitura” significa que o evento de cadastro confirmado ocorreu depois da leitura na mesma sessão. Isso evita atribuir ao artigo cadastros sem relação observável com aquela visita.</p>
    </section>
  )
}
