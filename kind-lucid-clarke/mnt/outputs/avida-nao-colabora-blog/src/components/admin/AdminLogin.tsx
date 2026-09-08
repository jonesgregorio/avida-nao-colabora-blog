import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Eye, EyeOff, Loader2, KeyRound, ShieldCheck } from 'lucide-react'
import { LogoIcon } from '../Logo'
import './admin-theme.css'

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
    e.preventDefault(); setError(''); setLoading(true)
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
        setFactorId(totp.id); setChallengeId(challenge.id); setStep('mfa'); setLoading(false); return
      }
    } catch (err) {
      setError((err as Error).message || 'Não foi possível entrar. Verifique e-mail e senha.'); setLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId, code: totpCode.trim() })
      if (vErr) throw vErr
    } catch (err) {
      setError((err as Error).message || 'Código inválido. Tente novamente.'); setLoading(false)
    }
  }

  const inputCls = 'w-full border border-[#ded5c8] bg-[#fffefb] rounded-xl px-3.5 py-3 text-sm text-[#18352B] placeholder:text-[#8d958f] focus:outline-none focus:ring-4 focus:ring-[#1A4A3A]/10 focus:border-[#6f9b86] transition-colors'

  return (
    <div className="admin-login-shell">
      <section className="admin-login-brand">
        <div className="relative z-10 max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <LogoIcon className="w-12 h-12 text-white" />
            <div>
              <p className="font-serif text-2xl leading-none text-white">A Vida Não Colabora</p>
              <p className="text-[11px] tracking-[.22em] uppercase text-white/55 mt-2">Área Administrativa</p>
            </div>
          </div>
          <h1 className="font-serif text-4xl leading-tight text-white mb-4">Gestão que cuida de pessoas.</h1>
          <p className="text-white/62 leading-relaxed text-sm">Um espaço seguro para acompanhar a jornada, organizar o cuidado e administrar cada parte da plataforma com clareza.</p>
          <div className="mt-10 flex items-center gap-2 text-white/55 text-xs"><ShieldCheck className="w-4 h-4" /> Acesso restrito a administradores autorizados.</div>
        </div>
      </section>

      <section className="admin-login-panel">
        <div className="admin-login-card">
          <div className="mb-7">
            <p className="text-xs uppercase tracking-[.15em] text-[#718078] font-semibold mb-2">Admin</p>
            <h2 className="font-serif text-3xl text-[#18352B] mb-2">Bem-vindo de volta</h2>
            <p className="text-sm text-[#6d756f]">{step === 'password' ? 'Entre com suas credenciais para acessar o painel administrativo.' : 'Digite o código de 6 dígitos do seu aplicativo autenticador.'}</p>
          </div>

          {error && <div className="bg-[#FDE5DE] border border-[#efc7bb] text-[#934534] text-sm rounded-xl px-3.5 py-3 mb-4">{error}</div>}

          {step === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#41564c] mb-1.5">E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required autoComplete="username" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#41564c]">Senha</label>
                </div>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className={inputCls + ' pr-10'} required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-3 text-[#87928b] hover:text-[#18352B]" aria-label="Mostrar senha">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 bg-[#123528] hover:bg-[#1A4A3A] text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando…</> : 'Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#41564c] mb-1.5">Código de verificação</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-[#87928b]" />
                  <input type="text" inputMode="numeric" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className={inputCls + ' pl-9 tracking-[.28em] text-center text-lg'} required autoFocus autoComplete="one-time-code" />
                </div>
              </div>
              <button type="submit" disabled={loading || totpCode.length < 6} className="w-full inline-flex items-center justify-center gap-2 bg-[#123528] hover:bg-[#1A4A3A] text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-60">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</> : 'Confirmar acesso'}
              </button>
              <button type="button" onClick={() => { setStep('password'); setError(''); setTotpCode('') }} className="w-full text-[#718078] hover:text-[#18352B] text-sm transition-colors">← Voltar</button>
            </form>
          )}

          <div className="mt-7 pt-5 border-t border-[#e7ded2] text-center">
            <a href="/" className="text-xs text-[#718078] hover:text-[#18352B] transition-colors">Voltar ao site</a>
          </div>
        </div>
      </section>
    </div>
  )
}
