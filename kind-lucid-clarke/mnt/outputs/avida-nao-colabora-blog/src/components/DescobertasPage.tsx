import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Compass, ArrowRight, ChevronDown, EyeOff, Heart, LineChart, Loader2, RotateCcw, Sparkles } from 'lucide-react'
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
import DiscoveryMemoryArchive from './history/DiscoveryMemoryArchive'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigate: (section: string) => void
}

function isFatigueSignal(discovery: HomeDiscovery) {
  const key = discovery.stableKey.toLowerCase()
  return key.includes('cansaco') || key.includes('sem_energia')
}

function discoveryCategoryLabel(discovery: HomeDiscovery): string {
  switch (discovery.kind) {
    case 'context':
      return 'Tema recorrente'
    case 'trigger':
      return 'Possível gatilho'
    case 'emotion':
      return 'Emoção recorrente'
    case 'context_emotion':
    case 'trigger_emotion':
      return 'Conexão em observação'
    case 'sleep_anxiety':
      return 'Sinal no sono'
    case 'energy_anxiety':
      return 'Conexão em observação'
    case 'mood':
      return isFatigueSignal(discovery) ? 'Sintoma recorrente' : 'Humor recorrente'
    default:
      return 'Sinal recorrente'
  }
}

function discoveryStage(discovery: HomeDiscovery): string {
  if (discovery.status === 'forming') return 'Começando a aparecer'

  const ratio = discovery.baseDays > 0 ? discovery.matchedDays / discovery.baseDays : 0
  if (discovery.baseDays >= 7 && discovery.matchedDays >= 5 && ratio >= 0.6) {
    return 'Padrão observado'
  }
  return 'Se repetindo'
}

function discoveryContextualDescription(discovery: HomeDiscovery): string {
  const { matchedDays, baseDays, status } = discovery
  const stillForming = status === 'forming'

  switch (discovery.kind) {
    case 'context':
      return stillForming
        ? `Esse tema apareceu em ${matchedDays} dos seus ${baseDays} dias com registro. Vale observar se ele costuma surgir associado a algum sentimento, sintoma ou momento específico.`
        : `Esse tema apareceu em ${matchedDays} dos seus ${baseDays} dias com registro. A repetição já é consistente o bastante para observar em quais situações ele ganha mais peso.`
    case 'mood':
      if (isFatigueSignal(discovery)) {
        return stillForming
          ? `Você registrou esse sinal em ${matchedDays} dos seus ${baseDays} dias com registro. Por enquanto, o sistema está acompanhando a frequência e o contexto em que ele aparece.`
          : `Você registrou esse sinal em ${matchedDays} dos seus ${baseDays} dias com registro. A frequência já permite observar com mais atenção o que costuma acontecer nos mesmos dias.`
      }
      return stillForming
        ? `Esse estado apareceu em ${matchedDays} dos seus ${baseDays} dias com registro. Ainda está ganhando contexto, então vale acompanhar sem tirar conclusões agora.`
        : `Esse estado apareceu em ${matchedDays} dos seus ${baseDays} dias com registro. A repetição já permite comparar melhor os dias em que ele aparece.`
    case 'emotion':
      return stillForming
        ? `Essa emoção apareceu em ${matchedDays} dos seus ${baseDays} dias com registro. Ainda é cedo para tratá-la como padrão, mas já existe repetição para acompanhar.`
        : `Essa emoção apareceu em ${matchedDays} dos seus ${baseDays} dias com registro. Agora já há contexto suficiente para observar o que costuma acompanhá-la.`
    case 'trigger':
      return stillForming
        ? `Esse gatilho foi marcado em ${matchedDays} dos seus ${baseDays} dias com registro. O sistema ainda está observando em quais situações ele volta a aparecer.`
        : `Esse gatilho foi marcado em ${matchedDays} dos seus ${baseDays} dias com registro. A repetição já permite olhar com mais atenção para o que costuma acontecer ao redor dele.`
    default:
      return discovery.description
  }
}

export default function DescobertasPage({ user, profile, onNavigate }: Props) {
  const plan = normalizePlan(profile?.plan)
  const [entries, setEntries] = useState<HomeDiscoveryEntry[]>([])
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)
  const [feedback, setFeedback] = useState<DiscoveryFeedbackMap>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showCollection, setShowCollection] = useState(false)
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
  const madeSenseDiscoveries = useMemo(
    () => discoveries.filter(d => feedback[d.stableKey] === 'made_sense'),
    [discoveries, feedback]
  )
  const observingDiscoveries = useMemo(
    () => discoveries.filter(d => feedback[d.stableKey] !== 'made_sense'),
    [discoveries, feedback]
  )

  const forming = observingDiscoveries.filter(d => d.status === 'forming')
  const ready = observingDiscoveries.filter(d => d.status === 'ready')
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <header>
        <div className="flex items-center gap-2 text-forest-600">
          <Compass className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">O que estou percebendo</p>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Descobertas</h1>
        <p className="mt-2 text-ink-soft max-w-xl leading-relaxed">
          Algumas coisas começam a se repetir nos seus registros. Aqui você vê primeiro o que merece atenção agora — e aprofunda só se quiser.
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
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600 mt-4">Aparecendo agora</p>
          <h2 className="font-serif text-2xl text-forest-900 mt-1">
            {hiddenCount > 0 ? 'Nada pedindo atenção agora' : 'Ainda não apareceu algo para destacar'}
          </h2>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-2xl">
            {hiddenCount > 0
              ? 'O que você preferiu não acompanhar continua guardado e pode ser restaurado quando quiser.'
              : 'Conforme seus registros criam contexto suficiente, alguns sinais podem aparecer aqui. Não existe meta de frequência para isso.'}
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
              eyebrow="Aparecendo agora"
              title="Algo começou a se repetir"
              description="Sinais recentes que ainda estão ganhando contexto. Você não precisa decidir nada sobre eles agora."
              discoveries={forming}
              feedback={feedback}
              onChoose={choose}
              onOpenMap={() => onNavigate('my-evolution')}
              emerging
            />
          )}

          {ready.length > 0 && (
            <Section
              eyebrow="Descobertas"
              title="Talvez valha observar"
              description="Padrões que apareceram vezes suficientes para merecer um olhar mais atento. Se fizer sentido para você, pode guardar essa percepção."
              discoveries={ready}
              feedback={feedback}
              onChoose={choose}
              onOpenMap={() => onNavigate('my-evolution')}
            />
          )}

          {madeSenseDiscoveries.length > 0 && (
            <section className="border-t border-line pt-5" aria-labelledby="made-sense-heading">
              <button
                type="button"
                onClick={() => setShowCollection(current => !current)}
                className="w-full flex items-center justify-between gap-4 text-left"
                aria-expanded={showCollection}
              >
                <span>
                  <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Minha coleção</span>
                  <span id="made-sense-heading" className="block font-serif text-2xl text-forest-900 mt-0.5">Coisas que já fizeram sentido para mim</span>
                  <span className="block text-sm text-ink-soft mt-1">{madeSenseDiscoveries.length} {madeSenseDiscoveries.length === 1 ? 'percepção reconhecida' : 'percepções reconhecidas'} agora.</span>
                </span>
                <ChevronDown className={`w-5 h-5 text-forest-600 flex-shrink-0 transition-transform ${showCollection ? 'rotate-180' : ''}`} />
              </button>

              {showCollection && (
                <div className="mt-5 space-y-3">
                  {madeSenseDiscoveries.map(discovery => (
                    <DiscoveryCard
                      key={discovery.id}
                      discovery={discovery}
                      feedback={feedback}
                      onChoose={choose}
                      onOpenMap={() => onNavigate('my-evolution')}
                      collected
                    />
                  ))}
                  <p className="text-[11px] text-ink-soft leading-relaxed">
                    Quando uma percepção deixa de aparecer na janela recente, ela continua disponível em “O que já fez sentido antes”.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {!loading && user && (
        <DiscoveryMemoryArchive
          userId={user.id}
          discoveries={allDiscoveries}
          feedback={feedback}
        />
      )}

      {personalizationEnabled && !loading && hiddenCount > 0 && (
        <section className="border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowHidden(current => !current)}
            className="w-full flex items-center justify-between gap-3 text-left"
            aria-expanded={showHidden}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-forest-900">
              <EyeOff className="w-4 h-4 text-forest-600" />
              Ocultadas ({hiddenCount})
            </span>
            <span className="text-xs text-ink-soft">{showHidden ? 'Ocultar lista' : 'Ver e restaurar'}</span>
          </button>
          {showHidden && (
            <div className="mt-4 space-y-2">
              {hiddenDiscoveries.map(discovery => (
                <div key={discovery.stableKey} className="rounded-2xl bg-paper-soft px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">{discoveryCategoryLabel(discovery)}</p>
                    <p className="font-serif text-base text-forest-900 mt-0.5">{discovery.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => choose(discovery.stableKey, 'not_following')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-forest-800 hover:bg-mint/50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Voltar a acompanhar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <details className="border-t border-line pt-4 text-xs text-ink-soft">
        <summary className="cursor-pointer font-medium text-forest-700">Como estas descobertas são formadas</summary>
        <p className="mt-2 max-w-2xl leading-relaxed">
          São observações dos dados estruturados dos seus próprios registros, não diagnósticos. Coocorrência não significa que um sinal cause o outro. Nenhum trecho do texto livre do seu diário é usado nesta área.
        </p>
      </details>
    </div>
  )
}

function Section({
  eyebrow, title, description, discoveries, feedback, onChoose, onOpenMap, emerging = false,
}: {
  eyebrow: string
  title: string
  description: string
  discoveries: HomeDiscovery[]
  feedback: DiscoveryFeedbackMap
  onChoose: (key: string, value: DiscoveryFeedbackValue) => void
  onOpenMap: () => void
  emerging?: boolean
}) {
  return (
    <section>
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{eyebrow}</p>
      <h2 className="font-serif text-2xl text-forest-900 mt-0.5">{title}</h2>
      <p className="text-sm text-ink-soft mt-1 max-w-2xl">{description}</p>
      <div className="mt-4 space-y-3">
        {discoveries.map(discovery => (
          <DiscoveryCard
            key={discovery.id}
            discovery={discovery}
            feedback={feedback}
            onChoose={onChoose}
            onOpenMap={onOpenMap}
            emerging={emerging}
          />
        ))}
      </div>
    </section>
  )
}

function DiscoveryCard({
  discovery, feedback, onChoose, onOpenMap, collected = false, emerging = false,
}: {
  discovery: HomeDiscovery
  feedback: DiscoveryFeedbackMap
  onChoose: (key: string, value: DiscoveryFeedbackValue) => void
  onOpenMap: () => void
  collected?: boolean
  emerging?: boolean
}) {
  return (
    <article className={`rounded-3xl p-5 sm:p-6 ${collected ? 'bg-mint/25' : emerging ? 'bg-paper-soft' : 'border border-line bg-white/80'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">
          {discoveryCategoryLabel(discovery)}
        </p>
        {collected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-forest-700">
            <Heart className="w-3 h-3" /> Reconhecida por você
          </span>
        )}
      </div>
      <h3 className="font-serif text-xl text-forest-900 mt-1">{discovery.title}</h3>
      <p className="text-sm text-ink-soft mt-2 leading-relaxed">{discoveryContextualDescription(discovery)}</p>

      <details className="mt-3 text-xs text-ink-soft">
        <summary className="cursor-pointer font-medium text-forest-700">Entender melhor</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-ink-soft">Estágio da descoberta</span>
          <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-forest-700">
            {discoveryStage(discovery)}
          </span>
        </div>
        <p className="mt-2">{discovery.evidence}</p>
        <p className="text-sm text-forest-800 mt-2">Para observar: {discovery.question}</p>
        <button
          onClick={onOpenMap}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-forest-900 hover:bg-mint/40 transition-colors"
        >
          <LineChart className="w-4 h-4" /> Ver no Mapa Emocional
        </button>
      </details>

      <div className="mt-4 pt-4 border-t border-line/80">
        <p className="text-[11px] text-ink-soft mb-1.5">Isso fez sentido para você?</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sua percepção sobre esta descoberta">
          {DISCOVERY_FEEDBACK_OPTIONS.map(option => {
            const active = feedback[discovery.stableKey] === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChoose(discovery.stableKey, option.value)}
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
        {collected && (
          <p className="mt-2 text-[11px] text-forest-700">
            Esta percepção está na sua coleção. Você pode mudar de ideia quando quiser.
          </p>
        )}
      </div>
    </article>
  )
}
