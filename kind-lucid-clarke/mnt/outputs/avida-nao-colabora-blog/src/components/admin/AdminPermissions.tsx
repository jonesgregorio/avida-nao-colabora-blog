import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield } from 'lucide-react'

interface AdminUser {
  id: string
  full_name: string | null
  user_id: string
  role: string
  plan: string
  created_at: string
}

export default function AdminPermissions() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, role, plan, created_at')
      .eq('role', 'admin')
      .order('created_at')
    setAdmins(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function revokeAdmin(id: string, name: string) {
    if (!confirm(`Remover permissão de admin de ${name}?`)) return
    await supabase.from('profiles').update({ role: 'user' }).eq('id', id)
    showToast('Permissão removida.')
    load()
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-forest-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      <h1 className="font-serif text-2xl text-forest-900 mb-2">Permissões</h1>
      <p className="text-stone-500 text-sm mb-6">
        Gerencie quem tem acesso ao painel administrativo. Para promover um usuário a admin, vá em <strong>Usuários</strong> e ative o toggle de admin.
      </p>

      <div className="bg-white rounded-xl border border-line p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-forest-700" />
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Administradores ativos</h2>
        </div>

        {loading ? (
          <p className="text-stone-400 text-sm">Carregando...</p>
        ) : admins.length === 0 ? (
          <p className="text-stone-400 text-sm">Nenhum admin encontrado.</p>
        ) : (
          <div className="space-y-3">
            {admins.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                <div>
                  <p className="text-sm font-medium text-forest-900">{a.full_name || a.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-stone-400">
                    Admin desde {new Date(a.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => revokeAdmin(a.id, a.full_name || a.user_id.slice(0, 8))}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50"
                >
                  Revogar admin
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <strong>Cuidado:</strong> Administradores têm acesso total ao painel, incluindo dados de usuários, configurações financeiras e logs de auditoria. Mantenha apenas pessoas de confiança com essa permissão.
      </div>
    </div>
  )
}
