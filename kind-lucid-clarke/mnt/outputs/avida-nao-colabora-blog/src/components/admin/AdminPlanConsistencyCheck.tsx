import { useState } from 'react'
import { Loader2, ShieldAlert, AlertTriangle, Info, SearchCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Etapa 9 (P1): verificador de consistência dos Planos e Assinaturas.
// Só APONTA divergências — nunca corrige nada automaticamente (regra
// explícita da missão). A lógica de comparação vive na Edge Function
// admin-plan-consistency (precisa da chave secreta do Stripe para
// comparar o preço real ao vivo, por isso não roda no cliente).

type Severity = 'critical' | 'warning' | 'info'
type Area = 'catalog' | 'plans' | 'prices' | 'stripe'
interface Finding { severity: Severity; area: Area; message: string }

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Crítico', warning: 'Atenção', info: 'Informativo' }
const SEVERITY_ICON: Record<Severity, typeof ShieldAlert> = { critical: ShieldAlert, warning: AlertTriangle, info: Info }
const SEVERITY_CLS: Record<Severity, string> = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}
const AREA_LABEL: Record<Area, string> = { catalog: 'Catálogo', plans: 'Planos', prices: 'Preços', stripe: 'Stripe' }

export default function AdminPlanConsistencyCheck() {
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runCheck() {
    setLoading(true)
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke('admin-plan-consistency', { body: {} })
    setLoading(false)
    if (fnError || !data?.ok) {
      setError(fnError?.message || data?.error || 'Não foi possível concluir a verificação agora.')
      return
    }
    const sorted = [...(data.findings as Finding[])].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    setFindings(sorted)
    setCheckedAt(data.checked_at)
  }

  const counts = findings?.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }), {} as Record<Severity, number>)

  return (
    <section className="bg-white border border-line rounded-2xl p-6 mb-5">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-forest-900 flex items-center gap-2"><SearchCheck className="w-5 h-5 text-forest-600" /> Verificação de consistência</h2>
          <p className="text-sm text-ink-soft mt-1">Compara catálogo, planos, preços e Stripe. Só aponta divergências — nada é corrigido automaticamente aqui.</p>
        </div>
        <button
          onClick={() => void runCheck()}
          disabled={loading}
          className="flex items-center gap-1.5 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-60 flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />}
          {loading ? 'Verificando…' : 'Verificar planos'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {findings && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 text-xs text-ink-soft flex-wrap">
            <span>Verificado em {checkedAt ? new Date(checkedAt).toLocaleString('pt-BR') : '—'}</span>
            {counts?.critical ? <span className="text-red-700 font-medium">{counts.critical} crítico(s)</span> : null}
            {counts?.warning ? <span className="text-amber-700 font-medium">{counts.warning} atenção</span> : null}
            {counts?.info ? <span className="text-blue-700 font-medium">{counts.info} informativo(s)</span> : null}
          </div>

          {findings.length === 0 ? (
            <p className="text-sm text-forest-700 bg-mint/40 border border-forest-100 rounded-xl p-3">Nenhuma divergência encontrada. Catálogo, planos, preços e Stripe estão consistentes.</p>
          ) : (
            <ul className="space-y-2">
              {findings.map((f, i) => {
                const Icon = SEVERITY_ICON[f.severity]
                return (
                  <li key={i} className={`flex items-start gap-2.5 border rounded-xl p-3 text-sm ${SEVERITY_CLS[f.severity]}`}>
                    <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{SEVERITY_LABEL[f.severity]} · {AREA_LABEL[f.area]}</p>
                      <p>{f.message}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
