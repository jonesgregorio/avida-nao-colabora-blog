import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield, RefreshCw } from 'lucide-react'

interface AdminLog {
  id: string
  admin_id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: any | null
  created_at: string
  admin?: { full_name: string | null }
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-amber-100 text-amber-700',
  publish: 'bg-emerald-100 text-emerald-700',
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('admin_logs')
      .select('*, admin:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter
    ? logs.filter(l =>
        l.action.includes(filter) ||
        l.target_type?.includes(filter) ||
        JSON.stringify(l.details || '').toLowerCase().includes(filter.toLowerCase()) ||
        (l.admin as any)?.full_name?.includes(filter)
      )
    : logs

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Logs de Auditoria</h1>
        <button onClick={load} className="flex items-center gap-2 border border-stone-200 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      <div className="mb-4">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar por ação, tipo, detalhes..."
          className="w-full max-w-sm px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum log encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Data/Hora</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Admin</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Ação</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden md:table-cell">Alvo</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden lg:table-cell">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">
                    {(log.admin as any)?.full_name || log.admin_id?.slice(0, 8) || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || 'bg-stone-100 text-stone-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 hidden md:table-cell">
                    {log.target_type && <span className="capitalize">{log.target_type}</span>}
                    {log.target_id && <span className="text-stone-300 ml-1">#{log.target_id.slice(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 hidden lg:table-cell max-w-xs truncate">
                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-stone-400 mt-4">Exibindo até 200 registros mais recentes.</p>
    </div>
  )
}
