import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, Eye, EyeOff } from 'lucide-react'

interface Props {
  userId: string
  onDone: () => void
}

export default function ForceChangePassword({ userId: _userId, onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setSaving(true)
    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) { setError('Erro ao atualizar senha: ' + pwErr.message); setSaving(false); return }

    // Clear the flag via RPC (SECURITY DEFINER — não expõe UPDATE direto em profiles)
    await supabase.rpc('clear_must_change_password')
    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 text-center">Defina uma nova senha</h2>
          <p className="text-sm text-stone-500 text-center mt-2">
            Por segurança, você precisa criar uma senha pessoal antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Nova senha</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
                className="w-full px-3 py-2.5 pr-10 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-1.5 h-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    password.length < 8 ? 'w-1/4 bg-red-400' :
                    password.length < 12 ? 'w-2/4 bg-yellow-400' :
                    'w-full bg-emerald-500'
                  }`}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirmar senha</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              required
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
                confirm && confirm !== password ? 'border-red-300' : 'border-stone-200'
              }`}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || password.length < 8 || password !== confirm}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            {saving ? 'Salvando...' : 'Definir nova senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
