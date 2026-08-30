import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Compass, ArrowRight, EyeOff, LineChart, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { normalizePlan } from '../lib/officialPlans'
import { fetchHistoryPersonalizationEnabled } from '../lib/privacyPreferences'
import {
  buildHomeDiscoveries,
  type HomeDiscovery,
  type HomeDiscoveryEntry,
} from '../lib/homeDiscoveries'
import {
  DISCOVERY_FEEDBACK_OPTIONS,
  mutedDiscoveryKeys,
  type DiscoveryFeedbackMap,
  type DiscoveryFeedbackValue,
} from '../lib/discoveryFeedback'
import {
  clearDiscoveryFeedback,
  fetchDiscoveryFeedback,
  saveDiscoveryFeedback,
} from '../lib/discoveryFeedbackStore'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigate: (section: string) => void
}

export default function DescobertasPage({ user, profile, onNavigate }: Props) {
  const plan = normalizePlan(profile?.plan)
  const [entries, setEntries] = useState<HomeDiscoveryEntry[]>([])
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)
  const [feedback, setFeedback] = useState<DiscoveryFeedbackMap>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      setLoading(true)
      setFailed(false)
      try {
        const since = new Date(Date.now() - 60 * 864e5).toISOString()
        const [{ data, error }, enabled, feedbackMap] = await Promise.all([
          supabase
            .from('diary_entries')
            .select('created_at,date,mood,energy,anxiety_level,sleep_quality,emotional_tags,context_tags,trigger_tags,need_tags,care_action_tags')
            .eq('user_id', user.id)
            .gte('created_at', since)
            .order('created_at', { ascending: false }),
          fetchHistoryPersonalizationEnabled(user.id),
          fetchDiscoveryFeedback(user.id),
        ])
        if (!active) return
        if (error) throw error
        setEntries((data ?? []) as HomeDiscoveryEntry[])
        setPersonalizationEnabled(enabled)
        setFeedback(feedbackMap)
      } catch {
        if (active) {
          setFailed(true)
          setEntries([])
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [user])

  const muted = useMemo(() => mutedDiscoveryKeys(feedback), [feedback])

  const allDiscoveries = useMemo<HomeDiscovery[]>(() => {
    if (!personalizationEnabled) return []
    return buildHomeDiscoveries(entries, plan)
  }, [entries, plan, personalizationEnabled])

  const discoveries = useMemo(
    () => allDiscoveries.filter(d => !muted.has(d.stableKey)),
    [allDiscoveries, muted]
  )
  const hiddenDiscoveries = useMemo(
    () => allDiscoveries.filter(d => muted.has(d.stableKey)),
    [allDiscoveries, muted]
  )

  const forming = discoveries.filter(d => d.status === 'forming')
  const ready = discoveries.filter(d => d.status === 'ready')
  const hiddenCount = hiddenDiscoveries.length

  const choose = useCallback(async (key: string, value: DiscoveryFeedbackValue) => {
    if (!user) return
    const previous = feedback[key]
    const clearing = previous === value
    setFeedback(current => {
      const next = { ...current }
      if (clearing) delete next[key]
      else next[key] = value
      return next
    })
    const ok = clearing
      ? await clearDiscoveryFeedback(user.id, key)
      : await saveDiscoveryFeedback(user.id, key, value)
    if (!ok) {
      setFeedback(current => {
        const next = { ...current }
        if (previous) next[key] = previous
        else delete next[key]
        return next
      })
    }
  }, [user, feedback])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header>
        <div className="flex items-center gap-2 text-forest-600">
          <Compass className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Sua jornada</p>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Descobertas</h1>
        <p className="mt-2 text-ink-soft max-w-2xl leading-relaxed">
          Pequenos padrões que aparecem ao longo do tempo, montados só a partir dos seus próprios registros.
          Uma descoberta só aparece aqui quando há repetição suficiente para valer uma observação.
        </p>
      </header>

      {!personalizationEnabled ? (
        <section className="rounded-3xl border border-line bg-paper-soft p-6 sm:p-7">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Descobertas pausadas</p>
          <h2 className="font-serif text-2xl text-forest-900 mt-1">Você desativou a personalização com o histórico</h2>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-2xl">
            Enquanto essa preferência estiver desligada, o sistema não observa padrões nos seus registros.
            Você pode reativá-la no seu perfil quando quiser.
          </p>
          <button
            onClick={() => onNavigate('profile')}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-forest-900 hover:bg-mint/40 transition-colors"
          >
            Abrir preferências de privacidade <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      ) : loading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader2 className="w-6 h-6 animate-spin text-forest-500" />
        </div>
      ) : failed ? (
        <p className="rounded-2xl bg-coral/30 px-4 py-3 text-sm text-[#8a3b23]">
          Não foi possível carregar suas descobertas agora. Tente novamente em instantes.
        </p>
      ) : discoveries.length === 0 ? (
        <section className="rounded-3xl border border-line bg-mint/25 p-6 sm:p-7">
          <span className="w-11 h-11 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </span>
          <h2 className="font-serif text-2xl text-forest-900 mt-4">
            {hiddenCount > 0 ? 'Nenhuma descoberta em acompanhamento' : 'Ainda não há descobertas'}
          </h2>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-2xl">
            {hiddenCount > 0
              ? 'As descobertas que você pediu para não acompanhar ficam guardadas e podem ser restauradas quando quiser.'
              : 'As descobertas aparecem sozinhas conforme seus registros criam contexto suficiente. Não existe meta de frequência para isso.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('diary')}
              className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800 transition-colors"
            >
              Ir para o diário <ArrowRight className="w-4 h-4" />
            </button>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowHidden(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-forest-900 hover:bg-mint/40 transition-colors"
              >
                <EyeOff className="w-4 h-4" /> Ver ocultas ({hiddenCount})
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          {forming.length > 0 && (
            <Section
              title="Em formação"
              description="Sinais que já se repetiram, mas ainda precisam de mais contexto para virar uma observação mais firme."
              discoveries={forming}
              feedback={feedback}
              onChoose={choose}
              onOpenMap={() => onNavigate('my-evolution')}
            />
          )}
          {ready.length > 0 && (
            <Section
              title="Descobertas"
              description="Padrões com repetição suficiente nos seus registros para valer uma observação mais atenta."
              discoveries={ready}
              feedback={feedback}
              onChoose={choose}
              onOpenMap={() => onNavigate('my-evolution')}
            />
          )}
        </div>
      )}

      {personalizationEnabled && !loading && hiddenCount > 0 && (
        <section className="rounded-2xl border border-line bg-paper-soft p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setShowHidden(current => !current)}
            className="w-full flex items-center justify-between gap-3 text-left"
            aria-expanded={showHidden}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-forest-900">
              <EyeOff className="w-4 h-4 text-forest-600" />
              Descobertas ocultas ({hiddenCount})
            </span>
            <span className="text-xs text-ink-soft">{showHidden ? 'Ocultar lista' : 'Ver e restaurar'}</span>
          </button>
          {showHidden && (
            <div className="mt-4 pt-4 border-t border-line space-y-2">
              {hiddenDiscoveries.map(discovery => (
                <div key={discovery.stableKey} className="rounded-2xl border border-line bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">{discovery.eyebrow}</p>
                    <p className="font-serif text-base text-forest-900 mt-0.5">{discovery.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => choose(discovery.stableKey, 'not_following')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-paper-soft px-3 py-2 text-xs font-medium text-forest-800 hover:bg-mint/50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Voltar a acompanhar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-ink-soft border-l-2 border-forest-300 pl-3 leading-relaxed">
        Essas são observações dos seus próprios registros e não representam diagnóstico. Coocorrência não significa que
        um sinal cause o outro. Nenhum trecho do texto do seu diário é usado nesta área.
      </p>
    </div>
  )
}

function Section({
  title, description, discoveries, feedback, onChoose, onOpenMap,
}: {
  title: string
  description: string
  discoveries: HomeDiscovery[]
  feedback: DiscoveryFeedbackMap
  onChoose: (key: string, value: DiscoveryFeedbackValue) => void
  onOpenMap: () => void
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-forest-900">{title}</h2>
      <p className="text-sm text-ink-soft mt-1">{description}</p>
      <div className="mt-4 space-y-3">
        {discoveries.map(d => (
          <article key={d.id} className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{d.eyebrow}</p>
            <h3 className="font-serif text-xl text-forest-900 mt-1">{d.title}</h3>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">{d.description}</p>
            <p className="text-xs text-ink-soft mt-2">{d.evidence}</p>
            <p className="text-sm text-forest-800 mt-3">Para observar: {d.question}</p>

            <button
              onClick={onOpenMap}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-forest-900 hover:bg-mint/40 transition-colors"
            >
              <LineChart className="w-4 h-4" /> Ver no Mapa Emocional
            </button>

            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-[11px] text-ink-soft mb-1.5">Essa descoberta fez sentido para você?</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sua percepção sobre esta descoberta">
                {DISCOVERY_FEEDBACK_OPTIONS.map(option => {
                  const active = feedback[d.stableKey] === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChoose(d.stableKey, option.value)}
                      className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                        active
                          ? 'border-forest-500 bg-mint text-forest-800 font-medium'
                          : 'border-line bg-white text-ink-soft hover:border-forest-300 hover:text-forest-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
