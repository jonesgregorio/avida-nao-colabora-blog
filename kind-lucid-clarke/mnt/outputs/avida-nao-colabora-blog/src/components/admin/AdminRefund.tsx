import { useState } from 'react'
import { Loader2, RotateCcw, AlertTriangle, Check, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Reembolso de uma cobrança específica pelo Admin. Duas etapas:
//   1. consulta a cobrança (preview) e mostra valor / cliente / descrição
//   2. confirma com motivo obrigatório + digitar REEMBOLSAR
// Backend: Edge Function admin-refund (AAL2 + teto + auditoria).

interface Preview {
  charge_id: string
  payment_intent: string | null
  amount: number
  amount_refunded: number
  refundable: number
  currency: string
  customer_email: string | null
  description: string | null
  created: number
}

const brl = (cents: number, currency = 'brl') =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: currency.toUpperCase() })

export default function AdminRefund() {
  const [id, setId] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [maxCents, setMaxCents] = useState(50_000)
  const [amount, setAmount] = useState('') // reais, string
  const [reason, setReason] = useState('')
  const [confirmWord, setConfirmWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ refund_id: string; amount_cents: number; currency: string; status: string | null } | null>(null)

  function reset() {
    setPreview(null); setAmount(''); setReason(''); setConfirmWord(''); setErr(''); setDone(null)
  }

  async function consultar() {
    setBusy(true); setErr(''); setDone(null); setPreview(null)
    const { data, error } = await supabase.functions.invoke('admin-refund', { body: { id: id.trim() } })
    setBusy(false)
    const d = data as { preview?: Preview; max_cents?: number; error?: string }
    if (error || d?.error) { setErr(d?.error || error?.message || 'Falha ao consultar.'); return }
    if (d?.preview) {
      setPreview(d.preview)
      setMaxCents(d.max_cents ?? 50_000)
      setAmount((d.preview.refundable / 100).toFixed(2))
    }
  }

  async function reembolsar() {
    if (!preview) return
    const cents = Math.round(parseFloat(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents <= 0) { setErr('Valor inválido.'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('admin-refund', {
      body: { id: preview.charge_id, amount_cents: cents, reason: reason.trim(), confirm: true },
    })
    setBusy(false)
    const d = data as { ok?: boolean; refund_id?: string; amount_cents?: number; currency?: string; status?: string | null; error?: string }
    if (error || d?.error || !d?.ok) { setErr(d?.error || error?.message || 'Falha ao reembolsar.'); return }
    setDone({ refund_id: d.refund_id!, amount_cents: d.amount_cents!, currency: d.currency ?? 'brl', status: d.status ?? null })
  }

  const centsWanted = Math.round((parseFloat(amount.replace(',', '.')) || 0) * 100)
  const overCap = centsWanted > maxCents
  const overRefundable = preview ? centsWanted > preview.refundable : false
  const canRefund = !!preview && !overCap && !overRefundable && centsWanted > 0
    && reason.trim().length >= 5 && confirmWord.trim().toUpperCase() === 'REEMBOLSAR'

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-forest-700" />
        <h3 className="font-serif text-lg text-forest-900">Reembolso</h3>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Reembolsa uma cobrança específica no Stripe. Exige o ID da cobrança (<code>ch_…</code>), do pagamento (<code>pi_…</code>) ou da fatura (<code>in_…</code>) —
        você encontra no dashboard do Stripe ou no e-mail do cliente. Ação irreversível.
      </p>

      {done ? (
        <div className="mt-4 rounded-xl border border-forest-200 bg-mint/30 p-4 text-sm">
          <p className="inline-flex items-center gap-1.5 font-medium text-forest-800">
            <Check className="h-4 w-4" /> Reembolso enviado: {brl(done.amount_cents, done.currency)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            <code>{done.refund_id}</code> · status {done.status ?? '—'} ·{' '}
            <a href={`https://dashboard.stripe.com/refunds/${done.refund_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-forest-700 underline">
              ver no Stripe <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <button onClick={() => { reset(); setId('') }} className="mt-3 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-forest-800 hover:border-forest-300">
            novo reembolso
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[220px] text-xs text-ink-soft">
              ID da cobrança / pagamento / fatura
              <input
                value={id}
                onChange={e => { setId(e.target.value); reset() }}
                placeholder="ch_… / pi_… / in_…"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-forest-300"
              />
            </label>
            <button onClick={consultar} disabled={busy || id.trim().length < 6} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-forest-800 hover:border-forest-300 disabled:opacity-40">
              {busy && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : null} consultar
            </button>
          </div>

          {err && <p className="inline-flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {err}</p>}

          {preview && (
            <div className="rounded-xl border border-line bg-paper/50 p-3 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-ink-soft">Cobrança</dt><dd className="font-mono">{preview.charge_id}</dd>
                <dt className="text-ink-soft">Cliente</dt><dd>{preview.customer_email ?? '—'}</dd>
                <dt className="text-ink-soft">Descrição</dt><dd>{preview.description ?? '—'}</dd>
                <dt className="text-ink-soft">Valor pago</dt><dd>{brl(preview.amount, preview.currency)}</dd>
                <dt className="text-ink-soft">Já reembolsado</dt><dd>{brl(preview.amount_refunded, preview.currency)}</dd>
                <dt className="text-ink-soft font-medium text-forest-800">Reembolsável agora</dt><dd className="font-medium text-forest-800">{brl(preview.refundable, preview.currency)}</dd>
              </dl>

              {preview.refundable <= 0 ? (
                <p className="mt-3 text-xs text-amber-700">Essa cobrança já foi totalmente reembolsada.</p>
              ) : (
                <div className="mt-3 space-y-2.5 border-t border-line pt-3">
                  <label className="block text-xs text-ink-soft">
                    Valor a reembolsar (R$) <span className="text-stone-400">— teto por operação {brl(maxCents)}</span>
                    <input
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      inputMode="decimal"
                      className="mt-1 w-40 rounded-lg border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
                    />
                    {overCap && <span className="mt-0.5 block text-[11px] text-red-600">acima do teto — faça pelo Stripe</span>}
                    {overRefundable && <span className="mt-0.5 block text-[11px] text-red-600">acima do reembolsável</span>}
                  </label>
                  <label className="block text-xs text-ink-soft">
                    Motivo (obrigatório, fica registrado)
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={2}
                      className="mt-1 w-full resize-y rounded-lg border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
                    />
                  </label>
                  <label className="block text-xs text-ink-soft">
                    Digite <b>REEMBOLSAR</b> para confirmar
                    <input
                      value={confirmWord}
                      onChange={e => setConfirmWord(e.target.value)}
                      className="mt-1 w-48 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-forest-300"
                    />
                  </label>
                  <button
                    onClick={reembolsar}
                    disabled={busy || !canRefund}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Reembolsar {centsWanted > 0 ? brl(centsWanted, preview.currency) : ''}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
