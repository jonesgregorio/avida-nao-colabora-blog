import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type TotpFactor = { id: string; status?: string; friendly_name?: string | null }

type EnrollState = {
  factorId: string
  qrCode: string
  secret: string
} | null

interface Props {
  user: User | null
}

export default function UserMfaSettings({ user }: Props) {
  const [loading, setLoading] = useState(true)
  const [verifiedFactor, setVerifiedFactor] = useState<TotpFactor | null>(null)
  const [enrollState, setEnrollState] = useState<EnrollState>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  async function loadFactors() {
    if (!user) {
      setVerifiedFactor(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setMessage({ type: 'err', text: 'Não foi possível consultar a verificação em duas etapas agora.' })
      setLoading(false)
      return
    }
    const factor = data?.totp?.find(item => item.status === 'verified') ?? null
    setVerifiedFactor(factor)
    setLoading(false)
  }

  useEffect(() => {
    void loadFactors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function beginEnrollment() {
    if (!user || busy) return
    setBusy(true)
    setMessage(null)
    setCode('')
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError

      // Um cadastro interrompido pode deixar um fator TOTP não verificado.
      // Limpamos apenas esses fatores antes de iniciar um novo cadastro.
      for (const factor of factors?.totp ?? []) {
        if (factor.status !== 'verified') {
          const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
          if (cleanupError) throw cleanupError
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'A Vida Não Colabora',
      })
      if (error || !data) throw error ?? new Error('Não foi possível iniciar a configuração.')

      setEnrollState({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      })
    } catch (err) {
      setMessage({ type: 'err', text: (err as Error).message || 'Não foi possível iniciar a verificação em duas etapas.' })
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnrollment() {
    if (!enrollState || code.length !== 6 || busy) return
    setBusy(true)
    setMessage(null)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollState.factorId })
      if (challengeError || !challenge) throw challengeError ?? new Error('Não foi possível criar o desafio MFA.')

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollState.factorId,
        challengeId: challenge.id,
        code,
      })
      if (verifyError) throw verifyError

      setEnrollState(null)
      setCode('')
      setMessage({ type: 'ok', text: 'Verificação em duas etapas ativada com sucesso.' })
      await loadFactors()
    } catch (err) {
      setCode('')
      setMessage({ type: 'err', text: (err as Error).message || 'Código inválido. Confira o autenticador e tente novamente.' })
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnrollment() {
    if (!enrollState || busy) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrollState.factorId })
    if (error) {
      setMessage({ type: 'err', text: 'Não foi possível cancelar esta configuração agora.' })
    } else {
      setEnrollState(null)
      setCode('')
    }
    setBusy(false)
  }

  async function disableMfa() {
    if (!verifiedFactor || busy) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id })
    if (error) {
      setMessage({ type: 'err', text: error.message || 'Não foi possível desativar a verificação em duas etapas.' })
    } else {
      setVerifiedFactor(null)
      setConfirmDisable(false)
      setMessage({ type: 'ok', text: 'Verificação em duas etapas desativada.' })
    }
    setBusy(false)
  }

  async function copySecret() {
    if (!enrollState?.secret) return
    try {
      await navigator.clipboard.writeText(enrollState.secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch { /* a chave continua visível para cópia manual */ }
  }

  return (
    <section className="bg-paper-soft border border-line rounded-3xl p-6" aria-labelledby="mfa-settings-title">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="mfa-settings-title" className="font-serif text-lg sm:text-xl text-forest-900">Verificação em duas etapas</h2>
          <p className="text-sm text-ink-soft mt-1 leading-relaxed">
            Opcional. Quando ativada, além da senha você informa um código do aplicativo autenticador ao entrar.
          </p>
        </div>
      </div>

      {message && (
        <div className={`mt-4 rounded-xl border px-3.5 py-2.5 text-sm ${message.type === 'ok' ? 'bg-mint/60 border-forest-100 text-forest-800' : 'bg-coral/20 border-coral/40 text-[#8a3b23]'}`} role={message.type === 'err' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-ink-soft" role="status">
          <Loader2 className="w-4 h-4 animate-spin" /> Verificando configuração…
        </div>
      ) : verifiedFactor ? (
        <div className="mt-5 rounded-2xl border border-forest-100 bg-mint/35 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-forest-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-forest-900">Proteção ativada</p>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">Sua conta pede um código TOTP sempre que uma nova sessão precisa subir de AAL1 para AAL2.</p>
            </div>
          </div>

          {!confirmDisable ? (
            <button type="button" onClick={() => setConfirmDisable(true)} className="mt-4 inline-flex items-center gap-2 text-sm text-red-700 hover:text-red-800">
              <ShieldOff className="w-4 h-4" /> Desativar verificação em duas etapas
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-3">
              <p className="text-sm text-red-800">Ao desativar, os próximos acessos voltarão a exigir somente sua senha.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void disableMfa()} disabled={busy} className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm disabled:opacity-50">
                  {busy ? 'Desativando…' : 'Confirmar desativação'}
                </button>
                <button type="button" onClick={() => setConfirmDisable(false)} disabled={busy} className="px-4 py-2 rounded-xl border border-line text-sm text-forest-800 disabled:opacity-50">
                  Manter proteção
                </button>
              </div>
            </div>
          )}
        </div>
      ) : enrollState ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-line bg-white p-4 flex justify-center">
            {enrollState.qrCode ? <img src={enrollState.qrCode} alt="QR Code para configurar o aplicativo autenticador" className="w-48 h-48" /> : <Loader2 className="w-6 h-6 animate-spin text-forest-700" />}
          </div>
          <div>
            <p className="text-sm font-medium text-forest-900">1. Escaneie o QR Code</p>
            <p className="text-xs text-ink-soft mt-1">Use Google Authenticator, Microsoft Authenticator, 1Password ou outro aplicativo TOTP.</p>
          </div>
          <div>
            <p className="text-sm font-medium text-forest-900 mb-1.5">Ou digite a chave manualmente</p>
            <div className="flex items-center gap-2 rounded-xl bg-mint/30 border border-line px-3 py-2">
              <code className="text-xs break-all flex-1 text-forest-800">{enrollState.secret}</code>
              <button type="button" onClick={() => void copySecret()} className="p-1.5 text-ink-soft hover:text-forest-900" aria-label="Copiar chave TOTP">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copied && <p className="text-xs text-forest-600 mt-1" role="status">Chave copiada.</p>}
          </div>
          <div>
            <label htmlFor="mfa-enrollment-code" className="text-sm font-medium text-forest-900">2. Digite o código de 6 dígitos</label>
            <input
              id="mfa-enrollment-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
              onKeyDown={event => { if (event.key === 'Enter') void confirmEnrollment() }}
              placeholder="000000"
              className="mt-2 w-full border border-line bg-white rounded-xl px-4 py-3 text-center text-xl tracking-[0.35em] placeholder:tracking-normal text-forest-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void confirmEnrollment()} disabled={busy || code.length !== 6} className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Ativar proteção
            </button>
            <button type="button" onClick={() => void cancelEnrollment()} disabled={busy} className="px-4 py-2.5 rounded-xl border border-line text-sm text-forest-800 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-sm font-medium text-forest-900">Proteção adicional disponível</p>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed">
              A conta continua funcionando normalmente sem MFA. Ative apenas se quiser adicionar o código do autenticador aos próximos acessos.
            </p>
          </div>
          <button type="button" onClick={() => void beginEnrollment()} disabled={busy || !user} className="mt-4 inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {busy ? 'Preparando…' : 'Ativar verificação em duas etapas'}
          </button>
        </div>
      )}
    </section>
  )
}
