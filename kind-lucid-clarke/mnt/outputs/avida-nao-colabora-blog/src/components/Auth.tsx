import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Eye, EyeOff, Sprout, HeartHandshake, LineChart, ShieldCheck, Leaf } from 'lucide-react'
import { emailWelcome } from '../lib/emailTriggers'
import { LogoIcon } from './Logo'

type AuthMode = 'login' | 'signup' | 'reset'

interface AuthProps {
  onBack: () => void
}

const BENEFITS = [
  { Icon: Sprout, title: 'Autoconhecimento real', desc: 'Ferramentas e conteúdos para você se entender melhor todos os dias.' },
  { Icon: HeartHandshake, title: 'Apoio que acolhe', desc: 'Recursos criados com cuidado para te acompanhar de verdade.' },
  { Icon: LineChart, title: 'Pequenos passos, grandes mudanças', desc: 'Planos personalizados para você evoluir no seu tempo.' },
]

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

export default function Auth({ onBack }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isSignup = mode === 'signup'

  const setModeReset = (m: AuthMode) => { setMode(m); setError(''); setSuccess('') }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError('Não foi possível entrar com o Google agora. Tente com e-mail e senha.')
      setLoading(false)
    }
    // sucesso → o navegador redireciona para o Google
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (isSignup) {
      if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
      if (!agreedTerms) { setError('É preciso aceitar os Termos de Uso e a Política de Privacidade.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onBack()
      } else if (mode === 'signup') {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: name } },
        })
        if (error) throw error
        if (signUpData.user) void emailWelcome(signUpData.user.id, email, name || 'você')
        setSuccess('Conta criada com sucesso! Verifique seu e-mail se necessário.')
        setTimeout(() => onBack(), 2000)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
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
      {/* Top bar */}
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between border-b border-line">
        <button onClick={onBack} className="flex items-center gap-2.5" aria-label="A Vida Não Colabora">
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
            {/* ─── Lado esquerdo ─── */}
            <div className="p-7 sm:p-9 flex flex-col justify-center">
              <p className="text-sm text-forest-600 flex items-center gap-1.5"><Leaf className="w-4 h-4" /> Bem-vindo(a) ao seu espaço</p>
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
              <div className="mt-7 hidden sm:block rounded-2xl overflow-hidden aspect-[16/7] bg-mint">
                <img
                  src="https://images.unsplash.com/photo-1495197359483-d092478c170a?w=700&q=80"
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            </div>

            {/* ─── Lado direito (card de auth) ─── */}
            <div className="p-6 sm:p-9 bg-white border-t lg:border-t-0 lg:border-l border-line flex flex-col justify-center">
              {/* Tabs */}
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

              {mode !== 'reset' && (
                <>
                  <button
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 border border-line rounded-xl py-2.5 text-sm font-medium text-ink hover:bg-mint/40 transition-colors disabled:opacity-60"
                  >
                    <GoogleIcon /> Entrar com Google
                  </button>
                  <div className="flex items-center gap-3 my-5">
                    <span className="flex-1 h-px bg-line" />
                    <span className="text-xs text-ink-soft">ou</span>
                    <span className="flex-1 h-px bg-line" />
                  </div>
                </>
              )}

              {error && <div className="bg-coral/20 border border-coral/40 text-[#8a3b23] text-sm rounded-xl px-3.5 py-2.5 mb-4">{error}</div>}
              {success && <div className="bg-mint/60 border border-forest-100 text-forest-800 text-sm rounded-xl px-3.5 py-2.5 mb-4">{success}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <Field label="Nome completo">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Digite seu nome" className={inputCls} required />
                  </Field>
                )}
                <Field label="E-mail">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@email.com" className={inputCls} required />
                </Field>
                {mode !== 'reset' && (
                  <Field label="Senha">
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={inputCls + ' pr-10'}
                        required
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-ink-soft" aria-label="Mostrar senha">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                )}
                {isSignup && (
                  <Field label="Confirmar senha">
                    <input type={showPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Digite novamente sua senha" className={inputCls} required minLength={6} />
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
            </div>
          </div>

          {/* Faixa de confiança */}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-forest-800 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
