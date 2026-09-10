import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AdminView } from './types'
import {
  RefreshCw, UserPlus, NotebookPen, CalendarCheck, ClipboardList,
  Sprout, BarChart3, BookOpen, LifeBuoy, MessageSquare, CreditCard, XCircle, TrendingUp, TrendingDown, Activity,
} from 'lucide-react'

type Period = 'today' | '7d' | '30d' | 'month' | 'custom'
interface DashboardData { period?: Record<string, number>; attention?: Record<string, number> }

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje', '7d': '7 dias', '30d': '30 dias', month: 'Mês atual', custom: 'Personalizado',
}

function rangeFor(period: Period, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  if (period === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    return { start, end }
  }
  if (period === '7d') return { start: new Date(now.getTime() - 7 * 86400000), end }
  if (period === '30d') return { start: new Date(now.getTime() - 30 * 86400000), end }
  if (period === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
  const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(now.getTime() - 7 * 86400000)
  const customEndDate = customEnd ? new Date(`${customEnd}T23:59:59`) : end
  return { start, end: customEndDate }
}

const FOCUS = [
  { key: 'checkins', label: 'Check-ins', note: 'momentos registrados', Icon: CalendarCheck },
  { key: 'diary_entries', label: 'Diário', note: 'entradas no período', Icon: NotebookPen },
  { key: 'reports_generated', label: 'Relatórios', note: 'gerados no período', Icon: BarChart3 },
  { key: 'care_plans_generated', label: 'Plano de Autocuidado', note: 'planos gerados', Icon: Sprout },
]

const GROUPS = [
  {
    title: 'Participação',
    metrics: [
      { key: 'active_users', label: 'Usuários ativos', Icon: Activity },
      { key: 'new_users', label: 'Novos cadastros', Icon: UserPlus },
      { key: 'questionnaires_completed', label: 'Questionários', Icon: ClipboardList },
      { key: 'guidance_requests', label: 'Orientações', Icon: MessageSquare },
    ],
  },
  {
    title: 'Conteúdo e suporte',
    metrics: [
      { key: 'articles_read', label: 'Artigos lidos', Icon: BookOpen },
      { key: 'guided_completed', label: 'Conteúdos concluídos', Icon: BookOpen },
      { key: 'tickets_opened', label: 'Tickets abertos', Icon: LifeBuoy },
    ],
  },
  {
    title: 'Negócio',
    metrics: [
      { key: 'new_subscriptions', label: 'Novas assinaturas', Icon: CreditCard },
      { key: 'cancellations', label: 'Cancelamentos', Icon: XCircle },
      { key: 'payments_failed', label: 'Pagamentos recusados', Icon: XCircle },
      { key: 'plan_upgrades', label: 'Upgrades', Icon: TrendingUp },
      { key: 'plan_downgrades', label: 'Downgrades', Icon: TrendingDown },
    ],
  },
]

export default function AdminOperationalDashboard({ onNavigate: _onNavigate }: { onNavigate: (v: AdminView) => void }) {
  const [period, setPeriod] = useState<Period>('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { start, end } = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: res, error: err } = await supabase.rpc('admin_operational_dashboard', {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    })
    if (err) {
      const code = (err as { code?: string }).code
      setError(code === 'PGRST202' ? 'A função admin_operational_dashboard não está publicada neste ambiente.' : err.message)
      setData(null)
    } else {
      setData((res ?? {}) as DashboardData)
    }
    setLoading(false)
  }, [start, end])

  useEffect(() => { void load() }, [load])

  const value = (key: string) => {
    const raw = data?.period?.[key]
    return loading ? null : typeof raw === 'number' ? raw.toLocaleString('pt-BR') : '—'
  }

  return (
    <section className="h-full rounded-[24px] border border-line bg-white p-5 sm:p-6 shadow-[0_14px_40px_rgba(33,52,42,0.035)]">
      <div className="mb-5 flex flex-col gap-4 border-b border-line/80 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">Jornada no período</p>
          <h2 className="font-serif text-2xl leading-tight text-forest-900">Central da jornada</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-soft">Uma leitura rápida de cuidado, participação, conteúdo e negócio.</p>
        </div>
        <div className="inline-flex max-w-full self-start overflow-x-auto rounded-xl border border-line bg-[#f6f2eb] p-1 xl:self-auto">
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
          <button type="button" onClick={() => void load()} className="ml-1 rounded-lg p-1.5 text-stone-500 hover:bg-white hover:text-forest-800" aria-label="Atualizar período">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-stone-50 px-4 py-3 text-xs">
          <label className="flex items-center gap-2">De <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5" /></label>
          <label className="flex items-center gap-2">até <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5" /></label>
        </div>
      )}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">Não foi possível carregar: {error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {FOCUS.map(m => {
              const display = value(m.key)
              return (
                <div key={m.key} className="rounded-2xl border border-line bg-[#fbfaf7] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-500">{m.label}</p>
                      {display === null ? <span className="mt-2 block h-8 w-12 animate-pulse rounded bg-stone-200" aria-label="carregando" /> : <p className="mt-1 font-serif text-[32px] leading-none text-forest-900">{display}</p>}
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white"><m.Icon className="h-3.5 w-3.5 text-forest-600" /></span>
                  </div>
                  <p className="mt-2 text-[10px] text-stone-500">{m.note}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
            {GROUPS.map(group => (
              <div key={group.title} className="rounded-2xl border border-line bg-[#fffdf9] px-4 py-3.5">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-forest-700">{group.title}</h3>
                <div className="divide-y divide-line/70">
                  {group.metrics.map(m => {
                    const display = value(m.key)
                    return (
                      <div key={m.key} className="flex items-center gap-2 py-2.5">
                        <m.Icon className="h-3.5 w-3.5 flex-shrink-0 text-stone-400" />
                        <span className="min-w-0 flex-1 text-xs text-stone-600">{m.label}</span>
                        {display === null ? <span className="h-4 w-7 animate-pulse rounded bg-stone-200" /> : <strong className="font-serif text-lg font-normal text-forest-900">{display}</strong>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
