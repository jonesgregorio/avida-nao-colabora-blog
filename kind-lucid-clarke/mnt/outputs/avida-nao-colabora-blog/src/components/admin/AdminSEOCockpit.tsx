import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { smartFixArticle, type SeoSmartArticle, type SeoSmartIssue } from '../../lib/seoSmartCorrector'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Pencil, RefreshCw, Search, Sparkles, WandSparkles } from 'lucide-react'

type Row = SeoSmartArticle
type Issue = 'no_seo' | 'no_image' | 'bad_slug' | 'thin' | 'no_author' | 'no_review' | 'no_links' | 'old'
type Metric = { clicks: number; impressions: number; ctr: number; position: number }
type SearchItem = Metric & { key: string; previous?: Metric | null; trend?: 'growing' | 'declining' | 'stable' | 'insufficient' }
type TrendRow = Metric & { day: string }
type Inspection = { url: string; verdict?: string | null; coverage_state?: string | null; last_inspected_at: string }
type Sitemap = { path: string; errors: number; warnings: number; last_checked_at?: string | null }
type Alert = { id: string; code?: string; severity: 'info' | 'warning' | 'critical'; title: string; details?: string | null; url?: string | null; last_seen_at: string }
type Run = { id: string; kind: string; status: string; started_at: string; rows_written: number; error?: string | null }
type Opportunity = SearchItem & { type: string; subject: string; reason: string; score?: number; priority?: 'high' | 'medium' | 'watch' }
type Cannibalization = { query: string; pages: string[]; impressions: number; reason: string }
type Dashboard = {
  configured: boolean; siteUrl: string; current: Metric; previous: Metric; trend: TrendRow[]
  queries: SearchItem[]; pages: SearchItem[]; opportunities: Opportunity[]; inspections: Inspection[]
  sitemaps: Sitemap[]; alerts: Alert[]; runs: Run[]; cannibalization: Cannibalization[]; error?: string
}
type ReportPriority = { level: 'critical' | 'high' | 'medium' | 'info' | 'ok'; title: string; what: string; action: string }
type InstantReport = {
  generatedAt: string; score: number; indexed: number; inspected: number; notIndexed: number
  sitemapErrors: number; sitemapWarnings: number; seoIssues: number; missingAlt: number; missingLinks: number
  thinContent: number; noReview: number; badSlugs: number; missingAuthor: number; oldContent: number
  priorities: ReportPriority[]
}
type Tab = 'overview' | 'indexing' | 'performance' | 'queries' | 'pages' | 'opportunities' | 'overlap' | 'sitemap' | 'alerts' | 'audit' | 'settings'

const seoOk = (a: Row) => !!(a.seo_title && a.seo_title.trim().length >= 25 && a.seo_title.trim().length <= 60 && a.seo_description && a.seo_description.trim().length >= 90 && a.seo_description.trim().length <= 155 && a.keyword)
const imgOk = (a: Row) => !!((a.image_url || a.cover_image || a.cover_image_url) && a.image_alt?.trim())
const badSlug = (s: string) => !s || /[^a-z0-9-]/.test(s) || s.length > 60 || s.includes('--')
const wordCount = (content: string | null) => String(content || '').trim().split(/\s+/).filter(Boolean).length
const isOld = (a: Row) => Date.now() - new Date(a.updated_at || a.published_at || a.created_at).getTime() > 180 * 86400000
const hasIssue = (a: Row, i: Issue) => i === 'no_seo' ? !seoOk(a) : i === 'no_image' ? !imgOk(a) : i === 'bad_slug' ? badSlug(a.slug) : i === 'thin' ? wordCount(a.content) < 800 : i === 'no_author' ? !a.author?.trim() : i === 'no_review' ? !a.reviewed_at : i === 'no_links' ? !a.related_slugs?.length && !/\]\(\/blog\//.test(a.content || '') : isOld(a)
const issueCount = (rows: Row[], issue: Issue) => rows.filter(a => hasIssue(a, issue)).length
const fmt = (v = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)
const pct = (v = 0) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const delta = (now: number, before: number) => before ? (now - before) / Math.abs(before) : now ? 1 : 0

const ISSUE_COPY: Record<Issue, { label: string; what: string; action: string; button: string }> = {
  no_seo: { label: 'SEO a otimizar', what: 'O artigo tem título, descrição ou palavra-chave fora do padrão recomendado. Isso não quer dizer que ele esteja “sem SEO”.', action: 'A IA pode reescrever esses campos e salvar uma versão mais adequada.', button: 'Corrigir com IA' },
  no_image: { label: 'Imagem ou descrição ausente', what: 'O artigo está sem capa ou sem uma descrição de imagem para acessibilidade e mecanismos de busca.', action: 'O corretor busca uma capa relacionada no Pexels quando necessário e cria o texto alternativo.', button: 'Corrigir com IA' },
  bad_slug: { label: 'Endereço da página a melhorar', what: 'O endereço da página está longo ou fora do padrão. Um endereço mais limpo ajuda pessoas e mecanismos de busca.', action: 'O corretor cria um novo endereço e também cria um redirecionamento 301 do endereço antigo para o novo, para não perder acessos.', button: 'Corrigir endereço' },
  thin: { label: 'Conteúdo curto', what: 'O texto está abaixo do tamanho mínimo usado pela auditoria e pode estar pouco aprofundado.', action: 'A IA amplia o artigo mantendo o assunto e sem inventar estudos, dados ou promessas clínicas.', button: 'Ampliar com IA' },
  no_author: { label: 'Sem autoria', what: 'O artigo não informa quem é responsável editorialmente pelo conteúdo.', action: 'O corretor preenche a autoria padrão da equipe editorial.', button: 'Corrigir autoria' },
  no_review: { label: 'Sem revisão humana registrada', what: 'O sistema não encontrou uma revisão editorial humana registrada. Isso não impede o Google de indexar a página.', action: 'A IA pode fazer uma pré-revisão e salvar observações, mas nunca vai fingir que uma pessoa revisou o texto.', button: 'Fazer pré-revisão' },
  no_links: { label: 'Poucos links internos', what: 'O artigo não aponta para outros conteúdos relacionados do próprio site. Isso pode dificultar a navegação e a descoberta de páginas.', action: 'O corretor escolhe conteúdos relacionados e adiciona esses vínculos automaticamente.', button: 'Adicionar links' },
  old: { label: 'Conteúdo antigo', what: 'O artigo não é atualizado há mais de seis meses. Isso, sozinho, não é um erro de SEO.', action: 'Se você quiser, a IA pode atualizar a clareza e a organização sem inventar fatos novos.', button: 'Atualizar com IA' },
}

const actionableForBulk: Issue[] = ['no_seo', 'no_image', 'bad_slug', 'thin', 'no_author', 'no_links']

function detectedIssues(article: Row): Issue[] {
  return (Object.keys(ISSUE_COPY) as Issue[]).filter(issue => hasIssue(article, issue))
}

function calculateHealth(dashboard: Dashboard | null, publishedRows: Row[]) {
  if (!dashboard) return 0
  const inspected = dashboard.inspections.length
  const passed = dashboard.inspections.filter(i => i.verdict === 'PASS').length
  const sitemapPenalty = dashboard.sitemaps.reduce((sum, item) => sum + Number(item.errors || 0) * 10 + Number(item.warnings || 0) * 3, 0)
  const alertPenalty = dashboard.alerts.reduce((sum, item) => sum + (item.severity === 'critical' ? 15 : item.severity === 'warning' ? 6 : 2), 0)
  const realSeoProblems = actionableForBulk.reduce((sum, issue) => sum + issueCount(publishedRows, issue), 0)
  return Math.max(0, Math.min(100, 55 + (inspected ? Math.round((passed / inspected) * 30) : 15) - sitemapPenalty - alertPenalty - Math.min(25, realSeoProblems)))
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

function simpleCoverage(value?: string | null) {
  const text = String(value || '').toLowerCase()
  if (!text) return 'O Google ainda não informou o motivo.'
  if (text.includes('submitted and indexed') || text.includes('enviada e indexada')) return 'Indexada pelo Google.'
  if (text.includes('discovered') || text.includes('detectada')) return 'O Google já conhece a página, mas ainda não a colocou nos resultados.'
  if (text.includes('crawled') || text.includes('rastreada')) return 'O Google já visitou a página, mas ainda não decidiu colocá-la nos resultados.'
  if (text.includes('blocked') || text.includes('bloque')) return 'O Google encontrou um bloqueio para acessar ou indexar esta página.'
  return value || 'O Google ainda não informou o motivo.'
}

function simpleAlert(row: Alert) {
  if (row.code === 'index_problem' || /indexa/i.test(row.title)) return { title: 'O Google ainda não colocou esta página nos resultados', detail: simpleCoverage(row.details) }
  if (row.code === 'canonical_mismatch' || /canonical/i.test(row.title)) return { title: 'O Google está tratando outra URL como a principal', detail: 'O site declarou uma URL principal, mas o Google escolheu outra. O sistema pode revisar a página e verificar de novo.' }
  if (row.code === 'sitemap_problem' || /sitemap/i.test(row.title)) return { title: 'O arquivo que lista as páginas do site precisa de atenção', detail: 'O sitemap ajuda o Google a encontrar as páginas. O sistema pode reenviá-lo sem você precisar entrar no Search Console.' }
  return { title: row.title, detail: row.details || 'O sistema encontrou algo que merece atenção.' }
}

function buildInstantReport(dashboard: Dashboard, publishedRows: Row[]): InstantReport {
  const seoIssues = issueCount(publishedRows, 'no_seo')
  const missingAlt = issueCount(publishedRows, 'no_image')
  const missingLinks = issueCount(publishedRows, 'no_links')
  const thinContent = issueCount(publishedRows, 'thin')
  const noReview = issueCount(publishedRows, 'no_review')
  const badSlugs = issueCount(publishedRows, 'bad_slug')
  const missingAuthor = issueCount(publishedRows, 'no_author')
  const oldContent = issueCount(publishedRows, 'old')
  const indexed = dashboard.inspections.filter(i => i.verdict === 'PASS').length
  const inspected = dashboard.inspections.length
  const notIndexed = dashboard.inspections.filter(i => i.verdict && i.verdict !== 'PASS').length
  const sitemapErrors = dashboard.sitemaps.reduce((sum, item) => sum + Number(item.errors || 0), 0)
  const sitemapWarnings = dashboard.sitemaps.reduce((sum, item) => sum + Number(item.warnings || 0), 0)
  const priorities: ReportPriority[] = []

  if (sitemapErrors) priorities.push({ level: 'critical', title: 'O Google encontrou erro no mapa de páginas do site', what: `Há ${sitemapErrors} erro(s) no sitemap. Esse arquivo é a lista que ajuda o Google a descobrir as páginas do site.`, action: 'O sistema pode reenviar o sitemap ao Google. Se o erro vier do conteúdo do arquivo, ele será mostrado para correção no site, sem exigir que você abra o Search Console.' })
  if (notIndexed) priorities.push({ level: 'high', title: 'Algumas páginas ainda não aparecem no índice do Google', what: `Das ${inspected} páginas já verificadas, ${notIndexed} ainda não foram confirmadas como indexadas. Isso não significa automaticamente que exista um bloqueio.`, action: 'O corretor melhora o que depende do site, reenvia o sitemap e verifica a página novamente. A decisão final de incluir uma página nos resultados continua sendo do Google.' })
  if (seoIssues) priorities.push({ level: 'high', title: 'Alguns artigos precisam de ajuste nos dados de SEO', what: `${seoIssues} artigo(s) têm título, descrição ou palavra-chave fora do padrão interno.`, action: 'A IA pode corrigir esses campos automaticamente.' })
  if (badSlugs) priorities.push({ level: 'high', title: 'Alguns endereços de página podem ser melhorados', what: `${badSlugs} página(s) têm endereço longo ou fora do padrão.`, action: 'O corretor pode trocar o endereço e criar um redirecionamento 301 automático para preservar o endereço antigo.' })
  if (missingLinks) priorities.push({ level: 'medium', title: 'Alguns artigos estão pouco conectados entre si', what: `${missingLinks} artigo(s) não têm links internos detectados.`, action: 'O corretor pode escolher artigos relacionados e criar esses vínculos automaticamente.' })
  if (missingAlt) priorities.push({ level: 'medium', title: 'Falta capa ou descrição de imagem em alguns artigos', what: `${missingAlt} artigo(s) precisam de capa ou texto alternativo.`, action: 'O corretor pode buscar uma capa relacionada e criar uma descrição segura da imagem.' })
  if (thinContent) priorities.push({ level: 'medium', title: 'Alguns artigos estão curtos', what: `${thinContent} artigo(s) têm menos de 800 palavras.`, action: 'A IA pode ampliar o texto, mantendo o assunto e sem inventar estudos ou informações.' })
  if (missingAuthor) priorities.push({ level: 'medium', title: 'Há conteúdo sem autoria', what: `${missingAuthor} conteúdo(s) não informam a responsabilidade editorial.`, action: 'O corretor pode preencher a equipe editorial automaticamente.' })
  if (noReview) priorities.push({ level: 'info', title: 'Falta registro de revisão humana', what: `${noReview} conteúdo(s) não têm revisão humana registrada. Isso é um controle editorial interno e não é, sozinho, um erro de SEO.`, action: 'A IA pode fazer uma pré-revisão e deixar observações, mas somente uma pessoa deve marcar a revisão humana como concluída.' })
  if (oldContent) priorities.push({ level: 'info', title: 'Há conteúdos com mais de seis meses sem atualização', what: `${oldContent} conteúdo(s) entram na regra interna de “antigo”. Idade, sozinha, não significa problema.`, action: 'Atualize somente quando o texto realmente precisar. A IA pode ajudar quando você pedir.' })
  if (sitemapWarnings) priorities.push({ level: 'medium', title: 'O sitemap tem avisos', what: `O Google informou ${sitemapWarnings} aviso(s) no arquivo que lista as páginas.`, action: 'O sistema pode reenviar o sitemap e continuar monitorando.' })
  if (!priorities.length) priorities.push({ level: 'ok', title: 'Nenhum problema importante foi encontrado agora', what: 'As páginas verificadas, o sitemap e os itens principais da auditoria estão em ordem.', action: 'Continue usando “Analisar tudo agora” para acompanhar novas mudanças.' })

  return { generatedAt: new Date().toISOString(), score: calculateHealth(dashboard, publishedRows), indexed, inspected, notIndexed, sitemapErrors, sitemapWarnings, seoIssues, missingAlt, missingLinks, thinContent, noReview, badSlugs, missingAuthor, oldContent, priorities }
}

export default function AdminSEOCockpit({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<Issue>('no_seo')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [report, setReport] = useState<InstantReport | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  const flash = useCallback((msg: string, err = false) => {
    setToast({ msg, err })
    window.setTimeout(() => setToast(null), 5000)
  }, [])

  const articleSelect = 'id,title,slug,status,published,category,seo_title,seo_description,image_url,cover_image,cover_image_url,image_alt,keyword,content,author,related_slugs,reviewed_at,review_notes,published_at,updated_at,created_at'

  const loadArticles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('articles').select(articleSelect).order('created_at', { ascending: false }).limit(500)
    if (error) flash('Não consegui carregar a auditoria dos artigos: ' + error.message, true)
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
      const message = error instanceof Error ? error.message : 'Não consegui carregar os dados do Google agora.'
      setDashboard(prev => prev ? { ...prev, error: message } : null)
      flash(message, true)
    } finally { setSearchLoading(false) }
  }, [flash])

  useEffect(() => { void Promise.all([loadArticles(), loadDashboard()]) }, [loadArticles, loadDashboard])

  const publishedRows = rows.filter(a => a.published === true || a.status === 'published')
  const count = (i: Issue) => issueCount(publishedRows, i)
  const list = publishedRows.filter(a => hasIssue(a, issue))
  const health = useMemo(() => dashboard ? calculateHealth(dashboard, publishedRows) : null, [dashboard, publishedRows])
  const actualProblems = actionableForBulk.reduce((sum, item) => sum + count(item), 0)

  async function syncNow() {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('google-search-console', { body: { action: 'sync', source: 'manual' } })
      if (error) throw error
      if (data?.dashboard) setDashboard(data.dashboard as Dashboard)
      else await loadDashboard()
      flash(`Atualização concluída. ${data?.rowsWritten || 0} registros foram atualizados.`)
    } catch (error) { flash(error instanceof Error ? error.message : 'Não consegui atualizar os dados do Google.', true) }
    finally { setSyncing(false) }
  }

  async function analyzeAllNow() {
    setAnalyzing(true)
    try {
      const [{ data: syncData, error: syncError }, { data: articleData, error: articleError }] = await Promise.all([
        supabase.functions.invoke('google-search-console', { body: { action: 'sync', source: 'analysis_report' } }),
        supabase.from('articles').select(articleSelect).order('created_at', { ascending: false }).limit(500),
      ])
      if (syncError) throw syncError
      if (articleError) throw articleError
      const freshDashboard = (syncData?.dashboard || dashboard) as Dashboard | null
      if (!freshDashboard) throw new Error('O Google ainda não retornou dados suficientes para montar o relatório.')
      const freshRows = (articleData as Row[]) ?? []
      const freshPublished = freshRows.filter(a => a.published === true || a.status === 'published')
      setDashboard(freshDashboard)
      setRows(freshRows)
      setReport(buildInstantReport(freshDashboard, freshPublished))
      setTab('overview')
      flash('Análise concluída. O relatório foi atualizado com linguagem simples.')
    } catch (error) { flash(error instanceof Error ? error.message : 'Não consegui gerar o relatório agora.', true) }
    finally { setAnalyzing(false) }
  }

  async function googleAction(action: 'inspect_url' | 'submit_sitemap', payload: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke('seo-smart-google-actions', { body: { action, ...payload } })
    if (error) throw new Error((data as { error?: string } | null)?.error || error.message)
    if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)
    return data
  }

  async function refreshGoogleAfterFix(article: Row, newSlug?: string) {
    if (!(article.published === true || article.status === 'published')) return ''
    const url = `https://www.avidanaocolabora.com/blog/${newSlug || article.slug}`
    const notes: string[] = []
    try { await googleAction('submit_sitemap'); notes.push('sitemap reenviado ao Google') } catch (error) { notes.push(`sitemap não reenviado: ${error instanceof Error ? error.message : String(error)}`) }
    try { await googleAction('inspect_url', { url }); notes.push('página verificada novamente no Google') } catch (error) { notes.push(`verificação do Google pendente: ${error instanceof Error ? error.message : String(error)}`) }
    return notes.join(' · ')
  }

  async function correctArticle(article: Row, requested?: SeoSmartIssue) {
    setBusyId(article.id)
    try {
      const current = detectedIssues(article)
      const issues: SeoSmartIssue[] = requested === 'indexing'
        ? [...current.filter(i => actionableForBulk.includes(i)), 'indexing']
        : requested === 'opportunity'
          ? [...current.filter(i => actionableForBulk.includes(i)), 'opportunity']
          : requested ? [requested] : current
      if (!issues.length) { flash('Não encontrei nada que precise ser corrigido neste artigo.'); return }
      const result = await smartFixArticle(article, publishedRows, issues)
      const needsGoogleRefresh = issues.some(i => i !== 'no_review' && i !== 'old')
      const googleNote = needsGoogleRefresh && result.changed.length ? await refreshGoogleAfterFix(article, result.newSlug) : ''
      await Promise.all([loadArticles(), loadDashboard()])
      if (result.changed.length) {
        const skipped = result.skipped.length ? ` O que ficou pendente: ${result.skipped.join(' | ')}` : ''
        flash(`Corrigido: ${result.changed.join(', ')}.${googleNote ? ` ${googleNote}.` : ''}${skipped}`)
      } else {
        flash(`Não consegui aplicar uma correção automática. ${result.skipped.join(' | ') || 'O item precisa de análise humana.'}`, true)
      }
    } catch (error) { flash('Não consegui concluir a correção: ' + (error instanceof Error ? error.message : String(error)), true) }
    finally { setBusyId(null) }
  }

  async function correctAllAutomatically() {
    const targets = publishedRows.map(article => ({ article, issues: detectedIssues(article).filter(i => actionableForBulk.includes(i)) })).filter(item => item.issues.length)
    if (!targets.length) { flash('Não há problemas de SEO que possam ser corrigidos automaticamente agora.'); return }
    setBulkBusy(true)
    let corrected = 0
    let pending = 0
    try {
      for (let i = 0; i < targets.length; i++) {
        const { article, issues } = targets[i]
        setBulkProgress(`Corrigindo ${i + 1} de ${targets.length}: ${article.title}`)
        const result = await smartFixArticle(article, publishedRows, issues)
        if (result.changed.length) corrected++
        if (result.skipped.length) pending++
      }
      setBulkProgress('Avisando o Google sobre as páginas atualizadas…')
      try { await googleAction('submit_sitemap') } catch { pending++ }
      const { data } = await supabase.functions.invoke('google-search-console', { body: { action: 'sync', source: 'manual' } })
      if (data?.dashboard) setDashboard(data.dashboard as Dashboard)
      await loadArticles()
      flash(`Correção em lote concluída: ${corrected} artigo(s) corrigido(s)${pending ? ` e ${pending} item(ns) ainda precisam de atenção` : ''}.`)
    } catch (error) { flash('A correção em lote parou porque ocorreu um erro: ' + (error instanceof Error ? error.message : String(error)), true) }
    finally { setBulkBusy(false); setBulkProgress('') }
  }

  async function inspectGoogleUrl(url: string) {
    setBusyId(url)
    try {
      await googleAction('inspect_url', { url })
      await loadDashboard()
      flash('A página foi verificada novamente no Google. O painel agora mostra o estado mais recente disponível.')
    } catch (error) { flash('Não consegui verificar a página no Google: ' + (error instanceof Error ? error.message : String(error)), true) }
    finally { setBusyId(null) }
  }

  async function submitSitemapNow() {
    setSyncing(true)
    try {
      await googleAction('submit_sitemap')
      await syncNow()
      flash('O mapa de páginas foi reenviado ao Google e os dados foram atualizados.')
    } catch (error) { flash('Não consegui reenviar o mapa de páginas: ' + (error instanceof Error ? error.message : String(error)), true) }
    finally { setSyncing(false) }
  }

  const cards: { key: Issue; label: string }[] = (Object.keys(ISSUE_COPY) as Issue[]).map(key => ({ key, label: ISSUE_COPY[key].label }))
  const tabs: Array<{ key: Tab; label: string }> = [
    ['overview', 'Visão Geral'], ['indexing', 'Indexação'], ['performance', 'Performance'], ['queries', 'Palavras-chave'], ['pages', 'Páginas'],
    ['opportunities', 'Oportunidades'], ['overlap', 'Sobreposição'], ['sitemap', 'Sitemap'], ['alerts', 'Alertas'], ['audit', 'Auditoria técnica'], ['settings', 'Configurações'],
  ].map(([key, label]) => ({ key: key as Tab, label }))

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    {toast && <div className={`fixed top-4 right-4 z-50 max-w-xl text-white text-sm px-4 py-3 rounded-xl shadow-lg ${toast.err ? 'bg-red-700' : 'bg-forest-900'}`}>{toast.msg}</div>}
    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div><p className="text-xs uppercase tracking-[0.18em] text-forest-600 font-semibold">Admin · Crescimento orgânico</p><h1 className="font-serif text-3xl sm:text-4xl text-forest-900 mt-1">SEO Control Center</h1><p className="text-sm text-ink-soft mt-2 max-w-3xl">Veja o que está acontecendo em linguagem simples e corrija o que depende do site sem precisar abrir o Google Search Console.</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void Promise.all([loadArticles(), loadDashboard()])} disabled={searchLoading || loading || bulkBusy} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${searchLoading || loading ? 'animate-spin' : ''}`} /> Recarregar</button>
        <button onClick={analyzeAllNow} disabled={analyzing || !dashboard?.configured || bulkBusy} className="inline-flex items-center gap-2 border border-forest-300 bg-mint px-4 py-2 rounded-xl text-sm font-medium text-forest-900 disabled:opacity-50">{analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analisar tudo agora</button>
        <button onClick={correctAllAutomatically} disabled={bulkBusy || loading || !publishedRows.length} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">{bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />} Corrigir problemas automaticamente</button>
        <button onClick={syncNow} disabled={syncing || !dashboard?.configured || bulkBusy} className="inline-flex items-center gap-2 border border-forest-700 px-4 py-2 rounded-xl text-sm text-forest-900 disabled:opacity-50">{syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Atualizar dados do Google</button>
      </div>
    </div>
    {bulkProgress && <div className="mb-4 rounded-xl border border-forest-200 bg-mint px-4 py-3 text-sm text-forest-900"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />{bulkProgress}</div>}
    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-950"><strong>Importante:</strong> o sistema consegue corrigir o que depende do site, reenviar o sitemap e verificar as páginas no Google. Nenhuma ferramenta pode obrigar o Google a indexar uma página; a decisão final de indexação é do próprio Google.</div>
    {report && <InstantReportPanel report={report} />}
    <div className="flex gap-2 overflow-x-auto pb-2 mb-5" role="tablist" aria-label="Áreas do SEO Control Center">{tabs.map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs sm:text-sm border ${tab === item.key ? 'bg-forest-900 border-forest-900 text-white' : 'bg-white border-line text-forest-800 hover:border-forest-300'}`}>{item.label}</button>)}</div>
    {!dashboard?.configured && tab !== 'audit' && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"><strong>A ligação com o Google ainda não está pronta.</strong> A auditoria interna continua disponível, mas os dados de indexação não poderão ser atualizados.</div>}
    {tab === 'overview' && <Overview dashboard={dashboard} health={health} actualProblems={actualProblems} />}
    {tab === 'indexing' && <Indexing rows={dashboard?.inspections || []} articles={publishedRows} busyId={busyId} onCorrect={correctArticle} onInspect={inspectGoogleUrl} />}
    {tab === 'performance' && <Performance rows={dashboard?.trend || []} />}
    {tab === 'queries' && <MetricTable title="Palavras-chave" rows={dashboard?.queries || []} firstLabel="Pesquisa feita no Google" />}
    {tab === 'pages' && <MetricTable title="Páginas" rows={dashboard?.pages || []} firstLabel="Página" links />}
    {tab === 'opportunities' && <Opportunities rows={dashboard?.opportunities || []} articles={publishedRows} busyId={busyId} onCorrect={correctArticle} />}\n    {tab === 'overlap' && <Overlap rows={dashboard?.cannibalization || []} articles={publishedRows} busyId={busyId} onCorrect={correctArticle} />}
    {tab === 'sitemap' && <Sitemaps rows={dashboard?.sitemaps || []} onSubmit={submitSitemapNow} busy={syncing} />}
    {tab === 'alerts' && <Alerts rows={dashboard?.alerts || []} articles={publishedRows} busyId={busyId} onCorrect={correctArticle} onSubmitSitemap={submitSitemapNow} onInspect={inspectGoogleUrl} />}
    {tab === 'audit' && <Audit loading={loading} cards={cards} issue={issue} setIssue={setIssue} list={list} busyId={busyId} onCorrect={correctArticle} onEditArticle={onEditArticle} counts={count} />}
    {tab === 'settings' && <Settings dashboard={dashboard} />}
  </div>
}

function InstantReportPanel({ report }: { report: InstantReport }) {
  const levelClass: Record<ReportPriority['level'], string> = { critical: 'border-red-200 bg-red-50 text-red-900', high: 'border-amber-200 bg-amber-50 text-amber-950', medium: 'border-yellow-200 bg-yellow-50 text-yellow-950', info: 'border-sky-200 bg-sky-50 text-sky-950', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900' }
  return <section className="mb-5 rounded-2xl border border-forest-200 bg-[#fbfcf8] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-forest-600 font-semibold">Relatório instantâneo</p><h2 className="font-serif text-2xl text-forest-900 mt-1">O que está bem e o que precisa de atenção</h2><p className="text-xs text-ink-soft mt-1">Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')} com os dados mais recentes disponíveis.</p></div><div className="text-right"><p className="text-xs text-ink-soft">Saúde do SEO</p><p className="font-serif text-4xl text-forest-900">{report.score}/100</p></div></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mt-4"><ReportStat label="Confirmadas no Google" value={`${report.indexed}/${report.inspected}`} /><ReportStat label="Ainda não confirmadas" value={String(report.notIndexed)} /><ReportStat label="SEO a otimizar" value={String(report.seoIssues)} /><ReportStat label="Links internos" value={String(report.missingLinks)} /><ReportStat label="Imagem/descrição" value={String(report.missingAlt)} /><ReportStat label="Mapa de páginas" value={report.sitemapErrors ? `${report.sitemapErrors} erro(s)` : report.sitemapWarnings ? `${report.sitemapWarnings} aviso(s)` : 'Tudo certo'} /></div>
    <div className="mt-4 space-y-2">{report.priorities.map((item, i) => <div key={`${item.title}-${i}`} className={`rounded-xl border px-3.5 py-3 ${levelClass[item.level]}`}><p className="text-sm font-semibold">{item.title}</p><p className="text-xs mt-1 leading-relaxed"><strong>O que isso significa:</strong> {item.what}</p><p className="text-xs mt-1 leading-relaxed"><strong>O que fazer:</strong> {item.action}</p></div>)}</div>
    <p className="text-xs text-ink-soft mt-4">“Indexada” quer dizer que o Google confirmou a página no índice. “Impressões” quer dizer quantas vezes ela apareceu em uma busca. São coisas diferentes.</p>
  </section>
}
function ReportStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-line bg-white px-3 py-3"><p className="text-[11px] text-ink-soft">{label}</p><p className="font-serif text-xl text-forest-900 mt-0.5">{value}</p></div> }

function Overview({ dashboard, health, actualProblems }: { dashboard: Dashboard | null; health: number | null; actualProblems: number }) {
  const current = dashboard?.current || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const previous = dashboard?.previous || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const metrics = [['Cliques', fmt(current.clicks), delta(current.clicks, previous.clicks)], ['Vezes que apareceu no Google', fmt(current.impressions), delta(current.impressions, previous.impressions)], ['Taxa de cliques', pct(current.ctr), delta(current.ctr, previous.ctr)], ['Posição média', fmt(current.position), previous.position ? (previous.position - current.position) / previous.position : 0]] as const
  const indexed = dashboard?.inspections.filter(i => i.verdict === 'PASS').length || 0
  return <div className="space-y-5"><div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3"><div className="rounded-2xl border border-forest-100 bg-[#f4f8f3] p-5"><p className="text-xs text-ink-soft">Saúde do SEO</p><p className="font-serif text-4xl text-forest-900 mt-1">{health ?? '—'}</p><p className="text-xs text-ink-soft mt-2">Leva em conta indexação, mapa de páginas, alertas e problemas que o site consegue corrigir.</p></div>{metrics.map(([label, value, change]) => <div key={label} className="rounded-2xl border border-line bg-white p-5"><p className="text-xs text-ink-soft">{label} · últimos 28 dias</p><p className="font-serif text-3xl text-forest-900 mt-1">{value}</p><p className={`text-xs mt-2 ${change > 0 ? 'text-emerald-700' : change < 0 ? 'text-amber-700' : 'text-ink-soft'}`}>{change ? `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}% comparado ao período anterior` : 'Ainda não há comparação útil'}</p></div>)}</div><div className="grid lg:grid-cols-3 gap-4"><Panel title="Páginas confirmadas no Google"><Big>{indexed}/{dashboard?.inspections.length || 0}</Big><Small>Entre as páginas já verificadas, estas foram confirmadas como indexadas.</Small></Panel><Panel title="Oportunidades"><Big>{dashboard?.opportunities.length || 0}</Big><Small>Páginas ou pesquisas em que há espaço para ganhar mais cliques ou posição.</Small></Panel><Panel title="Problemas que podem ser corrigidos"><Big>{actualProblems}</Big><Small>Ocorrências nos artigos que o corretor automático consegue tratar.</Small></Panel></div><div className="grid lg:grid-cols-2 gap-4"><MetricTable title="Principais pesquisas" rows={(dashboard?.queries || []).slice(0, 8)} firstLabel="O que as pessoas pesquisaram" /><Alerts rows={(dashboard?.alerts || []).slice(0, 6)} compact /></div></div>
}

function Indexing({ rows, articles, busyId, onCorrect, onInspect }: { rows: Inspection[]; articles: Row[]; busyId: string | null; onCorrect: (r: Row, issue?: SeoSmartIssue) => Promise<void>; onInspect: (url: string) => Promise<void> }) {
  return <Panel title="Páginas no Google" subtitle="Aqui você vê se o Google já colocou cada página no índice. Quando houver algo que o site possa melhorar, use o botão de correção; o sistema também verifica a página de novo depois.">{rows.length === 0 ? <Empty text="Nenhuma página foi verificada ainda." /> : <div className="overflow-x-auto"><table className="w-full text-xs sm:text-sm"><thead><tr className="border-b border-line text-left text-ink-soft"><th className="py-2 pr-3">Página</th><th>Situação</th><th>Explicação</th><th>Verificada</th><th className="text-right">Ação</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map(item => { const article = item.verdict === 'PASS' ? null : articleFromUrl(item.url, articles); const ok = item.verdict === 'PASS'; return <tr key={item.url}><td className="py-3 pr-3 max-w-[360px] truncate"><a href={item.url} target="_blank" rel="noreferrer" className="text-forest-800 hover:underline">{item.url}</a></td><td><Status ok={ok} label={ok ? 'Indexada' : 'Ainda não indexada'} /></td><td className="text-ink-soft max-w-[360px]">{simpleCoverage(item.coverage_state)}</td><td className="text-ink-soft whitespace-nowrap">{new Date(item.last_inspected_at).toLocaleDateString('pt-BR')}</td><td className="text-right">{article ? <button onClick={() => void onCorrect(article, 'indexing')} disabled={busyId === article.id} className="inline-flex items-center gap-1 text-[11px] border border-forest-200 text-forest-800 px-2 py-1.5 rounded-lg disabled:opacity-50">{busyId === article.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <WandSparkles className="w-3 h-3" />} Corrigir SEO e verificar</button> : !ok ? <button onClick={() => void onInspect(item.url)} disabled={busyId === item.url} className="inline-flex items-center gap-1 text-[11px] border border-forest-200 text-forest-800 px-2 py-1.5 rounded-lg disabled:opacity-50">{busyId === item.url ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Verificar novamente</button> : null}</td></tr> })}</tbody></table></div>}</Panel>
}

function Performance({ rows }: { rows: TrendRow[] }) { const max = Math.max(1, ...rows.map(r => Number(r.impressions || 0))); return <Panel title="Quantas vezes o site apareceu no Google" subtitle="Este gráfico mostra aparições nas buscas. Uma página pode estar indexada e ainda ter zero aparições.">{rows.length === 0 ? <Empty text="Ainda não há histórico suficiente." /> : <div className="space-y-2">{rows.slice(-30).map(row => <div key={row.day} className="grid grid-cols-[72px_1fr_70px] gap-3 items-center text-xs"><span className="text-ink-soft">{new Date(`${row.day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span><div className="h-2 rounded-full bg-stone-100 overflow-hidden"><div className="h-full bg-forest-700 rounded-full" style={{ width: `${Math.max(2, (row.impressions / max) * 100)}%` }} /></div><span className="text-right">{fmt(row.impressions)}</span></div>)}</div>}</Panel> }

function MetricTable({ title, rows, firstLabel, links = false }: { title: string; rows: SearchItem[]; firstLabel: string; links?: boolean }) { return <Panel title={title}>{rows.length === 0 ? <Empty text="Ainda não há dados neste período." /> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-line text-ink-soft"><th className="text-left py-2">{firstLabel}</th><th className="text-right">Cliques</th><th className="text-right">Aparições</th><th className="text-right">Taxa de clique</th><th className="text-right">Posição</th><th className="text-right">Tendência</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map(row => <tr key={row.key}><td className="py-2.5 pr-3 max-w-[360px] truncate">{links && /^https?:/.test(row.key) ? <a href={row.key} target="_blank" rel="noreferrer" className="text-forest-800 hover:underline">{row.key}</a> : row.key}</td><td className="text-right">{fmt(row.clicks)}</td><td className="text-right">{fmt(row.impressions)}</td><td className="text-right">{pct(row.ctr)}</td><td className="text-right">{fmt(row.position)}</td><td className="text-right whitespace-nowrap">{row.trend === 'growing' ? '📈 Crescendo' : row.trend === 'declining' ? '📉 Caindo' : row.trend === 'stable' ? '➖ Estável' : 'Dados insuficientes'}</td></tr>)}</tbody></table></div>}</Panel> }

function Opportunities({ rows, articles, busyId, onCorrect }: { rows: Opportunity[]; articles: Row[]; busyId: string | null; onCorrect: (r: Row, issue?: SeoSmartIssue) => Promise<void> }) {
  const reason = (row: Opportunity) => row.type === 'position' ? 'Esta pesquisa já está perto da primeira página. Ajustes no conteúdo e nos dados de SEO podem ajudar.' : row.type === 'page' ? 'Esta página já aparece nas buscas, mas recebe poucos cliques. Melhorar título e descrição pode ajudar.' : 'O site aparece para esta pesquisa, mas poucas pessoas clicam. Um título e uma descrição mais atraentes podem ajudar.'
  return <Panel title="Oportunidades de crescimento" subtitle="Aqui o sistema mostra onde pequenas melhorias podem trazer mais visitas.">{rows.length === 0 ? <Empty text="Nenhuma oportunidade forte foi encontrada agora." /> : <div className="space-y-3">{rows.map((row, i) => { const article = articleFromUrl(row.subject, articles); return <div key={`${row.type}-${row.subject}-${i}`} className="rounded-xl border border-line p-4"><p className="font-medium text-forest-900 break-all">{row.subject}</p><p className="text-xs text-ink-soft mt-1">{reason(row)}</p><p className="text-[11px] text-forest-700 mt-1">Prioridade por evidência: {fmt(row.score || 0)} · {row.priority === 'high' ? 'alta' : row.priority === 'medium' ? 'média' : 'acompanhar'}</p><div className="flex flex-wrap items-center justify-between gap-3 mt-2"><p className="text-xs text-ink-soft">{fmt(row.impressions)} aparições · {fmt(row.clicks)} cliques · taxa {pct(row.ctr)} · posição média {fmt(row.position)}</p>{article && <button onClick={() => void onCorrect(article, row.type === 'position' ? 'position' : row.type === 'page' || row.type === 'ctr' ? 'ctr' : 'opportunity')} disabled={busyId === article.id} className="inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg disabled:opacity-50">{busyId === article.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WandSparkles className="w-3.5 h-3.5" />} Melhorar com IA</button>}</div></div> })}</div>}</Panel>
}

function Overlap({ rows, articles, busyId, onCorrect }: { rows: Cannibalization[]; articles: Row[]; busyId: string | null; onCorrect: (r: Row, issue?: SeoSmartIssue) => Promise<void> }) {
  return <Panel title="Possível sobreposição de conteúdo" subtitle="Mostra somente casos em que duas páginas receberam impressões para a mesma pesquisa. Isso é um sinal para revisar, não uma ordem para excluir ou redirecionar conteúdo.">{rows.length === 0 ? <Empty text="Nenhuma sobreposição com evidência suficiente foi encontrada agora." /> : <div className="space-y-3">{rows.map(row => <div key={row.query} className="rounded-xl border border-line p-4"><p className="font-medium text-forest-900">Pesquisa: {row.query}</p><p className="text-xs text-ink-soft mt-1">{fmt(row.impressions)} aparições somadas nas duas páginas principais.</p><div className="mt-2 space-y-1">{row.pages.map(page => <a key={page} href={page} target="_blank" rel="noreferrer" className="block text-xs text-forest-700 hover:underline break-all">{page}</a>)}</div><p className="text-xs mt-3 text-amber-900"><strong>Recomendação:</strong> {row.reason}</p><div className="mt-2 flex flex-wrap gap-2">{row.pages.map(page => { const article = articleFromUrl(page, articles); return article ? <button key={`fix-${page}`} onClick={() => void onCorrect(article, 'position')} disabled={busyId === article.id} className="inline-flex items-center gap-1 text-[11px] border border-forest-200 text-forest-800 px-2 py-1.5 rounded-lg disabled:opacity-50">{busyId === article.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <WandSparkles className="w-3 h-3" />} Fortalecer {article.title}</button> : null })}</div><p className="text-[11px] text-ink-soft mt-2">A correção fortalece metadados e links internos. O sistema não exclui, funde nem redireciona automaticamente páginas em sobreposição.</p></div>)}</div>}</Panel>
}

function Sitemaps({ rows, onSubmit, busy }: { rows: Sitemap[]; onSubmit: () => Promise<void>; busy: boolean }) { return <Panel title="Mapa de páginas do site" subtitle="O sitemap é a lista que ajuda o Google a descobrir as páginas. Você pode reenviá-lo daqui, sem entrar no Search Console."><div className="mb-3"><button onClick={() => void onSubmit()} disabled={busy} className="inline-flex items-center gap-2 border border-forest-200 text-forest-800 px-3 py-2 rounded-lg text-xs disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Reenviar mapa de páginas ao Google</button></div>{rows.length === 0 ? <Empty text="Ainda não há informação do sitemap." /> : <div className="space-y-3">{rows.map(row => <div key={row.path} className="rounded-xl border border-line p-4 flex flex-wrap items-center justify-between gap-3"><div><a href={row.path} target="_blank" rel="noreferrer" className="font-medium text-forest-900 hover:underline inline-flex items-center gap-1">{row.path}<ExternalLink className="w-3 h-3" /></a><p className="text-xs text-ink-soft mt-1">Última verificação: {row.last_checked_at ? new Date(row.last_checked_at).toLocaleString('pt-BR') : 'ainda não informada'}</p></div><Status ok={!row.errors && !row.warnings} label={row.errors ? `${row.errors} erro(s)` : row.warnings ? `${row.warnings} aviso(s)` : 'Tudo certo'} /></div>)}</div>}</Panel> }

function Alerts({ rows, compact = false, articles = [], busyId = null, onCorrect, onSubmitSitemap, onInspect }: { rows: Alert[]; compact?: boolean; articles?: Row[]; busyId?: string | null; onCorrect?: (r: Row, issue?: SeoSmartIssue) => Promise<void>; onSubmitSitemap?: () => Promise<void>; onInspect?: (url: string) => Promise<void> }) { return <Panel title="Avisos que precisam de atenção">{rows.length === 0 ? <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Nenhum aviso importante agora.</div> : <div className="space-y-3">{rows.map(row => { const copy = simpleAlert(row); const article = row.url ? articleFromUrl(row.url, articles) : null; return <div key={row.id} className="rounded-xl border border-line p-3 flex gap-3"><AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${row.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-forest-900">{copy.title}</p>{!compact && <p className="text-xs text-ink-soft mt-1 break-words">{copy.detail}</p>}{row.url && <a href={row.url} target="_blank" rel="noreferrer" className="text-xs text-forest-700 hover:underline mt-1 block truncate">{row.url}</a>}{!compact && onCorrect && article && <button onClick={() => void onCorrect(article, row.code === 'index_problem' ? 'indexing' : row.code === 'canonical_mismatch' ? 'no_seo' : undefined)} disabled={busyId === article.id} className="mt-2 inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg disabled:opacity-50">{busyId === article.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WandSparkles className="w-3.5 h-3.5" />} {row.code === 'index_problem' ? 'Corrigir SEO e verificar' : row.code === 'canonical_mismatch' ? 'Revisar SEO da página' : 'Aplicar correção específica'}</button>}{!compact && onInspect && row.url && row.code === 'canonical_mismatch' && <button onClick={() => void onInspect(row.url!)} disabled={busyId === row.url} className="mt-2 ml-2 inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg disabled:opacity-50">{busyId === row.url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Verificar canonical novamente</button>}{!compact && onSubmitSitemap && row.code === 'sitemap_problem' && <button onClick={() => void onSubmitSitemap()} className="mt-2 inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg"><RefreshCw className="w-3.5 h-3.5" /> Reenviar ao Google</button>}</div></div> })}</div>}</Panel> }

function Audit({ loading, cards, issue, setIssue, list, busyId, onCorrect, onEditArticle, counts }: { loading: boolean; cards: { key: Issue; label: string }[]; issue: Issue; setIssue: (i: Issue) => void; list: Row[]; busyId: string | null; onCorrect: (r: Row, issue?: SeoSmartIssue) => Promise<void>; onEditArticle?: (id: string) => void; counts: (i: Issue) => number }) {
  const info = ISSUE_COPY[issue]
  return <div className="space-y-5"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards.map(c => <button key={c.key} onClick={() => setIssue(c.key)} className={`text-left bg-white border rounded-2xl p-4 ${issue === c.key ? 'border-forest-700 shadow-sm' : 'border-line hover:border-forest-300'}`}><p className="font-serif text-2xl text-forest-900">{loading ? '—' : counts(c.key)}</p><p className="text-xs text-ink-soft mt-1">{c.label}</p></button>)}</div><div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm font-semibold text-sky-950">{info.label}</p><p className="text-xs text-sky-900 mt-1"><strong>O que significa:</strong> {info.what}</p><p className="text-xs text-sky-900 mt-1"><strong>Como o sistema ajuda:</strong> {info.action}</p></div><Panel title="Conteúdos que precisam de atenção">{loading ? <Small>Carregando…</Small> : list.length === 0 ? <Empty text="Nenhum conteúdo com esse problema." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><tbody className="divide-y divide-stone-100">{list.map(a => <tr key={a.id}><td className="py-3 pr-3"><p className="font-medium text-forest-900">{a.title}</p><p className="text-xs text-ink-soft">{a.slug} · {wordCount(a.content)} palavras</p></td><td className="py-3"><div className="flex justify-end gap-1"><button onClick={() => void onCorrect(a, issue)} disabled={busyId === a.id} className="inline-flex items-center gap-1.5 text-xs border border-forest-200 text-forest-800 px-2.5 py-1.5 rounded-lg disabled:opacity-50">{busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WandSparkles className="w-3.5 h-3.5" />} {info.button}</button>{onEditArticle && <button onClick={() => onEditArticle(a.id)} className="p-1.5 text-stone-500" title="Editar manualmente"><Pencil className="w-4 h-4" /></button>}</div></td></tr>)}</tbody></table></div>}</Panel></div>
}

function Settings({ dashboard }: { dashboard: Dashboard | null }) { const last = dashboard?.runs?.[0]; return <div className="grid lg:grid-cols-2 gap-4"><Panel title="Ligação com o Google"><div className="space-y-3 text-sm"><p><strong>Site monitorado:</strong> {dashboard?.siteUrl || 'sc-domain:avidanaocolabora.com'}</p><p><strong>Credencial:</strong> {dashboard?.configured ? 'Pronta' : 'Pendente'}</p><p className="text-ink-soft">As credenciais ficam somente no servidor e nunca são enviadas ao navegador.</p></div></Panel><Panel title="Atualização automática"><div className="space-y-2 text-sm"><p>O sistema consulta o Google todos os dias automaticamente.</p><p><strong>Última execução:</strong> {last ? `${last.status === 'succeeded' ? 'concluída com sucesso' : last.status} · ${new Date(last.started_at).toLocaleString('pt-BR')}` : 'ainda não registrada'}</p>{last?.error && <p className="text-red-700">Ocorreu um problema: {last.error}</p>}</div></Panel></div> }

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><div className="mb-3"><h2 className="font-serif text-xl text-forest-900">{title}</h2>{subtitle && <p className="text-xs text-ink-soft mt-1">{subtitle}</p>}</div>{children}</section> }
function Empty({ text }: { text: string }) { return <p className="text-sm text-ink-soft py-3">{text}</p> }
function Status({ ok, label }: { ok: boolean; label: string }) { return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}{label}</span> }
function Big({ children }: { children: React.ReactNode }) { return <p className="font-serif text-3xl text-forest-900">{children}</p> }
function Small({ children }: { children: React.ReactNode }) { return <p className="text-sm text-ink-soft mt-1">{children}</p> }
