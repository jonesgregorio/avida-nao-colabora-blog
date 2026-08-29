import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { fetchHistoryPersonalizationEnabled, saveHistoryPersonalizationEnabled } from '../lib/privacyPreferences'

export default function HistoryPersonalizationControl({ user }: { user: User | null }) {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    if (!user) {
      setLoading(false)
      return
    }
    void fetchHistoryPersonalizationEnabled(user.id).then(value => {
      if (!active) return
      setEnabled(value)
      setLoading(false)
    })
    return () => { active = false }
  }, [user])

  async function change(next: boolean) {
    if (!user || saving) return
    setSaving(true)
    setMessage('')
    const previous = enabled
    setEnabled(next)
    const ok = await saveHistoryPersonalizationEnabled(user.id, next)
    if (!ok) {
      setEnabled(previous)
      setMessage('Não foi possível salvar esta preferência agora. Tente novamente em instantes.')
    } else {
      setMessage(next
        ? 'As retomadas automáticas com seu histórico estão ativadas.'
        : 'As retomadas automáticas com seu histórico estão desativadas.')
    }
    setSaving(false)
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-mint text-forest-700">
            <History className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-forest-900">Retomadas automáticas com meu histórico</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Quando ativado, o app pode usar marcadores estruturados dos seus registros anteriores para retomadas, descobertas, recorrências e sugestões automáticas. O texto livre de dias anteriores não entra nessas leituras.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Retomadas automáticas com meu histórico"
          disabled={loading || saving || !user}
          onClick={() => void change(!enabled)}
          className={`relative mt-1 h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-forest-800' : 'bg-line'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          <span className="sr-only">{enabled ? 'Ativado' : 'Desativado'}</span>
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
        Desativar não apaga seus registros e não bloqueia Mapa Emocional, Relatórios ou Minha História quando você decide abrir essas áreas. A leitura complementar do registro atual continua sendo uma escolha separada dentro do Diário.
      </p>
      {(loading || saving || message) && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-soft" aria-live="polite">
          {(loading || saving) && <Loader2 className="h-3 w-3 animate-spin" />}
          {loading ? 'Carregando preferência…' : saving ? 'Salvando preferência…' : message}
        </p>
      )}
    </div>
  )
}
