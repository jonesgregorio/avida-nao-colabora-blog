import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Users, Radar } from 'lucide-react'

// Card visual fixo na Visão geral do Admin (pedido do usuário: "quero a
// informação de quantos acessos e por onde acessaram, de forma mais visual
// e fácil, a partir de agora" — não só dentro de Analytics → Aquisição,
// mas logo na primeira tela que o admin abre). Mesma fonte de dados
// (analytics_events) e mesmas regras de classificação de fonte já usadas
// em Analytics; aqui só o recorte fica mais enxuto e com um gráfico.

type Period = 'today' | '7d' | '30d'
const PERIOD_LABELS: Record<Period, string> = { today: 'Hoje', '7d': '7 dias', '30d': '30 dias' }
const PERIOD_DAYS: Record<Period, number> = { today: 1, '7d': 7, '30d': 30 }

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
  const [loading, setLoading] = useState(true)
  const [visitors, setVisitors] = useState(0)
  const [sessions, setSessions] = useState(0)
  const [sources, setSources] = useState<[string, number][]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const since = new Date(Date.now() - PERIOD_DAYS[period] * 86400000).toISOString()
    const { data } = await supabase
      .from('analytics_events')
      .select('event, entity_id, session_id, user_id')
      .gte('created_at', since)
      .in('event', ['page_view', 'article_view', 'visit_source'])
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
  }, [period])

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
            <div className="w-full flex-1 space-y-2">
              {arcs.map(a => (
                <div key={a.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: a.color }} />
                  <span className="flex-1 truncate text-forest-900">{a.label}</span>
                  <span className="whitespace-nowrap text-ink-soft">{a.n} · {Math.round((a.n / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
