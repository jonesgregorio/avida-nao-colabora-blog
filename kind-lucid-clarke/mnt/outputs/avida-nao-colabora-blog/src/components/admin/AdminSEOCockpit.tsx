import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { generateSEO } from '../../lib/aiContent'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Pencil, RefreshCw, Search, Sparkles } from 'lucide-react'

interface Row {
  id: string
  title: string
  slug: string
  status: string
  seo_title: string | null
  seo_description: string | null
  image_url: string | null
  cover_image: string | null
  cover_image_url: string | null
  keyword: string | null
  content: string | null
  author: string | null
  image_alt: string | null
  related_slugs: string[] | null
  reviewed_at: string | null
  published: boolean | null
  published_at: string | null
  updated_at: string | null
  created_at: string
}

type Issue = 'no_seo' | 'no_image' | 'bad_slug' | 'thin' | 'no_author' | 'no_review' | 'no_links' | 'old'
type Metric = { clicks: number; impressions: number; ctr: number; position: number }
type SearchItem = Metric & { key: string }
type TrendRow = Metric & { day: string }
type Inspection = { url: string; verdict?: string | null; coverage_state?: string | null; google_canonical?: string | null; user_canonical?: string | null; last_crawl_time?: string | null; last_inspected_at: string }
type Sitemap = { path: string; errors: number; warnings: number; last_submitted?: string | null; last_downloaded?: string | null; last_checked_at?: string | null }
type Alert = { id: string; severity: 'info' | 'warning' | 'critical'; title: string; details?: string | null; url?: string | null; last_seen_at: string }
type Run = { id: string; kind: string; status: string; started_at: string; finished_at?: string | null; rows_written: number; error?: string | null }
type Opportunity = SearchItem & { type: string; subject: string; reason: string }
type Dashboard = {
  configured: boolean
  siteUrl: string
  current: Metric
  previous: Metric
  trend: TrendRow[]
  queries: SearchItem[]
  pages: SearchItem[]
  opportunities: Opportunity[]
  inspections: Inspection[]
  sitemaps: Sitemap[]
  alerts: Alert[]
  runs: Run[]
  error?: string
}

type Tab = 'overview' | 'indexing' | 'performance' | 'queries' | 'pages' | 'opportunities' | 'sitemap' | 'alerts' | 'audit' | 'settings'

const seoOk = (a: Row) => !!(a.seo_title && a.seo_title.trim().length >= 25 && a.seo_title.trim().length <= 60 && a.seo_description && a.seo_description.trim().length >= 90 && a.seo_description.trim().length <= 155 && a.keyword)
const imgOk = (a: Row) => !!((a.image_url || a.cover_image || a.cover_image_url) && a.image_alt?.trim())
const badSlug = (s: string) => !s || /[^a-z0-9-]/.test(s) || s.length > 60 || s.includes('--')
const wordCount = (content: string | null) => String(content || '').trim().split(/\s+/).filter(Boolean).length
function isOld(a: Row) {
  const d = a.updated_at || a.published_at || a.created_at
  return !!d && Date.now() - new Date(d).getTime() > 180 * 86400000
}
const hasIssue = (a: Row, i: Issue) =>
  i === 'no_seo' ? !seoOk(a)
    : i === 'no_image' ? !imgOk(a)
      : i === 'bad_slug' ? badSlug(a.slug)
        : i === 'thin' ? wordCount(a.content) < 800
          : i === 'no_author' ? !a.author?.trim()
            : i === 'no_review' ? !a.reviewed_at
              : i === 'no_links' ? !a.related_slugs?.length && !/\]\(\/blog\//.test(a.content || '')
                : isOld(a)

const fmt = (value: number | undefined) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0)
const pct = (value: number | undefined) => `${((value || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const delta = (now: number, before: number) => before ? ((now - before) / Math.abs(before)) : (now ? 1 : 0)

export default function AdminSEOCockpit({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<Issue>('no_seo')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function flash(msg: string, err = false) {
    setToast({ msg, err })
    window.setTimeout(() => setToast(null), 3500)
  }

  async function loadArticles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('articles')
      .select('id,title,slug,status,published,seo_title,seo_description,image_url,cover_image,cover_image_url,image_alt,keyword,content,author,related_slugs,reviewed_at,published_at,updated_at,created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) flash('Falha ao carregar auditoria técnica: ' + error.message, true)
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }

  async function loadDashboard() {
    setSearchLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-search-console', { body: { action: 'dashboard' } })
      if (error) throw error
      setDashboard(data as Dashboard)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar o Google Search Console.'
      setDashboard(prev => prev ? { ...prev, error: message } : null)
      flash(message, true)
    } finally {
      setSearchLoading(false)
    }
  }

  async function syncNow() {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-search-console', { body: { action: 'sync', source: 'manual' } })
      if (error) throw error
      if (data?.dashboard) setDashboard(data.dashboard as Dashboard)
      else await loadDashboard()
      flash(`Sincronização concluída: ${data?.rowsWritten || 0} registros atualizados.`)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Falha ao sincronizar Search Console.', true)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    void Promise.all([loadArticles(), loadDashboard()])
  }, [])

  const cards: { key: Issue; label: string }[] = [
    { key: 'no_seo', label: 'Metadados incompletos' },
    { key: 'no_image', label: 'Imagem ou alt ausente' },
    { key: 'bad_slug', label: 'Slug ruim' },
    { key: 'thin', label: 'Conteúdo curto' },
    { key: 'no_author', label: 'Sem autoria' },
    { key: 'no_review', label: 'Sem revisão registrada' },
    { key: 'no_links', label: 'Sem links internos' },
    { key: 'old', label: 'Antigos (6+ meses)' },
  ]
  const publishedRows = rows.filter(a => a.published === true || a.status === 'published')
  const count = (i: Issue) => publishedRows.filter(a => hasIssue(a, i)).length
  const list = publishedRows.filter(a => hasIssue(a, issue))
  const auditProblems = cards.reduce((sum, card) => sum + count(card.key), 0)

  const health = useMemo(() => {
    if (!dashboard) return null
    const inspected = dashboard.inspections.length
    const passed = dashboard.inspections.filter(item => item.verdict === 'PASS').length
    const sitemapPenalty = dashboard.sitemaps.reduce((sum, item) => sum + Number(item.errors || 0) * 10 + Number(item.warnings || 0) * 3, 0)
    const alertPenalty = dashboard.alerts.reduce((sum, item) => sum + (item.severity === 'critical' ? 15 : item.severity === 'warning' ? 6 : 2), 0)
    const auditPenalty = Math.min(25, auditProblems)
    const indexScore = inspected ? Math.round((passed / inspected) * 30) : 15
    return Math.max(0, Math.min(100, 55 + indexScore - sitemapPenalty - alertPenalty - auditPenalty))
  }, [dashboard, auditProblems])

  async function genSEO(a: Row) {
    setBusyId(a.id)
    try {
      const raw = await generateSEO(a.title, a.content || a.title)
      const title = raw.match(/META TITLE:\s*(.+)/i)?.[1]?.trim()
      const desc = raw.match(/META DESCRIPTION:\s*(.+)/i)?.[1]?.trim()
      const kw = raw.match(/KEYWORDS:\s*(.+)/i)?.[1]?.trim()
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title) patch.seo_title = title
      if (desc) patch.seo_description = desc
      if (kw) patch.keyword = kw.split(',')[0]?.trim()
      const { error } = await supabase.from('articles').update(patch).eq('id', a.id)
      if (error) flash('Erro: ' + error.message, true)
      else {
        flash('SEO atualizado para "' + a.title + '".')
        await loadArticles()
      }
    } catch (error) {
      flash('Falha na IA: ' + (error instanceof Error ? error.message : String(error)), true)
    } finally {
      setBusyId(null)
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    ['overview', 'Visão Geral'], ['indexing', 'Indexação'], ['performance', 'Performance'], ['queries', 'Palavras-chave'],
    ['pages', 'Páginas'], ['opportunities', 'Oportunidades'], ['sitemap', 'Sitemap'], ['alerts', 'Alertas'],
    ['audit', 'Auditoria técnica'], ['settings', 'Configurações'],
  ].map(([key, label]) => ({ key: key as Tab, label }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 max-w-md text-white text-sm px-4 py-3 rounded-xl shadow-lg ${toast.err ? 'bg-red-700' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-forest-600 font-semibold">Admin · Crescimento orgânico</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-forest-900 mt-1">SEO Control Center</h1>
          <p className="text-sm text-ink-soft mt-2 max-w-3xl">Indexação, desempenho orgânico, oportunidades editoriais e auditoria técnica em um único lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void Promise.all([loadArticles(), loadDashboard()])} disabled={searchLoading || loading} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${searchLoading || loading ? 'animate-spin' : ''}`} /> Recarregar
          </button>
          <button onClick={syncNow} disabled={syncing || !dashboard?.configured} className="inline-flex items-center gap-2 admin-btn-primary disabled:opacity-50">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Sincronizar agora
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5" role="tablist" aria-label="Áreas do SEO Control Center">
        {tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs sm:text-sm border transition-colors ${tab === item.key ? 'bg-forest-900 border-forest-900 text-white' : 'bg-white border-line text-forest-800 hover:border-forest-300'}`}>{item.label}</button>)}
      </div>

      {!dashboard?.configured && tab !== 'audit' && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <strong>Google Search Console ainda não configurado no servidor.</strong> A auditoria técnica continua disponível. Para ativar sincronização, configure a conta de serviço e a propriedade na aba Configurações.
        </div>
      )}

      {tab === 'overview' && <Overview dashboard={dashboard} health={health} auditProblems={auditProblems} />}
      {tab === 'indexing' && <Indexing inspections={dashboard?.inspections || []} />}
      {tab === 'performance' && <Performance dashboard={dashboard} />}
      {tab === 'queries' && <MetricTable title="Palavras-chave" rows={dashboard?.queries || []} firstLabel="Consulta" />}
      {tab === 'pages' && <MetricTable title="Páginas" rows={dashboard?.pages || []} firstLabel="Página" linkKeys />}
      {tab === 'opportunities' && <Opportunities rows={dashboard?.opportunities || []} />}
      {tab === 'sitemap' && <Sitemaps rows={dashboard?.sitemaps || []} />}
      {tab === 'alerts' && <Alerts rows={dashboard?.alerts || []} />}
      {tab === 'audit' && <Audit rows={rows} loading={loading} cards={cards} issue={issue} setIssue={setIssue} list={list} busyId={busyId} onGenerate={genSEO} onEditArticle={onEditArticle} />}
      {tab === 'settings' && <Settings dashboard={dashboard} />}
    </div>
  )
}

function Overview({ dashboard, health, auditProblems }: { dashboard: Dashboard | null; health: number | null; auditProblems: number }) {
  const current = dashboard?.current || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const previous = dashboard?.previous || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const cards = [
    ['Cliques', fmt(current.clicks), delta(current.clicks, previous.clicks)],
    ['Impressões', fmt(current.impressions), delta(current.impressions, previous.impressions)],
    ['CTR', pct(current.ctr), delta(current.ctr, previous.ctr)],
    ['Posição média', fmt(current.position), previous.position ? (previous.position - current.position) / previous.position : 0],
  ] as const
  const indexed = dashboard?.inspections.filter(item => item.verdict === 'PASS').length || 0
  return <div className="space-y-5">
    <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
      <div className="rounded-2xl border border-forest-100 bg-[#f4f8f3] p-5">
        <p className="text-xs text-ink-soft">SEO Health Score</p><p className="font-serif text-4xl text-forest-900 mt-1">{health ?? '—'}</p><p className="text-xs text-ink-soft mt-2">Explicável: indexação, sitemap, alertas e auditoria técnica.</p>
      </div>
      {cards.map(([label, value, change]) => <div key={label} className="rounded-2xl border border-line bg-white p-5"><p className="text-xs text-ink-soft">{label} · 28 dias</p><p className="font-serif text-3xl text-forest-900 mt-1">{value}</p><p className={`text-xs mt-2 ${change > 0 ? 'text-emerald-700' : change < 0 ? 'text-amber-700' : 'text-ink-soft'}`}>{change ? `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}% vs período anterior` : 'Sem variação calculável'}</p></div>)}
    </div>
    <div className="grid lg:grid-cols-3 gap-4">
      <Panel title="Indexação monitorada"><p className="font-serif text-3xl text-forest-900">{indexed}/{dashboard?.inspections.length || 0}</p><p className="text-sm text-ink-soft mt-1">URLs inspecionadas com verdict PASS.</p></Panel>
      <Panel title="Oportunidades"><p className="font-serif text-3xl text-forest-900">{dashboard?.opportunities.length || 0}</p><p className="text-sm text-ink-soft mt-1">Consultas e páginas com margem de ganho.</p></Panel>
      <Panel title="Pendências técnicas"><p className="font-serif text-3xl text-forest-900">{auditProblems}</p><p className="text-sm text-ink-soft mt-1">Ocorrências na auditoria editorial/técnica.</p></Panel>
    </div>
    <div className="grid lg:grid-cols-2 gap-4"><MetricTable title="Top consultas" rows={(dashboard?.queries || []).slice(0, 8)} firstLabel="Consulta" /><Alerts rows={(dashboard?.alerts || []).slice(0, 6)} compact /></div>
  </div>
}

function Indexing({ inspections }: { inspections: Inspection[] }) {
  return <Panel title="Indexação de URLs públicas" subtitle="URL Inspection mostra a versão conhecida pelo Google; não é um teste ao vivo.">
    {inspections.length === 0 ? <Empty text="Nenhuma URL foi inspecionada ainda." /> : <div className="overflow-x-auto"><table className="w-full text-xs sm:text-sm"><thead><tr className="border-b border-line text-left text-ink-soft"><th className="py-2 pr-3">URL</th><th className="py-2 px-2">Estado</th><th className="py-2 px-2">Cobertura</th><th className="py-2 pl-2">Inspecionada</th></tr></thead><tbody className="divide-y divide-stone-100">{inspections.map(item => <tr key={item.url}><td className="py-3 pr-3 max-w-[420px] truncate"><a href={item.url} target="_blank" rel="noreferrer" className="text-forest-800 hover:underline">{item.url}</a></td><td className="py-3 px-2"><Status ok={item.verdict === 'PASS'} label={item.verdict || '—'} /></td><td className="py-3 px-2 text-ink-soft">{item.coverage_state || '—'}</td><td className="py-3 pl-2 text-ink-soft whitespace-nowrap">{new Date(item.last_inspected_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div>}
  </Panel>
}

function Performance({ dashboard }: { dashboard: Dashboard | null }) {
  const trend = dashboard?.trend || []
  const max = Math.max(1, ...trend.map(row => Number(row.impressions || 0)))
  return <div className="space-y-4"><Panel title="Tendência de impressões" subtitle="Histórico diário persistido no Supabase; a sincronização diária mantém a série disponível.">
    {trend.length === 0 ? <Empty text="Ainda não há histórico sincronizado." /> : <div className="space-y-2">{trend.slice(-30).map(row => <div key={row.day} className="grid grid-cols-[72px_1fr_70px] gap-3 items-center text-xs"><span className="text-ink-soft">{new Date(`${row.day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span><div className="h-2 rounded-full bg-stone-100 overflow-hidden"><div className="h-full bg-forest-700 rounded-full" style={{ width: `${Math.max(2, (Number(row.impressions || 0) / max) * 100)}%` }} /></div><span className="text-right text-forest-900">{fmt(row.impressions)}</span></div>)}</div>}
  </Panel></div>
}

function MetricTable({ title, rows, firstLabel, linkKeys = false }: { title: string; rows: SearchItem[]; firstLabel: string; linkKeys?: boolean }) {
  return <Panel title={title}>{rows.length === 0 ? <Empty text="Sem dados no período." /> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-line text-ink-soft"><th className="text-left py-2 pr-3 font-medium">{firstLabel}</th><th className="text-right px-2 py-2 font-medium">Cliques</th><th className="text-right px-2 py-2 font-medium">Impr.</th><th className="text-right px-2 py-2 font-medium">CTR</th><th className="text-right pl-2 py-2 font-medium">Pos.</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map(row => <tr key={row.key}><td className="py-2.5 pr-3 max-w-[360px] truncate">{linkKeys && /^https?:/.test(row.key) ? <a href={row.key} target="_blank" rel="noreferrer" className="text-forest-800 hover:underline">{row.key}</a> : <span className="text-forest-900">{row.key}</span>}</td><td className="text-right px-2">{fmt(row.clicks)}</td><td className="text-right px-2">{fmt(row.impressions)}</td><td className="text-right px-2">{pct(row.ctr)}</td><td className="text-right pl-2">{fmt(row.position)}</td></tr>)}</tbody></table></div>}</Panel>
}

function Opportunities({ rows }: { rows: Opportunity[] }) {
  return <Panel title="Oportunidades priorizadas" subtitle="Regras transparentes: CTR baixo com impressões, posições 8–20 e páginas visíveis com poucos cliques.">{rows.length === 0 ? <Empty text="Nenhuma oportunidade forte foi detectada no período." /> : <div className="space-y-3">{rows.map((row, index) => <div key={`${row.type}-${row.subject}-${index}`} className="rounded-xl border border-line p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-forest-900 break-all">{row.subject}</p><span className="text-[11px] px-2 py-1 rounded-full bg-mint text-forest-800">{row.reason}</span></div><p className="text-xs text-ink-soft mt-2">{fmt(row.impressions)} impressões · {fmt(row.clicks)} cliques · CTR {pct(row.ctr)} · posição {fmt(row.position)}</p></div>)}</div>}</Panel>
}

function Sitemaps({ rows }: { rows: Sitemap[] }) {
  return <Panel title="Sitemaps no Google Search Console">{rows.length === 0 ? <Empty text="Nenhum sitemap sincronizado." /> : <div className="space-y-3">{rows.map(row => <div key={row.path} className="rounded-xl border border-line p-4 flex flex-wrap items-center justify-between gap-3"><div><a href={row.path} target="_blank" rel="noreferrer" className="font-medium text-forest-900 hover:underline inline-flex items-center gap-1">{row.path}<ExternalLink className="w-3 h-3" /></a><p className="text-xs text-ink-soft mt-1">Última verificação: {row.last_checked_at ? new Date(row.last_checked_at).toLocaleString('pt-BR') : '—'}</p></div><Status ok={!row.errors && !row.warnings} label={row.errors ? `${row.errors} erro(s)` : row.warnings ? `${row.warnings} aviso(s)` : 'Sem erros'} /></div>)}</div>}</Panel>
}

function Alerts({ rows, compact = false }: { rows: Alert[]; compact?: boolean }) {
  return <Panel title="Alertas ativos">{rows.length === 0 ? <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Nenhum alerta operacional ativo.</div> : <div className="space-y-3">{rows.map(row => <div key={row.id} className="rounded-xl border border-line p-3 flex gap-3"><AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${row.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} /><div className="min-w-0"><p className="text-sm font-medium text-forest-900">{row.title}</p>{!compact && row.details && <p className="text-xs text-ink-soft mt-1 break-words">{row.details}</p>}{row.url && <a href={row.url} target="_blank" rel="noreferrer" className="text-xs text-forest-700 hover:underline mt-1 block truncate">{row.url}</a>}</div></div>)}</div>}</Panel>
}

function Audit({ rows, loading, cards, issue, setIssue, list, busyId, onGenerate, onEditArticle }: { rows: Row[]; loading: boolean; cards: { key: Issue; label: string }[]; issue: Issue; setIssue: (value: Issue) => void; list: Row[]; busyId: string | null; onGenerate: (row: Row) => Promise<void>; onEditArticle?: (id: string) => void }) {
  const published = rows.filter(a => a.published === true || a.status === 'published')
  const count = (i: Issue) => published.filter(a => hasIssue(a, i)).length
  return <div className="space-y-5"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards.map(card => <button key={card.key} onClick={() => setIssue(card.key)} className={`text-left bg-white border rounded-2xl p-4 transition-colors ${issue === card.key ? 'border-forest-700 shadow-sm' : 'border-line hover:border-forest-300'}`}><p className="font-serif text-2xl text-forest-900">{loading ? '—' : count(card.key)}</p><p className="text-xs leading-4 text-ink-soft mt-1">{card.label}</p></button>)}</div><Panel title="Conteúdos que precisam de atenção">{loading ? <p className="text-sm text-ink-soft">Carregando…</p> : list.length === 0 ? <Empty text="Nenhum conteúdo com esse problema." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><tbody className="divide-y divide-stone-100">{list.map(a => <tr key={a.id}><td className="py-3 pr-3"><p className="font-medium text-forest-900">{a.title}</p><p className="text-xs text-ink-soft">{a.slug} · {wordCount(a.content)} palavras</p></td><td className="py-3"><div className="flex justify-end gap-1"><button onClick={() => void onGenerate(a)} disabled={busyId === a.id} className="inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg disabled:opacity-50">{busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Gerar SEO</button>{onEditArticle && <button onClick={() => onEditArticle(a.id)} className="p-1.5 text-stone-500 hover:text-forest-800" title="Editar"><Pencil className="w-4 h-4" /></button>}</div></td></tr>)}</tbody></table></div>}</Panel></div>
}

function Settings({ dashboard }: { dashboard: Dashboard | null }) {
  const last = dashboard?.runs?.[0]
  return <div className="grid lg:grid-cols-2 gap-4"><Panel title="Google Search Console"><div className="space-y-3 text-sm"><p><strong>Propriedade:</strong> {dashboard?.siteUrl || 'sc-domain:avidanaocolabora.com'}</p><p><strong>Credencial:</strong> {dashboard?.configured ? 'Configurada no servidor' : 'Pendente'}</p><p className="text-ink-soft">Secrets esperados no Supabase: <code>GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON</code> e <code>GOOGLE_SEARCH_CONSOLE_SITE_URL</code>. A credencial nunca é enviada ao navegador.</p></div></Panel><Panel title="Sincronização automática"><div className="space-y-2 text-sm"><p>Execução diária via pg_cron às 06:35 UTC, usando o token interno já existente.</p><p><strong>Última execução:</strong> {last ? `${last.status} · ${new Date(last.started_at).toLocaleString('pt-BR')}` : 'ainda não registrada'}</p>{last?.error && <p className="text-red-700">{last.error}</p>}</div></Panel></div>
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><div className="mb-3"><h2 className="font-serif text-xl text-forest-900">{title}</h2>{subtitle && <p className="text-xs text-ink-soft mt-1">{subtitle}</p>}</div>{children}</section>
}
function Empty({ text }: { text: string }) { return <p className="text-sm text-ink-soft py-3">{text}</p> }
function Status({ ok, label }: { ok: boolean; label: string }) { return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}{label}</span> }
