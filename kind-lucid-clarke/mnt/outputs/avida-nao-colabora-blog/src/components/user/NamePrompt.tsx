import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Profile } from '../../types'
import { supabase } from '../../lib/supabase'
import { NAME_PROMPT_MAX_ASKS, NAME_PROMPT_MAX_NAME, cleanName, profileHasNoName, shouldAskName } from '../../lib/namePrompt'

// Depois do cadastro sem nome (o formulário só pede e-mail e senha), perguntamos uma vez, de forma
// leve, como a pessoa quer ser chamada. O nome vai para o perfil (Admin, e-mails e saudações).
// Não bloqueia nada: aparece como um cartão no canto da tela, pode ser dispensado e volta a
// perguntar no máximo mais duas vezes, com intervalo de alguns dias.

const SHOW_DELAY_MS = 1500

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
    return <div role="status" className="fixed bottom-24 right-4 z-40 rounded-2xl border border-[#d9e3d4] bg-white px-4 py-3 text-sm font-medium text-forest-900 shadow-lg sm:bottom-6 sm:right-6">{thanks}</div>
  }
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-labelledby="name-prompt-title"
      className="fixed bottom-24 left-4 right-4 z-40 rounded-3xl border border-[#e0d8ca] bg-[#fffaf3] p-5 shadow-[0_18px_50px_rgba(47,61,43,.18)] sm:bottom-6 sm:left-auto sm:right-6 sm:w-[22rem]"
    >
      <button type="button" onClick={dismiss} aria-label="Agora não" className="absolute right-3 top-3 rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"><X className="h-4 w-4" /></button>
      <p id="name-prompt-title" className="pr-6 font-serif text-lg leading-snug text-forest-900">Como você gostaria de ser chamado(a)?</p>
      <p className="mt-1 text-xs leading-5 text-ink-soft">Assim a gente conversa com você do jeito certo, nas telas e nos e-mails.</p>
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <label htmlFor="name-prompt-input" className="sr-only">Seu nome</label>
        <input
          id="name-prompt-input"
          ref={inputRef}
          value={name}
          maxLength={NAME_PROMPT_MAX_NAME}
          autoComplete="given-name"
          placeholder="Seu nome ou apelido"
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-forest-900 outline-none focus:border-forest-500"
        />
        {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" onClick={dismiss} className="text-xs font-medium text-stone-500 underline underline-offset-4">Agora não</button>
          <button type="submit" disabled={saving || cleanName(name).length < 2} className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-forest-800 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salvar
          </button>
        </div>
      </form>
    </div>
  )
}
