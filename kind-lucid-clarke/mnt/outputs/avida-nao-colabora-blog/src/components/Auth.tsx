import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Eye, EyeOff, Heart } from 'lucide-react'

type AuthMode = 'login' | 'signup' | 'reset'

interface AuthProps {
  onBack: () => void
}

export default function Auth({ onBack }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onBack()
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        // Perfil criado automaticamente pelo trigger handle_new_user no banco
        setSuccess('Conta criada com sucesso! Verifique seu e-mail se necessário.')
        setTimeout(() => onBack(), 2000)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sand-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sage-600 hover:text-sage-800 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-sand-200 p-8">
          <div className="flex items-center gap-2 justify-center mb-6">
            <Heart className="w-6 h-6 text-sage-500" />
            <span className="font-serif text-2xl text-sage-800">A Vida Não Colabora</span>
          </div>

          <h2 className="font-serif text-2xl text-center text-sage-800 mb-2">
            {mode === 'login' && 'Entrar'}
            {mode === 'signup' && 'Criar conta'}
            {mode === 'reset' && 'Recuperar senha'}
          </h2>
          <p className="text-sm text-sage-500 text-center mb-6">
            {mode === 'login' && 'Bem-vindo(a) de volta ao seu espaço.'}
            {mode === 'signup' && 'Crie seu espaço seguro de bem-estar.'}
            {mode === 'reset' && 'Enviaremos um link para redefinir sua senha.'}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-sage-50 border border-sage-200 text-sage-700 text-sm rounded-lg p-3 mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Como você prefere ser chamado(a)?"
                  className="w-full border border-sand-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full border border-sand-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400"
                required
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-sand-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-2.5 text-sage-400"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sage-600 hover:bg-sage-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Aguarde...' :
                mode === 'login' ? 'Entrar' :
                mode === 'signup' ? 'Criar conta' :
                'Enviar link de recuperação'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => setMode('reset')}
                  className="text-sm text-sage-500 hover:text-sage-700 block w-full"
                >
                  Esqueci minha senha
                </button>
                <button
                  onClick={() => setMode('signup')}
                  className="text-sm text-ocean-600 hover:text-ocean-800 font-medium"
                >
                  Ainda não tenho conta — Cadastrar
                </button>
              </>
            )}
            {mode === 'signup' && (
              <button
                onClick={() => setMode('login')}
                className="text-sm text-ocean-600 hover:text-ocean-800 font-medium"
              >
                Já tenho conta — Entrar
              </button>
            )}
            {mode === 'reset' && (
              <button
                onClick={() => setMode('login')}
                className="text-sm text-sage-500 hover:text-sage-700"
              >
                Voltar ao login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
