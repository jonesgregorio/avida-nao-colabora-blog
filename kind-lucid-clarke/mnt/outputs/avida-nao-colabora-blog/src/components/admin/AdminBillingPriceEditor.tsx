import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'

type PlanKey = 'essential' | 'plus'
type BillingRow = { plan_key: PlanKey; price_id: string; amount_cents: number; active: boolean }

const LABELS: Record<PlanKey, string> = { essential: 'Essencial', plus: 'Plus' }
const FALLBACK: Record<PlanKey, number> = { essential: 1990, plus: 3990 }

const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

export default function AdminBillingPriceEditor() {
  const [rows, setRows] = useState<Record<PlanKey, BillingRow | null>>({ essential: null, plus: null })
  const [inputs, setInputs] = useState<Record<PlanKey, string>>({ essential: '19,90', plus: '39,90' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<PlanKey | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke('admin-plan-pricing', { body: { action: 'status' } })
    if (!error && data?.ok && Array.isArray(data.prices)) {
      const next: Record<PlanKey, BillingRow | null> = { essential: null, plus: null }
      const nextInputs = { ...inputs }
      for (const row of data.prices as BillingRow[]) {
        if (row.plan_key === 'essential' || row.plan_key === 'plus') {
          next[row.plan_key] = row
          nextInputs[row.plan_key] = (row.amount_cents / 100).toFixed(2).replace('.', ',')
        }
      }
      setRows(next)
      setInputs(nextInputs)
    }
    setLoading(false)
  // inputs deliberately excluded: load replaces values from Stripe status.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void load() }, [load])

  async function updatePrice(planKey: PlanKey) {
    const normalized = inputs[planKey].trim().replace(/\./g, '').replace(',', '.')
    const amount = Number(normalized)
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({ ok: false, text: 'Informe um preço mensal válido.' })
      return
    }
    const cents = Math.round(amount * 100)
    const current = rows[planKey]?.amount_cents ?? FALLBACK[planKey]
    if (cents === current) {
      setMessage({ ok: false, text: 'Esse já é o preço atual de cobrança.' })
      return
    }
    if (!window.confirm(
      `Confirmar ${money(cents)}/mês para o plano ${LABELS[planKey]}?\n\n` +
      'O sistema criará um novo Price no Stripe. Novas assinaturas e futuras trocas usarão o novo valor. Assinaturas já existentes manterão o preço contratado.'
    )) return

    setSaving(planKey)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('admin-plan-pricing', {
      body: { action: 'update', plan_key: planKey, amount_cents: cents },
    })
    setSaving(null)
    const err = error?.message ?? data?.error
    if (err || !data?.ok) {
      setMessage({ ok: false, text: err || 'Não foi possível atualizar o preço.' })
      return
    }
    await logAdminAction('config', 'stripe_plan_price', null, {
      plan_key: planKey, old_price_id: data.old_price_id, new_price_id: data.new_price_id, amount_cents: cents,
    })
    setMessage({ ok: true, text: data.message || 'Preço atualizado no Stripe e sincronizado com o site.' })
    await load()
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-6 mb-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-serif text-2xl text-forest-900">Cobrança no Stripe</h2>
          <p className="text-sm text-ink-soft mt-1">Preço-base real dos planos pagos. Alterações aqui afetam novas assinaturas e futuras trocas de plano.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} title="Atualizar" className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['essential', 'plus'] as PlanKey[]).map(planKey => {
          const row = rows[planKey]
          return (
            <div key={planKey} className="border border-line rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold text-forest-900">{LABELS[planKey]}</p>
                  <p className="text-[11px] text-stone-400 font-mono break-all">{row?.price_id || 'Preço legado configurado por secret'}</p>
                </div>
                <span className="text-[10px] bg-mint text-forest-700 border border-forest-200 px-2 py-1 rounded-full">Mensal · BRL</span>
              </div>
              <label className="block text-xs text-stone-500 mb-1">Novo preço mensal</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-sm text-stone-500">R$</span>
                  <input
                    value={inputs[planKey]}
                    onChange={e => setInputs(v => ({ ...v, [planKey]: e.target.value }))}
                    inputMode="decimal"
                    className="w-full pl-9 pr-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <button
                  onClick={() => void updatePrice(planKey)}
                  disabled={loading || saving !== null}
                  className="px-4 py-2 rounded-lg bg-forest-800 text-white text-sm font-medium hover:bg-forest-900 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving === planKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Atualizar
                </button>
              </div>
              <p className="text-xs text-stone-500 mt-2">Atual: {money(row?.amount_cents ?? FALLBACK[planKey])}/mês</p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
        <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p><strong>Proteção de assinantes:</strong> mudar o preço cria um novo Price no Stripe. Assinaturas existentes não são reajustadas automaticamente. Descontos individuais continuam sendo aplicados separadamente como Coupon do Stripe.</p>
      </div>
      {message && <p className={`mt-3 text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>}
    </section>
  )
}
