import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, TrendingUp, TrendingDown, Ban, CheckCircle2, Users } from 'lucide-react'
import type { AdminView } from './types'

interface Data {
  free: number
  essential: number
  plus: number
  upgrades30d: number
  downgrades30d: number
  cancelPending: number
  cancelCompleted30d: number
}

const EMPTY: Data = { free: 0, essential: 0, plus: 0, upgrades30d: 0, downgrades30d: 0, cancelPending: 0, cancelCompleted30d: 0 }

async function count(build: () => PromiseLike<{ count: number | null; error?: unknown }>): Promise<number> {
  try { const { count: c } = await build(); return c ?? 0 } catch { return 0 }
}

interface Props { onGoTab?: (tab: 'cancelamentos' | 'planos' | 'alteracoes') => void; onNavigate?: (v: AdminView) => void }

export default function AdminAssinaturasOverview({ onGoTab }: Props) {
  const [d, setD] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
    const [free, essential, plus, upg, dwn, cp, cc] = await Promise.all([
      count(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'free')),
      count(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'essential')),
      count(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).in('plan', ['plus', 'therapeutic', 'therapeutic-plus', 'therapeutic_plus'])),
      count(() => supabase.from('plan_change_history').select('*', { count: 'exact', head: true }).in('change_type', ['upgrade', 'upgrade_intent']).gte('created_at', since30)),
      count(() => supabase.from('plan_change_history').select('*', { count: 'exact', head: true }).in('change_type', ['downgrade', 'downgrade_intent']).gte('created_at', since30)),
      count(() => supabase.from('subscription_change_feedback').select('*', { count: 'exact', head: true }).eq('change_type', 'cancellation').is('admin_handled_at', null).neq('status', 'reverted')),
      count(() => supabase.from('subscription_change_feedback').select('*', { count: 'exact', head: true }).eq('change_type', 'cancellation').not('admin_handled_at', 'is', null).gte('requested_at', since30)),
    ])
    setD({ free, essential, plus, upgrades30d: upg, downgrades30d: dwn, cancelPending: cp, cancelCompleted30d: cc })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const paid = d.essential + d.plus
  const fmt = (n: number) => (loading ? '—' : n.toLocaleString('pt-BR'))

  const kpis = [
    { label: 'Assinaturas pagas', value: fmt(paid), sub: 'Essencial + Plus', Icon: Users },
    { label: 'Gratuito', value: fmt(d.free), sub: 'Contas no plano free', Icon: Users },
    { label: 'Essencial', value: fmt(d.essential), sub: 'Assinantes Essencial', Icon: Users },
    { label: 'Plus', value: fmt(d.plus), sub: 'Assinantes Plus', Icon: Users },
  ]

  const flows = [
    { label: 'Upgrades (30 dias)', value: d.upgrades30d, Icon: TrendingUp, tone: 'text-forest-700', tab: 'alteracoes' as const },
    { label: 'Downgrades (30 dias)', value: d.downgrades30d, Icon: TrendingDown, tone: 'text-amber-600', tab: 'alteracoes' as const },
    { label: 'Cancelamentos a tratar', value: d.cancelPending, Icon: Ban, tone: 'text-red-600', tab: 'cancelamentos' as const },
    { label: 'Cancelamentos concluídos (30 dias)', value: d.cancelCompleted30d, Icon: CheckCircle2, tone: 'text-stone-500', tab: 'cancelamentos' as const },
  ]

  return (
    <div className="p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-forest-900">Visão geral das assinaturas</h2>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-lg text-sm hover:border-forest-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>
      {err && <p className="text-sm text-red-600">Erro: {err}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-line rounded-2xl p-4">
            <k.Icon className="w-4 h-4 text-stone-400" />
            <p className="font-serif text-2xl text-forest-900 mt-1 leading-none">{k.value}</p>
            <p className="text-xs text-ink-soft mt-1">{k.label}</p>
            <p className="text-[11px] text-stone-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-line rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-forest-900 mb-3">Movimento recente</h3>
        <div className="divide-y divide-line">
          {flows.map(f => (
            <div key={f.label} className="flex items-center gap-3 py-2.5">
              <f.Icon className={`w-4 h-4 ${f.tone} flex-shrink-0`} />
              <span className="flex-1 text-sm text-ink">{f.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${f.value > 0 ? 'text-forest-900' : 'text-stone-400'}`}>{loading ? '—' : f.value}</span>
              {onGoTab && (
                <button onClick={() => onGoTab(f.tab)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2.5 py-1 whitespace-nowrap">Abrir</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {!loading && paid === 0 && d.free === 0 && (
        <p className="rounded-xl bg-stone-50 border border-line p-4 text-sm text-stone-500">Nenhum dado de assinatura ainda.</p>
      )}
    </div>
  )
}
