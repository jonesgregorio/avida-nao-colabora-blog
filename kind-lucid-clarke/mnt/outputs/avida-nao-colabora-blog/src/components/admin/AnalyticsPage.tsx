import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { callAI } from '../../lib/aiContent'
import AdminPerformanceEditorial from './AdminPerformanceEditorial'
import AdminSEOCockpit from './AdminSEOCockpit'
import {
  LayoutDashboard, FileText, Filter, MousePointerClick, Route, Search, AlertTriangle,
  Gauge, Flame, Monitor, Sparkles, Settings2, RefreshCw, Download, Loader2,
  Plus, Trash2, Save, ArrowRight, Check,
} from 'lucide-react'

type Period = 'today' | '7d' | '30d' | '90d'
const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: 'today', label: 'Hoje', days: 1 },
  { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '90d', label: '90 dias', days: 90 },
]

const TABS = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'pages', label: 'Páginas', icon: FileText },
  { id: 'funnel', label: 'Funil', icon: Filter },
  { id: 'events', label: 'Eventos', icon: MousePointerClick },
  { id: 'journey', label: 'Jornada', icon: Route },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'errors', label: 'Erros', icon: AlertTriangle },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'heatmap', label: 'Mapa de calor', icon: Flame },
  { id: 'devices', label: 'Dispositivos', icon: Monitor },
  { id: 'ai', label: 'Relatórios IA', icon: Sparkles },
  { id: 'settings', label: 'Configurações', icon: Settings2 },
] as const
type Tab = typeof TABS[number]['id']

interface Ev { event: string; entity_id: string | null; entity_title: string | null; session_id: string | null; user_id: string | null; user_agent: string | null; referrer: string | null; created_at: string }

function deviceOf(ua: string | null) {
  const raw = ua || ''
  if (raw.includes('|')) return raw.split('|')[0] || 'Desktop' // formato anonimizado "Dispositivo|Navegador"
  const s = raw.toLowerCase()
  if (/ipad|tablet/.test(s)) return 'Tablet'
  if (/mobi|android|iphone/.test(s)) return 'Mobile'
  return 'Desktop'
}
function browserOf(ua: string | null) {
  const s = ua || ''
  if (s.includes('|')) return s.split('|')[1] || 'Outro' // formato anonimizado
  if (/Edg\//.test(s)) return 'Edge'
  if (/Chrome\//.test(s) && !/Edg\//.test(s)) return 'Chrome'
  if (/Firefox\//.test(s)) return 'Firefox'
  if (/Safari\//.test(s) && !/Chrome/.test(s)) return 'Safari'
  return 'Outro'
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft"><p className="text-ink-soft text-sm">{text}</p></div>
}
function topCount<T>(rows: T[], keyFn: (r: T) => string | null, n = 8) {
  const m = new Map<string, number>()
  for (const r of rows) { const k = keyFn(r); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export default function AnalyticsPage({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [tab, setTab] = useState<Tab>(() => {
    try { return (localStorage.getItem('admin-analytics-tab') as Tab) || 'overview' } catch { return 'overview' }
  })
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<Ev[]>([])
  const [signups, setSignups] = useState(0)
  const [conversions, setConversions] = useState(0)
  const [readTop, setReadTop] = useState<[string, number][]>([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiSaving, setAiSaving] = useState(false)
  const [aiHistoryKey, setAiHistoryKey] = useState(0)
  const [redirectFrom, setRedirectFrom] = useState('')

  const since = useMemo(() => new Date(Date.now() - (PERIODS.find(p => p.id === period)!.days) * 86400000).toISOString(), [period])

  async function load() {
    setLoading(true)
    const [evRes, upRes, chRes, rhRes] = await Promise.all([
      supabase.from('analytics_events').select('event, entity_id, entity_title, session_id, user_id, user_agent, referrer, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20000),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('plan_change_history').select('id', { count: 'exact', head: true }).gte('created_at', since).in('change_type', ['upgrade', 'new']),
      supabase.from('reading_history').select('article_slug').gte('created_at', since).limit(20000),
    ])
    setEvents((evRes.data as Ev[]) ?? [])
    setSignups(upRes.count ?? 0)
    setConversions(chRes.count ?? 0)
    setReadTop(topCount((rhRes.data as { article_slug: string }[]) ?? [], r => r.article_slug, 5))
    setLoading(false)
  }
  useEffect(() => { load() }, [since]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(id: Tab) { setTab(id); try { localStorage.setItem('admin-analytics-tab', id) } catch { /* noop */ } }

  // ── Métricas derivadas dos eventos ──
  const m = useMemo(() => {
    const count = (e: string) => events.filter(x => x.event === e).length
    const sessions = new Set(events.map(e => e.session_id).filter(Boolean)).size
    const visitors = new Set(events.map(e => e.user_id || e.session_id).filter(Boolean)).size
    return {
      sessions, visitors,
      pageviews: count('page_view') || count('article_view'),
      articleViews: count('article_view'),
      ctaClicks: count('cta_click'),
      errors404: count('error_404'),
    }
  }, [events])

  function exportCSV() {
    const rows = [['event', 'entity', 'session', 'user', 'created_at'], ...events.slice(0, 5000).map(e => [e.event, e.entity_title ?? e.entity_id ?? '', e.session_id ?? '', e.user_id ?? '', e.created_at])]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `analytics-${period}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  async function genAIReport() {
    setAiBusy(true); setAiText('')
    try {
      const resumo = `Período: ${PERIODS.find(p => p.id === period)!.label}. Sessões: ${m.sessions}. Visitantes: ${m.visitors}. Pageviews: ${m.pageviews}. Cliques em CTA: ${m.ctaClicks}. Cadastros: ${signups}. Conversões para plano: ${conversions}. Erros 404: ${m.errors404}. Artigos mais lidos: ${readTop.map(([s, n]) => `${s} (${n})`).join(', ') || 'sem dados'}.`
      const out = await callAI(`Você é um analista de produto de um blog de saúde emocional. Com base nestes números de analytics, escreva um resumo curto e 3 a 5 recomendações práticas (melhorar CTA, atualizar artigo, criar pauta, corrigir SEO, reduzir erros). Seja específico e acionável.\n\n${resumo}`, { size: 'médio' })
      setAiText(out)
    } catch (e) { setAiText('Falha ao gerar: ' + (e instanceof Error ? e.message : String(e))) }
    setAiBusy(false)
  }

  async function saveAIReport() {
    if (!aiText) return
    setAiSaving(true)
    const periodLabel = PERIODS.find(p => p.id === period)!.label
    const { error } = await supabase.from('analytics_ai_reports').insert({
      kind: 'custom', period: periodLabel, title: `Análise · ${periodLabel} · ${new Date().toLocaleDateString('pt-BR')}`, content: aiText,
    })
    setAiSaving(false)
    if (!error) setAiHistoryKey(k => k + 1)
  }

  const card = 'bg-white border border-line rounded-2xl p-5'
  const metricCards = [
    { n: m.visitors, label: 'Visitantes' },
    { n: m.sessions, label: 'Sessões' },
    { n: m.pageviews, label: 'Pageviews' },
    { n: m.articleViews, label: 'Leituras de artigo' },
    { n: m.ctaClicks, label: 'Cliques em CTA' },
    { n: signups, label: 'Cadastros' },
    { n: conversions, label: 'Conversões p/ plano' },
    { n: m.errors404, label: 'Erros 404' },
  ]

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-forest-900">Analytics</h1>
            <p className="text-sm text-ink-soft mt-1">Acompanhe visitas, comportamento, SEO, conversões, erros e desempenho do blog.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 bg-paper-soft border border-line rounded-xl p-1">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)} className={`text-sm px-3 py-1.5 rounded-lg ${period === p.id ? 'bg-white shadow-sm text-forest-900' : 'text-ink-soft'}`}>{p.label}</button>
              ))}
            </div>
            <button onClick={load} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
            <button onClick={exportCSV} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300"><Download className="w-4 h-4" /> CSV</button>
          </div>
        </div>
      </div>

      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas do Analytics">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => switchTab(t.id)} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-forest-700 text-forest-900' : 'border-transparent text-ink-soft hover:text-forest-900 hover:border-line'}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Reaproveita Desempenho e SEO cockpit (fonte única, sem duplicar) */}
        {tab === 'pages' && <div className="-mx-6 -my-6"><AdminPerformanceEditorial onEditArticle={onEditArticle} /></div>}
        {tab === 'seo' && <div className="-mx-6 -my-6"><AdminSEOCockpit onEditArticle={onEditArticle} /></div>}

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metricCards.map(c => (
                <div key={c.label} className={card}><p className="font-serif text-3xl text-forest-900">{loading ? '—' : c.n}</p><p className="text-sm text-ink-soft mt-1">{c.label}</p></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className={card}>
                <h2 className="font-serif text-xl text-forest-900 mb-3">Top artigos lidos</h2>
                {readTop.length === 0 ? <p className="text-sm text-ink-soft">Sem leituras no período.</p> : (
                  <div className="space-y-2">{readTop.map(([slug, n]) => <div key={slug} className="flex justify-between text-sm"><span className="text-forest-900 truncate">{slug}</span><span className="text-ink-soft">{n}</span></div>)}</div>
                )}
              </div>
              <div className={card}>
                <h2 className="font-serif text-xl text-forest-900 mb-3">Eventos mais frequentes</h2>
                {events.length === 0 ? <p className="text-sm text-ink-soft">Sem eventos ainda — o rastreamento começa a preencher a partir do deploy.</p> : (
                  <div className="space-y-2">{topCount(events, e => e.event, 6).map(([ev, n]) => <div key={ev} className="flex justify-between text-sm"><span className="text-forest-900 font-mono text-xs">{ev}</span><span className="text-ink-soft">{n}</span></div>)}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'events' && (
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-3">Eventos ({PERIODS.find(p => p.id === period)!.label})</h2>
            {events.length === 0 ? <Empty text="Nenhum evento no período. Assim que o site público começar a emitir eventos, eles aparecem aqui." /> : (
              <table className="w-full text-sm"><thead className="bg-stone-50 border-b border-line"><tr><th className="text-left px-3 py-2 text-stone-500 font-medium">Evento</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Total</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Sessões</th></tr></thead>
                <tbody className="divide-y divide-stone-100">{topCount(events, e => e.event, 40).map(([ev, n]) => {
                  const sess = new Set(events.filter(e => e.event === ev).map(e => e.session_id)).size
                  return <tr key={ev}><td className="px-3 py-2 font-mono text-xs text-forest-900">{ev}</td><td className="px-3 py-2 text-right">{n}</td><td className="px-3 py-2 text-right text-ink-soft">{sess}</td></tr>
                })}</tbody></table>
            )}
          </div>
        )}

        {tab === 'devices' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={card}><h2 className="font-serif text-xl text-forest-900 mb-3">Dispositivos</h2>{events.length === 0 ? <Empty text="Sem dados ainda." /> : <div className="space-y-2">{topCount(events, e => deviceOf(e.user_agent)).map(([d, n]) => <div key={d} className="flex justify-between text-sm"><span>{d}</span><span className="text-ink-soft">{n}</span></div>)}</div>}</div>
            <div className={card}><h2 className="font-serif text-xl text-forest-900 mb-3">Navegadores</h2>{events.length === 0 ? <Empty text="Sem dados ainda." /> : <div className="space-y-2">{topCount(events, e => browserOf(e.user_agent)).map(([d, n]) => <div key={d} className="flex justify-between text-sm"><span>{d}</span><span className="text-ink-soft">{n}</span></div>)}</div>}</div>
            <div className={`${card} md:col-span-2`}><h2 className="font-serif text-xl text-forest-900 mb-3">Origem (referrer)</h2>{events.length === 0 ? <Empty text="Sem dados ainda." /> : <div className="space-y-2">{topCount(events, e => { try { return e.referrer ? new URL(e.referrer).hostname : 'direto' } catch { return 'direto' } }).map(([d, n]) => <div key={d} className="flex justify-between text-sm"><span className="truncate">{d}</span><span className="text-ink-soft">{n}</span></div>)}</div>}</div>
          </div>
        )}

        {tab === 'funnel' && (
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-4">Funil de conversão</h2>
            {(() => {
              const steps = [
                { label: 'Visitantes', n: m.visitors },
                { label: 'Leram artigo', n: new Set(events.filter(e => e.event === 'article_view').map(e => e.session_id)).size },
                { label: 'Clicaram em CTA', n: new Set(events.filter(e => e.event === 'cta_click').map(e => e.session_id)).size },
                { label: 'Criaram conta', n: signups },
                { label: 'Assinaram plano', n: conversions },
              ]
              const max = Math.max(1, steps[0].n)
              return steps.every(s => s.n === 0) ? <Empty text="Sem dados de funil ainda — depende dos eventos do site (article_view, cta_click) que começam a fluir após o deploy." /> : (
                <div className="space-y-3">{steps.map((s, i) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-forest-900">{s.label}</span><span className="text-ink-soft">{s.n}{i > 0 && steps[i - 1].n > 0 ? ` · ${Math.round((s.n / steps[i - 1].n) * 100)}%` : ''}</span></div>
                    <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-forest-500" style={{ width: `${(s.n / max) * 100}%` }} /></div>
                  </div>
                ))}</div>
              )
            })()}
          </div>
        )}

        {tab === 'heatmap' && (
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-3">Elementos mais clicados</h2>
            {(() => {
              const clicks = events.filter(e => e.event === 'cta_click' || e.event === 'article_click')
              return clicks.length === 0 ? <Empty text="Mapa de calor por cliques — preenche conforme o site emite cta_click/article_click. Versão visual com coordenadas fica para a próxima fase." /> : (
                <div className="space-y-2">{topCount(clicks, e => e.entity_title || e.entity_id, 20).map(([el, n]) => <div key={el} className="flex justify-between text-sm"><span className="truncate">{el}</span><span className="text-ink-soft">{n}</span></div>)}</div>
              )
            })()}
          </div>
        )}

        {tab === 'errors' && (
          <div className="space-y-5">
            <div className={card}>
              <h2 className="font-serif text-xl text-forest-900 mb-3">Erros 404 ({PERIODS.find(p => p.id === period)!.label})</h2>
              {(() => {
                const errs = events.filter(e => e.event === 'error_404')
                const top = topCount(errs, e => e.entity_id, 30)
                return top.length === 0 ? <Empty text="Sem erros 404 no período — o site registra error_404 automaticamente quando alguém acessa um artigo inexistente." /> : (
                  <table className="w-full text-sm"><thead className="bg-stone-50 border-b border-line"><tr><th className="text-left px-3 py-2 text-stone-500 font-medium">URL</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Ocorrências</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Ação</th></tr></thead>
                    <tbody className="divide-y divide-stone-100">{top.map(([u, n]) => (
                      <tr key={u}><td className="px-3 py-2 font-mono text-xs">{u}</td><td className="px-3 py-2 text-right">{n}</td>
                        <td className="px-3 py-2 text-right"><button onClick={() => setRedirectFrom(u)} className="text-xs text-forest-700 hover:underline">Criar redirect</button></td></tr>
                    ))}</tbody></table>
                )
              })()}
            </div>
            <RedirectsManager prefillFrom={redirectFrom} onConsumePrefill={() => setRedirectFrom('')} />
          </div>
        )}

        {tab === 'performance' && (
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-3">Core Web Vitals</h2>
            {(() => {
              const vitals = events.filter(e => e.event === 'web_vital')
              return vitals.length === 0 ? <Empty text="Métricas de performance (LCP, CLS, INP, FCP, TTFB) — o site coleta e envia como web_vital após o deploy. Aparecem aqui assim que houver amostras." /> : (
                <div className="space-y-2">{topCount(vitals, e => (e.entity_id || 'métrica')).map(([mt, n]) => <div key={mt} className="flex justify-between text-sm"><span className="font-mono text-xs">{mt}</span><span className="text-ink-soft">{n} amostras</span></div>)}</div>
              )
            })()}
          </div>
        )}

        {tab === 'journey' && (
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-3">Jornadas recentes (anonimizadas)</h2>
            <p className="text-xs text-ink-soft mb-3">Comportamento por sessão — sem conteúdo do diário, respostas ou dados sensíveis (LGPD).</p>
            {(() => {
              const bySession = new Map<string, Ev[]>()
              for (const e of events) { if (!e.session_id) continue; if (!bySession.has(e.session_id)) bySession.set(e.session_id, []); bySession.get(e.session_id)!.push(e) }
              const sessions = [...bySession.entries()].slice(0, 15)
              return sessions.length === 0 ? <Empty text="Sem sessões no período ainda." /> : (
                <div className="space-y-3">{sessions.map(([sid, evs]) => (
                  <div key={sid} className="border border-line rounded-xl p-3">
                    <p className="text-xs text-stone-400">Sessão {sid.slice(0, 8)} · {deviceOf(evs[0].user_agent)} · {browserOf(evs[0].user_agent)}</p>
                    <p className="text-sm text-forest-900 mt-1">{evs.slice(0, 8).map(e => e.event).reverse().join(' → ')}</p>
                  </div>
                ))}</div>
              )
            })()}
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-4">
            <div className={card}>
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h2 className="font-serif text-xl text-forest-900">Relatório com IA</h2>
                <div className="flex gap-2">
                  {aiText && !aiBusy && <button onClick={saveAIReport} disabled={aiSaving} className="inline-flex items-center gap-2 border border-line bg-white text-forest-800 px-4 py-2 rounded-xl text-sm font-medium hover:border-forest-300 disabled:opacity-50">{aiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</button>}
                  <button onClick={genAIReport} disabled={aiBusy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar análise do período</button>
                </div>
              </div>
              <p className="text-xs text-ink-soft mb-3">A IA analisa os números reais do período (visitas, CTA, cadastros, conversões, 404, artigos lidos) e sugere ações.</p>
              {aiText ? <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-paper-soft border border-line rounded-xl p-4">{aiText}</div> : <Empty text="Clique em “Gerar análise do período” para receber um resumo + recomendações acionáveis." />}
            </div>
            <AiReportsHistory reload={aiHistoryKey} />
          </div>
        )}

        {tab === 'settings' && <AnalyticsSettingsPanel />}
      </div>
    </div>
  )
}

// ─── Gestão de redirecionamentos (Erros → 404) ──────────────────────────────
interface Redirect { id: string; from_path: string; to_path: string; type: number; is_active: boolean; hits: number; created_at: string }
function RedirectsManager({ prefillFrom, onConsumePrefill }: { prefillFrom: string; onConsumePrefill: () => void }) {
  const [rows, setRows] = useState<Redirect[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState(301)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.from('analytics_redirects').select('*').order('created_at', { ascending: false })
    setRows((data as Redirect[]) ?? [])
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (prefillFrom) { setFrom(prefillFrom); onConsumePrefill() } }, [prefillFrom]) // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!from.trim() || !to.trim()) { setErr('Preencha origem e destino.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('analytics_redirects').upsert(
      { from_path: from.trim(), to_path: to.trim(), type }, { onConflict: 'from_path' })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setFrom(''); setTo(''); setType(301); load()
  }
  async function toggle(r: Redirect) { await supabase.from('analytics_redirects').update({ is_active: !r.is_active }).eq('id', r.id); load() }
  async function del(r: Redirect) { await supabase.from('analytics_redirects').delete().eq('id', r.id); load() }

  const inp = 'border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-forest-400'
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <h2 className="font-serif text-xl text-forest-900 mb-1">Redirecionamentos</h2>
      <p className="text-xs text-ink-soft mb-4">Uma URL antiga (ex.: <code>/blog/slug-velho</code>) é reenviada para a nova. O site aplica automaticamente ao detectar o 404.</p>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="flex-1 min-w-[180px]"><label className="block text-xs text-ink-soft mb-1">De (origem)</label><input value={from} onChange={e => setFrom(e.target.value)} placeholder="/blog/slug-antigo" className={`${inp} w-full`} /></div>
        <ArrowRight className="w-4 h-4 text-stone-300 mb-3" />
        <div className="flex-1 min-w-[180px]"><label className="block text-xs text-ink-soft mb-1">Para (destino)</label><input value={to} onChange={e => setTo(e.target.value)} placeholder="/blog/slug-novo" className={`${inp} w-full`} /></div>
        <div><label className="block text-xs text-ink-soft mb-1">Tipo</label><select value={type} onChange={e => setType(Number(e.target.value))} className={inp}><option value={301}>301 permanente</option><option value={302}>302 temporário</option></select></div>
        <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar</button>
      </div>
      {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
      {rows.length === 0 ? <Empty text="Nenhum redirecionamento cadastrado." /> : (
        <table className="w-full text-sm"><thead className="bg-stone-50 border-b border-line"><tr><th className="text-left px-3 py-2 text-stone-500 font-medium">De → Para</th><th className="px-3 py-2 text-stone-500 font-medium">Tipo</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Hits</th><th className="px-3 py-2 text-stone-500 font-medium">Ativo</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-stone-100">{rows.map(r => (
            <tr key={r.id}>
              <td className="px-3 py-2 font-mono text-xs text-forest-900"><span className="text-stone-500">{r.from_path}</span> → {r.to_path}</td>
              <td className="px-3 py-2 text-center text-xs">{r.type}</td>
              <td className="px-3 py-2 text-right">{r.hits}</td>
              <td className="px-3 py-2 text-center"><button onClick={() => toggle(r)} className={`text-xs px-2 py-1 rounded-lg ${r.is_active ? 'bg-mint text-forest-700' : 'bg-stone-100 text-stone-400'}`}>{r.is_active ? 'ativo' : 'inativo'}</button></td>
              <td className="px-3 py-2 text-right"><button onClick={() => del(r)} className="text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
            </tr>
          ))}</tbody></table>
      )}
    </div>
  )
}

// ─── Histórico de relatórios de IA ──────────────────────────────────────────
interface AiReport { id: string; title: string | null; period: string | null; content: string; created_at: string }
function AiReportsHistory({ reload }: { reload: number }) {
  const [rows, setRows] = useState<AiReport[]>([])
  const [open, setOpen] = useState<string | null>(null)
  async function load() { const { data } = await supabase.from('analytics_ai_reports').select('id, title, period, content, created_at').order('created_at', { ascending: false }).limit(30); setRows((data as AiReport[]) ?? []) }
  useEffect(() => { load() }, [reload])
  async function del(id: string) { await supabase.from('analytics_ai_reports').delete().eq('id', id); load() }
  if (rows.length === 0) return null
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <h2 className="font-serif text-xl text-forest-900 mb-3">Relatórios salvos</h2>
      <div className="space-y-2">{rows.map(r => (
        <div key={r.id} className="border border-line rounded-xl">
          <div className="flex items-center justify-between px-3 py-2">
            <button onClick={() => setOpen(open === r.id ? null : r.id)} className="text-left flex-1"><span className="text-sm text-forest-900">{r.title || 'Relatório'}</span> <span className="text-xs text-stone-400">· {r.period} · {new Date(r.created_at).toLocaleDateString('pt-BR')}</span></button>
            <button onClick={() => del(r.id)} className="text-stone-400 hover:text-red-600 ml-2"><Trash2 className="w-4 h-4" /></button>
          </div>
          {open === r.id && <div className="px-3 pb-3 text-sm text-ink whitespace-pre-wrap leading-relaxed border-t border-line pt-3">{r.content}</div>}
        </div>
      ))}</div>
    </div>
  )
}

// ─── Configurações & eventos personalizados ─────────────────────────────────
type SettingsConfig = { track_pageviews: boolean; track_scroll: boolean; track_cta: boolean; track_errors: boolean; track_web_vitals: boolean; anonymize: boolean; retention_days: number }
const DEFAULT_CFG: SettingsConfig = { track_pageviews: true, track_scroll: true, track_cta: true, track_errors: true, track_web_vitals: true, anonymize: true, retention_days: 365 }
const TOGGLES: { key: keyof SettingsConfig; label: string; hint: string }[] = [
  { key: 'track_pageviews', label: 'Visualizações de página', hint: 'page_view a cada navegação' },
  { key: 'track_scroll', label: 'Profundidade de leitura', hint: 'scroll_50 / 75 / 100 nos artigos' },
  { key: 'track_cta', label: 'Cliques em CTA', hint: 'botões marcados com data-cta' },
  { key: 'track_errors', label: 'Erros 404', hint: 'artigos inexistentes' },
  { key: 'track_web_vitals', label: 'Core Web Vitals', hint: 'LCP, CLS, FCP, TTFB' },
  { key: 'anonymize', label: 'Anonimizar visitante', hint: 'sem IP, sessão aleatória (LGPD)' },
]
interface CustomEvent { id: string; name: string; description: string | null; selector: string | null; url_pattern: string | null; is_active: boolean }
function AnalyticsSettingsPanel() {
  const [cfg, setCfg] = useState<SettingsConfig>(DEFAULT_CFG)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ces, setCes] = useState<CustomEvent[]>([])
  const [nName, setNName] = useState(''); const [nSel, setNSel] = useState(''); const [nUrl, setNUrl] = useState('')

  async function load() {
    const [sRes, cRes] = await Promise.all([
      supabase.from('analytics_settings').select('config').eq('id', 1).maybeSingle(),
      supabase.from('analytics_custom_events').select('*').order('created_at', { ascending: false }),
    ])
    if (sRes.data?.config) setCfg({ ...DEFAULT_CFG, ...(sRes.data.config as Partial<SettingsConfig>) })
    setCes((cRes.data as CustomEvent[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true); setSaved(false)
    await supabase.from('analytics_settings').upsert({ id: 1, config: cfg, updated_at: new Date().toISOString() })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }
  async function addCE() {
    if (!nName.trim()) return
    await supabase.from('analytics_custom_events').insert({ name: nName.trim(), selector: nSel.trim() || null, url_pattern: nUrl.trim() || null })
    setNName(''); setNSel(''); setNUrl(''); load()
  }
  async function toggleCE(c: CustomEvent) { await supabase.from('analytics_custom_events').update({ is_active: !c.is_active }).eq('id', c.id); load() }
  async function delCE(c: CustomEvent) { await supabase.from('analytics_custom_events').delete().eq('id', c.id); load() }

  const card = 'bg-white border border-line rounded-2xl p-5'
  const inp = 'border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-forest-400'
  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-serif text-xl text-forest-900">Rastreamento</h2>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Salvo' : 'Salvar'}</button>
        </div>
        <div className="space-y-1">{TOGGLES.map(t => (
          <label key={t.key} className="flex items-center justify-between py-2.5 border-b border-line last:border-0 cursor-pointer">
            <span><span className="text-sm text-forest-900">{t.label}</span><span className="block text-xs text-ink-soft">{t.hint}</span></span>
            <button type="button" onClick={() => setCfg(c => ({ ...c, [t.key]: !c[t.key] }))} className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${cfg[t.key] ? 'bg-forest-600' : 'bg-stone-300'}`}><span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${cfg[t.key] ? 'left-[22px]' : 'left-0.5'}`} /></button>
          </label>
        ))}
          <label className="flex items-center justify-between py-2.5 cursor-pointer">
            <span><span className="text-sm text-forest-900">Retenção dos dados</span><span className="block text-xs text-ink-soft">dias antes de expurgar eventos antigos</span></span>
            <input type="number" min={30} max={1095} value={cfg.retention_days} onChange={e => setCfg(c => ({ ...c, retention_days: Number(e.target.value) }))} className={`${inp} w-24 text-right`} />
          </label>
        </div>
      </div>

      <div className={card}>
        <h2 className="font-serif text-xl text-forest-900 mb-1">Eventos personalizados</h2>
        <p className="text-xs text-ink-soft mb-4">Defina eventos extras a acompanhar (por seletor CSS e/ou padrão de URL). Ficam registrados aqui para orientar a instrumentação.</p>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-[140px]"><label className="block text-xs text-ink-soft mb-1">Nome</label><input value={nName} onChange={e => setNName(e.target.value)} placeholder="ex.: clique_whatsapp" className={`${inp} w-full`} /></div>
          <div className="flex-1 min-w-[140px]"><label className="block text-xs text-ink-soft mb-1">Seletor CSS</label><input value={nSel} onChange={e => setNSel(e.target.value)} placeholder="[data-cta='whatsapp']" className={`${inp} w-full`} /></div>
          <div className="flex-1 min-w-[140px]"><label className="block text-xs text-ink-soft mb-1">Padrão de URL</label><input value={nUrl} onChange={e => setNUrl(e.target.value)} placeholder="/contato" className={`${inp} w-full`} /></div>
          <button onClick={addCE} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800"><Plus className="w-4 h-4" /> Adicionar</button>
        </div>
        {ces.length === 0 ? <Empty text="Nenhum evento personalizado ainda." /> : (
          <div className="space-y-2">{ces.map(c => (
            <div key={c.id} className="flex items-center justify-between border border-line rounded-xl px-3 py-2">
              <div><span className="text-sm text-forest-900 font-mono text-xs">{c.name}</span>{(c.selector || c.url_pattern) && <span className="block text-xs text-ink-soft">{c.selector} {c.url_pattern && `· ${c.url_pattern}`}</span>}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleCE(c)} className={`text-xs px-2 py-1 rounded-lg ${c.is_active ? 'bg-mint text-forest-700' : 'bg-stone-100 text-stone-400'}`}>{c.is_active ? 'ativo' : 'inativo'}</button>
                <button onClick={() => delCE(c)} className="text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}</div>
        )}
      </div>

      <div className={card}>
        <h2 className="font-serif text-xl text-forest-900 mb-3">Privacidade & LGPD</h2>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> Sem IP completo — visitante anonimizado por sessão.</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> Não registra conteúdo de diário, check-in ou respostas sensíveis.</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> Dados de Analytics só o admin acessa (RLS).</li>
        </ul>
      </div>
    </div>
  )
}
