import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, ArrowRight } from 'lucide-react'
import { PLAN_LABELS } from '../../lib/planConstants'

interface Row {
  id: string
  user_id: string | null
  old_plan: string | null
  new_plan: string | null
  reason: string | null
  source: string | null
  change_type: string | null
  created_at: string
  name?: string
  email?: string
}

const label = (p: string | null | undefined) => (p && PLAN_LABELS[p]) || p || '—'

export default function AdminPlanChanges() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase
      .from('plan_change_history')
      .select('id, user_id, old_plan, new_plan, reason, source, change_type, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) { setErr(error.message); setRows([]); setLoading(false); return }
    const list = (data ?? []) as Row[]
    const ids = [...new Set(list.map(r => r.user_id).filter(Boolean))] as string[]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids)
      const byId = new Map((profs ?? []).map(p => [p.user_id as string, p]))
      list.forEach(r => { const p = r.user_id ? byId.get(r.user_id) : null; r.name = (p?.full_name as string) ?? ''; r.email = (p?.email as string) ?? '' })
    }
    setRows(list); setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl text-forest-900">Alterações de plano</h2>
          <p className="text-xs text-ink-soft mt-0.5">Upgrades, downgrades e ajustes manuais — os 200 mais recentes.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-lg text-sm hover:border-forest-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {err && <p className="text-sm text-red-600 mb-3">Erro: {err}</p>}
      {loading ? (
        <p className="text-sm text-ink-soft">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhuma alteração de plano registrada ainda.</p>
      ) : (
        <div className="bg-white border border-line rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-paper-soft border-b border-line text-xs text-ink-soft">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Usuário</th>
                <th className="text-left px-4 py-3">Mudança</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-paper-soft">
                  <td className="px-4 py-3 text-xs text-ink-soft whitespace-nowrap">{new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-4 py-3 text-xs">{r.name || r.email || (r.user_id ? r.user_id.slice(0, 8) : '—')}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1.5">{label(r.old_plan)} <ArrowRight className="w-3 h-3 text-stone-400" /> <strong className="text-forest-900">{label(r.new_plan)}</strong></span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{r.change_type || r.source || '—'}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft max-w-xs truncate">{r.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
