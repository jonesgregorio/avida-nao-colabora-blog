import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, Copy, Check } from 'lucide-react'
import { OFFICIAL_PLANS } from '../../lib/officialPlans'
import { reasonsLabel } from '../../lib/cancelReasons'
import {
  resolveStatus, TOM_CLASSES, eventLabel, EVENT_TOM,
  formatDateTimeBR, formatDateTimeShort, formatBRL,
} from '../../lib/subscriptionStatus'

interface Props { userId: string; plan: string | null }

interface SubRow {
  id: string
  plan_key: string | null
  status: string | null
  payment_status: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  pending_plan: string | null
  pending_plan_starts_at: string | null
  provider_subscription_id: string | null
  price_id: string | null
  product_id: string | null
  canceled_at: string | null
  trial_end: string | null
  last_payment_confirmed_at: string | null
  last_payment_failed_at: string | null
  last_payment_amount: number | null
  subscription_created_at: string | null
}

interface EventRow {
  id: string
  event_type: string
  previous_plan: string | null
  new_plan: string | null
  amount: number | null
  currency: string | null
  status: string | null
  reasons: string[] | null
  comment: string | null
  stripe_invoice_id: string | null
  stripe_subscription_id: string | null
  occurred_at: string
}

interface FeedbackRow {
  id: string
  change_type: string
  current_plan: string
  target_plan: string
  reasons: string[]
  comment: string | null
  requested_at: string
  effective_at: string | null
  status: string
}

const PLAN_LABELS: Record<string, string> = Object.fromEntries(OFFICIAL_PLANS.map(p => [p.key, p.label]))
const PLAN_PRICES: Record<string, number> = Object.fromEntries(OFFICIAL_PLANS.map(p => [p.key, p.priceValue]))
const planLabel = (p: string | null | undefined) => (p && PLAN_LABELS[p]) || p || '—'

// ID do Stripe: identificador administrativo, não credencial. Nenhuma chave
// secreta passa por aqui — o front nunca vê sk_/whsec_.
function StripeId({ label, value }: { label: string; value: string | null }) {
  const [copiado, setCopiado] = useState(false)
  if (!value) return (
    <div className="bg-white rounded-lg p-2 border border-line">
      <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
      <p className="text-xs text-stone-400">—</p>
    </div>
  )
  return (
    <div className="bg-white rounded-lg p-2 border border-line">
      <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
      <button
        onClick={() => { navigator.clipboard?.writeText(value); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }}
        className="flex items-center gap-1 text-[11px] font-mono text-stone-600 hover:text-forest-700 group"
        title="Copiar"
      >
        <span className="truncate max-w-[150px]">{value}</span>
        {copiado ? <Check className="w-3 h-3 text-green-600 flex-shrink-0" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 flex-shrink-0" />}
      </button>
    </div>
  )
}

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg p-2 border border-line">
      <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
      <div className="font-medium text-stone-700 text-xs">{value}</div>
    </div>
  )
}

// "Assinatura e Pagamentos" (§1/§3/§19): tudo que o admin precisa saber sobre o
// dinheiro daquele usuário. Lê a cópia sincronizada do Supabase — quem a mantém
// fiel ao Stripe é o webhook.
export default function AdminSubscriptionPanel({ userId, plan }: Props) {
  const [sub, setSub] = useState<SubRow | null>(null)
  const [eventos, setEventos] = useState<EventRow[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true
    async function carregar() {
      setLoading(true)
      const [s, e, f] = await Promise.all([
        supabase.from('user_subscriptions').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('subscription_events').select('*').eq('user_id', userId)
          .order('occurred_at', { ascending: false }).limit(50),
        supabase.from('subscription_change_feedback').select('*').eq('user_id', userId)
          .order('requested_at', { ascending: false }).limit(20),
      ])
      if (!vivo) return
      setSub(s.data as SubRow | null)
      setEventos((e.data as EventRow[]) ?? [])
      setFeedbacks((f.data as FeedbackRow[]) ?? [])
      setLoading(false)
    }
    void carregar()
    return () => { vivo = false }
  }, [userId])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-forest-500" /></div>

  const st = resolveStatus({
    appStatus: sub?.status,
    stripeStatus: sub?.payment_status,
    cancelAtPeriodEnd: sub?.cancel_at_period_end,
    pendingPlan: sub?.pending_plan,
    plan,
  })

  // Saída agendada (ainda não efetivada) — é o que o admin precisa ver em destaque.
  const agendado = feedbacks.find(f => f.status === 'scheduled')
  const semDados = !sub && eventos.length === 0

  return (
    <div className="space-y-4">
      {/* Cabeçalho: plano + status */}
      <div className="bg-stone-50 border border-line rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-0.5">Plano atual</p>
            <p className="font-semibold text-forest-900">{planLabel(plan)}</p>
            <p className="text-xs text-stone-500">{formatBRL(PLAN_PRICES[plan ?? ''] ?? 0)}{plan !== 'free' ? '/mês' : ''}</p>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${TOM_CLASSES[st.tom]}`}>{st.label}</span>
        </div>

        {semDados ? (
          <p className="text-xs text-stone-400">
            Sem assinatura registrada. Usuários do plano Gratuito que nunca assinaram não têm dados de cobrança.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Campo label="Assinatura criada em" value={formatDateTimeBR(sub?.subscription_created_at)} />
            <Campo label="Pagamento confirmado em" value={formatDateTimeBR(sub?.last_payment_confirmed_at)} />
            <Campo label="Último valor pago" value={formatBRL(sub?.last_payment_amount)} />
            <Campo label="Última tentativa recusada" value={
              sub?.last_payment_failed_at
                ? <span className="text-red-600">{formatDateTimeBR(sub.last_payment_failed_at)}</span>
                : '—'
            } />
            <Campo label="Início do ciclo atual" value={formatDateTimeBR(sub?.current_period_start)} />
            <Campo label="Fim do ciclo atual" value={formatDateTimeBR(sub?.current_period_end)} />
            <Campo label="Próxima renovação" value={
              sub?.cancel_at_period_end
                ? <span className="text-amber-700">Não renova (cancelamento agendado)</span>
                : formatDateTimeBR(sub?.current_period_end)
            } />
            <Campo label="Plano vale até" value={formatDateTimeBR(sub?.current_period_end)} />
            <Campo label="Status no Stripe" value={sub?.payment_status ?? '—'} />
            <Campo label="Cancelada em" value={formatDateTimeBR(sub?.canceled_at)} />
            {sub?.trial_end && <Campo label="Fim do teste" value={formatDateTimeBR(sub.trial_end)} />}
          </div>
        )}
      </div>

      {/* Saída agendada + motivos */}
      {agendado && (
        <div className={`border rounded-xl p-4 ${agendado.change_type === 'cancellation' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
          <p className={`text-xs font-semibold mb-2 ${agendado.change_type === 'cancellation' ? 'text-amber-800' : 'text-blue-800'}`}>
            {agendado.change_type === 'cancellation' ? 'Cancelamento solicitado' : 'Downgrade solicitado'}
          </p>
          <div className="space-y-1 text-xs text-stone-700">
            <p><strong>{planLabel(agendado.current_plan)} → {planLabel(agendado.target_plan)}</strong></p>
            <p><strong>Motivos:</strong> {reasonsLabel(agendado.reasons)}</p>
            {agendado.comment && <p><strong>Comentário:</strong> <span className="italic">“{agendado.comment}”</span></p>}
            <p><strong>Solicitado em:</strong> {formatDateTimeBR(agendado.requested_at)}</p>
            <p><strong>Vigência:</strong> {formatDateTimeBR(agendado.effective_at)}</p>
          </div>
        </div>
      )}

      {/* IDs administrativos */}
      {sub && (
        <div className="bg-stone-50 border border-line rounded-xl p-4">
          <p className="text-xs font-semibold text-stone-700 mb-2">Referências no Stripe</p>
          <div className="grid grid-cols-2 gap-2">
            <StripeId label="Subscription ID" value={sub.provider_subscription_id} />
            <StripeId label="Price ID" value={sub.price_id} />
            <StripeId label="Product ID" value={sub.product_id} />
          </div>
          <p className="text-[10px] text-stone-400 mt-2">Identificadores administrativos. Nenhuma chave secreta é exposta aqui.</p>
        </div>
      )}

      {/* Linha do tempo */}
      <div className="bg-stone-50 border border-line rounded-xl p-4">
        <p className="text-xs font-semibold text-stone-700 mb-3">Histórico de pagamentos e assinatura</p>
        {eventos.length === 0 ? (
          <p className="text-xs text-stone-400">
            Nenhum evento registrado ainda. O histórico é alimentado pelo Stripe a cada pagamento, renovação ou mudança de plano.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {eventos.map(ev => (
              <li key={ev.id} className="flex gap-2.5">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  EVENT_TOM[ev.event_type] === 'ok' ? 'bg-green-500'
                    : EVENT_TOM[ev.event_type] === 'erro' ? 'bg-red-500'
                      : EVENT_TOM[ev.event_type] === 'alerta' ? 'bg-amber-500' : 'bg-stone-300'
                }`} />
                <div className="flex-1 min-w-0 bg-white rounded-lg p-2.5 border border-line">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-medium text-stone-800">{eventLabel(ev.event_type)}</p>
                    <p className="text-[10px] text-stone-400 flex-shrink-0">{formatDateTimeShort(ev.occurred_at)}</p>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {ev.previous_plan && ev.new_plan && ev.previous_plan !== ev.new_plan
                      ? `${planLabel(ev.previous_plan)} → ${planLabel(ev.new_plan)}`
                      : planLabel(ev.new_plan ?? ev.previous_plan)}
                    {ev.amount != null && ev.amount > 0 && ` — ${formatBRL(ev.amount)}`}
                    {ev.status && ` · ${ev.status}`}
                  </p>
                  {ev.reasons && ev.reasons.length > 0 && (
                    <p className="text-[11px] text-stone-600 mt-1"><strong>Motivos:</strong> {reasonsLabel(ev.reasons)}</p>
                  )}
                  {ev.comment && <p className="text-[11px] text-stone-500 italic mt-0.5">“{ev.comment}”</p>}
                  {ev.stripe_invoice_id && (
                    <p className="text-[10px] text-stone-300 font-mono mt-1 truncate">{ev.stripe_invoice_id}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Histórico de motivos já efetivados/revertidos */}
      {feedbacks.filter(f => f.status !== 'scheduled').length > 0 && (
        <div className="bg-stone-50 border border-line rounded-xl p-4">
          <p className="text-xs font-semibold text-stone-700 mb-2">Motivos informados anteriormente</p>
          <div className="space-y-2">
            {feedbacks.filter(f => f.status !== 'scheduled').map(f => (
              <div key={f.id} className="bg-white rounded-lg p-2.5 border border-line text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-stone-700">
                    {f.change_type === 'cancellation' ? 'Cancelamento' : 'Downgrade'} · {planLabel(f.current_plan)} → {planLabel(f.target_plan)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${f.status === 'completed' ? 'bg-stone-100 text-stone-500' : 'bg-green-100 text-green-700'}`}>
                    {f.status === 'completed' ? 'efetivado' : 'revertido'}
                  </span>
                </div>
                <p className="text-stone-600 mt-1">{reasonsLabel(f.reasons)}</p>
                {f.comment && <p className="text-stone-400 italic mt-0.5">“{f.comment}”</p>}
                <p className="text-[10px] text-stone-400 mt-1">{formatDateTimeShort(f.requested_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
