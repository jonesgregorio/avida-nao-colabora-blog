import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { logAdminAction } from '../../lib/adminAudit'
import { Shield, Loader2 } from 'lucide-react'

interface AdminRow {
  id: string
  full_name: string | null
  user_id: string
  role: string
  created_at: string
  admin_role?: string | null
}

interface Perm { admin_role: string; module: string; action: string; allowed: boolean }

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', content: 'Conteúdo', support: 'Atendimento', finance: 'Financeiro', analyst: 'Analista',
}
const ROLE_DESC: Record<string, string> = {
  super_admin: 'Acesso total, incluindo permissões.',
  content: 'Artigos, conteúdo guiado e comunicação.',
  support: 'Usuários, mensagens e suporte.',
  finance: 'Assinaturas, cobranças e relatórios financeiros.',
  analyst: 'Só leitura: painéis, analytics e auditoria.',
}
const MODULES = ['overview', 'users', 'content', 'communication', 'finance', 'analytics', 'system', 'audit'] as const
const MODULE_LABEL: Record<string, string> = {
  overview: 'Visão geral', users: 'Usuários', content: 'Conteúdo', communication: 'Comunicação',
  finance: 'Financeiro', analytics: 'Analytics', system: 'Sistema', audit: 'Auditoria',
}

export default function AdminPermissions() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [perms, setPerms] = useState<Perm[]>([])
  const [rbac, setRbac] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, role, created_at, admin_role')
      .eq('role', 'admin').order('created_at')
    setAdmins((data ?? []) as AdminRow[])

    const { data: matrix, error } = await supabase.rpc('admin_rbac_matrix')
    if (!error && matrix) {
      setRbac(true)
      setPerms((((matrix as { permissions?: Perm[] }).permissions) ?? []))
    } else {
      setRbac(false)
    }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  async function changeRole(a: AdminRow, role: string) {
    setBusyId(a.id)
    const { error } = await supabase.rpc('admin_set_admin_role', { target_user_id: a.user_id, p_role: role })
    setBusyId(null)
    if (error) { showToast('Não foi possível: ' + error.message); return }
    void logAdminAction('config', 'admin_role', a.user_id, { role })
    showToast(`Papel de ${a.full_name || a.user_id.slice(0, 8)} agora é ${ROLE_LABEL[role]}.`)
    void load()
  }

  async function revokeAdmin(a: AdminRow) {
    const isSelf = a.user_id === user?.id
    if (!window.confirm(isSelf
      ? 'Remover a SUA própria permissão de administrador? Você perde o painel imediatamente.'
      : `Remover a permissão de administrador de ${a.full_name || a.user_id.slice(0, 8)}?`)) return
    setBusyId(a.id)
    const { error } = await supabase.from('profiles').update({ role: 'user' }).eq('id', a.id)
    setBusyId(null)
    if (error) {
      showToast(error.message.includes('último administrador')
        ? 'Não é possível remover o último administrador.'
        : 'Não foi possível atualizar a permissão.')
      return
    }
    void logAdminAction('revoke_admin', 'profile', a.user_id, { role: 'user', revoked_self: isSelf })
    showToast('Permissão removida (registrado na auditoria).')
    void load()
  }

  const can = (role: string, module: string, action: string) =>
    role === 'super_admin' || perms.some(p => p.admin_role === role && p.module === module && p.action === action && p.allowed)

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-forest-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      <h1 className="font-serif text-2xl text-forest-900 mb-2">Permissões</h1>
      <p className="text-stone-500 text-sm mb-6">
        Cada administrador tem um <strong>papel</strong>. O que cada papel pode fazer é verificado no servidor — esconder na tela não basta.
      </p>

      {loading ? (
        <p className="text-stone-400 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
      ) : (
        <>
          {!rbac && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
              Os papéis administrativos ficam disponíveis após o deploy desta etapa. Por enquanto, todo administrador tem acesso total.
            </div>
          )}

          <div className="bg-white rounded-xl border border-line p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-forest-700" />
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Administradores</h2>
            </div>
            <div className="space-y-3">
              {admins.map(a => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-line last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-forest-900">{a.full_name || a.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-stone-400">Admin desde {new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rbac && (
                      <select
                        value={a.admin_role ?? 'super_admin'}
                        disabled={busyId === a.id}
                        onChange={e => void changeRole(a, e.target.value)}
                        className="text-xs border border-line rounded-lg px-2 py-1.5 bg-white"
                      >
                        {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                    <button
                      onClick={() => void revokeAdmin(a)}
                      disabled={busyId === a.id}
                      className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === a.id ? '…' : 'Revogar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {rbac && (
            <div className="bg-white rounded-xl border border-line p-5 mb-6 overflow-x-auto">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-3">O que cada papel pode fazer</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-stone-400 font-medium">Módulo</th>
                    {Object.keys(ROLE_LABEL).map(r => (
                      <th key={r} className="p-2 text-stone-500 font-medium" title={ROLE_DESC[r]}>{ROLE_LABEL[r]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(m => (
                    <tr key={m} className="border-t border-line">
                      <td className="p-2 text-stone-700">{MODULE_LABEL[m]}</td>
                      {Object.keys(ROLE_LABEL).map(r => {
                        const v = can(r, m, 'view'), o = can(r, m, 'operate')
                        return (
                          <td key={r} className="p-2 text-center">
                            {o ? <span className="text-forest-700 font-medium">editar</span>
                              : v ? <span className="text-stone-500">ver</span>
                                : <span className="text-stone-300">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-stone-400 mt-3">
                Matriz padrão (somente leitura por enquanto). O papel <strong>Super Admin</strong> tem tudo. As ações sensíveis já são barradas no servidor pelos papéis restritos.
              </p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            <strong>Cuidado:</strong> Super Admin tem acesso total, incluindo dados de usuários, financeiro e auditoria. Mantenha esse papel só para pessoas de confiança.
          </div>
        </>
      )}
    </div>
  )
}
