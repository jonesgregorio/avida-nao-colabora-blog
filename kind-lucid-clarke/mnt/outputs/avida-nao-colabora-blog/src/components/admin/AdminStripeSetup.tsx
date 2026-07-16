import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react'

// Painel admin para: (1) configurar os eventos do webhook Stripe e (2) rodar o
// autoteste da lógica de cobrança — ambos server-side (a STRIPE_SECRET_KEY fica
// nas Edge Functions; o frontend só dispara). Modo teste, sem cobrança real.
export default function AdminStripeSetup() {
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ fn: string; data: unknown } | null>(null)

  async function call(fn: 'configure-stripe-webhook' | 'stripe-selftest' | 'stripe-audit', body: Record<string, unknown> = {}) {
    const tag = (body.scope as string) ? `${fn}:${body.scope}` : fn
    setBusy(tag); setResult(null)
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body })
      setResult({ fn: tag, data: error ? { error: error.message } : data })
    } catch (e) {
      setResult({ fn: tag, data: { error: e instanceof Error ? e.message : 'erro' } })
    } finally { setBusy(null) }
  }

  const ok = (result?.data as { ok?: boolean })?.ok

  return (
    <div className="bg-white rounded-xl border border-line p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="w-4 h-4 text-sage-600" />
        <h3 className="font-semibold text-forest-900 text-sm">Stripe — setup &amp; autoteste</h3>
      </div>
      <p className="text-xs text-stone-500 mb-4">
        Os botões de <strong>auditoria</strong> são somente leitura: não criam, alteram nem apagam nada no Stripe — pode clicar à vontade.
        O <strong>autoteste de cobrança</strong> exercita upgrade/downgrade/idempotência com cartões fictícios e só roda com chave de teste;
        com a conta em modo live ele recusa sozinho (cartão fictício não existe em live, e o fluxo real significaria cobrança de verdade).
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => call('stripe-audit')} disabled={!!busy}
          className="flex items-center gap-2 bg-forest-700 hover:bg-forest-800 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {busy === 'stripe-audit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Auditar configuração (somente leitura)
        </button>
        <button onClick={() => call('stripe-audit', { scope: 'webhook' })} disabled={!!busy}
          className="flex items-center gap-2 bg-forest-700 hover:bg-forest-800 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {busy === 'stripe-audit:webhook' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Auditar webhook (somente leitura)
        </button>
        <button onClick={() => call('stripe-audit', { scope: 'db' })} disabled={!!busy}
          className="flex items-center gap-2 bg-forest-700 hover:bg-forest-800 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {busy === 'stripe-audit:db' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Auditar dados sincronizados (Stripe × banco)
        </button>
        <button onClick={() => call('stripe-audit', { scope: 'diagnose' })} disabled={!!busy}
          data-testid="stripe-diagnose"
          className="flex items-center gap-2 bg-forest-700 hover:bg-forest-800 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {busy === 'stripe-audit:diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Diagnosticar entrega de eventos
        </button>
        <button onClick={() => call('configure-stripe-webhook')} disabled={!!busy}
          className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {busy === 'configure-stripe-webhook' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Configurar eventos do webhook
        </button>
        <button onClick={() => call('stripe-selftest')} disabled={!!busy}
          className="flex items-center gap-2 border border-stone-300 text-stone-700 hover:bg-stone-50 text-sm px-3 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {busy === 'stripe-selftest' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Rodar autoteste de cobrança
        </button>
      </div>
      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2 text-sm">
            {ok ? <CheckCircle className="w-4 h-4 text-forest-700" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span className="font-medium text-stone-700">{result.fn}: {ok ? 'OK' : 'ver detalhes'}</span>
          </div>
          <pre className="text-xs bg-forest-900 text-stone-100 rounded-lg p-3 overflow-auto max-h-72">{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
