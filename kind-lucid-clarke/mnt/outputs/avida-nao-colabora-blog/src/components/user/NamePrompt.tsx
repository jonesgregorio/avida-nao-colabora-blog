import { useEffect, useRef, useState } from 'react'
import { Heart, Loader2, X } from 'lucide-react'
import type { Profile } from '../../types'
import { supabase } from '../../lib/supabase'
import { NAME_PROMPT_MAX_ASKS, NAME_PROMPT_MAX_NAME, cleanName, profileHasNoName, shouldAskName } from '../../lib/namePrompt'

// Depois do cadastro sem nome (o formulário só pede e-mail e senha), perguntamos, no centro da
// tela e com destaque, como a pessoa quer ser chamada. O nome vai para o perfil (Admin, e-mails e
// saudações). Pode ser dispensado ("Agora não", X, Esc ou clique fora) e volta a perguntar no
// máximo mais duas vezes, com intervalo de alguns dias.

const SHOW_DELAY_MS = 1200

interface Props {
  userId: string
  profile: Profile | null
  currentView: string
  onSaved: () => void | Promise<void>
}

interface AskState { count: number; last: number }

const storageKey = (userId: string) => `avnc:namePrompt:${userId}`

function readState(userId: string): AskState {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    const parsed = raw ? (JSON.parse(raw) as Partial<AskState>) : null
    return { count: Number(parsed?.count) || 0, last: Number(parsed?.last) || 0 }
  } catch {
    return { count: 0, last: 0 }
  }
}

function writeState(userId: string, state: AskState) {
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify(state)) } catch { /* sem armazenamento: pergunta de novo na próxima visita */ }
}

export default function NamePrompt({ userId, profile, currentView, onSaved }: Props) {
  const [visible, setVisible] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [thanks, setThanks] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const eligible = profileHasNoName(profile) && !profile?.must_change_password && currentView !== 'profile'

  useEffect(() => {
    if (!eligible) { setVisible(false); return undefined }
    const state = readState(userId)
    if (!shouldAskName(state, Date.now())) return undefined
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [eligible, userId])

  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible])

  function dismiss() {
    const state = readState(userId)
    writeState(userId, { count: state.count + 1, last: Date.now() })
    setVisible(false)
  }

  useEffect(() => {
    if (!visible) return undefined
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const state = readState(userId)
      writeState(userId, { count: state.count + 1, last: Date.now() })
      setVisible(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, userId])

  async function save() {
    const clean = cleanName(name)
    if (clean.length < 2) { setError('Digite pelo menos 2 letras.'); return }
    setSaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('update_my_profile', {
      p_full_name: clean,
      p_display_name: clean,
      p_preferred_name: clean,
    })
    setSaving(false)
    if (rpcError) { setError('Não foi possível salvar agora. Tente de novo em instantes.'); return }
    writeState(userId, { count: NAME_PROMPT_MAX_ASKS, last: Date.now() })
    setThanks(`Prazer, ${clean.split(' ')[0]}! 🌿`)
    setVisible(false)
    await onSaved()
    window.setTimeout(() => setThanks(''), 3500)
  }

  if (thanks) {
    return <div role="status" className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-2xl border border-[#d9e3d4] bg-white px-6 py-4 font-serif text-lg text-forest-900 shadow-xl">{thanks}</div>
  }
  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#10261c]/55 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        className="relative w-full max-w-lg rounded-[32px] border border-[#e0d8ca] bg-[#fffaf3] px-6 py-9 text-center shadow-[0_30px_90px_rgba(16,38,28,.35)] sm:px-12 sm:py-12"
      >
        <button type="button" onClick={dismiss} aria-label="Agora não" className="absolute right-4 top-4 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"><X className="h-5 w-5" /></button>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e3eddc] text-forest-700" aria-hidden="true"><Heart className="h-8 w-8" /></span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[.24em] text-forest-600">Bem-vindo(a)</p>
        <h2 id="name-prompt-title" className="mt-2 font-serif text-3xl leading-tight text-[#173e2d] sm:text-4xl">Como você gostaria de ser chamado(a)?</h2>
        <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-[#5f655f]">Assim a gente conversa com você do jeito certo, nas telas e nos e-mails.</p>
        <form className="mt-7" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <label htmlFor="name-prompt-input" className="sr-only">Seu nome</label>
          <input
            id="name-prompt-input"
            ref={inputRef}
            value={name}
            maxLength={NAME_PROMPT_MAX_NAME}
            autoComplete="given-name"
            placeholder="Seu nome ou apelido"
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border-2 border-[#cfd9c6] bg-white px-5 py-4 text-center text-lg text-forest-900 outline-none transition placeholder:text-stone-400 focus:border-forest-600"
          />
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving || cleanName(name).length < 2} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-forest-900 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-forest-800 disabled:opacity-50">
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}Salvar
          </button>
          <button type="button" onClick={dismiss} className="mt-4 text-sm font-medium text-stone-500 underline underline-offset-4 transition hover:text-stone-700">Agora não</button>
        </form>
      </div>
    </div>
  )
}
