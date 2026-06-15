import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search } from 'lucide-react'

interface UserRow {
  id: string
  user_id: string
  full_name: string | null
  plan: string
  role: string | null
  created_at: string
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, user_id, full_name, plan, role, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [])

  async function updatePlan(id: string, plan: string) {
    await supabase.from('profiles').update({ plan }).eq('id', id)
    setUsers(u => u.map(r => r.id === id ? { ...r, plan } : r))
  }

  async function setAdmin(id: string, isAdmin: boolean) {
    await supabase.from('profiles').update({ role: isAdmin ? 'admin' : null }).eq('id', id)
    setUsers(u => u.map(r => r.id === id ? { ...r, role: isAdmin ? 'admin' : null } : r))
  }

  const filtered = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.user_id?.includes(search)
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Usuários</h1>
      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou ID..."
          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando usuários...</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Plano</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Admin</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{u.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-stone-400">{u.user_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan}
                      onChange={e => updatePlan(u.id, e.target.value)}
                      className="border border-stone-200 rounded px-2 py-1 text-xs focus:outline-none"
                    >
                      {Object.entries(PLAN_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={u.role === 'admin'}
                      onChange={e => setAdmin(u.id, e.target.checked)}
                      className="accent-stone-800"
                    />
                  </td>
                  <td className="px-4 py-3 text-stone-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
