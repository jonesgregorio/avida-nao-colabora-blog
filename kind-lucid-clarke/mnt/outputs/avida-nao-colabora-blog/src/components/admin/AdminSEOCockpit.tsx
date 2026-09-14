import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { generateSEO } from '../../lib/aiContent'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Pencil, RefreshCw, Search, Sparkles } from 'lucide-react'

interface Row {
  id: string; title: string; slug: string; status: string
  seo_title: string | null; seo_description: string | null; keyword: string | null; content: string | null
  image_url: string | null; cover_image: string | null; cover_image_url: string | null; image_alt: string | null
  author: string | null; related_slugs: string[] | null; reviewed_at: string | null; published: boolean | null
  published_at: string | null; updated_at: string | null; created_at: string
}

type Issue = 'no_seo' | 'no_image' | 'bad_slug' | 'thin' | 'no_author' | 'no_review' | 'no_links' | 'old'
type Metric = { clicks: number; impressions: number; ctr: number; position: number }
type SearchItem = Metric & { key: string }
type TrendRow = Metric & { day: string }
type Inspection = { url: string; verdict?: string | null; coverage_state?: string | null; last_inspected_at: string }
type Sitemap = { path: string; errors: number; warnings: number; last_checked_at?: string | null }
type Alert = { id: string; severity: 'info' | 'warning' | 'critical'; title: string; details?: string | null; url?: string | null; last_seen_at: string }
type Run = { id: string; kind: string; status: string; started_at: string; rows_written: number; error?: string | null }
type Opportunity = SearchItem & { type: string; subject: string; reason: string }
type Dashboard = {
  configured: boolean; siteUrl: string; current: Metric; previous: Metric; trend: TrendRow[]
  queries: SearchItem[]; pages: SearchItem[]; opportunities: Opportunity[]; inspections: Inspection[]
  sitemaps: Sitemap[]; alerts: Alert[]; runs: Run[]; error?: string
}
type ReportPriority = { level: 'critical' | 'high' | 'medium' | 'info' | 'ok'; title: string; detail: string }
type InstantReport = {
  generatedAt: string
  score: number
  indexed: number
  inspected: number
  notIndexed: number
  sitemapErrors: number
  sitemapWarnings: number
  seoIssues: number
  missingAlt: number
  missingLinks: number
  thinContent: number
  noReview: number
  priorities: ReportPriority[]
}
type Tab = 'overview' | 'indexing' | 'performance' | 'queries' | 'pages' | 'opportunities' | 'sitemap' | 'alerts' | 'audit' | 'settings'

const seoOk = (a: Row) => !!(a.seo_title && a.seo_title.trim().length >= 25 && a.seo_title.trim().length <= 60 && a.seo_description && a.seo_description.trim().length >= 90 && a.seo_description.trim().length <= 155 && a.keyword)
const imgOk = (a: Row) => !!((a.image_url || a.cover_image || a.cover_image_url) && a.image_alt?.trim())
const badSlug = (s: string) => !s || /[^a-z0-9-]/.test(s) || s.length > 60 || s.includes('--')
const wordCount = (content: string | null) => String(content || '').trim().split(/\s+/).filter(Boolean).length
const isOld = (a: Row) => Date.now() - new Date(a.updated_at || a.published_at || a.created_at).getTime() > 180 * 86400000
const hasIssue = (a: Row, i: Issue) => i === 'no_seo' ? !seoOk(a) : i === 'no_image' ? !imgOk(a) : i === 'bad_slug' ? badSlug(a.slug) : i === 'thin' ? wordCount(a.content) < 800 : i === 'no_author' ? !a.author?.trim() : i === 'no_review' ? !a.reviewed_at : i === 'no_links' ? !a.related_slugs?.length && !/\]\(\/blog\//.test(a.content || '') : isOld(a)
const fmt = (v = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)
const pct = (v = 0) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const delta = (now: number, before: number) => before ? (now - before) / Math.abs(before) : now ? 1 : 0
const issueCount = (rows: Row[], issue: Issue) => rows.filter(a => hasIssue(a, issue)).length

function calculateHealth(dashboard: Dashboard | null, auditProblems: number) {
  if (!dashboard) return 0
  const inspected = dashboard.inspections.length
  const passed = dashboard.inspections.filter(i => i.verdict === 'PASS').length
  const sitemapPenalty = dashboard.sitemaps.reduce((sum, item) => sum + Number(item.errors || 0) * 10 + Number(item.warnings || 0) * 3, 0)
  const alertPenalty = dashboard.alerts.reduce((sum, item) => sum + (item.severity === 'critical' ? 15 : item.severity === 'warning' ? 6 : 2), 0)
  return Math.max(0, Math.min(100, 55 + (inspected ? Math.round((passed / inspected) * 30) : 15) - sitemapPenalty - alertPenalty - Math.min(25, auditProblems)))
}

function articleFromUrl(subject: string, rows: Row[]) {
  try {
    const url = new URL(subject)
    const match = url.pathname.match(/^\/blog\/([^/?#]+)/)
    if (!match) return null
    const slug = decodeURIComponent(match[1])
    return rows.find(a => a.slug === slug) || null
  } catch { return null }
}

function buildInstantReport(dashboard: Dashboard, publishedRows: Row[]): InstantReport {
  const seoIssues = issueCount(publishedRows, 'no_seo')
  const missingAlt = issueCount(publishedRows, 'no_image')
  const missingLinks = issueCount(publishedRows, 'no_links')
  const thinContent = issueCount(publishedRows, 'thin')
  const noReview = issueCount(publishedRows, 'no_review')
  const auditProblems = ['no_seo', 'no_image', 'bad_slug', 'thin', 'no_author', 'no_review', 'no_links', 'old'].reduce((sum, key) => sum + issueCount(publishedRows, key as Issue), 0)
  const indexed = dashboard.inspections.filter(i => i.verdict === 'PASS').length
  const inspected = dashboard.inspections.length
  const notIndexed = dashboard.inspections.filter(i => i.verdict && i.verdict !== 'PASS').length
  const sitemapErrors = dashboard.sitemaps.reduce((sum, item) => sum + Number(item.errors || 0), 0)
  const sitemapWarnings = dashboard.sitemaps.reduce((sum, item) => sum + Number(item.warnings || 0), 0)
  const priorities: ReportPriority[] = []
  if (sitemapErrors) priorities.push({ level: 'critical', title: 'Corrigir erros do sitemap', detail: `${sitemapErrors} erro(s) de sitemap foram detectados pelo Search Console.` })
  if (notIndexed) priorities.push({ level: 'high', title: 'Acompanhar URLs ainda não indexadas', detail: `${notIndexed} de ${inspected} URLs inspecionadas ainda não têm verdict PASS. Isso não significa bloqueio: o Google pode ter apenas descoberto a URL e ainda não a indexado.` })
  if (seoIssues) priorities.push({ level: 'high', title: 'Otimizar metadados SEO', detail: `${seoIssues} conteúdo(s) têm title, description ou palavra-chave fora do padrão interno. Use “Corrigir com IA” para gerar e salvar novos metadados.` })
  if (missingLinks) priorities.push({ level: 'medium', title: 'Reforçar links internos', detail: `${missingLinks} conteúdo(s) não têm links internos detectados. Isso pode dificultar descoberta e distribuição de autoridade.` })
  if (missingAlt) priorities.push({ level: 'medium', title: 'Revisar imagem e texto alternativo', detail: `${missingAlt} conteúdo(s) não têm imagem completa ou texto alternativo. A IA de SEO não altera imagens automaticamente para evitar descrições incorretas.` })
  if (thinContent) priorities.push({ level: 'medium', title: 'Revisar conteúdos curtos', detail: `${thinContent} conteúdo(s) têm menos de 800 palavras. O relatório sinaliza, mas não reescreve o corpo automaticamente.` })
  if (noReview) priorities.push({ level: 'info', title: 'Registrar revisão editorial', detail: `${noReview} conteúdo(s) não têm reviewed_at. Esse é um controle interno do CMS e não é um requisito direto do Google.` })
  if (sitemapWarnings) priorities.push({ level: 'medium', title: 'Verificar avisos do sitemap', detail: `${sitemapWarnings} aviso(s) foram encontrados.` })
  if (!priorities.length) priorities.push({ level: 'ok', title: 'Nenhuma pendência relevante detectada', detail: 'A indexação monitorada, o sitemap e a auditoria técnica estão sem alertas relevantes no momento.' })
  return { generatedAt: new Date().toISOString(), score: calculateHealth(dashboard, auditProblems), indexed, inspected, notIndexed, sitemapErrors, sitemapWarnings, seoIssues, missingAlt, missingLinks, thinContent, noReview, priorities }
}

export default function AdminSEOCockpit({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<Issue>('no_seo')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [report, setReport] = useState<InstantReport | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  const flash = useCallback((msg: string, err = false) => {
    setToast({ msg, err })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const loadArticles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('articles').select('id,title,slug,status,published,seo_title,seo_description,image_url,cover_image,cover_image_url,image_alt,keyword,content,author,related_slugs,reviewed_at,published_at,updated_at,created_at').order('created_at', { ascending: false }).limit(500)
    if (error) flash('Falha ao carregar auditoria técnica: ' + error.message, true)
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }, [flash])

  const loadDashboard = useCallback(async () => {
    setSearchLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-search-console', { body: { action: 'dashboard' } })
      if (error) throw error
      setDashboard(data as Dashboard)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar o Google Search Console.'
      setDashboard(prev => prev ? { ...prev, error: message } : null)
      flash(message, true)
    } finally { setSearchLoading(false) }
  }, [flash])

  useEffect(() => { void Promise.all([loadArticles(), loadDashboard()]) }, [loadArticles, loadDashboard])

  async function syncNow() {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-search-console', { body: { action: 'sync', source: 'manual' } })
      if (error) throw error
      if (data?.dashboard) setDashboard(data.dashboard as Dashboard)
      else await loadDashboard()
      flash(`Sincronização concluída: ${data?.rowsWritten || 0} registros atualizados.`)
    } catch (error) { flash(error instanceof Error ? error.message : 'Falha ao sincronizar Search Console.', true) }
    finally { setSyncing(false) }
  }

  async function analyzeAllNow() {
    setAnalyzing(true)
    try {
      const [{ data: syncData, error: syncError }, { data: articleData, error: articleError }] = await Promise.all([
        supabase.functions.invoke('google-search-console', { body: { action: 'sync', source: 'analysis_report' } }),
        supabase.from('articles').select('id,title,slug,status,published,seo_title,seo_description,image_url,cover_image,cover_image_url,image_alt,keyword,content,author,related_slugs,reviewed_at,published_at,updated_at,created_at').order('created_at', { ascending: false }).limit(500),
      ])
      if (syncError) throw syncError
      if (articleError) throw articleError
      const freshDashboard = (syncData?.dashboard || dashboard) as Dashboard | null
      if (!freshDashboard) throw new Error('O Search Console ainda não retornou dados para o relatório.')
      const freshRows = (articleData as Row[]) ?? []
      const freshPublished = freshRows.filter(a => a.published === true || a.status === 'published')
      setDashboard(freshDashboard)
      setRows(freshRows)
      setReport(buildInstantReport(freshDashboard, freshPublished))
      setTab('overview')
      flash('Análise completa concluída e relatório atualizado.')
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Falha ao gerar o relatório SEO.', true)
    } finally { setAnalyzing(false) }
  }

  const cards: { key: Issue; label: string }[] = [
    { key: 'no_seo', label: 'SEO a otimizar' }, { key: 'no_image', label: 'Imagem ou alt ausente' },
    { key: 'bad_slug', label: 'Slug a revisar' }, { key: 'thin', label: 'Conteúdo curto' }, { key: 'no_author', label: 'Sem autoria' },
    { key: 'no_review', label: 'Sem revisão registrada' }, { key: 'no_links', label: 'Sem links internos' }, { key: 'old', label: 'Antigos (6+ meses)' },
  ]
  const publishedRows = rows.filter(a => a.published === true || a.status === 'published')
  const count = (i: Issue) => issueCount(publishedRows, i)
  const list = publishedRows.filter(a => hasIssue(a, issue))
  const auditProblems = cards.reduce((sum, card) => sum + count(card.key), 0)
  const health = useMemo(() => dashboard ? calculateHealth(dashboard, auditProblems) : null, [dashboard, auditProblems])

  async function genSEO(a: Row) {
    setBusyId(a.id)
    try {
      const raw = await generateSEO(a.title, a.content || a.title)
      const title = raw.match(/META TITLE:\s*(.+)/i)?.[1]?.trim()
      const desc = raw.match(/META DESCRIPTION:\s*(.+)/i)?.[1]?.trim()
      const kw = raw.match(/KEYWORDS:\s*(.+)/i)?.[1]?.trim()
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (title) patch.seo_title = title.slice(0, 60)
      if (desc) patch.seo_description = desc.slice(0, 155)
      if (kw) patch.keyword = kw.split(',')[0]?.trim()
      if (Object.keys(patch).length === 1) throw new Error('A IA não retornou metadados válidos.')
      const { error } = await supabase.from('articles').update(patch).eq('id', a.id)
      if (error) throw error
      flash(`SEO corrigido com IA para “${a.title}”.`)
      await loadArticles()
    } catch (error) { flash('Falha na IA: ' + (error instanceof Error ? error.message : String(error)), true) }
    finally { setBusyId(null) }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    ['overview', 'Visão Geral'], ['indexing', 'Indexação'], ['performance', 'Performance'], ['queries', 'Palavras-chave'], ['pages', 'Páginas'],
    ['opportunities', 'Oportunidades'], ['sitemap', 'Sitemap'], ['alerts', 'Alertas'], ['audit', 'Auditoria técnica'], ['settings', 'Configurações'],
  ].map(([key, label]) => ({ key: key as Tab, label }))

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    {toast && <div className={`fixed top-4 right-4 z-50 max-w-md text-white text-sm px-4 py-3 rounded-xl shadow-lg ${toast.err ? 'bg-red-700' : 'bg-forest-900'}`}>{toast.msg}</div>}
    <div className="flex flex-wrap items-start justify-between gap-4 mb-5"><div><p className="text-xs uppercase tracking-[0.18em] text-forest-600 font-semibold">Admin · Crescimento orgânico</p><h1 className="font-serif text-3xl sm:text-4xl text-forest-900 mt-1">SEO Control Center</h1><p className="text-sm text-ink-soft mt-2 max-w-3xl">Indexação, desempenho orgânico, oportunidades editoriais e auditoria técnica em um único lugar.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void Promise.all([loadArticles(), loadDashboard()])} disabled={searchLoading || loading} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${searchLoading || loading ? 'animate-spin' : ''}`} /> Recarregar</button><button onClick={analyzeAllNow} disabled={analyzing || !dashboard?.configured} className="inline-flex items-center gap-2 border border-forest-300 bg-mint px-4 py-2 rounded-xl text-sm font-medium text-forest-900 disabled:opacity-50">{analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analisar tudo agora</button><button onClick={syncNow} disabled={syncing || !dashboard?.configured} className="inline-flex items-center gap-2 admin-btn-primary disabled:opacity-50">{syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Sincronizar agora</button></div></div>
    {report && <InstantReportPanel report={report} />}
    <div className="flex gap-2 overflow-x-auto pb-2 mb-5" role="tablist" aria-label="Áreas do SEO Control Center">{tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs sm:text-sm border ${tab === item.key ? 'bg-forest-900 border-forest-900 text-white' : 'bg-white border-line text-forest-800 hover:border-forest-300'}`}>{item.label}</button>)}</div>
    {!dashboard?.configured && tab !== 'audit' && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"><strong>Google Search Console ainda não configurado no servidor.</strong> A auditoria técnica continua disponível. Configure a conta de serviço e a propriedade na aba Configurações para ativar a sincronização.</div>}
    {tab === 'overview' && <Overview dashboard={dashboard} health={health} auditProblems={auditProblems} />}
    {tab === 'indexing' && <Indexing rows={dashboard?.inspections || []} articles={publishedRows} busyId={busyId} onGenerate={genSEO} />}
    {tab === 'performance' && <Performance rows={dashboard?.trend || []} />}
    {tab === 'queries' && <MetricTable title="Palavras-chave" rows={dashboard?.queries || []} firstLabel="Consulta" />}
    {tab === 'pages' && <MetricTable title="Páginas" rows={dashboard?.pages || []} firstLabel="Página" links />}
    {tab === 'opportunities' && <Opportunities rows={dashboard?.opportunities || []} articles={publishedRows} busyId={busyId} onGenerate={genSEO} />}
    {tab === 'sitemap' && <Sitemaps rows={dashboard?.sitemaps || []} />}
    {tab === 'alerts' && <Alerts rows={dashboard?.alerts || []} />}
    {tab === 'audit' && <Audit loading={loading} cards={cards} issue={issue} setIssue={setIssue} list={list} busyId={busyId} onGenerate={genSEO} onEditArticle={onEditArticle} counts={count} />}
    {tab === 'settings' && <Settings dashboard={dashboard} />}
  </div>
}

function InstantReportPanel({ report }: { report: InstantReport }) {
  const levelClass: Record<ReportPriority['level'], string> = { critical: 'border-red-200 bg-red-50 text-red-900', high: 'border-amber-200 bg-amber-50 text-amber-950', medium: 'border-yellow-200 bg-yellow-50 text-yellow-950', info: 'border-sky-200 bg-sky-50 text-sky-950', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900' }
  return <section className="mb-5 rounded-2xl border border-forest-200 bg-[#fbfcf8] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-forest-600 font-semibold">Relatório instantâneo</p><h2 className="font-serif text-2xl text-forest-900 mt-1">Análise completa do SEO</h2><p className="text-xs text-ink-soft mt-1">Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')} com dados recém-sincronizados do Search Console e da auditoria interna.</p></div><div className="text-right"><p className="text-xs text-ink-soft">SEO Health Score</p><p className="font-serif text-4xl text-forest-900">{report.score}</p></div></div><div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mt-4"><ReportStat label="Indexadas" value={`${report.indexed}/${report.inspected}`} /><ReportStat label="Ainda não indexadas" value={String(report.notIndexed)} /><ReportStat label="SEO a otimizar" value={String(report.seoIssues)} /><ReportStat label="Sem links internos" value={String(report.missingLinks)} /><ReportStat label="Imagem/alt" value={String(report.missingAlt)} /><ReportStat label="Sitemap" value={report.sitemapErrors ? `${report.sitemapErrors} erro(s)` : report.sitemapWarnings ? `${report.sitemapWarnings} aviso(s)` : 'OK'} /></div><div className="mt-4 space-y-2">{report.priorities.map((item, i) => <div key={`${item.title}-${i}`} className={`rounded-xl border px-3.5 py-3 ${levelClass[item.level]}`}><p className="text-sm font-semibold">{item.title}</p><p className="text-xs mt-1 leading-relaxed">{item.detail}</p></div>)}</div><p className="text-xs text-ink-soft mt-4">Importante: “indexada” vem do URL Inspection. Impressões do Search Analytics medem aparições nas buscas e não devem ser usadas como sinônimo de indexação.</p></section>
}
function ReportStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-line bg-white px-3 py-3"><p className="text-[11px] text-ink-soft">{label}</p><p className="font-serif text-xl text-forest-900 mt-0.5">{value}</p></div> }

function Overview({ dashboard, health, auditProblems }: { dashboard: Dashboard | null; health: number | null; auditProblems: number }) {
  const current = dashboard?.current || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const previous = dashboard?.previous || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const metrics = [['Cliques', fmt(current.clicks), delta(current.clicks, previous.clicks)], ['Impressões', fmt(current.impressions), delta(current.impressions, previous.impressions)], ['CTR', pct(current.ctr), delta(current.ctr, previous.ctr)], ['Posição média', fmt(current.position), previous.position ? (previous.position - current.position) / previous.position : 0]] as const
  const indexed = dashboard?.inspections.filter(i => i.verdict === 'PASS').length || 0
  return <div className="space-y-5"><div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3"><div className="rounded-2xl border border-forest-100 bg-[#f4f8f3] p-5"><p className="text-xs text-ink-soft">SEO Health Score</p><p className="font-serif text-4xl text-forest-900 mt-1">{health ?? '—'}</p><p className="text-xs text-ink-soft mt-2">Explicável: indexação, sitemap, alertas e auditoria técnica.</p></div>{metrics.map(([label, value, change]) => <div key={label} className="rounded-2xl border border-line bg-white p-5"><p className="text-xs text-ink-soft">{label} · 28 dias</p><p className="font-serif text-3xl text-forest-900 mt-1">{value}</p><p className={`text-xs mt-2 ${change > 0 ? 'text-emerald-700' : change < 0 ? 'text-amber-700' : 'text-ink-soft'}`}>{change ? `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}% vs período anterior` : 'Sem variação calculável'}</p></div>)}</div><div className="grid lg:grid-cols-3 gap-4"><Panel title="Indexação monitorada"><Big>{indexed}/{dashboard?.inspections.length || 0}</Big><Small>URLs inspecionadas com verdict PASS.</Small></Panel><Panel title="Oportunidades"><Big>{dashboard?.opportunities.length || 0}</Big><Small>Consultas e páginas com margem de ganho.</Small></Panel><Panel title="Pendências técnicas"><Big>{auditProblems}</Big><Small>Ocorrências na auditoria editorial/técnica.</Small></Panel></div><div className="grid lg:grid-cols-2 gap-4"><MetricTable title="Top consultas" rows={(dashboard?.queries || []).slice(0, 8)} firstLabel="Consulta" /><Alerts rows={(dashboard?.alerts || []).slice(0, 6)} compact /></div></div>
}

function Indexing({ rows, articles, busyId, onGenerate }: { rows: Inspection[]; articles: Row[]; busyId: string | null; onGenerate: (r: Row) => Promise<void> }) { return <Panel title="Indexação de URLs públicas" subtitle="URL Inspection mostra a versão conhecida pelo Google; não é um teste ao vivo. A IA pode otimizar metadados, mas não força indexação.">{rows.length === 0 ? <Empty text="Nenhuma URL foi inspecionada ainda." /> : <div className="overflow-x-auto"><table className="w-full text-xs sm:text-sm"><thead><tr className="border-b border-line text-left text-ink-soft"><th className="py-2 pr-3">URL</th><th>Estado</th><th>Cobertura</th><th>Inspecionada</th><th className="text-right">Ação</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map(item => { const article = item.verdict === 'PASS' ? null : articleFromUrl(item.url, articles); return <tr key={item.url}><td className="py-3 pr-3 max-w-[420px] truncate"><a href={item.url} target="_blank" rel="noreferrer" className="text-forest-800 hover:underline">{item.url}</a></td><td><Status ok={item.verdict === 'PASS'} label={item.verdict || '—'} /></td><td className="text-ink-soft">{item.coverage_state || '—'}</td><td className="text-ink-soft whitespace-nowrap">{new Date(item.last_inspected_at).toLocaleDateString('pt-BR')}</td><td className="text-right">{article && <button onClick={() => void onGenerate(article)} disabled={busyId === article.id} className="inline-flex items-center gap-1 text-[11px] border border-forest-200 text-forest-800 px-2 py-1.5 rounded-lg disabled:opacity-50">{busyId === article.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Corrigir com IA</button>}</td></tr> })}</tbody></table></div>}</Panel> }

function Performance({ rows }: { rows: TrendRow[] }) { const max = Math.max(1, ...rows.map(r => Number(r.impressions || 0))); return <Panel title="Tendência de impressões" subtitle="Histórico diário persistido no Supabase.">{rows.length === 0 ? <Empty text="Ainda não há histórico sincronizado." /> : <div className="space-y-2">{rows.slice(-30).map(row => <div key={row.day} className="grid grid-cols-[72px_1fr_70px] gap-3 items-center text-xs"><span className="text-ink-soft">{new Date(`${row.day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span><div className="h-2 rounded-full bg-stone-100 overflow-hidden"><div className="h-full bg-forest-700 rounded-full" style={{ width: `${Math.max(2, (row.impressions / max) * 100)}%` }} /></div><span className="text-right">{fmt(row.impressions)}</span></div>)}</div>}</Panel> }

function MetricTable({ title, rows, firstLabel, links = false }: { title: string; rows: SearchItem[]; firstLabel: string; links?: boolean }) { return <Panel title={title}>{rows.length === 0 ? <Empty text="Sem dados no período." /> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-line text-ink-soft"><th className="text-left py-2">{firstLabel}</th><th className="text-right">Cliques</th><th className="text-right">Impr.</th><th className="text-right">CTR</th><th className="text-right">Pos.</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map(row => <tr key={row.key}><td className="py-2.5 pr-3 max-w-[360px] truncate">{links && /^https?:/.test(row.key) ? <a href={row.key} target="_blank" rel="noreferrer" className="text-forest-800 hover:underline">{row.key}</a> : row.key}</td><td className="text-right">{fmt(row.clicks)}</td><td className="text-right">{fmt(row.impressions)}</td><td className="text-right">{pct(row.ctr)}</td><td className="text-right">{fmt(row.position)}</td></tr>)}</tbody></table></div>}</Panel> }

function Opportunities({ rows, articles, busyId, onGenerate }: { rows: Opportunity[]; articles: Row[]; busyId: string | null; onGenerate: (r: Row) => Promise<void> }) { return <Panel title="Oportunidades priorizadas" subtitle="Regras transparentes: CTR baixo com impressões, posições 8–20 e páginas visíveis com poucos cliques. Quando a oportunidade aponta para um artigo, a IA pode corrigir os metadados.">{rows.length === 0 ? <Empty text="Nenhuma oportunidade forte foi detectada." /> : <div className="space-y-3">{rows.map((row, i) => { const article = articleFromUrl(row.subject, articles); return <div key={`${row.type}-${row.subject}-${i}`} className="rounded-xl border border-line p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-forest-900 break-all">{row.subject}</p><span className="text-[11px] px-2 py-1 rounded-full bg-mint text-forest-800">{row.reason}</span></div><div className="flex flex-wrap items-center justify-between gap-3 mt-2"><p className="text-xs text-ink-soft">{fmt(row.impressions)} impressões · {fmt(row.clicks)} cliques · CTR {pct(row.ctr)} · posição {fmt(row.position)}</p>{article && <button onClick={() => void onGenerate(article)} disabled={busyId === article.id} className="inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg disabled:opacity-50">{busyId === article.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Corrigir com IA</button>}</div></div> })}</div>}</Panel> }

function Sitemaps({ rows }: { rows: Sitemap[] }) { return <Panel title="Sitemaps no Google Search Console">{rows.length === 0 ? <Empty text="Nenhum sitemap sincronizado." /> : <div className="space-y-3">{rows.map(row => <div key={row.path} className="rounded-xl border border-line p-4 flex flex-wrap items-center justify-between gap-3"><div><a href={row.path} target="_blank" rel="noreferrer" className="font-medium text-forest-900 hover:underline inline-flex items-center gap-1">{row.path}<ExternalLink className="w-3 h-3" /></a><p className="text-xs text-ink-soft mt-1">Última verificação: {row.last_checked_at ? new Date(row.last_checked_at).toLocaleString('pt-BR') : '—'}</p></div><Status ok={!row.errors && !row.warnings} label={row.errors ? `${row.errors} erro(s)` : row.warnings ? `${row.warnings} aviso(s)` : 'Sem erros'} /></div>)}</div>}</Panel> }

function Alerts({ rows, compact = false }: { rows: Alert[]; compact?: boolean }) { return <Panel title="Alertas ativos">{rows.length === 0 ? <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Nenhum alerta operacional ativo.</div> : <div className="space-y-3">{rows.map(row => <div key={row.id} className="rounded-xl border border-line p-3 flex gap-3"><AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${row.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} /><div className="min-w-0"><p className="text-sm font-medium text-forest-900">{row.title}</p>{!compact && row.details && <p className="text-xs text-ink-soft mt-1 break-words">{row.details}</p>}{row.url && <a href={row.url} target="_blank" rel="noreferrer" className="text-xs text-forest-700 hover:underline mt-1 block truncate">{row.url}</a>}</div></div>)}</div>}</Panel> }

function Audit({ loading, cards, issue, setIssue, list, busyId, onGenerate, onEditArticle, counts }: { loading: boolean; cards: { key: Issue; label: string }[]; issue: Issue; setIssue: (i: Issue) => void; list: Row[]; busyId: string | null; onGenerate: (r: Row) => Promise<void>; onEditArticle?: (id: string) => void; counts: (i: Issue) => number }) { return <div className="space-y-5"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards.map(c => <button key={c.key} onClick={() => setIssue(c.key)} className={`text-left bg-white border rounded-2xl p-4 ${issue === c.key ? 'border-forest-700 shadow-sm' : 'border-line hover:border-forest-300'}`}><p className="font-serif text-2xl text-forest-900">{loading ? '—' : counts(c.key)}</p><p className="text-xs text-ink-soft mt-1">{c.label}</p></button>)}</div><Panel title="Conteúdos que precisam de atenção" subtitle="A ação de IA corrige apenas title, meta description e palavra-chave. Ela não muda URL, corpo do artigo ou imagem automaticamente.">{loading ? <Small>Carregando…</Small> : list.length === 0 ? <Empty text="Nenhum conteúdo com esse problema." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><tbody className="divide-y divide-stone-100">{list.map(a => <tr key={a.id}><td className="py-3 pr-3"><p className="font-medium text-forest-900">{a.title}</p><p className="text-xs text-ink-soft">{a.slug} · {wordCount(a.content)} palavras</p></td><td className="py-3"><div className="flex justify-end gap-1"><button onClick={() => void onGenerate(a)} disabled={busyId === a.id} className="inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg disabled:opacity-50">{busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {seoOk(a) ? 'Otimizar SEO com IA' : 'Gerar SEO com IA'}</button>{onEditArticle && <button onClick={() => onEditArticle(a.id)} className="p-1.5 text-stone-500" title="Editar"><Pencil className="w-4 h-4" /></button>}</div></td></tr>)}</tbody></table></div>}</Panel></div> }

function Settings({ dashboard }: { dashboard: Dashboard | null }) { const last = dashboard?.runs?.[0]; return <div className="grid lg:grid-cols-2 gap-4"><Panel title="Google Search Console"><div className="space-y-3 text-sm"><p><strong>Propriedade:</strong> {dashboard?.siteUrl || 'sc-domain:avidanaocolabora.com'}</p><p><strong>Credencial:</strong> {dashboard?.configured ? 'Configurada no servidor' : 'Pendente'}</p><p className="text-ink-soft">Secrets esperados no Supabase: <code>GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON</code> e <code>GOOGLE_SEARCH_CONSOLE_SITE_URL</code>. A credencial nunca é enviada ao navegador.</p></div></Panel><Panel title="Sincronização automática"><div className="space-y-2 text-sm"><p>Execução diária via pg_cron às 06:35 UTC, usando o token interno já existente.</p><p><strong>Última execução:</strong> {last ? `${last.status} · ${new Date(last.started_at).toLocaleString('pt-BR')}` : 'ainda não registrada'}</p>{last?.error && <p className="text-red-700">{last.error}</p>}</div></Panel></div> }

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><div className="mb-3"><h2 className="font-serif text-xl text-forest-900">{title}</h2>{subtitle && <p className="text-xs text-ink-soft mt-1">{subtitle}</p>}</div>{children}</section> }
function Empty({ text }: { text: string }) { return <p className="text-sm text-ink-soft py-3">{text}</p> }
function Status({ ok, label }: { ok: boolean; label: string }) { return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}{label}</span> }
function Big({ children }: { children: React.ReactNode }) { return <p className="font-serif text-3xl text-forest-900">{children}</p> }
function Small({ children }: { children: React.ReactNode }) { return <p className="text-sm text-ink-soft mt-1">{children}</p> }
