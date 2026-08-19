import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck, Copy, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Mode = 'loading' | 'enroll' | 'challenge' | 'error'

interface Props {
  onVerified: () => void
  onSignOut: () => void
}

export default function AdminMfaGate({ onVerified, onSignOut }: Props) {
  const [mode, setMode] = useState<Mode>('loading')
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  async function bootstrap() {
    setMode('loading')
    setError('')
    try {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalError) throw aalError
      if (aal?.currentLevel === 'aal2') {
        onVerified()
        return
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) throw factorsError
      const existingTotp = factors?.totp?.[0]
      if (existingTotp) {
        setFactorId(existingTotp.id)
        setMode('challenge')
        return
      }

      // Não há TOTP verificado: cadastro obrigatório antes de abrir o painel.
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Admin A Vida Não Colabora',
      })
      if (enrollError || !enrolled) throw enrollError ?? new Error('Não foi possível iniciar o MFA.')
      setFactorId(enrolled.id)
      setQrCode(enrolled.totp.qr_code)
      setSecret(enrolled.totp.secret)
      setMode('enroll')
    } catch (err) {
      setError((err as Error).message || 'Não foi possível preparar a verificação em duas etapas.')
      setMode('error')
    }
  }

  useEffect(() => {
    void bootstrap()
    // O gate deve inicializar uma única vez por montagem; após AAL2 ele desmonta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      // verify() promove a sessão atual a AAL2 e atualiza o JWT automaticamente.
      onVerified()
    } catch (err) {
      setError((err as Error).message || 'Código inválido. Gere um novo código no autenticador e tente novamente.')
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  async function copySecret() {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch { /* cópia manual continua disponível */ }
  }

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-forest-900 flex items-center justify-center px-4">
        <div className="text-center text-white/70">
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-emerald-300" />
          Verificando proteção do painel…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forest-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white/[0.07] border border-white/10 rounded-3xl p-7 text-white shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-2xl">Verificação em duas etapas</h1>
        <p className="text-sm text-white/60 mt-2 leading-relaxed">
          O painel administrativo exige senha + código TOTP. Essa proteção é obrigatória para qualquer operação de administrador.
        </p>

        {mode === 'enroll' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-white p-4 flex justify-center">
              {qrCode ? <img src={qrCode} alt="QR Code para configurar o autenticador" className="w-48 h-48" /> : <Loader2 className="w-6 h-6 animate-spin text-forest-700" />}
            </div>
            <div>
              <p className="text-sm font-medium">1. Escaneie o QR Code</p>
              <p className="text-xs text-white/55 mt-1">Use Google Authenticator, Microsoft Authenticator, 1Password ou outro app TOTP.</p>
            </div>
            {secret && (
              <div>
                <p className="text-sm font-medium mb-1.5">Ou digite esta chave manualmente</p>
                <div className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/10 px-3 py-2">
                  <code className="text-xs break-all flex-1 text-emerald-200">{secret}</code>
                  <button type="button" onClick={copySecret} className="p-1.5 text-white/60 hover:text-white" aria-label="Copiar chave TOTP">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && <p className="text-xs text-emerald-300 mt-1">Chave copiada.</p>}
              </div>
            )}
            <p className="text-sm font-medium">2. Digite o código de 6 dígitos gerado pelo app</p>
          </div>
        )}

        {mode === 'challenge' && (
          <div className="mt-6 rounded-2xl bg-emerald-400/10 border border-emerald-300/15 p-4 flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Confirme o acesso</p>
              <p className="text-xs text-white/55 mt-1">Abra seu aplicativo autenticador e informe o código atual.</p>
            </div>
          </div>
        )}

        {mode !== 'error' && (
          <div className="mt-5 space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') void verify() }}
              placeholder="000000"
              aria-label="Código TOTP de 6 dígitos"
              className="w-full border border-white/15 bg-white/5 rounded-xl px-4 py-3 text-center text-xl tracking-[0.35em] placeholder:tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void verify()}
              disabled={submitting || code.length !== 6}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-3 rounded-2xl transition-colors"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</> : mode === 'enroll' ? 'Ativar MFA e entrar' : 'Confirmar e entrar'}
            </button>
          </div>
        )}

        {error && <div className="mt-4 bg-red-500/15 border border-red-400/30 text-red-100 text-sm rounded-xl px-3.5 py-2.5">{error}</div>}

        <div className="mt-5 flex gap-2">
          {mode === 'error' && (
            <button type="button" onClick={() => void bootstrap()} className="flex-1 border border-white/15 rounded-xl py-2.5 text-sm hover:bg-white/5">Tentar novamente</button>
          )}
          <button type="button" onClick={onSignOut} className="flex-1 inline-flex items-center justify-center gap-2 border border-white/15 rounded-xl py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </div>
    </div>
  )
}
