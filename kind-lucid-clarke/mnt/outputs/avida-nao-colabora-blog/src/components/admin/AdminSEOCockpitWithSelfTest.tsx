import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, Loader2, Search, ShieldCheck, Sparkles, WandSparkles, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { collectAllPages } from '../../lib/supabasePagination'
import { smartFixArticle, type SeoSmartArticle, type SeoSmartIssue } from '../../lib/seoSmartCorrector'
import AdminSEOCockpit from './AdminSEOCockpit'

type Row = SeoSmartArticle
type Issue = 'no_seo' | 'no_image' | 'bad_slug' | 'thin' | 'no_author' | 'no_links'
type Inspection = { url: string; verdict?: string | null; coverage_state?: string | null; last_inspected_at?: string }
type Sitemap = { errors: number; warnings: number }
type Dashboard = { configured: boolean; inspections: Inspection[]; sitemaps: Sitemap[]; alerts?: { severity?: string }[]; error?: string }
type PublicAudit = { generatedAt: string; checked: string[]; unavailable: string[]; scope: string; issues: { path: string; code: string; severity: string; detail: string }[] }
type SelfTestCheck = { key: string; label: string; ok: boolean; detail: string; duration_ms: number }
type SelfTestRun = { id: string; source: 'manual' | 'scheduled'; status: 'passed' | 'warning' | 'failed'; passed: number; total: number; checks: SelfTestCheck[]; created_at: string }
type FixStatus = 'fixed' | 'unchanged' | 'approval' | 'google' | 'failed'
type FixItem = { id: string; title: string; issue: string; status: FixStatus; detail: string; changed?: string[]; pending?: string[] }
type FixReport = { createdAt: string; items: FixItem[]; sitemap: 'sent' | 'failed' | 'not-needed'; googleSync: 'done' | 'failed' | 'not-needed' }

const articleSelect = 'id,title,slug,status,published,category,seo_title,seo_description,image_url,cover_image,cover_image_url,image_alt,keyword,content,author,related_slugs,reviewed_at,review_notes,published_at,updated_at,created_at'
const seoOk = (a: Row) => !!(a.seo_title && a.seo_title.trim().length >= 25 && a.seo_title.trim().length <= 60 && a.seo_description && a.seo_description.trim().length >= 90 && a.seo_description.trim().length <= 155 && a.keyword)
const imgOk = (a: Row) => !!((a.image_url || a.cover_image || a.cover_image_url) && a.image_alt?.trim())
const badSlug = (s: string) => !s || /[^a-z0-9-]/.test(s) || s.length > 60 || s.includes('--')
const wordCount = (content: string | null) => String(content || '').trim().split(/\s+/).filter(Boolean).length
const ISSUE_LABEL: Record<Issue, string> = { no_seo: 'Dados de SEO', no_image: 'Imagem e descrição', bad_slug: 'Endereço da página', thin: 'Conteúdo curto', no_author: 'Autoria', no_links: 'Links internos' }
const ISSUE_ORDER: Issue[] = ['no_seo', 'no_image', 'bad_slug', 'thin', 'no_author', 'no_links']
function hasIssue(a: Row, issue: Issue) {
  if (issue === 'no_seo') return !seoOk(a)
  if (issue === 'no_image') return !imgOk(a)
  if (issue === 'bad_slug') return badSlug(a.slug)
  if (issue === 'thin') return wordCount(a.content) < 800
  if (issue === 'no_author') return !a.author?.trim()
  return !a.related_slugs?.length && !/\]\(\/blog\//.test(a.content || '')
}
function issuesOf(a: Row) { return ISSUE_ORDER.filter(issue => hasIssue(a, issue)) }

export default function AdminSEOCockpitWithSelfTest({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [progress, setProgress] = useState('')
  const [fixReport, setFixReport] = useState<FixReport | null>(null)
  const [latest, setLatest] = useState<SelfTestRun | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [publicAudit, setPublicAudit] = useState<PublicAudit | null>(null)
  const [auditError, setAuditError] = useState('')
  const [auditBusy, setAuditBusy] = useState(false)
  const auditPublic = useCallback(async () => {
    setAuditBusy(true); setAuditError('')
    try {
      const response = await fetch('/api/seo-audit', { signal: AbortSignal.timeout(25000) })
      if (!response.ok) throw new Error(`Auditoria pública respondeu HTTP ${response.status}`)
      const result = await response.json() as PublicAudit
      if (!Array.isArray(result.checked) || !Array.isArray(result.issues) || !Array.isArray(result.unavailable) || !result.generatedAt) throw new Error('Resposta inválida da auditoria pública.')
      setPublicAudit(result)
    } catch (err) { setPublicAudit(null); setAuditError(err instanceof Error ? err.message : 'Auditoria pública indisponível.') }
    finally { setAuditBusy(false) }
  }, [])

  const load = useCallback(async (sync = false) => {
    setLoading(true); setError('')
    try {
      const [articleResult, googleResult] = await Promise.all([
        collectAllPages<Row>((from, to) => supabase.from('articles').select(articleSelect).order('created_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message?: string } | null }>),
        supabase.functions.invoke('google-search-console', { body: { action: sync ? 'sync' : 'dashboard', source: sync ? 'manual' : undefined } }),
      ])
      if (articleResult.error) throw new Error(articleResult.error.message || 'Não foi possível carregar os artigos.')
      if (googleResult.error) throw googleResult.error
      if (googleResult.data?.error || googleResult.data?.dashboard?.error) throw new Error(googleResult.data.error || googleResult.data.dashboard.error)
      setRows(articleResult.data)
      setDashboard((googleResult.data?.dashboard || googleResult.data) as Dashboard)
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar os dados.'); throw err }
    finally { setLoading(false) }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('seo-control-selftest', { body: { history: true } })
      setLatest((data?.history?.[0] || null) as SelfTestRun | null)
    } catch { /* diagnóstico técnico não bloqueia a tela principal */ }
  }, [])

  useEffect(() => { void Promise.allSettled([load(false), loadHistory(), auditPublic()]) }, [load, loadHistory, auditPublic])

  const published = useMemo(() => rows.filter(a => a.published === true || a.status === 'published'), [rows])
  const targets = useMemo(() => published.map(article => ({ article, issues: issuesOf(article) })).filter(item => item.issues.length), [published])
  const autoCount = targets.reduce((sum, item) => sum + item.issues.length, 0)
  const inspected = dashboard?.inspections?.length || 0
  const indexed = dashboard?.inspections?.filter(i => i.verdict === 'PASS').length || 0
  const waitingGoogle = dashboard?.inspections?.filter(i => /discovered|crawled|detectada|rastreada/i.test(i.coverage_state || '') && i.verdict !== 'PASS').length || 0
  const sitemapErrors = dashboard?.sitemaps?.reduce((sum, s) => sum + Number(s.errors || 0), 0) || 0
  const critical = sitemapErrors + (dashboard?.alerts?.filter(a => a.severity === 'critical').length || 0) + (publicAudit?.issues.filter(i => i.severity === 'critical').length || 0) + (latest?.status === 'failed' ? 1 : 0)

  async function analyze() { setAnalyzing(true); setFixReport(null); try { await Promise.all([load(true), auditPublic()]) } catch { /* erro apresentado por load */ } finally { setAnalyzing(false) } }

  async function correct() {
    if (!targets.length) { await auditPublic(); setFixReport({ createdAt: new Date().toISOString(), items: [], sitemap: 'not-needed', googleSync: 'not-needed' }); return }
    setFixing(true); setError(''); setFixReport(null)
    const items: FixItem[] = []
    for (let i = 0; i < targets.length; i++) {
      const { article, issues } = targets[i]
      setProgress(`Validando e corrigindo ${i + 1} de ${targets.length}: ${article.title}`)
      try {
        const result = await smartFixArticle(article, published, issues as SeoSmartIssue[])
        const changed = result.changed || []
        const pending = result.skipped || []
        if (changed.length) {
          const saved = await supabase.from('articles').select(articleSelect).eq('id', article.id).single()
          if (saved.error || !saved.data) throw new Error('Alteração enviada, mas não foi possível confirmar o artigo salvo.')
          const remaining = issues.filter(issue => hasIssue(saved.data as Row, issue))
          pending.push(...remaining.map(issue => `${ISSUE_LABEL[issue]} ainda não passou na validação após salvar.`))
        }
        items.push({ id: article.id, title: article.title, issue: issues.map(i => ISSUE_LABEL[i]).join(', '), status: pending.length ? 'approval' : changed.length ? 'fixed' : 'unchanged', detail: changed.length ? 'A alteração foi salva e o artigo foi relido. Confira abaixo os itens que ainda precisam de revisão.' : pending.length ? 'O sistema não fez uma alteração insegura ou incerta automaticamente.' : 'Após a validação, nenhuma mudança era necessária.', changed, pending })
      } catch (err) {
        items.push({ id: article.id, title: article.title, issue: issues.map(i => ISSUE_LABEL[i]).join(', '), status: 'failed', detail: err instanceof Error ? err.message : 'A correção falhou e nenhuma conclusão foi presumida.' })
      }
    }
    let sitemap: FixReport['sitemap'] = 'not-needed'
    let googleSync: FixReport['googleSync'] = 'not-needed'
    if (items.some(i => i.changed?.length)) {
      setProgress('Reenviando o mapa de páginas e validando os dados mais recentes…')
      try { const result = await supabase.functions.invoke('seo-smart-google-actions', { body: { action: 'submit_sitemap' } }); if (result.error || result.data?.error) throw new Error(result.data?.error || result.error?.message); sitemap = 'sent' } catch { sitemap = 'failed' }
      try { await load(true); googleSync = 'done' } catch { googleSync = 'failed' }
    }
    setFixReport({ createdAt: new Date().toISOString(), items, sitemap, googleSync })
    await auditPublic()
    setProgress(''); setFixing(false)
  }

  async function runNow() {
    setRunning(true)
    try { const { data, error: e } = await supabase.functions.invoke('seo-control-selftest', { body: { source: 'manual' } }); if (e) throw e; setLatest(data?.result as SelfTestRun) }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível executar o autoteste.') }
    finally { setRunning(false) }
  }

  const allOk = latest?.passed === latest?.total && latest?.total === 12
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
    <header className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">Admin · Crescimento orgânico</p>
      <h1 className="mt-1 font-serif text-3xl text-forest-900 sm:text-4xl">SEO Control Center</h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-soft">Veja em poucos segundos o que está certo, o que o site consegue corrigir e o que depende do Google.</p>
    </header>

    <section className="mb-5 rounded-2xl border border-forest-200 bg-[#fbfcf8] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest-600">Resumo simples</p><h2 className="mt-1 font-serif text-2xl text-forest-900">Como está o SEO agora?</h2></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void analyze()} disabled={loading || analyzing || fixing} className="inline-flex items-center gap-2 rounded-xl border border-forest-300 bg-mint px-4 py-2.5 text-sm font-medium text-forest-900 disabled:opacity-50">{analyzing || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 1. Atualizar e analisar</button>
          <button onClick={() => void correct()} disabled={loading || fixing || !published.length} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{fixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />} 2. Corrigir {autoCount ? `${autoCount} ponto${autoCount === 1 ? '' : 's'}` : 'o que for possível'}</button>
        </div>
      </div>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {progress && <div className="mt-4 rounded-xl border border-forest-200 bg-mint px-4 py-3 text-sm text-forest-900"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{progress}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="No Google" value={dashboard && !error ? `${indexed}/${inspected}` : 'Não verificado'} note="inspeções disponíveis; não é todo o sitemap" tone="wait" />
        <Stat label="Aguardando Google" value={String(waitingGoogle)} note="não é erro automaticamente" tone="wait" />
        <Stat label="Correções automáticas" value={error || !dashboard ? 'Não verificado' : String(autoCount)} note="pontos que o site pode tratar" tone={autoCount ? 'attention' : 'ok'} />
        <Stat label="Erros críticos" value={publicAudit && !publicAudit.unavailable.length && !error ? String(critical) : 'Incompleto'} note="sitemap, alertas, autoteste e HTML público" tone={critical ? 'danger' : 'wait'} />
        <Stat label="Mapa de páginas" value={!dashboard?.sitemaps?.length || error ? 'Não verificado' : sitemapErrors ? 'Atenção' : 'Sem erros registrados'} note="resultado disponível do Google" tone={sitemapErrors ? 'danger' : 'wait'} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <SimpleBox title="O que precisa de ação" icon={<AlertTriangle className="h-4 w-4" />} text={`Há ${autoCount} ajuste(s) automático(s) de artigos e ${publicAudit?.issues.length || 0} achado(s) técnico(s) na amostra. Zero ajustes automáticos não significa ausência de problemas.`} />
        <SimpleBox title="O que depende do Google" icon={<Clock3 className="h-4 w-4" />} text={`${waitingGoogle} página(s) detectada(s) ou rastreada(s), ainda sem indexação. Demais resultados sem PASS precisam ser avaliados nos detalhes; não são classificados automaticamente como espera.`} />
        <SimpleBox title="O que está bem" icon={<CheckCircle2 className="h-4 w-4" />} text={error || !publicAudit || publicAudit.unavailable.length ? 'Verificação incompleta. Consulte as falhas e a cobertura antes de concluir.' : !critical ? 'Sem erros críticos nos testes disponíveis. Isso não aprova itens fora da cobertura.' : 'Há problemas confirmados. Veja os achados técnicos antes de outras melhorias.'} />
      </div>
    </section>

    <section className="mb-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <h2 className="font-serif text-2xl text-forest-900">Auditoria do site publicado</h2>
      <p className="mt-2 text-sm text-ink-soft">{auditBusy ? 'Verificando respostas HTTP e HTML público…' : publicAudit ? `${publicAudit.checked.length}/15 URLs verificadas em ${new Date(publicAudit.generatedAt).toLocaleString('pt-BR')}. ${publicAudit.scope}` : 'Não verificado. Nenhuma aprovação técnica pode ser presumida.'}</p>
      {publicAudit && Date.now() - new Date(publicAudit.generatedAt).getTime() > 3600000 && <p className="mt-2 text-sm text-amber-800">Dados desatualizados: execute Atualizar e analisar novamente.</p>}
      {auditError && <p className="mt-2 text-sm text-red-800">{auditError}</p>}
      {publicAudit?.unavailable.length ? <p className="mt-2 text-sm text-amber-800">Não verificado por falha de acesso: {publicAudit.unavailable.join(', ')}</p> : null}
      {publicAudit?.issues.map(i => <div key={`${i.path}-${i.code}`} className="mt-3 rounded-xl border border-amber-200 p-3 text-sm"><p className="font-semibold">{i.severity === 'critical' ? 'Crítico' : 'Melhoria confirmada'} · {i.path}</p><p>{i.detail}</p><p className="text-xs text-ink-soft">Requer ajuste no código e validação pública; o corretor de artigos não resolve este item.</p></div>)}
      {publicAudit && !publicAudit.issues.length && !publicAudit.unavailable.length && <p className="mt-3 text-sm">Aprovado nos testes executados nesta amostra. Demais páginas, desempenho e dimensões reais das imagens: não verificados.</p>}
    </section>

    {fixReport && <CorrectionReport report={fixReport} />}

    <details className="mb-5 rounded-2xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-semibold text-forest-900">Ver detalhes técnicos e ferramentas avançadas <ChevronDown className="h-4 w-4" /></summary>
      <div className="border-t border-line">
        <section className="p-4 sm:p-5">
          <div className={`rounded-2xl border p-4 ${allOk ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest-600">Autoteste técnico</p><h3 className="mt-1 font-serif text-xl text-forest-900">{latest ? `${latest.passed}/${latest.total} testes aprovados` : 'Ainda sem execução registrada'}</h3><p className="mt-1 text-xs text-ink-soft">Verifica Google, sitemap, inspeção, robots, banco, IA, redirects e automação sem editar artigos.</p></div><button onClick={() => void runNow()} disabled={running} className="inline-flex items-center gap-2 rounded-xl border border-forest-300 bg-white px-3 py-2 text-xs text-forest-900 disabled:opacity-50">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Executar autoteste</button></div>
          </div>
        </section>
        <div className="seo-advanced-embedded">
          <AdminSEOCockpit onEditArticle={onEditArticle} />
        </div>
        <style>{`
          .seo-advanced-embedded > div { max-width: none; padding: 0 1rem 1rem; }
          .seo-advanced-embedded > div > *:has(~ [role="tablist"]) { display: none; }
          .seo-advanced-embedded [role="tablist"] { flex-wrap: wrap; overflow-x: visible; padding-bottom: 0; }
          .seo-advanced-embedded [role="tablist"] + * { margin-top: .5rem; }
          @media (max-width: 640px) {
            .seo-advanced-embedded > div { padding-left: .75rem; padding-right: .75rem; }
            .seo-advanced-embedded [role="tablist"] { gap: .375rem; }
          }
        `}</style>
      </div>
    </details>
  </div>
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'ok' | 'wait' | 'attention' | 'danger' }) {
  const cls = tone === 'danger' ? 'border-red-200 bg-red-50' : tone === 'attention' ? 'border-amber-200 bg-amber-50' : tone === 'wait' ? 'border-sky-200 bg-sky-50' : 'border-emerald-200 bg-emerald-50/60'
  return <div className={`rounded-xl border p-4 ${cls}`}><p className="text-xs text-ink-soft">{label}</p><p className="mt-1 font-serif text-3xl text-forest-900">{value}</p><p className="mt-1 text-[11px] text-ink-soft">{note}</p></div>
}
function SimpleBox({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) { return <div className="rounded-xl border border-line bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold text-forest-900">{icon}{title}</div><p className="mt-2 text-xs leading-relaxed text-ink-soft">{text}</p></div> }
function CorrectionReport({ report }: { report: FixReport }) {
  const fixed = report.items.filter(i => i.status === 'fixed').length
  const failed = report.items.filter(i => i.status === 'failed').length
  const approval = report.items.filter(i => i.status === 'approval').length
  const unchanged = report.items.filter(i => i.status === 'unchanged').length
  const icon = (s: FixStatus) => s === 'fixed' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : s === 'failed' ? <XCircle className="h-4 w-4 text-red-600" /> : s === 'approval' ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <Search className="h-4 w-4 text-sky-600" />
  const label = (s: FixStatus) => s === 'fixed' ? 'Corrigido' : s === 'failed' ? 'Não corrigido' : s === 'approval' ? 'Precisa de revisão' : s === 'google' ? 'Aguardando Google' : 'Nenhuma mudança necessária'
  return <section className="mb-5 rounded-2xl border border-forest-200 bg-white p-4 sm:p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest-600">Relatório da correção</p>
    <h2 className="mt-1 font-serif text-2xl text-forest-900">O que foi feito e o que ficou pendente</h2>
    <p className="mt-1 text-xs text-ink-soft">Executado em {new Date(report.createdAt).toLocaleString('pt-BR')}. O sistema só marca como corrigido quando uma alteração foi realmente salva.</p>
    <div className="mt-4 flex flex-wrap gap-2 text-xs"><Badge text={`${fixed} corrigido(s)`} /><Badge text={`${approval} precisa(m) de revisão`} /><Badge text={`${failed} falhou(aram)`} /><Badge text={`${unchanged} sem mudança necessária`} /></div>
    {!report.items.length ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Não havia problemas automáticos para corrigir.</div> : <div className="mt-4 space-y-2">{report.items.map(item => <div key={`${item.id}-${item.issue}`} className="rounded-xl border border-line p-3"><div className="flex items-start gap-2"><div className="mt-0.5">{icon(item.status)}</div><div className="min-w-0"><p className="text-sm font-semibold text-forest-900">{item.title}</p><p className="text-[11px] font-medium text-ink-soft">{label(item.status)} · {item.issue}</p><p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.detail}</p>{item.changed?.length ? <p className="mt-1 text-xs text-emerald-800"><strong>Alterado:</strong> {item.changed.join(', ')}</p> : null}{item.pending?.length ? <p className="mt-1 text-xs text-amber-800"><strong>Pendente:</strong> {item.pending.join(' | ')}</p> : null}</div></div></div>)}</div>}
    <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-ink-soft"><strong>Sitemap:</strong> {report.sitemap === 'sent' ? 'reenviado ao Google' : report.sitemap === 'failed' ? 'tentativa falhou; permanece pendente' : 'não precisou ser reenviado'}</div><div className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-ink-soft"><strong>Atualização dos dados Google:</strong> {report.googleSync === 'done' ? 'dados atualizados novamente após as correções' : report.googleSync === 'failed' ? 'não foi possível atualizar os dados do Google agora' : 'não foi necessária'}</div></div>
  </section>
}
function Badge({ text }: { text: string }) { return <span className="rounded-full border border-line bg-stone-50 px-3 py-1.5 text-ink-soft">{text}</span> }
