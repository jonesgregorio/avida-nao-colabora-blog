import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Search, UserRoundCheck, UserRoundX } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Period = '24h' | '7d' | '30d' | '90d'
type ReaderType = 'all' | 'identified' | 'anonymous'
const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: '24h', label: 'Últimas 24h', days: 1 }, { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 }, { id: '90d', label: '90 dias', days: 90 },
]
const PAGE_SIZE = 25

type Ev = { event: string; entity_id: string | null; entity_title: string | null; session_id: string | null; user_id: string | null; created_at: string }
type Profile = { user_id: string; preferred_name: string | null; display_name: string | null; full_name: string | null }
type ReaderRow = { key: string; userId: string | null; sessionId: string | null; readerName: string; readerDetail: string; identified: boolean; slug: string; articleTitle: string; views: number; maxProgress: 0 | 50 | 75 | 100; lastReadAt: string }

function personKey(e: Ev) { return e.user_id ? `user:${e.user_id}` : e.session_id ? `session:${e.session_id}` : '' }
function progressOf(event: string): 0 | 50 | 75 | 100 { return event === 'article_scroll_100' ? 100 : event === 'article_scroll_75' ? 75 : event === 'article_scroll_50' ? 50 : 0 }
function identity(userId: string | null, sessionId: string | null, profiles: Map<string, Profile>) {
  if (userId) {
    const p = profiles.get(userId)
    return { name: p?.preferred_name || p?.display_name || p?.full_name || 'Usuário cadastrado', detail: `ID ${userId.slice(0, 8)}`, identified: true }
  }
  return { name: 'Visitante anônimo', detail: sessionId ? `Sessão ${sessionId.slice(0, 8)}` : 'Sessão sem identificador', identified: false }
}
function buildRows(events: Ev[], profiles: Map<string, Profile>): ReaderRow[] {
  const rows = new Map<string, ReaderRow>()
  for (const e of events.filter(x => x.event === 'article_view' && x.entity_id)) {
    const person = personKey(e); if (!person || !e.entity_id) continue
    const key = `${person}|${e.entity_id}`; const id = identity(e.user_id, e.session_id, profiles)
    const row = rows.get(key) || { key, userId: e.user_id, sessionId: e.session_id, readerName: id.name, readerDetail: id.detail, identified: id.identified, slug: e.entity_id, articleTitle: e.entity_title || e.entity_id, views: 0, maxProgress: 0 as const, lastReadAt: e.created_at }
    row.views += 1; if (e.entity_title) row.articleTitle = e.entity_title; if (e.created_at > row.lastReadAt) row.lastReadAt = e.created_at; rows.set(key, row)
  }
  for (const e of events) {
    const progress = progressOf(e.event); if (!progress || !e.entity_id) continue
    const person = personKey(e); if (!person) continue
    const row = rows.get(`${person}|${e.entity_id}`); if (!row) continue
    if (progress > row.maxProgress) row.maxProgress = progress
    if (e.created_at > row.lastReadAt) row.lastReadAt = e.created_at
  }
  return [...rows.values()].sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt))
}
function fmt(value: string) { try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) } catch { return value } }

export default function AdminArticleReaders() {
  const [period, setPeriod] = useState<Period>('30d'); const [readerType, setReaderType] = useState<ReaderType>('all'); const [article, setArticle] = useState('all'); const [search, setSearch] = useState(''); const [page, setPage] = useState(1)
  const [events, setEvents] = useState<Ev[]>([]); const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map()); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const days = PERIODS.find(p => p.id === period)!.days
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days])
  async function load() {
    setLoading(true); setError(null)
    const { data, error: evError } = await supabase.from('analytics_events').select('event,entity_id,entity_title,session_id,user_id,created_at').gte('created_at', since).in('event', ['article_view','article_scroll_50','article_scroll_75','article_scroll_100']).order('created_at', { ascending: false }).limit(20000)
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
  useEffect(() => { setPage(1) }, [readerType, article, search, period])
  const rows = useMemo(() => buildRows(events, profiles), [events, profiles])
  const articles = useMemo(() => { const m = new Map<string,string>(); for (const r of rows) m.set(r.slug,r.articleTitle); return [...m.entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')) }, [rows])
  const filtered = useMemo(() => { const q = search.trim().toLocaleLowerCase('pt-BR'); return rows.filter(r => { if (readerType==='identified'&&!r.identified) return false; if (readerType==='anonymous'&&r.identified) return false; if (article!=='all'&&r.slug!==article) return false; return !q || [r.readerName,r.readerDetail,r.articleTitle,r.slug].some(v=>v.toLocaleLowerCase('pt-BR').includes(q)) }) }, [rows,readerType,article,search])
  const identified = useMemo(() => new Set(rows.filter(r=>r.identified).map(r=>r.userId).filter(Boolean)).size,[rows]); const anonymous = useMemo(() => new Set(rows.filter(r=>!r.identified).map(r=>r.sessionId).filter(Boolean)).size,[rows])
  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); const safePage = Math.min(page,totalPages); const visible = filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE)
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="admin-kicker">Conteúdo</p><h2 className="font-serif text-2xl text-forest-900">Leitores e artigos lidos</h2><p className="mt-1 max-w-3xl text-sm text-ink-soft">Veja quais usuários cadastrados estão lendo, quais artigos abriram e até onde chegaram. Visitantes sem login aparecem apenas como sessão anônima.</p></div><button type="button" onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-800"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/> Atualizar</button></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-2xl border border-line bg-white p-4"><UserRoundCheck className="mb-2 h-4 w-4 text-forest-600"/><p className="font-serif text-3xl text-forest-900">{loading?'—':identified}</p><p className="mt-1 text-xs text-ink-soft">Leitores identificados</p></div><div className="rounded-2xl border border-line bg-white p-4"><UserRoundX className="mb-2 h-4 w-4 text-forest-600"/><p className="font-serif text-3xl text-forest-900">{loading?'—':anonymous}</p><p className="mt-1 text-xs text-ink-soft">Sessões anônimas</p></div><div className="rounded-2xl border border-line bg-white p-4"><p className="font-serif text-3xl text-forest-900">{loading?'—':rows.length}</p><p className="mt-1 text-xs text-ink-soft">Leitor × artigo</p></div><div className="rounded-2xl border border-line bg-white p-4"><p className="font-serif text-3xl text-forest-900">{loading?'—':articles.length}</p><p className="mt-1 text-xs text-ink-soft">Artigos lidos</p></div></div>
    <div className="rounded-2xl border border-line bg-white p-4"><div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_180px_minmax(220px,1fr)_minmax(220px,1fr)]"><div className="flex flex-wrap gap-1 rounded-xl border border-line bg-paper-soft p-1">{PERIODS.map(p=><button key={p.id} type="button" onClick={()=>setPeriod(p.id)} className={`rounded-lg px-3 py-1.5 text-sm ${period===p.id?'bg-white text-forest-900 shadow-sm':'text-ink-soft'}`}>{p.label}</button>)}</div><select value={readerType} onChange={e=>setReaderType(e.target.value as ReaderType)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Todos os leitores</option><option value="identified">Só cadastrados</option><option value="anonymous">Só anônimos</option></select><select value={article} onChange={e=>setArticle(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900"><option value="all">Todos os artigos</option>{articles.map(([slug,title])=><option key={slug} value={slug}>{title}</option>)}</select><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar usuário ou artigo" className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm text-forest-900"/></label></div></div>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar todos os dados: {error}</div>}
    <div className="overflow-hidden rounded-2xl border border-line bg-white"><div className="border-b border-line px-5 py-4"><h3 className="font-serif text-lg text-forest-900">Quem está lendo</h3><p className="mt-1 text-xs text-ink-soft">{filtered.length} resultado{filtered.length===1?'':'s'} · {PAGE_SIZE} linhas por página.</p></div>{loading?<div className="p-8 text-center text-sm text-ink-soft">Carregando leitores…</div>:filtered.length===0?<div className="p-8 text-center text-sm text-ink-soft">Nenhuma leitura encontrada com estes filtros.</div>:<><div className="overflow-x-auto"><table className="min-w-[960px] w-full text-sm"><thead className="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="px-4 py-3">Leitor</th><th className="px-4 py-3">Artigo</th><th className="px-3 py-3 text-right">Aberturas</th><th className="px-3 py-3 text-right">Leitura</th><th className="px-4 py-3 text-right">Última leitura</th></tr></thead><tbody className="divide-y divide-line">{visible.map(r=><tr key={r.key} className="hover:bg-paper-soft/60"><td className="px-4 py-3"><div className="flex items-center gap-2">{r.identified?<UserRoundCheck className="h-4 w-4 shrink-0 text-forest-600"/>:<UserRoundX className="h-4 w-4 shrink-0 text-stone-400"/>}<div className="min-w-0"><p className="truncate font-medium text-forest-900">{r.readerName}</p><p className="truncate text-xs text-ink-soft">{r.readerDetail}</p></div></div></td><td className="px-4 py-3"><p className="max-w-lg truncate font-medium text-forest-900">{r.articleTitle}</p><p className="max-w-lg truncate font-mono text-[11px] text-ink-soft">{r.slug}</p></td><td className="px-3 py-3 text-right text-forest-900">{r.views}</td><td className="px-3 py-3 text-right"><span className={`inline-flex min-w-12 justify-center rounded-full px-2 py-1 text-xs font-medium ${r.maxProgress>=100?'bg-green-50 text-green-700':r.maxProgress>=75?'bg-forest-50 text-forest-700':'bg-stone-100 text-stone-600'}`}>{r.maxProgress?`${r.maxProgress}%`:'abriu'}</span></td><td className="px-4 py-3 text-right whitespace-nowrap text-ink-soft">{fmt(r.lastReadAt)}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"><p className="text-xs text-ink-soft">Página {safePage} de {totalPages}</p><div className="flex gap-2"><button type="button" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-forest-800 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/> Anterior</button><button type="button" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-forest-800 disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4"/></button></div></div></>}</div>
    <p className="text-xs leading-relaxed text-ink-soft">Privacidade: usuários só são identificados quando o evento de leitura já contém um <span className="font-mono">user_id</span> de uma conta autenticada. Visitantes sem login continuam anônimos.</p>
  </section>
}
