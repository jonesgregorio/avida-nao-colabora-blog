import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { callAI } from '../../lib/aiContent'
import AdminPerformanceEditorial from './AdminPerformanceEditorial'
import AdminSEOCockpit from './AdminSEOCockpit'
import {
  LayoutDashboard, FileText, Filter, MousePointerClick, Route, Search, AlertTriangle,
  Gauge, Flame, Monitor, Sparkles, Settings2, RefreshCw, Download, Loader2,
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
  const s = (ua || '').toLowerCase()
  if (/ipad|tablet/.test(s)) return 'Tablet'
  if (/mobi|android|iphone/.test(s)) return 'Mobile'
  return 'Desktop'
}
function browserOf(ua: string | null) {
  const s = ua || ''
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
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-3">Erros 404</h2>
            {(() => {
              const errs = events.filter(e => e.event === 'error_404')
              return errs.length === 0 ? <Empty text="Sem erros 404 no período (o site registra error_404 automaticamente após o deploy). O gerenciamento de redirecionamentos entra na próxima fase." /> : (
                <table className="w-full text-sm"><thead className="bg-stone-50 border-b border-line"><tr><th className="text-left px-3 py-2 text-stone-500 font-medium">URL</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Ocorrências</th></tr></thead>
                  <tbody className="divide-y divide-stone-100">{topCount(errs, e => e.entity_id, 30).map(([u, n]) => <tr key={u}><td className="px-3 py-2 font-mono text-xs">{u}</td><td className="px-3 py-2 text-right">{n}</td></tr>)}</tbody></table>
              )
            })()}
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
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-xl text-forest-900">Relatório com IA</h2>
                <button onClick={genAIReport} disabled={aiBusy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar análise do período</button>
              </div>
              <p className="text-xs text-ink-soft mb-3">A IA analisa os números reais do período (visitas, CTA, cadastros, conversões, 404, artigos lidos) e sugere ações.</p>
              {aiText ? <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-paper-soft border border-line rounded-xl p-4">{aiText}</div> : <Empty text="Clique em “Gerar análise do período” para receber um resumo + recomendações acionáveis." />}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-3">Configurações & LGPD</h2>
            <ul className="space-y-2 text-sm text-ink">
              <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Sem IP completo — visitante anonimizado por sessão.</li>
              <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Não registra conteúdo de diário, check-in ou respostas sensíveis.</li>
              <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Dados de Analytics só o admin acessa (RLS).</li>
              <li className="flex items-center gap-2"><span className="text-green-600">✓</span> Retenção configurável (padrão 365 dias) — em <code>analytics_settings</code>.</li>
            </ul>
            <p className="text-xs text-ink-soft mt-4">Ajuste fino de eventos ativos, metas, rotas ignoradas e retenção entra na próxima fase (edição da tabela <code>analytics_settings</code> + eventos personalizados).</p>
          </div>
        )}
      </div>
    </div>
  )
}
