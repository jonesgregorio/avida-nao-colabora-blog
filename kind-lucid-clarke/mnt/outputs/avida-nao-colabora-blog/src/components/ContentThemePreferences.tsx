import { useEffect, useState } from 'react'
import { EyeOff, Loader2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { fetchMutedThemes, unmuteContentTheme, THEME_LABELS, type Theme } from '../lib/contentRecommendation'

interface Props { user: User | null }

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Etapa 17: reversão da personalização negativa ("Mostrar menos conteúdos
// assim" / "Não quero ver este tema agora"). Só existe se houver algo
// silenciado — nada aparece por padrão.
export default function ContentThemePreferences({ user }: Props) {
  const [muted, setMuted] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<Theme | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let active = true
    fetchMutedThemes(user.id).then(set => {
      if (!active) return
      setMuted([...set])
      setLoading(false)
    })
    return () => { active = false }
  }, [user])

  async function handleRestore(theme: Theme) {
    if (!user) return
    setRestoring(theme)
    const ok = await unmuteContentTheme(user.id, theme)
    if (ok) setMuted(prev => prev.filter(t => t !== theme))
    setRestoring(null)
  }

  if (loading || muted.length === 0) return null

  return (
    <section className="bg-paper-soft border border-line rounded-3xl p-6">
      <h2 className="font-serif text-lg text-forest-900 flex items-center gap-2 mb-1">
        <EyeOff className="w-4 h-4 text-forest-500" /> Temas reduzidos
      </h2>
      <p className="text-sm text-ink-soft mb-4">
        Você pediu para ver menos conteúdos sobre estes temas nas recomendações. Pode voltar a mostrar quando quiser.
      </p>
      <ul className="space-y-2">
        {muted.map(theme => (
          <li key={theme} className="flex items-center justify-between gap-3 bg-white border border-line rounded-xl px-4 py-2.5">
            <span className="text-sm text-forest-900">{capitalizeFirst(THEME_LABELS[theme] ?? theme)}</span>
            <button
              onClick={() => handleRestore(theme)}
              disabled={restoring === theme}
              className="text-xs font-medium text-forest-700 hover:underline disabled:opacity-50 flex items-center gap-1.5"
            >
              {restoring === theme && <Loader2 className="w-3 h-3 animate-spin" />} Voltar a mostrar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
