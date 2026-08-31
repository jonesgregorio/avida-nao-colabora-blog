import { useEffect, useState } from 'react'
import { History, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/reportPeriods'
import { fetchHistoryPersonalizationEnabled } from '../lib/privacyPreferences'
import { buildContinuityPrompt, type ContinuityEntry } from '../lib/todayContinuity'
import { buildAdaptiveCheckinPrompt, type AdaptiveCheckinAnswer, type AdaptiveCheckinPrompt } from '../lib/adaptiveCheckin'

interface Props {
  user: User | null
}

function entryDay(entry: ContinuityEntry) {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  const raw = String(entry.created_at ?? '')
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : ''
}

function dismissedKey(todayKey: string, continuityId: string) {
  return `avnc:continuity-dismissed:${todayKey}:${continuityId}`
}

export default function AdaptiveCheckinIntro({ user }: Props) {
  const [prompt, setPrompt] = useState<AdaptiveCheckinPrompt | null>(null)
  const [answer, setAnswer] = useState<AdaptiveCheckinAnswer | null>(null)
  const [loading, setLoading] = useState(true)
  const todayKey = ymd(new Date())

  useEffect(() => {
    if (!user) {
      setPrompt(null)
      setLoading(false)
      return
    }

    let active = true
    ;(async () => {
      try {
        const historyEnabled = await fetchHistoryPersonalizationEnabled(user.id)
        if (!active) return
        if (!historyEnabled) {
          setPrompt(null)
          return
        }

        const since = new Date(Date.now() - 30 * 864e5).toISOString()
        const { data, error } = await supabase
          .from('diary_entries')
          .select('created_at,date,mood,energy,anxiety_level,sleep_quality,context_tags,trigger_tags')
          .eq('user_id', user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (!active) return

        const entries = (data ?? []) as ContinuityEntry[]
        const hasEntryToday = entries.some(entry => entryDay(entry) === todayKey)
        const continuity = buildContinuityPrompt(entries, todayKey, hasEntryToday)
        const adaptive = buildAdaptiveCheckinPrompt(continuity)

        if (!continuity || !adaptive) {
          setPrompt(null)
        } else {
          let dismissed = false
          try { dismissed = window.localStorage.getItem(dismissedKey(todayKey, continuity.id)) === '1' } catch { /* armazenamento local é opcional */ }
          setPrompt(dismissed ? null : adaptive)
        }
      } catch {
        if (active) setPrompt(null)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [user, todayKey])

  function dismiss() {
    if (!prompt) return
    try { window.localStorage.setItem(dismissedKey(todayKey, prompt.continuityId), '1') } catch { /* segue sem armazenamento local */ }
    setPrompt(null)
    setAnswer(null)
  }

  if (loading || !prompt) return null

  return (
    <section className="mx-auto max-w-3xl px-4 pt-6 sm:px-6" aria-label="Continuidade do check-in">
      <div className="rounded-3xl border border-forest-100 bg-mint/45 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-forest-700 shadow-sm">
            <History className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-600">{prompt.eyebrow}</p>
                <h2 className="mt-1 font-serif text-xl text-forest-900 sm:text-2xl">{prompt.title}</h2>
              </div>
              <button type="button" onClick={dismiss} aria-label="Pular esta retomada" className="rounded-xl p-2 text-ink-soft hover:bg-white hover:text-forest-900">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{prompt.description}</p>

            {!answer ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {prompt.choices.map(choice => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setAnswer(choice.id)}
                    className="rounded-full border border-forest-200 bg-white px-4 py-2 text-sm font-medium text-forest-900 transition-colors hover:bg-forest-50"
                  >
                    {choice.label}
                  </button>
                ))}
                <button type="button" onClick={dismiss} className="rounded-full px-3 py-2 text-sm text-ink-soft hover:text-forest-900">
                  Prefiro começar do zero
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white bg-white/75 px-4 py-3">
                <p className="text-sm leading-relaxed text-forest-900">{prompt.guidance[answer]}</p>
                <button type="button" onClick={() => setAnswer(null)} className="mt-2 text-xs font-medium text-forest-700 hover:text-forest-900">
                  Alterar resposta
                </button>
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
              Esta retomada usa somente marcadores estruturados do seu histórico. Sua resposta de comparação não vira nota automática e não substitui o check-in que você preencher abaixo.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
