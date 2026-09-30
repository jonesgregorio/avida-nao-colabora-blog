import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock3, Filter, RefreshCw, Search, UserRoundCheck, UserRoundX } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Period = '24h' | '7d' | '30d' | '90d'
type ReaderType = 'all' | 'identified' | 'anonymous'
type EngagementFilter = 'all' | 'superficial' | 'partial' | 'engaged' | 'high' | 'engaged_no_signup'
type ProgressFilter = 'all' | 'opened' | '50' | '75' | '100'
type TimeFilter = 'all' | 'under30' | '30_60' | '60_180' | '180plus'
type RegistrationFilter = 'all' | 'yes' | 'no'
type Engagement = 'Superficial' | 'Parcial' | 'Engajado' | 'Alta intenção'

const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: '24h', label: 'Últimas 24h', days: 1 }, { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 }, { id: '90d', label: '90 dias', days: 90 },
]
const PAGE_SIZE = 20

type Ev = {
  event: string
  entity_id: string | null
  entity_title: string | null
  session_id: string | null
  user_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
type Profile = { user_id: string; preferred_name: string | null; display_name: string | null; full_name: string | null }
type ReaderRow = {
  key: string
  userId: string | null
  sessionIds: string[]
  readerName: string
  readerDetail: string
  identified: boolean
  slug: string
  articleTitle: string
  views: number
  maxProgress: 0 | 50 | 75 | 100
  activeSeconds: number
  estimatedReadSeconds: number
  engagement: Engagement
  nextAction: string
  signupStarted: boolean
  registered: boolean
  lastReadAt: string
}

type WorkingRow = Omit<ReaderRow, 'sessionIds' | 'activeSeconds' | 'estimatedReadSeconds' | 'engagement'> & {
  sessions: Set<string>
  activeBySession: Map<string, number>
  estimatedBySession: Map<string, number>
}

function personKey(e: Ev) { return e.user_id ? `user:${e.user_id}` : e.session_id ? `session:${e.session_id}` : '' }
function progressOf(event: string): 0 | 50 | 75 | 100 { return event === 'article_scroll_100' ? 100 : event === 'article_scroll_75' ? 75 : event === 'article_scroll_50' ? 50 : 0 }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : 0 }
function identity(userId: string | null, sessionId: string | null, profiles: Map<string, Profile>) {
  if (userId) {
    const p = profiles.get(userId)
    return { name: p?.preferred_name || p?.display_name || p?.full_name || 'Usuário cadastrado', detail: `ID ${userId.slice(0, 8)}`, identified: true }
  }
  return { name: 'Visitante anônimo', detail: sessionId ? `Sessão ${sessionId.slice(0, 8)}` : 'Sessão sem identificador', identified: false }
}
function engagementOf(progress: number, activeSeconds: number, estimatedReadSeconds: number): Engagement {
  const ratio = estimatedReadSeconds > 0 ? activeSeconds / estimatedReadSeconds : 0
  if (progress >= 75 && (activeSeconds >= 90 || ratio >= 0.35)) return 'Alta intenção'
  if (progress >= 50 && (activeSeconds >= 30 || ratio >= 0.2)) return 'Engajado'
  if (progress >= 50 || activeSeconds >= 20) return 'Parcial'
  return 'Superficial'
}
function formatTime(seconds: number) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60); const s = seconds % 60
  return s ? `${m}m ${s}s` : `${m}m`
}
function fmt(value: string) { try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) } catch { return value } }

function buildRows(events: Ev[], profiles: Map<string, Profile>): ReaderRow[] {
  const rows = new Map<string, WorkingRow>()
  const sessionSlugToKey = new Map<string, string>()
  const views = events.filter(e => e.event === 'article_view' && e.entity_id)

  for (const e of views) {
    const person = personKey(e); if (!person || !e.entity_id) continue
    const key = `${person}|${e.entity_id}`; const id = identity(e.user_id, e.session_id, profiles)
    const row = rows.get(key) || {
      key, userId: e.user_id, readerName: id.name, readerDetail: id.detail, identified: id.identified,
      slug: e.entity_id, articleTitle: e.entity_title || e.entity_id, views: 0, maxProgress: 0 as const,
      sessions: new Set<string>(), activeBySession: new Map<string, number>(), estimatedBySession: new Map<string, number>(),
      nextAction: 'Sem ação observada', signupStarted: false, registered: false, lastReadAt: e.created_at,
    }
    row.views += 1
    if (e.entity_title) row.articleTitle = e.entity_title
    if (e.session_id) { row.sessions.add(e.session_id); sessionSlugToKey.set(`${e.session_id}|${e.entity_id}`, key) }
    if (e.created_at > row.lastReadAt) row.lastReadAt = e.created_at
    rows.set(key, row)
  }

  for (const e of events) {
    const progress = progressOf(e.event)
    if (progress && e.entity_id) {
      const key = e.session_id ? sessionSlugToKey.get(`${e.session_id}|${e.entity_id}`) : undefined
      const fallback = personKey(e) ? `${personKey(e)}|${e.entity_id}` : ''
      const row = rows.get(key || fallback)
      if (row && progress > row.maxProgress) row.maxProgress = progress
      if (row && e.created_at > row.lastReadAt) row.lastReadAt = e.created_at
    }
    if (e.event === 'article_active_time' && e.entity_id && e.session_id) {
      const row = rows.get(sessionSlugToKey.get(`${e.session_id}|${e.entity_id}`) || '')
      if (!row) continue
      const active = num(e.metadata?.active_seconds)
      const estimated = num(e.metadata?.estimated_read_seconds)
      row.activeBySession.set(e.session_id, Math.max(row.activeBySession.get(e.session_id) || 0, active))
      if (estimated) row.estimatedBySession.set(e.session_id, estimated)
      if (e.created_at > row.lastReadAt) row.lastReadAt = e.created_at
    }
  }

  const bySession = new Map<string, Ev[]>()
  for (const e of events) if (e.session_id) {
    if (!bySession.has(e.session_id)) bySession.set(e.session_id, [])
    bySession.get(e.session_id)!.push(e)
  }
  for (const [sessionId, list] of bySession) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    let currentKey: string | null = null
    for (const e of list) {
      if (e.event === 'article_view' && e.entity_id) {
        const nextKey = sessionSlugToKey.get(`${sessionId}|${e.entity_id}`) || null
        if (currentKey && nextKey && currentKey !== nextKey) {
          const previous = rows.get(currentKey)
          if (previous && previous.nextAction === 'Sem ação observada') previous.nextAction = 'Abriu outro artigo'
        }
        currentKey = nextKey
        continue
      }
      if (!currentKey) continue
      const row = rows.get(currentKey); if (!row) continue
      if (e.event === 'cta_click' || e.event === 'article_click') row.nextAction = 'Clicou em CTA/link'
      if (e.event === 'signup_click' || e.event === 'signup_start' || e.event === 'signup_submit') {
        row.signupStarted = true; row.nextAction = 'Iniciou cadastro'
      }
      if (e.event === 'registration_complete') {
        row.signupStarted = true; row.registered = true; row.nextAction = 'Cadastro concluído'
      }
    }
  }

  return [...rows.values()].map(row => {
    const activeSeconds = [...row.activeBySession.values()].reduce((a, b) => a + b, 0)
    const estimates = [...row.estimatedBySession.values()]
    const estimatedReadSeconds = estimates.length ? Math.max(...estimates) : 0
    return {
      key: row.key, userId: row.userId, sessionIds: [...row.sessions], readerName: row.readerName, readerDetail: row.readerDetail,
      identified: row.identified, slug: row.slug, articleTitle: row.articleTitle, views: row.views, maxProgress: row.maxProgress,
      activeSeconds, estimatedReadSeconds, engagement: engagementOf(row.maxProgress, activeSeconds, estimatedReadSeconds),
      nextAction: row.nextAction, signupStarted: row.signupStarted, registered: row.registered, lastReadAt: row.lastReadAt,
    }
  }).sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt))
}

export default function AdminArticleReaders() {
  const [period, setPeriod] = useState<Period>('30d')
  const [readerType, setReaderType] = useState<ReaderType>('all')
  const [article, setArticle] = useState('all')
  const [engagement, setEngagement] = useState<EngagementFilter>('all')
  const [progress, setProgress] = useState<ProgressFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [registration, setRegistration] = useState<RegistrationFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<Ev[]>([])
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const days = PERIODS.find(p => p.id === period)!.days
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days])

  async function load() {
    setLoading(true); setError(null)
    const wanted = ['article_view','article_scroll_50','article_scroll_75','article_scroll_100','article_active_time','article_click','cta_click','signup_click','signup_start','signup_submit','registration_complete']
    const { data, error: evError } = await supabase.from('analytics_events').select('event,entity_id,entity_title,session_id,user_id,metadata,created_at').gte('created_at', since).in('event', wanted).order('created_at', { ascending: true }).limit(30000)
    if (evError) { setError(evError.message); setEvents([]); setProfiles(new Map()); setLoading(false); return }
    const loaded = (data as Ev[] | null) ?? []; setEvents(loaded)
    const ids = [...new Set(loaded.map(e => e.user_id).filter((id): id is string => Boolean(id)))]
    if (ids.length) {
      const { data: ps, error: pError } = await supabase.from('profiles').select('user_id,preferred_name,display_name,full_name').in('user_id', ids).limit(10000)
      if (pError) setError(pError.message)
      const map = new Map<string, Profile>(); for (const p of (ps as Profile[] | null) ?? []) map.set(p.user_id, p); setProfiles(map)
    } else setProfiles(new Map())
    setLoading(false)
  }
  useEffect(() => { void load() }, [since]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [readerType, article, engagement, progress, timeFilter, registration, search, period])

  const rows = useMemo(() => buildRows(events, profiles), [events, profiles])
  const articles = useMemo(() => { const m = new Map<string,string>(); for (const r of rows) m.set(r.slug,r.articleTitle); return [...m.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')) }, [rows])
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR')
    return rows.filter(r => {
      if (readerType === 'identified' && !r.identified) return false
      if (readerType === 'anonymous' && r.identified) return false
      if (article !== 'all' && r.slug !== article) return false
      return !q || [r.readerName,r.readerDetail,r.articleTitle,r.slug].some(v=>v.toLocaleLowerCase('pt-BR').includes(q))
    })
  }, [rows, readerType, article, search])
  const filtered = useMemo(() => baseFiltered.filter(r => {
    if (engagement === 'superficial' && r.engagement !== 'Superficial') return false
    if (engagement === 'partial' && r.engagement !== 'Parcial') return false
    if (engagement === 'engaged' && r.engagement !== 'Engajado') return false
    if (engagement === 'high' && r.engagement !== 'Alta intenção') return false
    if (engagement === 'engaged_no_signup' && !((r.engagement === 'Engajado' || r.engagement === 'Alta intenção') && !r.registered)) return false
    if (progress === 'opened' && r.maxProgress !== 0) return false
    if (progress === '50' && r.maxProgress < 50) return false
    if (progress === '75' && r.maxProgress < 75) return false
    if (progress === '100' && r.maxProgress < 100) return false
    if (timeFilter === 'under30' && r.activeSeconds >= 30) return false
    if (timeFilter === '30_60' && (r.activeSeconds < 30 || r.activeSeconds >= 60)) return false
    if (timeFilter === '60_180' && (r.activeSeconds < 60 || r.activeSeconds >= 180)) return false
    if (timeFilter === '180plus' && r.activeSeconds < 180) return false
    if (registration === 'yes' && !r.registered) return false
    if (registration === 'no' && r.registered) return false
    return true
  }), [baseFiltered, engagement, progress, timeFilter, registration])

  const identified = new Set(rows.filter(r=>r.identified).map(r=>r.userId).filter(Boolean)).size
  const anonymous = new Set(rows.filter(r=>!r.identified).flatMap(r=>r.sessionIds)).size
  const engagedNoSignup = rows.filter(r => (r.engagement === 'Engajado' || r.engagement === 'Alta intenção') && !r.registered).length
  const avgActive = rows.length ? Math.round(rows.reduce((sum,r)=>sum+r.activeSeconds,0)/rows.length) : 0
  const funnel = [
    ['Abriram', baseFiltered.length],
    ['Chegaram a 50%', baseFiltered.filter(r=>r.maxProgress>=50).length],
    ['Chegaram a 75%', baseFiltered.filter(r=>r.maxProgress>=75).length],
    ['Chegaram a 100%', baseFiltered.filter(r=>r.maxProgress>=100).length],
    ['Clicaram', baseFiltered.filter(r=>r.nextAction==='Clicou em CTA/link').length],
    ['Iniciaram cadastro', baseFiltered.filter(r=>r.signupStarted).length],
    ['Concluíram cadastro', baseFiltered.filter(r=>r.registered).length],
  ] as const
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const safePage = Math.min(page,totalPages); const visible = filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE)

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="admin-kicker">Conteúdo</p><h2 className="font-serif text-2xl text-forest-900">Leitores, tempo e conversão</h2><p className="mt-1 max-w-3xl text-sm text-ink-soft">Entenda quem leu, por quanto tempo ficou realmente ativo no artigo, até onde chegou e o que fez depois.</p></div><button type="button" onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-800"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/> Atualizar</button></div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div className="rounded-2xl border border-line bg-white p-4"><UserRoundCheck className="mb-2 h-4 w-4 text-forest-600"/><p className="font-serif text-3xl text-forest-900">{loading?'—':identified}</p><p className="mt-1 text-xs text-ink-soft">Leitores identificados</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><UserRoundX className="mb-2 h-4 w-4 text-forest-600"/><p className="font-serif text-3xl text-forest-900">{loading?'—':anonymous}</p><p className="mt-1 text-xs text-ink-soft">Sessões anônimas</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><Clock3 className="mb-2 h-4 w-4 text-forest-600"/><p className="font-serif text-3xl text-forest-900">{loading?'—':formatTime(avgActive)}</p><p className="mt-1 text-xs text-ink-soft">Tempo ativo médio</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><Filter className="mb-2 h-4 w-4 text-forest-600"/><p className="font-serif text-3xl text-forest-900">{loading?'—':engagedNoSignup}</p><p className="mt-1 text-xs text-ink-soft">Engajados sem cadastro</p></div>
      <div className="rounded-2xl border border-line bg-white p-4"><p className="font-serif text-3xl text-forest-900">{loading?'—':articles.length}</p><p className="mt-1 text-xs text-ink-soft">Artigos lidos</p></div>
    </div>

    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-paper-soft p-1">{PERIODS.map(p=><button key={p.id} type="button" onClick={()=>setPeriod(p.id)} className={`rounded-lg px-3 py-1.5 text-sm ${period===p.id?'bg-white text-forest-900 shadow-sm':'text-ink-soft'}`}>{p.label}</button>)}</div>
        <select value={readerType} onChange={e=>setReaderType(e.target.value as ReaderType)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Todos os leitores</option><option value="identified">Só cadastrados</option><option value="anonymous">Só anônimos</option></select>
        <select value={article} onChange={e=>setArticle(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Todos os artigos</option>{articles.map(([slug,title])=><option key={slug} value={slug}>{title}</option>)}</select>
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar usuário ou artigo" className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm text-forest-900"/></label>
        <select value={engagement} onChange={e=>setEngagement(e.target.value as EngagementFilter)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Todo engajamento</option><option value="superficial">Superficial</option><option value="partial">Parcial</option><option value="engaged">Engajado</option><option value="high">Alta intenção</option><option value="engaged_no_signup">Engajados sem cadastro</option></select>
        <select value={progress} onChange={e=>setProgress(e.target.value as ProgressFilter)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Qualquer profundidade</option><option value="opened">Só abriu</option><option value="50">50% ou mais</option><option value="75">75% ou mais</option><option value="100">Chegou ao fim</option></select>
        <select value={timeFilter} onChange={e=>setTimeFilter(e.target.value as TimeFilter)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Qualquer tempo ativo</option><option value="under30">Menos de 30s</option><option value="30_60">30s–1min</option><option value="60_180">1–3min</option><option value="180plus">3min ou mais</option></select>
        <select value={registration} onChange={e=>setRegistration(e.target.value as RegistrationFilter)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Cadastro: todos</option><option value="yes">Fez cadastro</option><option value="no">Não fez cadastro</option></select>
      </div>
    </div>

    <div className="rounded-2xl border border-line bg-white p-5"><div className="mb-4"><h3 className="font-serif text-lg text-forest-900">Funil de leitura → cadastro</h3><p className="mt-1 text-xs text-ink-soft">Respeita os filtros de leitor, artigo e busca acima. Selecione um artigo para analisar o funil dele isoladamente.</p></div><div className="grid gap-3 md:grid-cols-7">{funnel.map(([label,value],i)=>{const base=Math.max(1,funnel[0][1]);return <div key={label} className="rounded-xl bg-paper-soft p-3"><p className="font-serif text-2xl text-forest-900">{value}</p><p className="mt-1 text-[11px] text-ink-soft">{label}</p>{i>0&&<p className="mt-1 text-[10px] font-medium text-forest-600">{Math.round((value/base)*100)}% do topo</p>}</div>})}</div></div>

    {error&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar todos os dados: {error}</div>}

    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4"><h3 className="font-serif text-lg text-forest-900">Leituras detalhadas</h3><p className="mt-1 text-xs text-ink-soft">{filtered.length} resultado{filtered.length===1?'':'s'} · {PAGE_SIZE} linhas por página. Tempo ativo pausa quando a aba fica oculta ou após 60s sem atividade.</p></div>
      {loading?<div className="p-8 text-center text-sm text-ink-soft">Carregando leitores…</div>:filtered.length===0?<div className="p-8 text-center text-sm text-ink-soft">Nenhuma leitura encontrada com estes filtros.</div>:<><div className="overflow-x-auto"><table className="min-w-[1280px] w-full text-sm"><thead className="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="px-4 py-3">Leitor</th><th className="px-4 py-3">Artigo</th><th className="px-3 py-3 text-right">Tempo ativo</th><th className="px-3 py-3 text-right">Leitura</th><th className="px-3 py-3">Engajamento</th><th className="px-3 py-3">Próxima ação</th><th className="px-3 py-3 text-center">Cadastro</th><th className="px-4 py-3 text-right">Última leitura</th></tr></thead><tbody className="divide-y divide-line">{visible.map(r=><tr key={r.key} className="hover:bg-paper-soft/60"><td className="px-4 py-3"><div className="flex items-center gap-2">{r.identified?<UserRoundCheck className="h-4 w-4 shrink-0 text-forest-600"/>:<UserRoundX className="h-4 w-4 shrink-0 text-stone-400"/>}<div className="min-w-0"><p className="truncate font-medium text-forest-900">{r.readerName}</p><p className="truncate text-xs text-ink-soft">{r.readerDetail}</p></div></div></td><td className="px-4 py-3"><p className="max-w-md truncate font-medium text-forest-900">{r.articleTitle}</p><p className="max-w-md truncate font-mono text-[11px] text-ink-soft">{r.slug}</p></td><td className="px-3 py-3 text-right"><p className="font-medium text-forest-900">{formatTime(r.activeSeconds)}</p>{r.estimatedReadSeconds>0&&<p className="text-[10px] text-ink-soft">de ~{formatTime(r.estimatedReadSeconds)}</p>}</td><td className="px-3 py-3 text-right"><span className="inline-flex min-w-12 justify-center rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">{r.maxProgress?`${r.maxProgress}%`:'abriu'}</span></td><td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${r.engagement==='Alta intenção'?'bg-green-50 text-green-700':r.engagement==='Engajado'?'bg-forest-50 text-forest-700':r.engagement==='Parcial'?'bg-amber-50 text-amber-700':'bg-stone-100 text-stone-600'}`}>{r.engagement}</span></td><td className="px-3 py-3 text-ink-soft">{r.nextAction}</td><td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-medium ${r.registered?'bg-green-50 text-green-700':r.signupStarted?'bg-amber-50 text-amber-700':'bg-stone-100 text-stone-600'}`}>{r.registered?'Concluído':r.signupStarted?'Iniciado':'Não'}</span></td><td className="px-4 py-3 text-right whitespace-nowrap text-ink-soft">{fmt(r.lastReadAt)}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"><p className="text-xs text-ink-soft">Página {safePage} de {totalPages}</p><div className="flex gap-2"><button type="button" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-forest-800 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/> Anterior</button><button type="button" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-forest-800 disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4"/></button></div></div></>}
    </div>
    <p className="text-xs leading-relaxed text-ink-soft">Privacidade: o rastreamento registra apenas tempo técnico de leitura, artigo, sessão e ações de navegação. Não lê conteúdo do diário, check-ins, respostas de questionários ou dados emocionais. Usuários só aparecem identificados quando já estavam autenticados.</p>
  </section>
}
