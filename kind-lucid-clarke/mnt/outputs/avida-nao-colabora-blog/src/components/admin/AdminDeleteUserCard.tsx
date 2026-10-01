import { useState } from 'react'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// "Zona de risco" do usuário (Admin → Usuários → Segurança): excluir a conta DEFINITIVAMENTE.
// Toda a regra de segurança está no servidor (Edge Function admin-delete-user: só admin com MFA,
// confere o e-mail, recusa admin e contas com cobrança). Aqui só pedimos a confirmação.

interface Props {
  user: { user_id: string; email: string | null; full_name: string | null; role: string | null }
  onDeleted: () => void
}

export default function AdminDeleteUserCard({ user, onDeleted }: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const email = (user.email ?? '').trim()
  const isAdmin = user.role === 'admin'
  const matches = email.length > 0 && typed.trim().toLowerCase() === email.toLowerCase()

  async function remove() {
    if (!matches || busy) return
    setBusy(true)
    setError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: user.user_id, confirm_email: typed.trim() },
      })
      const res = data as { ok?: boolean; error?: string } | null
      if (fnError || !res?.ok) {
        // a função devolve a mensagem em JSON mesmo com status de erro
        let message = res?.error
        if (!message && fnError && 'context' in fnError) {
          try { message = ((await (fnError as { context: Response }).context.json()) as { error?: string }).error } catch { /* sem corpo */ }
        }
        throw new Error(message || 'Não foi possível excluir o usuário agora.')
      }
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível excluir o usuário agora.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-red-200 bg-red-50/50 rounded-xl p-4">
      <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5"><TriangleAlert className="w-3.5 h-3.5" />Zona de risco</p>
      <p className="text-xs text-stone-600 mt-1">Excluir a conta remove o acesso e os dados pessoais da pessoa. Não dá para desfazer.</p>

      {isAdmin ? (
        <p className="text-xs text-stone-500 mt-3">Contas administrativas não podem ser excluídas por aqui.</p>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 text-sm border border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50">
          <Trash2 className="w-4 h-4" />Excluir usuário…
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <ul className="list-disc pl-5 text-xs text-stone-700 space-y-1">
            <li>A conta e o perfil são apagados, junto com diário, check-ins, relatórios, notificações e demais registros dela.</li>
            <li>Contas com histórico de cobrança (Stripe) são recusadas: cancele a assinatura em Assinaturas antes.</li>
            <li>A exclusão fica registrada em Sistema → Logs (sem o e-mail completo).</li>
          </ul>
          <div>
            <label htmlFor="delete-user-confirm" className="block text-xs text-red-700 mb-1">
              Para confirmar, digite o e-mail da conta: <strong className="break-all">{email || '(sem e-mail)'}</strong>
            </label>
            <input
              id="delete-user-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="e-mail do usuário"
              className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
          {error && <p role="alert" className="text-xs text-red-700 bg-red-100 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void remove()} disabled={!matches || busy} className="inline-flex items-center gap-2 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {busy ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(''); setError('') }} disabled={busy} className="text-sm border border-line px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
