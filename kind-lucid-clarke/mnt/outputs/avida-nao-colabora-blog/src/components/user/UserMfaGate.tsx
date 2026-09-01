import { useEffect, useState, type ReactNode } from 'react'
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type GateMode = 'checking' | 'ready' | 'challenge' | 'error'

function verifiedTotpFactorId(factors: { totp?: Array<{ id: string; status?: string }> } | null | undefined) {
  return factors?.totp?.find(factor => factor.status === 'verified')?.id ?? ''
}

export function useUserMfaGate(user: User | null, onSignOut: () => void): ReactNode | null {
  const [mode, setMode] = useState<GateMode>('checking')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function bootstrap() {
    if (!user) {
      setMode('ready')
      return
    }

    setMode('checking')
    setError('')
    try {
      const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      if (aalError) throw aalError
      if (factorsError) throw factorsError

      const verifiedFactorId = verifiedTotpFactorId(factors)
      if (!verifiedFactorId || aal?.currentLevel === 'aal2') {
        setFactorId(verifiedFactorId)
        setMode('ready')
        return
      }

      setFactorId(verifiedFactorId)
      setMode('challenge')
    } catch (err) {
      setError((err as Error).message || 'Não foi possível verificar a proteção em duas etapas.')
      setMode('error')
    }
  }

  useEffect(() => {
    void bootstrap()
    // Uma checagem por montagem é suficiente; mudanças de fator acontecem no Perfil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function verify() {
    if (!factorId || code.length !== 6 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError || !challenge) throw challengeError ?? new Error('Não foi possível criar o desafio MFA.')

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      })
      if (verifyError) throw verifyError

      setCode('')
      setMode('ready')
    } catch (err) {
      setError((err as Error).message || 'Código inválido. Confira o aplicativo autenticador e tente novamente.')
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'ready') return null

  if (mode === 'checking') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4" role="status" aria-live="polite">
        <div className="text-center text-sm text-ink-soft">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-forest-600" />
          Verificando a segurança da sua conta…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-paper-soft border border-line rounded-3xl p-7 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-mint text-forest-700 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-2xl text-forest-900">Confirme que é você</h1>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed">
          Você ativou a verificação em duas etapas. Abra seu aplicativo autenticador e informe o código atual para continuar.
        </p>

        {mode === 'challenge' && (
          <div className="mt-6 space-y-3">
            <label htmlFor="user-mfa-code" className="text-sm font-medium text-forest-900">Código de 6 dígitos</label>
            <input
              id="user-mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
              onKeyDown={event => { if (event.key === 'Enter') void verify() }}
              placeholder="000000"
              className="w-full border border-line bg-white rounded-xl px-4 py-3 text-center text-xl tracking-[0.35em] placeholder:tracking-normal text-forest-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void verify()}
              disabled={submitting || code.length !== 6}
              className="w-full inline-flex items-center justify-center gap-2 bg-forest-900 hover:bg-forest-800 disabled:opacity-50 text-white font-medium py-3 rounded-2xl transition-colors"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</> : <><KeyRound className="w-4 h-4" /> Confirmar e continuar</>}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-coral/20 border border-coral/40 text-[#8a3b23] text-sm rounded-xl px-3.5 py-2.5" role="alert">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {mode === 'error' && (
            <button type="button" onClick={() => void bootstrap()} className="flex-1 border border-line rounded-xl py-2.5 text-sm text-forest-800 hover:bg-mint/40">
              Tentar novamente
            </button>
          )}
          <button type="button" onClick={onSignOut} className="flex-1 inline-flex items-center justify-center gap-2 border border-line rounded-xl py-2.5 text-sm text-ink-soft hover:text-forest-900 hover:bg-mint/40">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </div>
    </div>
  )
}
