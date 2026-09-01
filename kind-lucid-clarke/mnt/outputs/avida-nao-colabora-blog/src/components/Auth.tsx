import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Eye, EyeOff, Sprout, HeartHandshake, LineChart, ShieldCheck, Leaf, MailCheck, RefreshCw } from 'lucide-react'
import { emailWelcome } from '../lib/emailTriggers'
import { trackEvent } from '../lib/analytics'
import { confirmationRedirectUrl, isEmailConfirmed, isEmailNotConfirmedError } from '../lib/authVerification'
import { LogoIcon } from './Logo'

type AuthMode = 'login' | 'signup' | 'reset' | 'verify' | 'confirmed'

interface AuthProps {
  onBack: () => void
}

const PENDING_VERIFICATION_EMAIL = 'avida_pending_verification_email'

const BENEFITS = [
  { Icon: Sprout, title: 'Autoconhecimento real', desc: 'Ferramentas e conteúdos para você se entender melhor todos os dias.' },
  { Icon: HeartHandshake, title: 'Apoio que acolhe', desc: 'Recursos criados com cuidado para te acompanhar de verdade.' },
  { Icon: LineChart, title: 'Pequenos passos, grandes mudanças', desc: 'Planos personalizados para você evoluir no seu tempo.' },
]

function pendingVerificationEmail() {
  try { return sessionStorage.getItem(PENDING_VERIFICATION_EMAIL) || '' } catch { return '' }
}

function rememberVerificationEmail(value: string) {
  try {
    if (value) sessionStorage.setItem(PENDING_VERIFICATION_EMAIL, value)
    else sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL)
  } catch { /* storage indisponível não bloqueia autenticação */ }
}

function cleanAuthCallbackUrl() {
  try { window.history.replaceState({}, '', '/login') } catch { /* noop */ }
}

export default function Auth({ onBack }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [verificationEmail, setVerificationEmail] = useState(() => pendingVerificationEmail())
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isSignup = mode === 'signup'

  const setModeReset = (m: AuthMode) => {
    setMode(m)
    setError('')
    setSuccess('')
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const confirmationCallback = query.get('email_confirmed') === '1'
    const callbackError = query.get('error') || hash.get('error')
    const callbackErrorCode = query.get('error_code') || hash.get('error_code')

    if (!confirmationCallback && !callbackError) return

    if (callbackError) {
      setMode('verify')
      setVerificationEmail(pendingVerificationEmail())
      setError(callbackErrorCode === 'otp_expired'
        ? 'Este link de confirmação expirou ou já foi utilizado. Solicite um novo link abaixo.'
        : 'Não foi possível confirmar este e-mail com o link recebido. Solicite um novo link e tente novamente.')
      cleanAuthCallbackUrl()
      return
    }

    let active = true
    let resolved = false

    const finishConfirmation = (confirmedUser: { id: string; email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null; user_metadata?: Record<string, unknown> }) => {
      if (!active || resolved || !isEmailConfirmed(confirmedUser)) return
      resolved = true
      const userEmail = confirmedUser.email || pendingVerificationEmail()
      const metadataName = typeof confirmedUser.user_metadata?.full_name === 'string' ? confirmedUser.user_metadata.full_name : ''
      const displayName = metadataName || userEmail?.split('@')[0] || 'você'

      rememberVerificationEmail('')
      setVerificationEmail(userEmail || '')
      setError('')
      setSuccess('E-mail confirmado com sucesso. Sua conta está pronta para uso.')
      setMode('confirmed')
      cleanAuthCallbackUrl()
      trackEvent('email_confirmation_success', { user_id: confirmedUser.id, metadata: { location: 'auth' } })
      if (userEmail) void emailWelcome(confirmedUser.id, userEmail, displayName)
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) finishConfirmation(data.user)
    }).catch(() => undefined)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) finishConfirmation(session.user)
    })

    const timer = window.setTimeout(() => {
      if (!active || resolved) return
      setMode('verify')
      setVerificationEmail(pendingVerificationEmail())
      setError('A confirmação não pôde ser concluída. Solicite um novo link abaixo.')
      cleanAuthCallbackUrl()
    }, 6000)

    return () => {
      active = false
      window.clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  const handleResendConfirmation = async () => {
    const targetEmail = verificationEmail.trim()
    setError('')
    setSuccess('')
    if (!targetEmail) {
      setError('Informe o e-mail usado no cadastro.')
      return
    }

    setResending(true)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: confirmationRedirectUrl(window.location.origin) },
      })
      if (resendError) throw resendError
      rememberVerificationEmail(targetEmail)
      setSuccess('Se houver um cadastro aguardando confirmação para este e-mail, um novo link foi enviado. Verifique também a caixa de spam.')
    } catch (err) {
      const message = String((err as { message?: string })?.message ?? '').toLowerCase()
      setError(message.includes('rate limit') || message.includes('security purposes')
        ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de solicitar outro link.'
        : 'Não foi possível reenviar o link agora. Tente novamente em instantes.')
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (isSignup) {
      if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
      if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
      if (!agreedTerms) { setError('É preciso aceitar os Termos de Uso e a Política de Privacidade.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const targetEmail = email.trim()
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: targetEmail, password })
        if (loginError) {
          if (isEmailNotConfirmedError(loginError)) {
            rememberVerificationEmail(targetEmail)
            setVerificationEmail(targetEmail)
            setMode('verify')
            setSuccess('Seu cadastro existe, mas o e-mail ainda precisa ser confirmado antes do acesso.')
            return
          }
          throw loginError
        }
        if (data.user && !isEmailConfirmed(data.user)) {
          await supabase.auth.signOut()
          rememberVerificationEmail(targetEmail)
          setVerificationEmail(targetEmail)
          setMode('verify')
          setSuccess('Confirme seu e-mail antes de acessar a área logada.')
          return
        }
        trackEvent('login_success', { metadata: { location: 'auth' } })
        onBack()
      } else if (mode === 'signup') {
        const targetEmail = email.trim()
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: confirmationRedirectUrl(window.location.origin),
          },
        })
        if (signUpError) throw signUpError
        if (signUpData.user) {
          trackEvent('register_success', { user_id: signUpData.user.id, metadata: { location: 'auth', email_confirmation_required: true } })
        }
        rememberVerificationEmail(targetEmail)
        setVerificationEmail(targetEmail)
        setMode('verify')
        setSuccess('Conta criada. Enviamos um link de confirmação para o seu e-mail. Confirme o endereço antes de entrar.')
      } else if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        if (resetError) throw resetError
        setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      }
    } catch (err) {
      setError((err as Error).message || 'Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-line rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 focus:border-forest-300 transition-colors'

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between border-b border-line">
        <button onClick={onBack} className="flex items-center gap-2.5" aria-label="Voltar ao site">
          <LogoIcon className="w-7 h-7 text-forest-800" />
          <span className="font-serif text-lg text-forest-900 hidden sm:inline">A Vida Não Colabora</span>
        </button>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-forest-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao site
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-5xl">
          <div className="grid lg:grid-cols-2 bg-paper-soft border border-line rounded-3xl overflow-hidden shadow-sm">
            <div className="p-7 sm:p-9 flex flex-col justify-center">
              <p className="text-sm text-forest-600 flex items-center gap-1.5"><Leaf className="w-4 h-4" /> Boas-vindas ao seu espaço</p>
              <h1 className="font-serif text-3xl sm:text-4xl text-forest-900 leading-tight mt-3">
                Cuidar da mente<br className="hidden sm:block" /> é um ato de coragem.
              </h1>
              <p className="mt-4 text-sm text-ink-soft leading-relaxed max-w-sm">
                A Vida Não Colabora é o seu lugar seguro para entender o que sente, desenvolver equilíbrio emocional e viver com mais leveza.
              </p>
              <ul className="mt-6 space-y-4">
                {BENEFITS.map(({ Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><Icon className="w-4 h-4" /></span>
                    <div>
                      <p className="font-medium text-forest-900 text-sm">{title}</p>
                      <p className="text-sm text-ink-soft leading-snug">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-7 hidden sm:block rounded-2xl overflow-hidden aspect-[16/7] bg-mint flex items-center justify-center">
                <svg viewBox="0 0 560 245" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <rect width="560" height="245" fill="#E8F0EB"/>
                  <circle cx="80" cy="180" r="60" fill="#c0d8c9" opacity="0.5"/>
                  <circle cx="480" cy="60" r="80" fill="#c0d8c9" opacity="0.35"/>
                  <circle cx="280" cy="220" r="45" fill="#8fb5a1" opacity="0.25"/>
                  <path d="M0 160 Q140 100 280 140 Q420 180 560 120 L560 245 L0 245Z" fill="#b9d3c3" opacity="0.4"/>
                  <path d="M0 190 Q140 150 280 170 Q420 190 560 155 L560 245 L0 245Z" fill="#8fb5a1" opacity="0.3"/>
                  <text x="280" y="115" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fill="#1c4a37" opacity="0.7">A Vida Não Colabora</text>
                  <text x="280" y="140" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="#3f6f57" opacity="0.6">um lugar para se organizar por dentro</text>
                </svg>
              </div>
            </div>

            <div className="p-6 sm:p-9 bg-white border-t lg:border-t-0 lg:border-l border-line flex flex-col justify-center">
              {mode === 'verify' ? (
                <div>
                  <div className="w-12 h-12 rounded-full bg-mint flex items-center justify-center text-forest-700 mb-4"><MailCheck className="w-6 h-6" /></div>
                  <h2 className="font-serif text-2xl text-forest-900">Confirme seu e-mail</h2>
                  <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                    Para proteger sua conta, o acesso à área logada só é liberado depois da confirmação do endereço de e-mail.
                  </p>
                  {error && <div className="bg-coral/20 border border-coral/40 text-[#8a3b23] text-sm rounded-xl px-3.5 py-2.5 mt-4">{error}</div>}
                  {success && <div className="bg-mint/60 border border-forest-100 text-forest-800 text-sm rounded-xl px-3.5 py-2.5 mt-4">{success}</div>}
                  <div className="mt-5 space-y-3">
                    <Field label="E-mail do cadastro" htmlFor="verification-email">
                      <input id="verification-email" type="email" value={verificationEmail} onChange={e => setVerificationEmail(e.target.value)} placeholder="seuemail@email.com" className={inputCls} required />
                    </Field>
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resending}
                      className="w-full inline-flex items-center justify-center gap-2 bg-forest-900 hover:bg-forest-800 text-white font-medium py-3 rounded-2xl transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                      {resending ? 'Reenviando…' : 'Reenviar e-mail de confirmação'}
                    </button>
                    <button type="button" onClick={() => setModeReset('login')} className="w-full text-sm text-ink-soft hover:text-forest-900 py-2">
                      Voltar ao login
                    </button>
                  </div>
                </div>
              ) : mode === 'confirmed' ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-mint flex items-center justify-center text-forest-700 mx-auto mb-4"><ShieldCheck className="w-7 h-7" /></div>
                  <h2 className="font-serif text-2xl text-forest-900">E-mail confirmado</h2>
                  <p className="text-sm text-ink-soft mt-2 leading-relaxed">Sua identidade de e-mail foi verificada e a conta está liberada.</p>
                  {success && <div className="bg-mint/60 border border-forest-100 text-forest-800 text-sm rounded-xl px-3.5 py-2.5 mt-4">{success}</div>}
                  <button type="button" onClick={() => window.location.assign('/')} className="mt-5 w-full bg-forest-900 hover:bg-forest-800 text-white font-medium py-3 rounded-2xl transition-colors">
                    Ir para minha conta
                  </button>
                </div>
              ) : (
                <>
                  {mode !== 'reset' ? (
                    <div className="flex gap-1 p-1 bg-mint/40 rounded-2xl mb-6">
                      <button
                        onClick={() => setModeReset('login')}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white text-forest-900 shadow-sm' : 'text-ink-soft hover:text-forest-900'}`}
                      >
                        Entrar
                      </button>
                      <button
                        onClick={() => setModeReset('signup')}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-white text-forest-900 shadow-sm' : 'text-ink-soft hover:text-forest-900'}`}
                      >
                        Criar conta
                      </button>
                    </div>
                  ) : (
                    <h2 className="font-serif text-2xl text-forest-900 mb-1">Recuperar senha</h2>
                  )}

                  {error && <div className="bg-coral/20 border border-coral/40 text-[#8a3b23] text-sm rounded-xl px-3.5 py-2.5 mb-4">{error}</div>}
                  {success && <div className="bg-mint/60 border border-forest-100 text-forest-800 text-sm rounded-xl px-3.5 py-2.5 mb-4">{success}</div>}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignup && (
                      <Field label="Nome completo" htmlFor="auth-name">
                        <input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Digite seu nome" className={inputCls} required />
                      </Field>
                    )}
                    <Field label="E-mail" htmlFor="auth-email">
                      <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@email.com" className={inputCls} required />
                    </Field>
                    {mode !== 'reset' && (
                      <Field label="Senha" htmlFor="auth-password">
                        <div className="relative">
                          <input
                            id="auth-password"
                            type={showPass ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={isSignup ? 'Mínimo 8 caracteres' : 'Sua senha'}
                            className={inputCls + ' pr-10'}
                            required
                            minLength={isSignup ? 8 : undefined}
                          />
                          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-ink-soft" aria-label="Mostrar senha">
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </Field>
                    )}
                    {isSignup && (
                      <Field label="Confirmar senha" htmlFor="auth-confirm-password">
                        <input id="auth-confirm-password" type={showPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Digite novamente sua senha" className={inputCls} required minLength={8} />
                      </Field>
                    )}

                    {isSignup && (
                      <label className="flex items-start gap-2.5 text-sm text-ink-soft cursor-pointer">
                        <input type="checkbox" checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-forest-700 flex-shrink-0" />
                        <span>
                          Eu concordo com os <a href="/termos" target="_blank" rel="noreferrer" className="text-forest-700 underline">Termos de Uso</a> e com a <a href="/privacidade" target="_blank" rel="noreferrer" className="text-forest-700 underline">Política de Privacidade</a>.
                        </span>
                      </label>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 bg-forest-900 hover:bg-forest-800 text-white font-medium py-3 rounded-2xl transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : isSignup ? 'Começar grátis' : 'Enviar link de recuperação'}
                      {isSignup && !loading && <Leaf className="w-4 h-4" />}
                    </button>
                  </form>

                  <div className="mt-5 text-center text-sm">
                    {mode === 'login' && (
                      <div className="space-y-2">
                        <button onClick={() => setModeReset('reset')} className="text-ink-soft hover:text-forest-900 block w-full">Esqueci minha senha</button>
                        <p className="text-ink-soft">Ainda não tem conta? <button onClick={() => setModeReset('signup')} className="text-forest-700 font-medium underline">Criar conta</button></p>
                      </div>
                    )}
                    {isSignup && (
                      <p className="text-ink-soft">Já tem uma conta? <button onClick={() => setModeReset('login')} className="text-forest-700 font-medium underline">Entrar</button></p>
                    )}
                    {mode === 'reset' && (
                      <button onClick={() => setModeReset('login')} className="text-ink-soft hover:text-forest-900">Voltar ao login</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-paper-soft px-5 py-3.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><ShieldCheck className="w-4 h-4" /></span>
              <div>
                <p className="text-sm font-medium text-forest-900">Seus dados estão protegidos.</p>
                <p className="text-xs text-ink-soft">Levamos sua privacidade a sério e não compartilhamos suas informações.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-paper-soft px-5 py-3.5 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><HeartHandshake className="w-4 h-4" /></span>
              <div>
                <p className="text-sm font-medium text-forest-900">Aqui é um espaço seguro.</p>
                <p className="text-xs text-ink-soft">Sem julgamentos, com acolhimento e respeito sempre.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-forest-800 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
