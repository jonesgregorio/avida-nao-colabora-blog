import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'
import { LogoIcon } from '../Logo'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'password' | 'mfa'>('password')
  const [totpCode, setTotpCode] = useState('')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) throw err

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.nextLevel === 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totp = factors?.totp?.[0]
        if (!totp) { setError('MFA configurado mas nenhum fator TOTP encontrado.'); setLoading(false); return }
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (cErr || !challenge) throw cErr ?? new Error('Erro ao iniciar desafio MFA')
        setFactorId(totp.id)
        setChallengeId(challenge.id)
        setStep('mfa')
        setLoading(false)
        return
      }
      // AAL1 sem MFA cadastrado — login direto (admin deve configurar MFA na conta)
    } catch (err) {
      setError((err as Error).message || 'Não foi possível entrar. Verifique e-mail e senha.')
      setLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: totpCode.trim(),
      })
      if (vErr) throw vErr
      // Verificação OK — useAuth detecta a sessão e o AdminPanel assume
    } catch (err) {
      setError((err as Error).message || 'Código inválido. Tente novamente.')
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
          <p className="text-sm text-white/50 mb-6">
            {step === 'password' ? 'Acesso restrito à equipe. Entre com sua conta de administrador.' : 'Digite o código de 6 dígitos do seu aplicativo autenticador.'}
          </p>

          {error && <div className="bg-red-500/15 border border-red-400/30 text-red-200 text-sm rounded-xl px-3.5 py-2.5 mb-4">{error}</div>}

          {step === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
              <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-2xl transition-colors disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando…</> : 'Entrar no painel'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Código de verificação</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-2.5 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className={inputCls + ' pl-9 tracking-widest text-center text-lg'}
                    required
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading || totpCode.length < 6} className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-2xl transition-colors disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</> : 'Confirmar'}
              </button>
              <button type="button" onClick={() => { setStep('password'); setError(''); setTotpCode('') }} className="w-full text-white/40 hover:text-white/70 text-sm transition-colors">
                ← Voltar
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/40 mt-5">
          <a href="/" className="hover:text-white/70 transition-colors">← Voltar ao site</a>
        </p>
      </div>
    </div>
  )
}
