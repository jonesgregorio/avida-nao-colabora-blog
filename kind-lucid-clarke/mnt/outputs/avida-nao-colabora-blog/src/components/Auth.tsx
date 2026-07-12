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
        setSuccess('Conta criada com sucesso! Entrando…')
        setTimeout(() => onBack(), 1200)
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
