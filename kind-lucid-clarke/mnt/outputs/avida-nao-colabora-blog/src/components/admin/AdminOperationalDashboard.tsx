import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AdminView } from './types'
import {
  Activity, RefreshCw, UserPlus, NotebookPen, CalendarCheck, ClipboardList,
  Sprout, BarChart3, BookOpen, LifeBuoy, MessageSquare, CreditCard, XCircle, TrendingUp, TrendingDown,
} from 'lucide-react'

type Period = 'today' | '7d' | '30d' | 'month' | 'custom'
interface DashboardData { period?: Record<string, number>; attention?: Record<string, number> }

const PERIOD_LABELS: Record<Period, string> = { today: 'Hoje', '7d': '7 dias', '30d': '30 dias', month: 'Mês atual', custom: 'Personalizado' }

function rangeFor(period: Period, customStart: string, customEnd: string): { start: Date; end: Date } {
  const now = new Date(); const end = new Date(now)
  if (period === 'today') { const start = new Date(now); start.setHours(0, 0, 0, 0); return { start, end } }
  if (period === '7d') return { start: new Date(now.getTime() - 7 * 86400000), end }
  if (period === '30d') return { start: new Date(now.getTime() - 30 * 86400000), end }
  if (period === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
  const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(now.getTime() - 7 * 86400000)
  const cend = customEnd ? new Date(`${customEnd}T23:59:59`) : end
  return { start, end: cend }
}

const PRIMARY = [
  { key: 'active_users', label: 'Usuários ativos', note: 'Pessoas que voltaram à plataforma', Icon: Activity },
  { key: 'new_users', label: 'Novos cadastros', note: 'Novas pessoas no período', Icon: UserPlus },
  { key: 'checkins', label: 'Check-ins', note: 'Momentos de acompanhamento', Icon: CalendarCheck },
  { key: 'new_subscriptions', label: 'Novas assinaturas', note: 'Conversões confirmadas no período', Icon: CreditCard },
]

const GROUPS = [
  { title: 'Cuidado e acompanhamento', metrics: [
    { key: 'diary_entries', label: 'Entradas de diário', Icon: NotebookPen },
    { key: 'questionnaires_completed', label: 'Questionários', Icon: ClipboardList },
    { key: 'care_plans_generated', label: 'Planos de autocuidado', Icon: Sprout },
    { key: 'reports_generated', label: 'Relatórios', Icon: BarChart3 },
  ]},
  { title: 'Conteúdo e suporte', metrics: [
    { key: 'articles_read', label: 'Artigos lidos', Icon: BookOpen },
    { key: 'guided_completed', label: 'Conteúdos concluídos', Icon: BookOpen },
    { key: 'tickets_opened', label: 'Tickets abertos', Icon: LifeBuoy },
    { key: 'guidance_requests', label: 'Pedidos de orientação', Icon: MessageSquare },
  ]},
  { title: 'Movimento de assinaturas', metrics: [
    { key: 'cancellations', label: 'Cancelamentos', Icon: XCircle },
    { key: 'payments_failed', label: 'Pagamentos recusados', Icon: XCircle },
    { key: 'plan_upgrades', label: 'Upgrades', Icon: TrendingUp },
    { key: 'plan_downgrades', label: 'Downgrades', Icon: TrendingDown },
  ]},
]

const ATTENTION: { key: string; label: string; nav: AdminView }[] = [
  { key: 'reports_failed', label: 'Relatórios que falharam', nav: 'pdf' as AdminView },
  { key: 'care_plans_failed', label: 'Planos de autocuidado com falha', nav: 'self-care-plans' as AdminView },
  { key: 'care_plans_pending_review', label: 'Planos aguardando revisão', nav: 'self-care-plans' as AdminView },
  { key: 'guidance_pending', label: 'Orientações aguardando resposta', nav: 'guidance-requests' as AdminView },
  { key: 'tickets_stale_7d', label: 'Tickets parados há +7 dias', nav: 'support' as AdminView },
  { key: 'tickets_open', label: 'Tickets abertos', nav: 'support' as AdminView },
  { key: 'payments_failed_30d', label: 'Pagamentos recusados (30 dias)', nav: 'financeiro' as AdminView },
  { key: 'webhooks_stuck', label: 'Webhooks do Stripe travados', nav: 'financeiro' as AdminView },
  { key: 'cancellations_to_handle', label: 'Cancelamentos a tratar', nav: 'cancelamentos' as AdminView },
  { key: 'email_failures_7d', label: 'Falhas de e-mail (7 dias)', nav: 'system-health' as AdminView },
  { key: 'ai_errors_active', label: 'Fluxos de IA com erro ativo', nav: 'system-health' as AdminView },
  { key: 'notifications_draft', label: 'Campanhas em rascunho', nav: 'comunicacao' as AdminView },
]

export default function AdminOperationalDashboard({ onNavigate }: { onNavigate: (v: AdminView) => void }) {
  const [period, setPeriod] = useState<Period>('7d')
  const [customStart, setCustomStart] = useState(''); const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState<DashboardData | null>(null); const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { start, end } = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const { data: res, error: err } = await supabase.rpc('admin_operational_dashboard', { p_start: start.toISOString(), p_end: end.toISOString() })
    if (err) {
      const code = (err as { code?: string }).code
      setError(code === 'PGRST202' ? 'A função admin_operational_dashboard não está publicada neste ambiente.' : err.message); setData(null)
    } else setData((res ?? {}) as DashboardData)
    setLoading(false)
  }, [start, end])
  useEffect(() => { void load() }, [load])

  const attentionRows = ATTENTION.map(a => ({ ...a, value: data?.attention?.[a.key] ?? 0 })).filter(a => a.value > 0).sort((a, b) => b.value - a.value)
  const value = (key: string) => { const raw = data?.period?.[key]; return loading ? null : typeof raw === 'number' ? raw.toLocaleString('pt-BR') : '—' }

  return (
    <section className="bg-white border border-line rounded-[22px] p-5 sm:p-6 mb-6 shadow-[0_10px_35px_rgba(37,55,45,0.035)]">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-forest-600 mb-1.5">Panorama do período</p>
          <h2 className="font-serif text-2xl sm:text-[28px] leading-tight text-forest-900">Central da jornada</h2>
          <p className="text-sm text-ink-soft mt-1">O movimento mais importante da plataforma, organizado por contexto.</p>
        </div>
        <div className="inline-flex max-w-full overflow-x-auto items-center rounded-xl border border-line bg-stone-50 p-1 self-start xl:self-auto">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`text-xs whitespace-nowrap px-3 py-2 rounded-lg transition-all ${period === p ? 'bg-forest-900 text-white shadow-sm' : 'text-stone-600 hover:bg-white hover:text-forest-900'}`}>{PERIOD_LABELS[p]}</button>
          ))}
          <button onClick={() => void load()} className="ml-1 p-2 rounded-lg text-stone-500 hover:bg-white hover:text-forest-800" aria-label="Atualizar"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {period === 'custom' && <div className="flex flex-wrap items-center gap-3 mb-5 rounded-xl border border-line bg-stone-50 px-4 py-3 text-xs"><label className="flex items-center gap-2">De <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1.5" /></label><label className="flex items-center gap-2">até <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-white border border-line rounded-lg px-2.5 py-1.5" /></label></div>}

      {error ? <p className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">Não foi possível carregar: {error}</p> : <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-6">
          {PRIMARY.map((m, i) => { const display = value(m.key); return <div key={m.key} className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${i === 3 ? 'border-[#ead9c9] bg-[#fcf8f2]' : 'border-line bg-[#fbfaf7]'}`}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-stone-500">{m.label}</p>{display === null ? <span className="mt-3 block h-9 w-16 rounded bg-stone-200 animate-pulse" /> : <p className="font-serif text-[36px] sm:text-[40px] text-forest-900 mt-2 leading-none">{display}</p>}</div><span className="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center"><m.Icon className="w-4.5 h-4.5 text-forest-600" /></span></div>
            <p className="text-[11px] text-stone-500 mt-3">{m.note}</p>
          </div> })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {GROUPS.map(group => <div key={group.title} className="rounded-2xl border border-line bg-white p-4">
            <h3 className="text-xs font-semibold text-forest-900 mb-3">{group.title}</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">{group.metrics.map(m => { const display = value(m.key); return <div key={m.key} className="py-3 border-t border-line/70 first:pt-1">
              <div className="flex items-center gap-1.5 text-stone-500"><m.Icon className="w-3.5 h-3.5" /><span className="text-[10px] uppercase tracking-wide leading-tight">{m.label}</span></div>
              {display === null ? <span className="mt-2 block h-5 w-9 rounded bg-stone-200 animate-pulse" /> : <p className="font-serif text-2xl text-forest-900 mt-1">{display}</p>}
            </div>})}</div>
          </div>)}
        </div>

        <div className={`mt-5 rounded-2xl border p-4 ${!loading && attentionRows.length > 0 ? 'border-[#efcfc3] bg-[#fff8f5]' : 'border-forest-100 bg-mint/30'}`}>
          <div className="flex items-center justify-between gap-3 mb-2"><div><p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-500">Prioridade operacional</p><h3 className="font-serif text-lg text-forest-900 mt-0.5">Requer atenção</h3></div>{!loading && attentionRows.length > 0 && <span className="min-w-8 h-8 px-2 rounded-full bg-coral text-[#a84f31] text-sm font-semibold flex items-center justify-center">{attentionRows.reduce((sum, row) => sum + row.value, 0)}</span>}</div>
          {loading ? <p className="text-xs text-stone-400">Carregando…</p> : attentionRows.length === 0 ? <p className="text-xs text-forest-700">Nada pendente no momento. 🌿</p> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-3">{attentionRows.map(row => <div key={row.key} className="flex items-center gap-3 rounded-xl bg-white/80 border border-line px-3 py-2.5"><span className="flex-1 text-sm text-ink">{row.label}</span><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-coral text-[#b0532f]">{row.value}</span><button onClick={() => onNavigate(row.nav)} className="text-xs font-medium text-forest-700 hover:text-forest-900">Abrir</button></div>)}</div>}
        </div>
      </>}
    </section>
  )
}
