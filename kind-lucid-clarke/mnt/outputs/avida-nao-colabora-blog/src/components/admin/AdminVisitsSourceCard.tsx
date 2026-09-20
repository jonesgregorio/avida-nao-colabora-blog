import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Users, Radar } from 'lucide-react'

// Card visual fixo na Visão geral do Admin (pedido do usuário: "quero a
// informação de quantos acessos e por onde acessaram, de forma mais visual
// e fácil, a partir de agora" — não só dentro de Analytics → Aquisição,
// mas logo na primeira tela que o admin abre). Mesma fonte de dados
// (analytics_events) e mesmas regras de classificação de fonte já usadas
// em Analytics; aqui só o recorte fica mais enxuto e com um gráfico.

type Period = 'today' | '7d' | '30d' | 'month' | 'custom'
const PERIOD_LABELS: Record<Period, string> = { today: 'Hoje', '7d': '7 dias', '30d': '30 dias', month: 'Mês atual', custom: 'Personalizado' }

// yyyy-mm-dd no fuso local (input type=date trabalha assim, sem UTC no meio).
function isoDay(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Intervalo [start, end] de cada período. "Hoje" = desde 00:00 do dia local (não
// "últimas 24h"), e o personalizado vai do início do 1º dia ao fim do último — sem
// isso, escolher 10/09 a 12/09 cortaria o dia 12 inteiro.
function rangeFor(period: Period, customStart: string, customEnd: string): { start: Date; end: Date } | null {
  const now = new Date()
  if (period === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); return { start: s, end: now } }
  if (period === '7d') return { start: new Date(now.getTime() - 7 * 86400000), end: now }
  if (period === '30d') return { start: new Date(now.getTime() - 30 * 86400000), end: now }
  if (period === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
  if (!customStart || !customEnd) return null
  const start = new Date(`${customStart}T00:00:00`)
  const end = new Date(`${customEnd}T23:59:59.999`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null
  return { start, end }
}

// Cores por fonte reconhecida; fontes não mapeadas (site desconhecido) usam o fallback.
const SOURCE_COLORS: Record<string, string> = {
  Instagram: '#c1447e',
  Direto: '#a8a29e',
  Google: '#4285f4',
  YouTube: '#e05252',
  Facebook: '#3b6fc4',
  TikTok: '#3a3a3a',
  WhatsApp: '#3fae6a',
  'E-mail': '#8a7ac2',
}
const FALLBACK_COLORS = ['#3d6b52', '#c08b3e', '#7a5ea8', '#3e8fc0', '#c0603e']

interface Ev { event: string; entity_id: string | null; session_id: string | null; user_id: string | null }

export default function AdminVisitsSourceCard() {
  const [period, setPeriod] = useState<Period>('7d')
  const [customStart, setCustomStart] = useState(() => isoDay(new Date(Date.now() - 7 * 86400000)))
  const [customEnd, setCustomEnd] = useState(() => isoDay(new Date()))
  const rangeValid = rangeFor(period, customStart, customEnd) !== null
  const [loading, setLoading] = useState(true)
  const [visitors, setVisitors] = useState(0)
  const [sessions, setSessions] = useState(0)
  const [sources, setSources] = useState<[string, number][]>([])

  const load = useCallback(async () => {
    const r = rangeFor(period, customStart, customEnd)
    if (!r) { setLoading(false); setVisitors(0); setSessions(0); setSources([]); return }
    setLoading(true)
    // Achado ao vivo: o Supabase (PostgREST) limita silenciosamente a resposta a
    // 1000 linhas por padrão, mesmo pedindo .limit(20000) — sem .order(), o corte
    // ficava por conta da ordem "natural" da tabela, que descartava exatamente os
    // eventos mais RECENTES em janelas maiores (30 dias mostrava 0 do Instagram,
    // mesmo com a campanha rodando). Ordenar do mais novo pro mais antigo garante
    // que, se algo for cortado, seja o passado distante — nunca a campanha atual.
    const { data } = await supabase
      .from('analytics_events')
      .select('event, entity_id, session_id, user_id')
      .gte('created_at', r.start.toISOString())
      .lte('created_at', r.end.toISOString())
      .in('event', ['page_view', 'article_view', 'visit_source'])
      .order('created_at', { ascending: false })
      .limit(20000)
    const rows = (data ?? []) as Ev[]
    const navEvents = rows.filter(r => r.event === 'page_view' || r.event === 'article_view')
    setVisitors(new Set(navEvents.map(r => r.user_id || r.session_id).filter(Boolean)).size)
    setSessions(new Set(navEvents.map(r => r.session_id).filter(Boolean)).size)
    const counts = new Map<string, number>()
    for (const r of rows) {
      if (r.event !== 'visit_source' || !r.entity_id) continue
      counts.set(r.entity_id, (counts.get(r.entity_id) ?? 0) + 1)
    }
    setSources([...counts.entries()].sort((a, b) => b[1] - a[1]))
    setLoading(false)
  }, [period, customStart, customEnd])

  useEffect(() => { void load() }, [load])

  const total = sources.reduce((sum, [, n]) => sum + n, 0) || 1
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0
  const arcs = sources.map(([label, n], i) => {
    const dash = (n / total) * C
    const arc = { label, n, color: SOURCE_COLORS[label] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length], dash, offset: acc }
    acc += dash
    return arc
  })

  return (
    <section className="rounded-[24px] border border-line bg-white p-5 sm:p-6 shadow-[0_14px_40px_rgba(33,52,42,0.035)]">
      <div className="mb-5 flex flex-col gap-4 border-b border-line/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">Aquisição</p>
          <h2 className="font-serif text-2xl leading-tight text-forest-900">Visitas e origem</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-soft">Quantas pessoas acessaram o site e de onde vieram (Instagram, Google, direto…).</p>
        </div>
        <div className="inline-flex max-w-full self-start overflow-x-auto rounded-xl border border-line bg-[#f6f2eb] p-1 sm:self-auto">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${period === p ? 'bg-forest-900 text-white shadow-sm' : 'text-stone-600 hover:bg-white hover:text-forest-900'}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <button type="button" onClick={() => void load()} className="ml-1 rounded-lg p-1.5 text-stone-500 hover:bg-white hover:text-forest-800" aria-label="Atualizar">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-stone-50 px-4 py-3 text-xs">
          <label className="flex items-center gap-2">De <input type="date" value={customStart} max={customEnd || undefined} onChange={e => setCustomStart(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5" /></label>
          <label className="flex items-center gap-2">até <input type="date" value={customEnd} min={customStart || undefined} onChange={e => setCustomEnd(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5" /></label>
          {!rangeValid && <span className="text-amber-700">Escolha um intervalo válido (início antes do fim).</span>}
        </div>
      )}

      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex gap-3 sm:flex-col">
          <div className="min-w-[130px] flex-1 rounded-2xl border border-line bg-[#fbfaf7] p-4 sm:flex-none">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500"><Users className="h-3 w-3" /> Visitantes</p>
            {loading ? <span className="mt-2 block h-8 w-14 animate-pulse rounded bg-stone-200" /> : <p className="mt-1 font-serif text-[32px] leading-none text-forest-900">{visitors}</p>}
          </div>
          <div className="min-w-[130px] flex-1 rounded-2xl border border-line bg-[#fbfaf7] p-4 sm:flex-none">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500"><Radar className="h-3 w-3" /> Sessões</p>
            {loading ? <span className="mt-2 block h-8 w-14 animate-pulse rounded bg-stone-200" /> : <p className="mt-1 font-serif text-[32px] leading-none text-forest-900">{sessions}</p>}
          </div>
        </div>

        {loading ? (
          <div className="h-36 animate-pulse rounded-2xl bg-stone-100" />
        ) : sources.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-paper-soft p-6 text-center text-sm text-ink-soft">Sem visitas com origem identificada neste período.</p>
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <svg viewBox="0 0 140 140" className="h-32 w-32 flex-shrink-0 -rotate-90" role="img" aria-label="Distribuição de fontes de tráfego">
              <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f0ec" strokeWidth="18" />
              {arcs.map(a => (
                <circle
                  key={a.label}
                  cx="70" cy="70" r={R} fill="none" stroke={a.color} strokeWidth="18"
                  strokeDasharray={`${a.dash} ${C - a.dash}`}
                  strokeDashoffset={-a.offset}
                />
              ))}
            </svg>
            {/* Achado: numa tela larga, o rótulo (esquerda) e o número (direita) ficavam
                tão distantes um do outro que dava pra confundir qual % era de qual fonte.
                Largura limitada + número junto do nome na mesma "pastilha" resolve —
                cada linha fica curta e autoexplicativa por si só. */}
            <div className="w-full max-w-[280px] space-y-2">
              {arcs.map(a => (
                <div key={a.label} className="flex items-center justify-between gap-3 rounded-lg bg-[#fbfaf7] px-3 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: a.color }} />
                    <span className="truncate text-forest-900">{a.label}</span>
                  </span>
                  <span className="whitespace-nowrap font-medium text-ink-soft">{a.n} · {Math.round((a.n / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
