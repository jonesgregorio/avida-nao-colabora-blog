import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AdminView } from './types'
import {
  Activity, RefreshCw, UserPlus, NotebookPen, CalendarCheck, ClipboardList,
  Sprout, BarChart3, BookOpen, LifeBuoy, MessageSquare, CreditCard, XCircle, TrendingUp, TrendingDown,
} from 'lucide-react'

type Period = 'today' | '7d' | '30d' | 'month' | 'custom'

interface DashboardData {
  period?: Record<string, number>
  attention?: Record<string, number>
}

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
  // custom
  const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(now.getTime() - 7 * 86400000)
  const cend = customEnd ? new Date(`${customEnd}T23:59:59`) : end
  return { start, end: cend }
}

const METRICS: { key: string; label: string; Icon: typeof Activity }[] = [
  { key: 'active_users', label: 'Usuários ativos', Icon: Activity },
  { key: 'new_users', label: 'Novos cadastros', Icon: UserPlus },
  { key: 'checkins', label: 'Check-ins', Icon: CalendarCheck },
  { key: 'diary_entries', label: 'Entradas de diário', Icon: NotebookPen },
  { key: 'questionnaires_completed', label: 'Questionários concluídos', Icon: ClipboardList },
  { key: 'care_plans_generated', label: 'Planos de autocuidado', Icon: Sprout },
  { key: 'reports_generated', label: 'Relatórios gerados', Icon: BarChart3 },
  { key: 'articles_read', label: 'Artigos lidos', Icon: BookOpen },
  { key: 'guided_completed', label: 'Conteúdos concluídos', Icon: BookOpen },
  { key: 'tickets_opened', label: 'Tickets abertos', Icon: LifeBuoy },
  { key: 'guidance_requests', label: 'Pedidos de orientação', Icon: MessageSquare },
  { key: 'new_subscriptions', label: 'Novas assinaturas', Icon: CreditCard },
  { key: 'cancellations', label: 'Cancelamentos', Icon: XCircle },
  { key: 'payments_failed', label: 'Pagamentos recusados', Icon: XCircle },
  { key: 'plan_upgrades', label: 'Upgrades de plano', Icon: TrendingUp },
  { key: 'plan_downgrades', label: 'Downgrades de plano', Icon: TrendingDown },
]

const ATTENTION: { key: string; label: string; nav: AdminView }[] = [
  { key: 'reports_failed', label: 'Relatórios que falharam', nav: 'pdf' as AdminView },
  { key: 'care_plans_failed', label: 'Planos de autocuidado com falha', nav: 'self-care-plans' as AdminView },
  { key: 'care_plans_pending_review', label: 'Planos aguardando revisão', nav: 'self-care-plans' as AdminView },
  { key: 'guidance_pending', label: 'Orientações aguardando resposta', nav: 'guidance-requests' as AdminView },
  { key: 'tickets_stale_7d', label: 'Tickets parados há +7 dias', nav: 'support' as AdminView },
  { key: 'tickets_open', label: 'Tickets abertos', nav: 'support' as AdminView },
  { key: 'payments_failed_30d', label: 'Pagamentos recusados (30 dias)', nav: 'financeiro' as AdminView },
  { key: 'cancellations_to_handle', label: 'Cancelamentos a tratar', nav: 'cancelamentos' as AdminView },
  { key: 'email_failures_7d', label: 'Falhas de e-mail (7 dias)', nav: 'system-health' as AdminView },
  { key: 'ai_errors_active', label: 'Fluxos de IA com erro ativo', nav: 'system-health' as AdminView },
  { key: 'notifications_draft', label: 'Notificações não enviadas', nav: 'notifications' as AdminView },
]

export default function AdminOperationalDashboard({ onNavigate }: { onNavigate: (v: AdminView) => void }) {
  const [period, setPeriod] = useState<Period>('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { start, end } = useMemo(
    () => rangeFor(period, customStart, customEnd),
    [period, customStart, customEnd],
  )

  const load = useCallback(async () => {
    setLoading(true); setError(null); setNotAvailable(false)
    const { data: res, error: err } = await supabase.rpc('admin_operational_dashboard', {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    })
    if (err) {
      if (/admin_operational_dashboard|does not exist|schema cache/i.test(err.message)) setNotAvailable(true)
      else setError(err.message)
      setData(null)
    } else {
      setData((res ?? {}) as DashboardData)
    }
    setLoading(false)
  }, [start, end])

  useEffect(() => { void load() }, [load])

  const attentionRows = ATTENTION
    .map(a => ({ ...a, value: data?.attention?.[a.key] ?? 0 }))
    .filter(a => a.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div className="bg-white border border-line rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-xl text-forest-900">Central da jornada</h2>
          <p className="text-xs text-ink-soft mt-0.5">O que aconteceu na plataforma no período selecionado.</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${period === p ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-line hover:border-forest-300'}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <button onClick={() => void load()} className="ml-1 p-1.5 rounded-lg border border-line hover:border-forest-300" aria-label="Atualizar">
            <RefreshCw className={`w-3.5 h-3.5 text-stone-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
          <label className="flex items-center gap-1.5">De
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-line rounded-lg px-2 py-1" />
          </label>
          <label className="flex items-center gap-1.5">até
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-line rounded-lg px-2 py-1" />
          </label>
        </div>
      )}

      {notAvailable ? (
        <p className="rounded-xl bg-stone-50 border border-line p-4 text-xs text-stone-500">
          Os indicadores operacionais completos ficam disponíveis após o deploy desta etapa.
        </p>
      ) : error ? (
        <p className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">Não foi possível carregar: {error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {METRICS.map(m => (
              <div key={m.key} className="rounded-xl border border-line bg-stone-50 p-3">
                <div className="flex items-center gap-1.5 text-stone-400">
                  <m.Icon className="w-3.5 h-3.5" />
                  <p className="text-[10px] uppercase tracking-wide">{m.label}</p>
                </div>
                <p className="font-serif text-2xl text-forest-900 mt-1 leading-none">{loading ? '—' : (data?.period?.[m.key] ?? 0)}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-forest-900 mb-2">Requer atenção</h3>
            {loading ? (
              <p className="text-xs text-stone-400">Carregando…</p>
            ) : attentionRows.length === 0 ? (
              <p className="rounded-xl bg-mint/40 border border-forest-100 p-3 text-xs text-forest-700">Nada pendente no momento. 🌿</p>
            ) : (
              <div className="divide-y divide-line rounded-xl border border-line">
                {attentionRows.map(row => (
                  <div key={row.key} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex-1 text-sm text-ink">{row.label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-coral text-[#b0532f]">{row.value}</span>
                    <button onClick={() => onNavigate(row.nav)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2.5 py-1 whitespace-nowrap">Abrir</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
