import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { PlanFeatureCatalog } from '../../lib/planFeatureCatalog'
import { inspectPlanFeatureCatalog } from '../../lib/planFeatureConsistency'
import { getPlanLabel } from '../../lib/officialPlans'

export default function AdminPlanFeatureConsistency({ catalog }: { catalog: PlanFeatureCatalog }) {
  const issues = inspectPlanFeatureCatalog(catalog)
  const errors = issues.filter(issue => issue.severity === 'error')
  const warnings = issues.filter(issue => issue.severity === 'warning')

  if (issues.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-700" />
          <div>
            <h2 className="text-sm font-semibold text-green-900">Catálogo consistente com as regras técnicas</h2>
            <p className="mt-1 text-xs leading-relaxed text-green-800">Os recursos técnicos anunciados e os acessos dos planos estão alinhados. O verificador é somente preventivo e não altera nada sozinho.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-amber-950">Verificação de consistência dos planos</h2>
            {errors.length > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">{errors.length} {errors.length === 1 ? 'erro' : 'erros'}</span>}
            {warnings.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'}</span>}
          </div>
          <p className="mt-1 text-xs text-amber-800">Nada é corrigido automaticamente. Revise os itens abaixo antes de publicar novos textos ou alterar permissões.</p>

          <div className="mt-4 space-y-2">
            {issues.map(issue => (
              <div key={issue.id} className={`rounded-xl border bg-white p-3 ${issue.severity === 'error' ? 'border-red-200' : 'border-amber-200'}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-forest-900">{issue.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{issue.detail}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-stone-400">
                      <span className="font-mono">{issue.featureKey}</span>
                      {issue.plan && <span>Plano: {getPlanLabel(issue.plan)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
