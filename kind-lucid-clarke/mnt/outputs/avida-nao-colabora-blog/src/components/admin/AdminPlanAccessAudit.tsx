import { useState } from 'react'
import { Loader2, ShieldCheck, ShieldAlert, Info, SearchCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Verificador de ACESSO por plano (Gratuito/Essencial/Plus) — diferente do "Verificação de
// consistência" em Assinaturas, que compara PREÇO (banco × Stripe). Este aqui confere se as
// regras de liberação de funcionalidade por plano continuam batendo com a matriz oficial
// (README "Planos oficiais"). Só aponta — nunca corrige nada sozinho.
//
// Duas camadas, deixadas bem claras na tela:
// - "banco de dados": a RPC roda ao vivo, a cada clique, lendo a RLS/trigger real do Postgres.
// - "frontend (auditoria manual)": Postgres não lê código React — esses itens são um registro
//   estático da última revisão manual de código, não uma verificação ao vivo.

type Status = 'ok' | 'attention' | 'info'
interface Row { area: string; item: string; layer: string; expected: string; status: Status; detail: string }

const STATUS_ORDER: Record<Status, number> = { attention: 0, info: 1, ok: 2 }
const STATUS_LABEL: Record<Status, string> = { ok: 'Confere', attention: 'Atenção', info: 'Informativo' }
const STATUS_ICON: Record<Status, typeof ShieldCheck> = { ok: ShieldCheck, attention: ShieldAlert, info: Info }
const STATUS_CLS: Record<Status, string> = {
  ok: 'bg-mint/40 border-forest-200 text-forest-800',
  attention: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

export default function AdminPlanAccessAudit() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runCheck() {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_plan_access_audit')
    setLoading(false)
    if (rpcError) { setError(rpcError.message); return }
    const sorted = [...((data ?? []) as Row[])].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    setRows(sorted)
    setCheckedAt(new Date())
  }

  const counts = rows?.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {} as Record<Status, number>)

  return (
    <section className="p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-forest-900 flex items-center gap-2"><SearchCheck className="w-5 h-5 text-forest-600" /> Verificação de acesso por plano</h2>
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">Confere se as regras de liberação de funcionalidade (Gratuito/Essencial/Plus) continuam batendo com a matriz oficial descrita no README. Só aponta divergências — nada é corrigido automaticamente aqui.</p>
        </div>
        <button
          onClick={() => void runCheck()}
          disabled={loading}
          className="admin-btn-primary flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />}
          {loading ? 'Verificando…' : 'Verificar acesso por plano'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-ink-soft flex-wrap">
            <span>Verificado em {checkedAt?.toLocaleString('pt-BR') ?? '—'}</span>
            {counts?.attention ? <span className="text-red-700 font-medium">{counts.attention} atenção</span> : null}
            {counts?.info ? <span className="text-blue-700 font-medium">{counts.info} informativo(s)</span> : null}
            {counts?.ok ? <span className="text-forest-700 font-medium">{counts.ok} conferido(s)</span> : null}
          </div>

          <div className="rounded-xl border border-line bg-paper-soft/60 p-3 text-xs text-ink-soft">
            <strong className="text-forest-800">Como ler:</strong> itens marcados <strong>banco de dados</strong> são verificados agora mesmo, lendo a regra real do Postgres (RLS/trigger) — mesmo que alguém tente pular a tela e pedir o dado direto pela API, essa regra vale. Itens marcados <strong>frontend (auditoria manual)</strong> são só a tela decidindo o que mostrar; o Postgres não lê código React, então esses ficam registrados como um retrato da última revisão de código feita à mão, não uma checagem ao vivo.
          </div>

          <ul className="space-y-2">
            {rows.map((r, i) => {
              const Icon = STATUS_ICON[r.status]
              return (
                <li key={i} className={`flex items-start gap-2.5 border rounded-xl p-3 text-sm ${STATUS_CLS[r.status]}`}>
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide font-semibold opacity-70">{STATUS_LABEL[r.status]} · {r.area} · {r.layer}</p>
                    <p className="font-medium">{r.item} <span className="font-normal opacity-80">— esperado: {r.expected}</span></p>
                    <p className="mt-0.5 opacity-90">{r.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!rows && !loading && (
        <p className="text-sm text-ink-soft py-6 text-center">Clique em "Verificar acesso por plano" para rodar a checagem.</p>
      )}
    </section>
  )
}
