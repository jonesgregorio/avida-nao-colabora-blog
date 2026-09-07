import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'
import { Loader2, RefreshCw, Search, CalendarPlus, CalendarX2, RotateCcw } from 'lucide-react'
import { formatDateTimeBR } from '../../lib/subscriptionStatus'

interface Props {
  userId: string
  cancelAtPeriodEnd: boolean | null
  hasStripe: boolean
  onChanged: () => void | Promise<void>
}

type Busy = null | 'inspect' | 'sync' | 'cancel' | 'reactivate' | 'days'

// Ações administrativas sobre a assinatura. O Stripe continua sendo a fonte
// financeira: cancelar/reativar/sincronizar/consultar passam pela Edge Function
// admin-subscription (admin AAL2, idempotente, auditada). "Dias de cortesia"
// estende o acesso sem tocar em cobrança.
export default function AdminSubscriptionActions({ userId, cancelAtPeriodEnd, hasStripe, onChanged }: Props) {
  const [busy, setBusy] = useState<Busy>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [stripeView, setStripeView] = useState<Record<string, unknown> | null>(null)

  async function invoke(action: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke('admin-subscription', {
      body: { action, user_id: userId, ...extra },
    })
    const res = data as { ok?: boolean; error?: string } & Record<string, unknown> | null
    if (error || !res?.ok) throw new Error(error?.message ?? res?.error ?? 'Falha na operação.')
    return res
  }

  async function consultar() {
    setBusy('inspect'); setMsg(null); setStripeView(null)
    try {
      const res = await invoke('inspect')
      setStripeView((res.stripe as Record<string, unknown>) ?? null)
      if (!res.stripe) setMsg({ ok: true, text: 'Este usuário não tem assinatura no Stripe.' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao consultar.' })
    } finally { setBusy(null) }
  }

  async function sincronizar() {
    if (!window.confirm('Sincronizar os dados desta assinatura com o Stripe agora? Os campos locais serão sobrescritos pelo que estiver no Stripe.')) return
    setBusy('sync'); setMsg(null)
    try {
      await invoke('sync')
      void logAdminAction('config', 'subscription_sync', userId, {})
      setMsg({ ok: true, text: 'Assinatura sincronizada com o Stripe.' })
      await onChanged()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao sincronizar.' })
    } finally { setBusy(null) }
  }

  async function setCancel(value: boolean) {
    const verbo = value ? 'agendar o cancelamento para o fim do ciclo' : 'reativar a assinatura (cancelar o agendamento)'
    if (!window.confirm(`Confirmar: ${verbo}? ${value ? 'O usuário mantém o acesso pago até o fim do ciclo atual.' : ''}`)) return
    setBusy(value ? 'cancel' : 'reactivate'); setMsg(null)
    try {
      const res = await invoke('set_cancel_at_period_end', { value })
      void logAdminAction('config', value ? 'subscription_cancel_scheduled' : 'subscription_reactivated', userId, { effective_end: res.effective_end ?? null })
      setMsg({ ok: true, text: value
        ? `Cancelamento agendado${res.effective_end ? ` para ${formatDateTimeBR(String(res.effective_end))}` : ''}.`
        : 'Assinatura reativada — volta a renovar normalmente.' })
      await onChanged()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro na operação.' })
    } finally { setBusy(null) }
  }

  async function concederDias() {
    const raw = window.prompt('Quantos dias de acesso de cortesia adicionar? (1 a 365)')
    const dias = Number(raw)
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      if (raw != null) setMsg({ ok: false, text: 'Informe um número inteiro entre 1 e 365.' })
      return
    }
    const motivo = window.prompt('Motivo (aparece no cadastro do usuário):') ?? ''
    if (!window.confirm(`Conceder ${dias} dia(s) de acesso de cortesia a este usuário?`)) return
    setBusy('days'); setMsg(null)
    try {
      const { data, error } = await supabase.rpc('admin_grant_courtesy_days', {
        target_user_id: userId, p_days: dias, p_reason: motivo || null,
      })
      if (error) throw error
      const r = (data ?? {}) as { new_until?: string; days_added?: number }
      void logAdminAction('config', 'subscription_courtesy_days', userId, { days: r.days_added, until: r.new_until })
      setMsg({ ok: true, text: `Concedidos ${r.days_added} dia(s). Acesso de cortesia até ${formatDateTimeBR(r.new_until ?? null)}.` })
      await onChanged()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao conceder dias.' })
    } finally { setBusy(null) }
  }

  const btn = 'inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-line bg-white hover:border-forest-300 disabled:opacity-50'

  return (
    <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-stone-700">Ações administrativas</p>

      <div className="flex flex-wrap gap-2">
        <button onClick={consultar} disabled={busy !== null} className={btn}>
          {busy === 'inspect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Consultar Stripe
        </button>
        <button onClick={sincronizar} disabled={busy !== null || !hasStripe} className={btn} title={hasStripe ? '' : 'Sem assinatura Stripe'}>
          {busy === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizar
        </button>
        {cancelAtPeriodEnd ? (
          <button onClick={() => setCancel(false)} disabled={busy !== null} className={btn}>
            {busy === 'reactivate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Reativar assinatura
          </button>
        ) : (
          <button onClick={() => setCancel(true)} disabled={busy !== null} className={btn}>
            {busy === 'cancel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarX2 className="w-3.5 h-3.5" />} Cancelar ao fim do ciclo
          </button>
        )}
        <button onClick={concederDias} disabled={busy !== null} className={btn}>
          {busy === 'days' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />} Conceder dias de cortesia
        </button>
      </div>

      {msg && (
        <p className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? 'bg-mint/50 text-forest-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>
      )}

      {stripeView && (
        <div className="bg-white border border-line rounded-lg p-3">
          <p className="text-[11px] font-semibold text-stone-600 mb-1.5">Estado ao vivo no Stripe</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-stone-600">
            {Object.entries(stripeView).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-stone-400">{k}</span>
                <span className="font-mono truncate">{v === null ? '—' : String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-stone-400">
        O Stripe continua sendo a fonte financeira. Cancelamento é sempre para o fim do ciclo, nunca imediato. Toda ação é confirmada e registrada na auditoria.
      </p>
    </div>
  )
}
