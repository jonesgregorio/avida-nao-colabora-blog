import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { LogoIcon } from '../Logo'

// Login DEDICADO do painel admin (rota /admin) — não depende do login do blog.
// Autentica direto; o AdminPanel decide se a conta tem permissão de admin.
export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) throw err
      // Sucesso: o onAuthStateChange do useAuth atualiza a sessão e o AdminPanel
      // reavalia a permissão automaticamente. Não navega para o blog.
    } catch (err) {
      setError((err as Error).message || 'Não foi possível entrar. Verifique e-mail e senha.')
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-white/15 bg-white/5 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-colors'

  return (
    <div className="min-h-screen bg-forest-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-6 text-white">
          <LogoIcon className="w-8 h-8" />
          <span className="font-serif text-xl leading-none">A Vida Não Colabora</span>
        </div>

        <div className="bg-white/[0.06] border border-white/10 rounded-3xl p-7 shadow-xl">
          <div className="flex items-center gap-2 text-emerald-300 mb-1">
            <Shield className="w-5 h-5" />
            <h1 className="font-serif text-xl text-white">Painel Administrativo</h1>
          </div>
          <p className="text-sm text-white/50 mb-6">Acesso restrito à equipe. Entre com sua conta de administrador.</p>

          {error && <div className="bg-red-500/15 border border-red-400/30 text-red-200 text-sm rounded-xl px-3.5 py-2.5 mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@email.com" className={inputCls} required autoComplete="username" />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className={inputCls + ' pr-10'}
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-2.5 text-white/40 hover:text-white/70" aria-label="Mostrar senha">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-2xl transition-colors disabled:opacity-60"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando…</> : 'Entrar no painel'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/40 mt-5">
          <a href="/" className="hover:text-white/70 transition-colors">← Voltar ao site</a>
        </p>
      </div>
    </div>
  )
}
