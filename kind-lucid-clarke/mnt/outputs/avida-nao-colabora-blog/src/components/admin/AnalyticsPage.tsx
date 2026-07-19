import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { callAI } from '../../lib/aiContent'
import { exportElementToPdf } from '../../lib/exportPdf'
import AdminPerformanceEditorial from './AdminPerformanceEditorial'
import AdminSEOCockpit from './AdminSEOCockpit'
import {
  LayoutDashboard, FileText, Filter, MousePointerClick, Route, Search, AlertTriangle,
  Gauge, Flame, Monitor, Sparkles, Settings2, RefreshCw, Download, Loader2,
  Plus, Trash2, Save, ArrowRight, Check, HelpCircle, ChevronDown, FileDown,
} from 'lucide-react'

const ANALYTICS_VERSION = 'v5 · jul/2026' // selo para confirmar que o bundle novo está no ar

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

interface Ev { event: string; entity_id: string | null; entity_title: string | null; session_id: string | null; user_id: string | null; user_agent: string | null; referrer: string | null; metadata: Record<string, unknown> | null; created_at: string }

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

// ─── Ajuda contextual por aba (linguagem simples + glossário) ───────────────
interface Help { what: string; how: string; terms: [string, string][] }
const HELP: Record<Tab, Help> = {
  overview: {
    what: 'Um resumo rápido dos números mais importantes do período escolhido.',
    how: 'Olhe primeiro Visitantes e Conversões. Se muitos entram mas poucos assinam, o problema está no meio do caminho (veja o Funil).',
    terms: [
      ['Visitante', 'Uma pessoa diferente que acessou o site (contada uma vez, mesmo abrindo várias páginas).'],
      ['Sessão', 'Uma visita. A mesma pessoa pode ter várias sessões em dias diferentes.'],
      ['Pageview', 'Cada página aberta. Uma visita costuma gerar vários pageviews.'],
      ['CTA', '“Chamada para ação” — botões como “Assinar” ou “Começar grátis”.'],
      ['Conversão', 'Quando o visitante vira assinante de um plano pago.'],
      ['404', 'Página que não existe / link quebrado.'],
    ],
  },
  pages: {
    what: 'Desempenho de cada artigo e página: quais são mais vistos e mais lidos até o fim.',
    how: 'Use para decidir o que escrever mais (o que bomba) e o que revisar (muita visita, pouca leitura completa).',
    terms: [['Tempo de leitura', 'Quanto tempo a pessoa passou no artigo.'], ['Taxa de leitura', 'Quantos rolaram o artigo até o fim.']],
  },
  funnel: {
    what: 'O caminho do visitante até assinar, etapa por etapa: visitou → leu → clicou → criou conta → assinou.',
    how: 'A porcentagem mostra quantos passaram de uma etapa para a próxima. A maior queda entre duas etapas é onde você perde gente — foque ali.',
    terms: [['Etapa', 'Cada passo do caminho.'], ['Taxa de conversão', 'De cada 100 pessoas de uma etapa, quantas avançaram para a seguinte.']],
  },
  events: {
    what: 'A lista de tudo que foi registrado: cliques, rolagens, visualizações, erros.',
    how: 'É a visão “crua”. Serve para conferir se um botão novo está sendo clicado ou se uma ação está sendo registrada.',
    terms: [['Evento', 'Uma ação registrada (ex.: page_view = abriu página; cta_click = clicou num botão).'], ['Sessões', 'Quantas visitas diferentes geraram aquele evento.']],
  },
  journey: {
    what: 'A sequência de ações de cada visita, de forma anônima (sem identificar a pessoa nem mostrar conteúdo do diário).',
    how: 'Leia da esquerda para a direita: mostra o “passo a passo” que a pessoa fez. Ajuda a entender por onde as pessoas navegam.',
    terms: [['Sessão anônima', 'Um código aleatório que agrupa as ações de uma mesma visita, sem revelar quem é.'], ['→', 'Indica a ordem: fez isso, depois aquilo.']],
  },
  seo: {
    what: 'Como o blog aparece nas buscas do Google: títulos, descrições e palavras-chave.',
    how: 'Preencha título e descrição de cada artigo. É isso que aparece no Google e faz a pessoa clicar.',
    terms: [['SEO', 'Otimização para buscadores — ajustes para o Google mostrar seu site.'], ['Meta descrição', 'O textinho que aparece embaixo do título nos resultados do Google.']],
  },
  errors: {
    what: 'Páginas que deram erro 404 (não encontradas) e os redirecionamentos que você configurou para consertá-las.',
    how: 'Se uma URL antiga aparece com muitos 404, clique em “Criar redirect” e aponte para a página nova. O site passa a redirecionar sozinho.',
    terms: [['404', 'Link quebrado / página inexistente.'], ['Redirecionamento (301/302)', 'Manda quem acessa a URL antiga para a nova. 301 = mudança permanente, 302 = temporária.'], ['Hits', 'Quantas vezes o redirect foi usado.']],
  },
  performance: {
    what: 'A velocidade do site medida no navegador dos visitantes (Core Web Vitals do Google).',
    how: 'Quanto mais “bom” (verde), melhor. Sites lentos afastam visitantes e caem no ranking do Google.',
    terms: [
      ['LCP', 'Tempo até o conteúdo principal aparecer. Ideal: até 2,5s.'],
      ['CLS', 'O quanto a página “pula” enquanto carrega. Quanto menor, melhor.'],
      ['FCP', 'Tempo até aparecer o primeiro conteúdo na tela.'],
      ['TTFB', 'Tempo de resposta do servidor.'],
    ],
  },
  heatmap: {
    what: 'Os elementos (botões e links) mais clicados do site.',
    how: 'Veja o que chama mais atenção. Se um botão importante é pouco clicado, talvez precise ficar mais visível.',
    terms: [['Clique', 'Cada toque num elemento marcado.']],
  },
  devices: {
    what: 'Em que aparelho (celular, computador, tablet) e navegador as pessoas acessam, e de onde vieram (Instagram, Google, YouTube, campanhas).',
    how: 'Se a maioria usa celular, priorize o visual no celular. As Fontes mostram quais canais trazem mais gente — invista onde funciona.',
    terms: [
      ['Fonte', 'O canal que trouxe a visita (Instagram, Google, direto…).'],
      ['Referrer', 'O site de onde a pessoa clicou para chegar aqui.'],
      ['UTM', 'Etiquetas no link que identificam a campanha. Ex.: ?utm_source=instagram&utm_campaign=lancamento.'],
      ['Direto', 'A pessoa digitou o endereço ou usou um favorito — sem site de origem.'],
    ],
  },
  ai: {
    what: 'Uma análise automática, escrita pela IA, dos números reais do período — com recomendações práticas.',
    how: 'Clique em “Gerar análise”, leia o resumo e as sugestões. Se gostar, clique em “Salvar” para guardar no histórico.',
    terms: [['Relatório', 'Resumo + recomendações geradas a partir dos seus dados.']],
  },
  settings: {
    what: 'Liga/desliga o que é rastreado, define a privacidade e por quanto tempo os dados ficam guardados.',
    how: 'Deixe ligado o que quer acompanhar. A anonimização protege os visitantes (LGPD). Ajuste a retenção conforme sua necessidade.',
    terms: [['Retenção', 'Quantos dias os eventos ficam salvos antes de serem apagados automaticamente.'], ['Anonimizar', 'Não guardar nada que identifique a pessoa (sem IP).'], ['Evento personalizado', 'Uma ação extra que você quer acompanhar, além das padrão.']],
  },
}

function TabHelp({ tab }: { tab: Tab }) {
  const [open, setOpen] = useState(false)
  const h = HELP[tab]
  if (!h) return null
  return (
    <div className="mb-5 border border-line rounded-2xl bg-paper-soft overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <HelpCircle className="w-4 h-4 text-forest-600 flex-shrink-0" />
        <span className="text-sm font-medium text-forest-900 flex-1">Como ler esta aba</span>
        <ChevronDown className={`w-4 h-4 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-line">
          <p className="text-sm text-ink"><span className="font-medium text-forest-800">O que é:</span> {h.what}</p>
          <p className="text-sm text-ink"><span className="font-medium text-forest-800">Como analisar:</span> {h.how}</p>
          {h.terms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">Glossário</p>
              <dl className="space-y-1.5">{h.terms.map(([t, d]) => (
                <div key={t} className="text-sm"><dt className="inline font-medium text-forest-900">{t}:</dt> <dd className="inline text-ink-soft">{d}</dd></div>
              ))}</dl>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft"><p className="text-ink-soft text-sm">{text}</p></div>
}

// ─── Gráficos em SVG puro (sem dependência externa) ─────────────────────────
type Series = { label: string; value: number }[]
function fmtDay(d: string) { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : d }
function LineChartCard({ title, series, subtitle, prev }: { title: string; series: Series; subtitle?: string; prev?: number }) {
  const total = series.reduce((a, s) => a + s.value, 0)
  const max = Math.max(1, ...series.map(s => s.value))
  const W = 560, H = 170, pad = 26, n = series.length
  const gid = 'grad' + title.replace(/[^a-zA-Z0-9]/g, '')
  const X = (i: number) => n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2)
  const Y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const linePts = series.map((s, i) => `${X(i).toFixed(1)},${Y(s.value).toFixed(1)}`).join(' ')
  const areaPts = `${X(0).toFixed(1)},${H - pad} ${linePts} ${X(n - 1).toFixed(1)},${H - pad}`
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <div className="flex justify-between items-baseline mb-1 gap-2">
        <h3 className="font-serif text-lg text-forest-900">{title}</h3>
        <span className="text-sm text-ink-soft flex items-center gap-2">{prev !== undefined && <Delta cur={total} prev={prev} />}{total}{subtitle ? ` ${subtitle}` : ''}</span>
      </div>
      {total === 0 ? <div className="py-8 text-center text-sm text-ink-soft">Sem dados no período ainda.</div> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
            <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d6b52" stopOpacity="0.18" /><stop offset="100%" stopColor="#3d6b52" stopOpacity="0" /></linearGradient></defs>
            {[0, 0.5, 1].map(f => <line key={f} x1={pad} x2={W - pad} y1={Y(max * f)} y2={Y(max * f)} stroke="#eee" strokeWidth="1" />)}
            <polygon points={areaPts} fill={`url(#${gid})`} />
            <polyline points={linePts} fill="none" stroke="#3d6b52" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={X(n - 1)} cy={Y(series[n - 1].value)} r="3.5" fill="#3d6b52" />
            <text x={pad} y={Y(max) - 4} fontSize="10" fill="#9ca3af">{max}</text>
          </svg>
          <div className="flex justify-between text-[10px] text-stone-400 mt-1"><span>{fmtDay(series[0].label)}</span><span>{fmtDay(series[n - 1].label)}</span></div>
        </>
      )}
    </div>
  )
}
function BarChartCard({ title, subtitle, data }: { title: string; subtitle?: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map(d => d[1]))
  const tot = data.reduce((a, d) => a + d[1], 0)
  return (
    <div className="bg-white border border-line rounded-2xl p-5">
      <h3 className="font-serif text-lg text-forest-900 mb-1">{title}</h3>
      {subtitle && <p className="text-xs text-ink-soft mb-3">{subtitle}</p>}
      {data.length === 0 ? <div className="py-6 text-center text-sm text-ink-soft">Sem dados no período ainda.</div> : (
        <div className="space-y-2.5">{data.map(([label, v]) => (
          <div key={label}>
            <div className="flex justify-between text-sm mb-1 gap-2"><span className="text-forest-900 truncate">{label}</span><span className="text-ink-soft whitespace-nowrap">{v} · {pct(v, tot)}</span></div>
            <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-forest-500" style={{ width: `${(v / max) * 100}%` }} /></div>
          </div>
        ))}</div>
      )}
    </div>
  )
}
function topCount<T>(rows: T[], keyFn: (r: T) => string | null, n = 8) {
  const m = new Map<string, number>()
  for (const r of rows) { const k = keyFn(r); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}
// Porcentagem formatada (com 1 casa quando <10% para não sumir valores pequenos).
function pct(n: number, total: number) {
  if (total <= 0) return '0%'
  const v = (n / total) * 100
  return `${v < 10 && v > 0 ? v.toFixed(1) : Math.round(v)}%`
}
// Soma dos valores de um resultado de topCount (para usar como base do %).
function sumCounts(rows: [string, number][]) { return rows.reduce((a, r) => a + r[1], 0) }

function computeMetrics(evs: Ev[]) {
  const count = (e: string) => evs.filter(x => x.event === e).length
  const sessions = new Set(evs.map(e => e.session_id).filter(Boolean)).size
  const visitors = new Set(evs.map(e => e.user_id || e.session_id).filter(Boolean)).size
  return {
    sessions, visitors,
    pageviews: count('page_view') || count('article_view'),
    articleViews: count('article_view'),
    ctaClicks: count('cta_click'),
    errors404: count('error_404'),
  }
}

// Badge de variação vs. período anterior. goodWhenUp=false inverte a cor (ex.: erros).
function Delta({ cur, prev, goodWhenUp = true }: { cur: number; prev: number; goodWhenUp?: boolean }) {
  if (prev === 0 && cur === 0) return <span className="text-[11px] text-stone-400">— sem base anterior</span>
  if (prev === 0) return <span className="text-[11px] font-medium text-forest-600">novo no período</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return <span className="text-[11px] text-stone-400">estável</span>
  const up = pct > 0
  const good = up === goodWhenUp
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${good ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

export default function AnalyticsPage({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [tab, setTab] = useState<Tab>(() => {
    try { return (localStorage.getItem('admin-analytics-tab') as Tab) || 'overview' } catch { return 'overview' }
  })
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<Ev[]>([])
  const [prevEvents, setPrevEvents] = useState<Ev[]>([])
  const [signups, setSignups] = useState(0)
  const [conversions, setConversions] = useState(0)
  const [prevSignups, setPrevSignups] = useState(0)
  const [prevConversions, setPrevConversions] = useState(0)
  const [signupDates, setSignupDates] = useState<string[]>([])
  const [conversionDates, setConversionDates] = useState<string[]>([])
  const [readTop, setReadTop] = useState<[string, number][]>([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiSaving, setAiSaving] = useState(false)
  const [aiHistoryKey, setAiHistoryKey] = useState(0)
  const [redirectFrom, setRedirectFrom] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const days = PERIODS.find(p => p.id === period)!.days
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days])
  // Janela imediatamente anterior, do mesmo tamanho (para comparativo).
  const prevSince = useMemo(() => new Date(Date.now() - days * 2 * 86400000).toISOString(), [days])

  async function load() {
    setLoading(true)
    const [evRes, upRes, chRes, rhRes, prevEvRes, prevUpRes, prevChRes] = await Promise.all([
      supabase.from('analytics_events').select('event, entity_id, entity_title, session_id, user_id, user_agent, referrer, metadata, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20000),
      supabase.from('profiles').select('created_at').gte('created_at', since).limit(50000),
      supabase.from('plan_change_history').select('created_at').gte('created_at', since).in('change_type', ['upgrade', 'new']).limit(50000),
      supabase.from('reading_history').select('article_slug').gte('created_at', since).limit(20000),
      supabase.from('analytics_events').select('event, session_id, user_id, user_agent, created_at').gte('created_at', prevSince).lt('created_at', since).limit(20000),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', prevSince).lt('created_at', since),
      supabase.from('plan_change_history').select('id', { count: 'exact', head: true }).gte('created_at', prevSince).lt('created_at', since).in('change_type', ['upgrade', 'new']),
    ])
    setEvents((evRes.data as Ev[]) ?? [])
    const upRows = (upRes.data as { created_at: string }[]) ?? []
    const chRows = (chRes.data as { created_at: string }[]) ?? []
    setSignups(upRows.length); setSignupDates(upRows.map(r => r.created_at))
    setConversions(chRows.length); setConversionDates(chRows.map(r => r.created_at))
    setReadTop(topCount((rhRes.data as { article_slug: string }[]) ?? [], r => r.article_slug, 5))
    setPrevEvents((prevEvRes.data as Ev[]) ?? [])
    setPrevSignups(prevUpRes.count ?? 0)
    setPrevConversions(prevChRes.count ?? 0)
    setLoading(false)
  }
  useEffect(() => { load() }, [since]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchTab(id: Tab) { setTab(id); try { localStorage.setItem('admin-analytics-tab', id) } catch { /* noop */ } }

  // ── Métricas derivadas dos eventos (atual e período anterior) ──
  const m = useMemo(() => computeMetrics(events), [events])
  const prevM = useMemo(() => computeMetrics(prevEvents), [prevEvents])

  // ── Séries diárias para os gráficos de crescimento ──
  const growth = useMemo(() => {
    const dayList: string[] = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) dayList.push(new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10))
    const idx = new Map(dayList.map((d, i) => [d, i]))
    const zero = () => dayList.map(d => ({ label: d, value: 0 }))

    const visits = zero()
    const sessSeen = dayList.map(() => new Set<string>())
    const pv = zero()
    for (const e of events) {
      const i = idx.get(e.created_at.slice(0, 10))
      if (i == null) continue
      if (e.session_id) sessSeen[i].add(e.session_id)
      if (e.event === 'page_view' || e.event === 'article_view') pv[i].value++
    }
    sessSeen.forEach((s, i) => { visits[i].value = s.size })

    const su = zero(); for (const d of signupDates) { const i = idx.get(d.slice(0, 10)); if (i != null) su[i].value++ }
    const cv = zero(); for (const d of conversionDates) { const i = idx.get(d.slice(0, 10)); if (i != null) cv[i].value++ }

    // Fontes e dispositivos (por sessão) para gráficos de barra
    const srcEvents = events.filter(e => e.event === 'visit_source')
    const sources = topCount(srcEvents, e => e.entity_id, 8)
    const seen = new Set<string>(); const first: Ev[] = []
    for (const e of events) { const k = e.session_id || ''; if (k && !seen.has(k)) { seen.add(k); first.push(e) } }
    const base = first.length ? first : events
    const devices = (['Desktop', 'Mobile', 'Tablet'] as const).map(d => [d, base.filter(e => deviceOf(e.user_agent) === d).length] as [string, number]).filter(x => x[1] > 0)

    // Tendência simples (2ª metade vs 1ª metade das visitas)
    const half = Math.floor(visits.length / 2)
    const fh = visits.slice(0, half).reduce((a, s) => a + s.value, 0)
    const sh = visits.slice(half).reduce((a, s) => a + s.value, 0)
    const trend = sh > fh * 1.1 ? 'crescente' : sh < fh * 0.9 ? 'em queda' : 'estável'

    return { visits, pv, su, cv, sources, devices, trend }
  }, [events, signupDates, conversionDates, days])

  function exportCSV() {
    const L = PERIODS.find(p => p.id === period)!.label
    const lines: string[] = []
    const push = (arr: (string | number)[]) => lines.push(arr.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    const deltaStr = (c: number, p: number) => p > 0 ? `${Math.round(((c - p) / p) * 100)}%` : (c > 0 ? 'novo' : '—')

    push([`Relatório Analytics — ${L}`]); push(['Gerado em', new Date().toLocaleString('pt-BR')]); lines.push('')

    push(['MÉTRICAS', 'Atual', 'Período anterior', 'Variação %'])
    const rowsM: [string, number, number][] = [
      ['Visitantes', m.visitors, prevM.visitors], ['Sessões', m.sessions, prevM.sessions],
      ['Pageviews', m.pageviews, prevM.pageviews], ['Leituras de artigo', m.articleViews, prevM.articleViews],
      ['Cliques em CTA', m.ctaClicks, prevM.ctaClicks], ['Cadastros', signups, prevSignups],
      ['Conversões', conversions, prevConversions], ['Erros 404', m.errors404, prevM.errors404],
    ]
    for (const [l, c, p] of rowsM) push([l, c, p, deltaStr(c, p)])
    lines.push('')

    push(['FUNIL', 'Sessões', '% da etapa anterior', '% do topo'])
    const fSteps: [string, number][] = [
      ['Visitantes', m.visitors],
      ['Leram artigo', new Set(events.filter(e => e.event === 'article_view').map(e => e.session_id)).size],
      ['Clicaram em CTA', new Set(events.filter(e => e.event === 'cta_click').map(e => e.session_id)).size],
      ['Criaram conta', signups], ['Assinaram plano', conversions],
    ]
    fSteps.forEach(([l, n], i) => push([l, n, i > 0 && fSteps[i - 1][1] > 0 ? pct(n, fSteps[i - 1][1]) : '—', i > 0 && fSteps[0][1] > 0 ? pct(n, fSteps[0][1]) : '—']))
    lines.push('')

    const src = topCount(events.filter(e => e.event === 'visit_source'), e => e.entity_id, 30); const st = sumCounts(src)
    push(['FONTES DE TRÁFEGO', 'Visitas', '%']); for (const [d, n] of src) push([d, n, pct(n, st)]); lines.push('')

    const seen = new Set<string>(); const first: Ev[] = []
    for (const e of events) { const k = e.session_id || ''; if (k && !seen.has(k)) { seen.add(k); first.push(e) } }
    const base = first.length ? first : events
    const dev = (['Desktop', 'Mobile', 'Tablet'] as const).map(d => [d, base.filter(e => deviceOf(e.user_agent) === d).length] as [string, number]); const dt = sumCounts(dev)
    push(['DISPOSITIVOS', 'Sessões', '%']); for (const [d, n] of dev) push([d, n, pct(n, dt)]); lines.push('')

    const sq = topCount(events.filter(e => e.event === 'blog_search'), e => e.entity_id || e.entity_title, 40); const sqt = sumCounts(sq)
    push(['TERMOS MAIS BUSCADOS', 'Buscas', '%']); for (const [t, n] of sq) push([t, n, pct(n, sqt)]); lines.push('')

    push(['EVENTOS', 'Total', '% do total']); for (const [ev, n] of topCount(events, e => e.event, 60)) push([ev, n, pct(n, events.length)])

    const csv = lines.join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `analytics-${period}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  async function exportPDF() {
    if (!reportRef.current) return
    setPdfBusy(true)
    try { await exportElementToPdf(reportRef.current, `analytics-${period}.pdf`) }
    catch (e) { console.error('Falha ao gerar PDF', e) }
    finally { setPdfBusy(false) }
  }

  async function genAIReport() {
    setAiBusy(true); setAiText('')
    try {
      const fontes = growth.sources.map(([s, n]) => `${s} (${n})`).join(', ') || 'sem dados'
      const comp = `Comparado ao período anterior de mesmo tamanho — visitantes: ${prevM.visitors}, cadastros: ${prevSignups}, conversões: ${prevConversions}.`
      const resumo = `Período: ${PERIODS.find(p => p.id === period)!.label}. Sessões: ${m.sessions}. Visitantes: ${m.visitors}. Pageviews: ${m.pageviews}. Cliques em CTA: ${m.ctaClicks}. Cadastros: ${signups}. Conversões para plano: ${conversions}. Erros 404: ${m.errors404}. Tendência de visitas: ${growth.trend}. ${comp} Principais fontes de tráfego: ${fontes}. Artigos mais lidos: ${readTop.map(([s, n]) => `${s} (${n})`).join(', ') || 'sem dados'}.`
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
    { n: m.visitors, prev: prevM.visitors, label: 'Visitantes' },
    { n: m.sessions, prev: prevM.sessions, label: 'Sessões' },
    { n: m.pageviews, prev: prevM.pageviews, label: 'Pageviews' },
    { n: m.articleViews, prev: prevM.articleViews, label: 'Leituras de artigo', rate: `${pct(m.articleViews, m.pageviews)} das pageviews` },
    { n: m.ctaClicks, prev: prevM.ctaClicks, label: 'Cliques em CTA', rate: `${pct(m.ctaClicks, m.visitors)} dos visitantes` },
    { n: signups, prev: prevSignups, label: 'Cadastros', rate: `${pct(signups, m.visitors)} dos visitantes` },
    { n: conversions, prev: prevConversions, label: 'Conversões p/ plano', rate: `${pct(conversions, m.visitors)} dos visitantes` },
    { n: m.errors404, prev: prevM.errors404, label: 'Erros 404', goodWhenUp: false, rate: `${pct(m.errors404, m.pageviews)} das pageviews` },
  ] as { n: number; prev: number; label: string; goodWhenUp?: boolean; rate?: string }[]

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-3xl text-forest-900">Analytics</h1>
              <span className="text-[10px] font-medium text-forest-600 bg-mint px-2 py-0.5 rounded-full" title="Versão do painel — confirme que corresponde à última atualização">{ANALYTICS_VERSION}</span>
            </div>
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
            <button onClick={exportPDF} disabled={pdfBusy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-3 py-2 rounded-xl text-sm hover:bg-forest-800 disabled:opacity-60">{pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF</button>
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
        <TabHelp tab={tab} />
        {/* Reaproveita Desempenho e SEO cockpit (fonte única, sem duplicar) */}
        {tab === 'pages' && <div className="-mx-6"><AdminPerformanceEditorial onEditArticle={onEditArticle} /></div>}
        {tab === 'seo' && <div className="-mx-6"><AdminSEOCockpit onEditArticle={onEditArticle} /></div>}

        {tab === 'overview' && (
          <div className="space-y-6">
            <p className="text-xs text-ink-soft -mb-2">Comparado com os {days} dias anteriores.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metricCards.map(c => (
                <div key={c.label} className={card}>
                  <p className="font-serif text-3xl text-forest-900">{loading ? '—' : c.n}</p>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-sm text-ink-soft">{c.label}</p>
                    {!loading && <Delta cur={c.n} prev={c.prev} goodWhenUp={c.goodWhenUp ?? true} />}
                  </div>
                  {!loading && c.rate && <p className="text-[11px] text-forest-600 mt-1">{c.rate}</p>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className={card}>
                <h2 className="font-serif text-xl text-forest-900 mb-3">Top artigos lidos</h2>
                {readTop.length === 0 ? <p className="text-sm text-ink-soft">Sem leituras no período.</p> : (() => { const tot = sumCounts(readTop); return (
                  <div className="space-y-2">{readTop.map(([slug, n]) => <div key={slug} className="flex justify-between text-sm gap-2"><span className="text-forest-900 truncate">{slug}</span><span className="text-ink-soft whitespace-nowrap">{n} · {pct(n, tot)}</span></div>)}</div>
                )})()}
              </div>
              <div className={card}>
                <h2 className="font-serif text-xl text-forest-900 mb-3">Eventos mais frequentes</h2>
                {events.length === 0 ? <p className="text-sm text-ink-soft">Sem eventos ainda — o rastreamento começa a preencher a partir do deploy.</p> : (
                  <div className="space-y-2">{topCount(events, e => e.event, 6).map(([ev, n]) => <div key={ev} className="flex justify-between text-sm gap-2"><span className="text-forest-900 font-mono text-xs">{ev}</span><span className="text-ink-soft whitespace-nowrap">{n} · {pct(n, events.length)}</span></div>)}</div>
                )}
              </div>
            </div>
            <div className={card}>
              <h2 className="font-serif text-xl text-forest-900 mb-1">Termos mais buscados</h2>
              <p className="text-xs text-ink-soft mb-3">O que os usuários digitaram na busca de Conteúdos — os temas mais procurados, do mais para o menos buscado.</p>
              {(() => {
                const searches = events.filter(e => e.event === 'blog_search')
                if (searches.length === 0) return <Empty text="Sem buscas no período — preenche conforme os usuários usam a busca da página Conteúdos. Começa a fluir após o deploy." />
                const rows = topCount(searches, e => e.entity_id || e.entity_title, 15); const tot = searches.length
                return <div className="space-y-2">{rows.map(([term, n]) => <div key={term} className="flex justify-between text-sm gap-2"><span className="text-forest-900 truncate">{term}</span><span className="text-ink-soft whitespace-nowrap">{n} busca{n > 1 ? 's' : ''} · {pct(n, tot)}</span></div>)}</div>
              })()}
            </div>
          </div>
        )}

        {tab === 'events' && (
          <div className={card}>
            <h2 className="font-serif text-xl text-forest-900 mb-3">Eventos ({PERIODS.find(p => p.id === period)!.label})</h2>
            {events.length === 0 ? <Empty text="Nenhum evento no período. Assim que o site público começar a emitir eventos, eles aparecem aqui." /> : (
              <table className="w-full text-sm"><thead className="bg-stone-50 border-b border-line"><tr><th className="text-left px-3 py-2 text-stone-500 font-medium">Evento</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Total</th><th className="text-right px-3 py-2 text-stone-500 font-medium">% do total</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Sessões</th></tr></thead>
                <tbody className="divide-y divide-stone-100">{topCount(events, e => e.event, 40).map(([ev, n]) => {
                  const sess = new Set(events.filter(e => e.event === ev).map(e => e.session_id)).size
                  return <tr key={ev}><td className="px-3 py-2 font-mono text-xs text-forest-900">{ev}</td><td className="px-3 py-2 text-right">{n}</td><td className="px-3 py-2 text-right text-ink-soft">{pct(n, events.length)}</td><td className="px-3 py-2 text-right text-ink-soft">{sess}</td></tr>
                })}</tbody></table>
            )}
          </div>
        )}

        {tab === 'devices' && (() => {
          // Conta por sessão única para não distorcer com muitos page_views da mesma pessoa.
          const seen = new Set<string>()
          const perSession: Ev[] = []
          for (const e of events) { const k = e.session_id || ''; if (k && !seen.has(k)) { seen.add(k); perSession.push(e) } }
          const base = perSession.length ? perSession : events
          const totalDev = base.length || 1
          const devCounts = ['Desktop', 'Mobile', 'Tablet'].map(d => [d, base.filter(e => deviceOf(e.user_agent) === d).length] as [string, number])
          const srcEvents = events.filter(e => e.event === 'visit_source')
          return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={card}>
              <h2 className="font-serif text-xl text-forest-900 mb-3">Dispositivos</h2>
              <div className="space-y-3">{devCounts.map(([d, n]) => (
                <div key={d}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-forest-900">{d}</span><span className="text-ink-soft">{n} · {Math.round((n / totalDev) * 100)}%</span></div>
                  <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-forest-500" style={{ width: `${(n / totalDev) * 100}%` }} /></div>
                </div>
              ))}</div>
              <p className="text-xs text-ink-soft mt-3">Rastreamento por sessão. Celular aparece aqui assim que alguém acessar pelo telefone.</p>
            </div>
            <div className={card}><h2 className="font-serif text-xl text-forest-900 mb-3">Navegadores</h2>{base.length === 0 ? <Empty text="Sem dados ainda." /> : (() => { const rows = topCount(base, e => browserOf(e.user_agent)); const tot = sumCounts(rows); return <div className="space-y-2">{rows.map(([d, n]) => <div key={d} className="flex justify-between text-sm gap-2"><span>{d}</span><span className="text-ink-soft whitespace-nowrap">{n} · {pct(n, tot)}</span></div>)}</div> })()}</div>

            <div className={card}>
              <h2 className="font-serif text-xl text-forest-900 mb-1">Fontes de tráfego</h2>
              <p className="text-xs text-ink-soft mb-3">De onde vieram as visitas (Instagram, Google, YouTube, direto…).</p>
              {srcEvents.length === 0 ? <Empty text="Sem dados de fonte ainda — preenche quando alguém chega por link externo ou campanha com UTM." /> : (() => { const rows = topCount(srcEvents, e => e.entity_id, 12); const tot = sumCounts(rows); return <div className="space-y-2">{rows.map(([d, n]) => <div key={d} className="flex justify-between text-sm gap-2"><span className="truncate">{d}</span><span className="text-ink-soft whitespace-nowrap">{n} · {pct(n, tot)}</span></div>)}</div> })()}
            </div>
            <div className={card}>
              <h2 className="font-serif text-xl text-forest-900 mb-1">Campanhas</h2>
              <p className="text-xs text-ink-soft mb-3">Visitas com <code>utm_campaign</code> no link (ex.: bio do Instagram, anúncio).</p>
              {(() => {
                const camps = srcEvents.filter(e => e.entity_title)
                if (camps.length === 0) return <Empty text="Nenhuma campanha rastreada ainda. Use links com ?utm_campaign=…" />
                const rows = topCount(camps, e => `${e.entity_id} · ${e.entity_title}`, 15); const tot = sumCounts(rows)
                return <div className="space-y-2">{rows.map(([d, n]) => <div key={d} className="flex justify-between text-sm gap-2"><span className="truncate">{d}</span><span className="text-ink-soft whitespace-nowrap">{n} · {pct(n, tot)}</span></div>)}</div>
              })()}
            </div>

            <div className={`${card} md:col-span-2`}><h2 className="font-serif text-xl text-forest-900 mb-3">Origem detalhada (referrer)</h2>{events.length === 0 ? <Empty text="Sem dados ainda." /> : (() => { const rows = topCount(events, e => { const r = e.referrer || ''; if (!r) return 'direto'; try { return r.includes('/') || r.includes('.') ? new URL(r.startsWith('http') ? r : 'https://' + r).hostname : r } catch { return r || 'direto' } }); const tot = sumCounts(rows); return <div className="space-y-2">{rows.map(([d, n]) => <div key={d} className="flex justify-between text-sm gap-2"><span className="truncate">{d}</span><span className="text-ink-soft whitespace-nowrap">{n} · {pct(n, tot)}</span></div>)}</div> })()}</div>
          </div>
          )
        })()}

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
                    <div className="flex justify-between text-sm mb-1 gap-2">
                      <span className="text-forest-900">{s.label}</span>
                      <span className="text-ink-soft whitespace-nowrap">{s.n}{i > 0 && steps[i - 1].n > 0 ? ` · ${Math.round((s.n / steps[i - 1].n) * 100)}% da etapa` : ''}{i > 0 && steps[0].n > 0 ? ` · ${pct(s.n, steps[0].n)} do topo` : ''}</span>
                    </div>
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
              if (clicks.length === 0) return <Empty text="Mapa de calor por cliques — preenche conforme o site emite cta_click/article_click. Versão visual com coordenadas fica para a próxima fase." />
              const rows = topCount(clicks, e => e.entity_title || e.entity_id, 20); const tot = sumCounts(rows)
              return <div className="space-y-2">{rows.map(([el, n]) => <div key={el} className="flex justify-between text-sm gap-2"><span className="truncate">{el}</span><span className="text-ink-soft whitespace-nowrap">{n} · {pct(n, tot)}</span></div>)}</div>
            })()}
          </div>
        )}

        {tab === 'errors' && (
          <div className="space-y-5">
            <div className={card}>
              <h2 className="font-serif text-xl text-forest-900 mb-3">Erros 404 ({PERIODS.find(p => p.id === period)!.label})</h2>
              {(() => {
                const errs = events.filter(e => e.event === 'error_404')
                const top = topCount(errs, e => e.entity_id, 30); const tot = sumCounts(top)
                return top.length === 0 ? <Empty text="Sem erros 404 no período — o site registra error_404 automaticamente quando alguém acessa um artigo inexistente." /> : (
                  <table className="w-full text-sm"><thead className="bg-stone-50 border-b border-line"><tr><th className="text-left px-3 py-2 text-stone-500 font-medium">URL</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Ocorrências</th><th className="text-right px-3 py-2 text-stone-500 font-medium">% dos 404</th><th className="text-right px-3 py-2 text-stone-500 font-medium">Ação</th></tr></thead>
                    <tbody className="divide-y divide-stone-100">{top.map(([u, n]) => (
                      <tr key={u}><td className="px-3 py-2 font-mono text-xs">{u}</td><td className="px-3 py-2 text-right">{n}</td><td className="px-3 py-2 text-right text-ink-soft">{pct(n, tot)}</td>
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
              if (vitals.length === 0) return <Empty text="Métricas de performance (LCP, CLS, INP, FCP, TTFB) — o site coleta e envia como web_vital após o deploy. Aparecem aqui assim que houver amostras." />
              const metrics = topCount(vitals, e => (e.entity_id || 'métrica'))
              return (
                <div className="space-y-4">{metrics.map(([mt, n]) => {
                  const rows = vitals.filter(e => (e.entity_id || 'métrica') === mt)
                  const good = rows.filter(e => e.entity_title === 'bom').length
                  const warn = rows.filter(e => e.entity_title === 'atenção').length
                  const bad = rows.filter(e => e.entity_title === 'ruim').length
                  return (
                    <div key={mt}>
                      <div className="flex justify-between text-sm mb-1 gap-2"><span className="font-mono text-xs text-forest-900">{mt}</span><span className="text-ink-soft whitespace-nowrap">{n} amostras · {pct(good, n)} bom</span></div>
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-stone-100">
                        <div className="h-full bg-green-500" style={{ width: `${pct(good, n)}` }} title={`Bom: ${good}`} />
                        <div className="h-full bg-amber-400" style={{ width: `${pct(warn, n)}` }} title={`Atenção: ${warn}`} />
                        <div className="h-full bg-red-400" style={{ width: `${pct(bad, n)}` }} title={`Ruim: ${bad}`} />
                      </div>
                    </div>
                  )
                })}</div>
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
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl text-forest-900">Painel de crescimento</h2>
              <p className="text-sm text-ink-soft mt-1">Tendências do período ({PERIODS.find(p => p.id === period)!.label}) · visitas {growth.trend}. Use 30 ou 90 dias para ver a evolução.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <LineChartCard title="Visitas por dia" series={growth.visits} subtitle="sessões" prev={prevM.sessions} />
              <LineChartCard title="Cadastros por dia" series={growth.su} subtitle="novos" prev={prevSignups} />
              <LineChartCard title="Conversões por dia" series={growth.cv} subtitle="assinaturas" prev={prevConversions} />
              <LineChartCard title="Pageviews por dia" series={growth.pv} subtitle="páginas" prev={prevM.pageviews} />
              <BarChartCard title="Fontes de tráfego" subtitle="de onde vieram as visitas" data={growth.sources} />
              <BarChartCard title="Dispositivos" subtitle="por sessão" data={growth.devices} />
            </div>

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

      {/* Relatório imprimível (oculto) — capturado no botão PDF, com gráficos e % */}
      <div ref={reportRef} aria-hidden="true" style={{ position: 'absolute', left: -99999, top: 0, width: 760, background: '#FBFAF7', padding: 28 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 className="font-serif text-3xl text-forest-900">Relatório Analytics</h1>
          <p className="text-sm text-ink-soft">Período: {PERIODS.find(p => p.id === period)!.label} · gerado em {new Date().toLocaleString('pt-BR')} · visitas {growth.trend} · comparado aos {days} dias anteriores</p>
        </div>
        <div className="grid grid-cols-4 gap-3" style={{ marginBottom: 20 }}>
          {metricCards.map(c => (
            <div key={c.label} className="bg-white border border-line rounded-2xl p-4">
              <p className="font-serif text-2xl text-forest-900">{c.n}</p>
              <p className="text-xs text-ink-soft mb-1">{c.label}</p>
              <Delta cur={c.n} prev={c.prev} goodWhenUp={c.goodWhenUp ?? true} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
          <LineChartCard title="Visitas por dia" series={growth.visits} subtitle="sessões" prev={prevM.sessions} />
          <LineChartCard title="Cadastros por dia" series={growth.su} subtitle="novos" prev={prevSignups} />
          <LineChartCard title="Conversões por dia" series={growth.cv} subtitle="assinaturas" prev={prevConversions} />
          <LineChartCard title="Pageviews por dia" series={growth.pv} subtitle="páginas" prev={prevM.pageviews} />
          <BarChartCard title="Fontes de tráfego" data={growth.sources} />
          <BarChartCard title="Dispositivos" data={growth.devices} />
        </div>
        <div className="bg-white border border-line rounded-2xl p-5" style={{ marginBottom: 20 }}>
          <h3 className="font-serif text-lg text-forest-900 mb-3">Funil de conversão</h3>
          {(() => {
            const steps: [string, number][] = [
              ['Visitantes', m.visitors],
              ['Leram artigo', new Set(events.filter(e => e.event === 'article_view').map(e => e.session_id)).size],
              ['Clicaram em CTA', new Set(events.filter(e => e.event === 'cta_click').map(e => e.session_id)).size],
              ['Criaram conta', signups], ['Assinaram plano', conversions],
            ]
            const max = Math.max(1, steps[0][1])
            return <div className="space-y-2">{steps.map(([l, n], i) => (
              <div key={l}>
                <div className="flex justify-between text-sm mb-1"><span className="text-forest-900">{l}</span><span className="text-ink-soft">{n}{i > 0 && steps[0][1] > 0 ? ` · ${pct(n, steps[0][1])} do topo` : ''}</span></div>
                <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-forest-500" style={{ width: `${(n / max) * 100}%` }} /></div>
              </div>
            ))}</div>
          })()}
        </div>
        <div className="bg-white border border-line rounded-2xl p-5">
          <h3 className="font-serif text-lg text-forest-900 mb-3">Eventos mais frequentes</h3>
          {events.length === 0 ? <p className="text-sm text-ink-soft">Sem eventos no período.</p> : (
            <table className="w-full text-sm"><thead><tr><th className="text-left py-1 text-stone-500 font-medium">Evento</th><th className="text-right py-1 text-stone-500 font-medium">Total</th><th className="text-right py-1 text-stone-500 font-medium">% do total</th></tr></thead>
              <tbody>{topCount(events, e => e.event, 15).map(([ev, n]) => <tr key={ev}><td className="py-1 font-mono text-xs text-forest-900">{ev}</td><td className="py-1 text-right">{n}</td><td className="py-1 text-right text-ink-soft">{pct(n, events.length)}</td></tr>)}</tbody></table>
          )}
        </div>
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
