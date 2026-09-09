import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  RefreshCw, TrendingUp, TrendingDown, Ban, CheckCircle2, AlertTriangle,
  CreditCard, RotateCcw, XCircle,
} from 'lucide-react'
import type { AdminView } from './types'

interface Overview {
  generated_at?: string
  users_by_plan: { free: number; essential: number; plus: number }
  stripe: {
    active: number; trialing: number; past_due: number; incomplete: number
    cancel_at_period_end: number; canceled: number; no_stripe_sub: number
  }
  divergences: {
    paid_profile_no_active_stripe: number
    free_profile_active_stripe: number
    plan_mismatch: number
  }
  movement_30d: {
    upgrades: number; downgrades: number; reactivations: number
    cancellations_requested: number; cancellations_handled: number; payment_failures: number
  }
  attention: { cancellations_to_handle: number; past_due: number; divergences_total: number }
}

interface DivergenceRow { user_id: string; full_name: string | null; email: string | null; profile_plan: string | null; stripe_status: string | null; stripe_plan: string | null }

interface Props {
  onGoTab?: (tab: 'cancelamentos' | 'planos' | 'alteracoes') => void
  onViewUser?: (userId: string) => void
  onNavigate?: (v: AdminView) => void
}

const num = (n: number) => n.toLocaleString('pt-BR')
const DIVERGENCE_LABELS: Record<string, string> = {
  paid_profile_no_active_stripe: 'Plano pago no perfil, sem assinatura Stripe ativa',
  free_profile_active_stripe: 'Perfil gratuito, mas assinatura Stripe ativa',
  plan_mismatch: 'Plano do perfil diferente do plano no Stripe',
}

export default function AdminAssinaturasOverview({ onGoTab, onViewUser }: Props) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [drillKind, setDrillKind] = useState<string | null>(null)
  const [drillRows, setDrillRows] = useState<DivergenceRow[] | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data: res, error } = await supabase.rpc('admin_subscriptions_overview')
    if (error) {
      setErr(
        (error as { code?: string }).code === 'PGRST202'
          ? 'A função admin_subscriptions_overview ainda não está publicada neste ambiente.'
          : error.message,
      )
      setData(null)
    } else {
      setData(res as Overview)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function openDrill(kind: string) {
    setDrillKind(kind); setDrillRows(null); setDrillLoading(true)
    const { data: rows, error } = await supabase.rpc('admin_subscription_divergences', { p_kind: kind, p_limit: 200 })
    setDrillRows(error ? [] : ((rows as DivergenceRow[]) ?? []))
    setDrillLoading(false)
  }

  // Cada métrica: número quando carregou, "Indisponível" quando a RPC falhou.
  function Metric({ label, value, sub, tone }: { label: string; value: number | undefined; sub?: string; tone?: string }) {
    return (
      <div className="bg-white border border-line rounded-2xl p-4">
        <p className="text-xs text-ink-soft">{label}</p>
        {loading ? (
          <span className="mt-1 block h-7 w-14 rounded bg-stone-200 animate-pulse" />
        ) : value == null ? (
          <p className="font-serif text-lg text-red-500 mt-1">Indisponível</p>
        ) : (
          <p className={`font-serif text-2xl mt-1 leading-none ${tone ?? 'text-forest-900'}`}>{num(value)}</p>
        )}
        {sub && <p className="text-[11px] text-stone-400 mt-1">{sub}</p>}
      </div>
    )
  }

  const s = data
  const totalDivergences = s ? s.divergences.paid_profile_no_active_stripe + s.divergences.free_profile_active_stripe + s.divergences.plan_mismatch : 0

  return (
    <div className="p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-forest-900">Visão geral das assinaturas</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            {s?.generated_at && !loading ? `Atualizado ${new Date(s.generated_at).toLocaleString('pt-BR')}` : 'Panorama comercial das assinaturas.'}
          </p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-lg text-sm hover:border-forest-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {err && (
        <p className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Não foi possível carregar a visão geral: {err} — os números abaixo NÃO representam o estado real.
        </p>
      )}

      {/* A — usuários por plano (profiles.plan) */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Usuários em plano (perfil)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Metric label="Gratuito" value={s?.users_by_plan.free} />
          <Metric label="Essencial" value={s?.users_by_plan.essential} />
          <Metric label="Plus" value={s?.users_by_plan.plus} />
        </div>
        <p className="text-[11px] text-stone-400 mt-1.5">Fonte: <code>profiles.plan</code> — o que a pessoa tem no cadastro, não necessariamente uma assinatura Stripe ativa.</p>
      </section>

      {/* B — situação real Stripe */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Assinaturas Stripe</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Ativas" value={s?.stripe.active} tone="text-forest-700" />
          <Metric label="Em teste (trial)" value={s?.stripe.trialing} />
          <Metric label="Pagamento em atraso" value={s?.stripe.past_due} tone="text-red-600" />
          <Metric label="Cancelamento agendado" value={s?.stripe.cancel_at_period_end} tone="text-amber-600" />
          <Metric label="Canceladas" value={s?.stripe.canceled} />
          <Metric label="Incompletas" value={s?.stripe.incomplete} />
          <Metric label="Sem assinatura Stripe" value={s?.stripe.no_stripe_sub} />
        </div>
        <p className="text-[11px] text-stone-400 mt-1.5">Fonte: <code>user_subscriptions.payment_status</code> (persistido pelo webhook do Stripe).</p>
      </section>

      {/* C — divergências */}
      <section className="bg-white border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-forest-900">Divergências de assinatura</h3>
          {!loading && s && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${totalDivergences > 0 ? 'bg-amber-100 text-amber-800' : 'bg-mint text-forest-700'}`}>{totalDivergences}</span>
          )}
        </div>
        {loading ? (
          <p className="text-xs text-stone-400">Carregando…</p>
        ) : !s ? (
          <p className="text-xs text-red-500">Indisponível.</p>
        ) : totalDivergences === 0 ? (
          <p className="text-xs text-forest-700">Nenhuma divergência entre perfil e Stripe. 🌿</p>
        ) : (
          <div className="divide-y divide-line">
            {(['paid_profile_no_active_stripe', 'free_profile_active_stripe', 'plan_mismatch'] as const).map(k => {
              const v = s.divergences[k]
              if (v === 0) return null
              return (
                <div key={k} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-sm text-ink">{DIVERGENCE_LABELS[k]}</span>
                  <span className="text-sm font-semibold text-amber-700 tabular-nums">{v}</span>
                  <button onClick={() => void openDrill(k)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2.5 py-1 whitespace-nowrap">Investigar</button>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-[11px] text-stone-400 mt-2">Só leitura — nenhuma correção financeira automática. Investigue e ajuste caso a caso na Ficha 360°.</p>
      </section>

      {/* D — movimento */}
      <section className="bg-white border border-line rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-forest-900 mb-3">Movimento recente (30 dias)</h3>
        <div className="divide-y divide-line">
          {([
            { label: 'Upgrades', k: 'upgrades', Icon: TrendingUp, tone: 'text-forest-700', tab: 'alteracoes' as const },
            { label: 'Downgrades', k: 'downgrades', Icon: TrendingDown, tone: 'text-amber-600', tab: 'alteracoes' as const },
            { label: 'Reativações', k: 'reactivations', Icon: RotateCcw, tone: 'text-forest-700', tab: 'alteracoes' as const },
            { label: 'Cancelamentos solicitados', k: 'cancellations_requested', Icon: Ban, tone: 'text-amber-600', tab: 'cancelamentos' as const },
            { label: 'Cancelamentos concluídos', k: 'cancellations_handled', Icon: CheckCircle2, tone: 'text-stone-500', tab: 'cancelamentos' as const },
            { label: 'Falhas de pagamento', k: 'payment_failures', Icon: XCircle, tone: 'text-red-600', tab: null },
          ] as const).map(row => {
            const v = s?.movement_30d[row.k]
            return (
              <div key={row.k} className="flex items-center gap-3 py-2.5">
                <row.Icon className={`w-4 h-4 ${row.tone} flex-shrink-0`} />
                <span className="flex-1 text-sm text-ink">{row.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${v == null ? 'text-red-500' : v > 0 ? 'text-forest-900' : 'text-stone-400'}`}>
                  {loading ? '—' : v == null ? 'Indisp.' : v}
                </span>
                {row.tab && onGoTab && <button onClick={() => onGoTab(row.tab)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2.5 py-1 whitespace-nowrap">Abrir</button>}
              </div>
            )
          })}
        </div>
      </section>

      {/* E — atenção */}
      {s && !loading && (s.attention.cancellations_to_handle > 0 || s.attention.past_due > 0 || s.attention.divergences_total > 0) && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => onGoTab?.('cancelamentos')} className="bg-white border border-line rounded-2xl p-4 text-left hover:border-forest-300">
            <Ban className="w-4 h-4 text-amber-600" />
            <p className="font-serif text-2xl text-forest-900 mt-1">{num(s.attention.cancellations_to_handle)}</p>
            <p className="text-xs text-ink-soft">Cancelamentos a tratar</p>
          </button>
          <div className="bg-white border border-line rounded-2xl p-4">
            <CreditCard className="w-4 h-4 text-red-600" />
            <p className="font-serif text-2xl text-forest-900 mt-1">{num(s.attention.past_due)}</p>
            <p className="text-xs text-ink-soft">Pagamentos em atraso</p>
          </div>
          <div className="bg-white border border-line rounded-2xl p-4">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="font-serif text-2xl text-forest-900 mt-1">{num(s.attention.divergences_total)}</p>
            <p className="text-xs text-ink-soft">Divergências perfil × Stripe</p>
          </div>
        </section>
      )}

      {/* Drill de divergência */}
      {drillKind && (
        <section className="bg-white border border-line rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-forest-900">{DIVERGENCE_LABELS[drillKind]}</h3>
            <button onClick={() => { setDrillKind(null); setDrillRows(null) }} className="text-xs text-stone-500 hover:text-forest-900">Fechar</button>
          </div>
          {drillLoading ? (
            <p className="text-xs text-stone-400">Carregando…</p>
          ) : !drillRows?.length ? (
            <p className="text-xs text-stone-400">Nenhum usuário nesta divergência.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="text-xs text-ink-soft border-b border-line">
                  <tr><th className="text-left py-2">Usuário</th><th className="text-left py-2">Perfil</th><th className="text-left py-2">Stripe</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {drillRows.map(r => (
                    <tr key={r.user_id}>
                      <td className="py-2 text-xs">{r.full_name || r.email || r.user_id.slice(0, 8)}</td>
                      <td className="py-2 text-xs text-ink-soft">{r.profile_plan ?? '—'}</td>
                      <td className="py-2 text-xs text-ink-soft">{r.stripe_status || '—'}{r.stripe_plan ? ` · ${r.stripe_plan}` : ''}</td>
                      <td className="py-2 text-right">
                        {onViewUser && <button onClick={() => onViewUser(r.user_id)} className="text-xs text-forest-700 hover:text-forest-900 border border-line rounded-lg px-2 py-1">Ficha 360°</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {drillRows.length >= 200 && <p className="text-[11px] text-stone-400 mt-2">Mostrando os primeiros 200.</p>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
