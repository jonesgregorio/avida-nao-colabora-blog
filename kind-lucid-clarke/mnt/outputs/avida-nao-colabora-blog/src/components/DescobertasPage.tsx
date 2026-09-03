import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowRight,
  ChevronRight,
  Compass,
  EyeOff,
  Heart,
  LineChart,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
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

type DiscoveryTab = 'now' | 'patterns' | 'connections' | 'saved' | 'hidden'

function isFatigueSignal(discovery: HomeDiscovery) {
  const key = discovery.stableKey.toLowerCase()
  return key.includes('cansaco') || key.includes('sem_energia')
}

function isConnection(discovery: HomeDiscovery) {
  return ['context_emotion', 'trigger_emotion', 'sleep_anxiety', 'energy_anxiety'].includes(discovery.kind)
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
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('now')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedDiscovery, setSelectedDiscovery] = useState<HomeDiscovery | null>(null)

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

  useEffect(() => {
    if (!selectedDiscovery) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDiscovery(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedDiscovery])

  const muted = useMemo(() => mutedDiscoveryKeys(feedback), [feedback])

  const allDiscoveries = useMemo<HomeDiscovery[]>(() => {
    if (!personalizationEnabled) return []
    return buildHomeDiscoveries(entries, plan)
  }, [entries, plan, personalizationEnabled])

  const discoveries = useMemo(
    () => allDiscoveries.filter(discovery => !muted.has(discovery.stableKey)),
    [allDiscoveries, muted],
  )
  const hiddenDiscoveries = useMemo(
    () => allDiscoveries.filter(discovery => muted.has(discovery.stableKey)),
    [allDiscoveries, muted],
  )
  const madeSenseDiscoveries = useMemo(
    () => discoveries.filter(discovery => feedback[discovery.stableKey] === 'made_sense'),
    [discoveries, feedback],
  )
  const observingDiscoveries = useMemo(
    () => discoveries.filter(discovery => feedback[discovery.stableKey] !== 'made_sense'),
    [discoveries, feedback],
  )

  const nowDiscoveries = useMemo(
    () => observingDiscoveries.filter(discovery => discovery.status === 'forming' && !isConnection(discovery)),
    [observingDiscoveries],
  )
  const patternDiscoveries = useMemo(
    () => observingDiscoveries.filter(discovery => discovery.status === 'ready' && !isConnection(discovery)),
    [observingDiscoveries],
  )
  const connectionDiscoveries = useMemo(
    () => observingDiscoveries.filter(isConnection),
    [observingDiscoveries],
  )

  const highlights = observingDiscoveries.slice(0, 3)
  const observedPatterns = observingDiscoveries.filter(discovery => discoveryStage(discovery) === 'Padrão observado').length
  const strongestContext = observingDiscoveries.find(discovery => discovery.kind === 'context')
  const strongestConnection = observingDiscoveries.find(isConnection)
  const strongestSignal = observingDiscoveries.find(discovery => discovery.kind === 'mood' || discovery.kind === 'emotion')

  const tabs: Array<{ key: DiscoveryTab; label: string; count: number }> = [
    { key: 'now', label: 'Agora', count: nowDiscoveries.length },
    { key: 'patterns', label: 'Padrões', count: patternDiscoveries.length },
    { key: 'connections', label: 'Conexões', count: connectionDiscoveries.length },
    { key: 'saved', label: 'Guardadas', count: madeSenseDiscoveries.length },
    { key: 'hidden', label: 'Ocultas', count: hiddenDiscoveries.length },
  ]

  const activeDiscoveries = activeTab === 'now'
    ? nowDiscoveries
    : activeTab === 'patterns'
      ? patternDiscoveries
      : activeTab === 'connections'
        ? connectionDiscoveries
        : activeTab === 'saved'
          ? madeSenseDiscoveries
          : []

  const categoryOptions = useMemo(
    () => [...new Set(activeDiscoveries.map(discoveryCategoryLabel))],
    [activeDiscoveries],
  )

  const filteredDiscoveries = categoryFilter === 'all'
    ? activeDiscoveries
    : activeDiscoveries.filter(discovery => discoveryCategoryLabel(discovery) === categoryFilter)

  useEffect(() => {
    setCategoryFilter('all')
  }, [activeTab])

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

  if (!personalizationEnabled && !loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
        <PageHeader />
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
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <PageHeader />

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader2 className="w-6 h-6 animate-spin text-forest-500" />
        </div>
      ) : failed ? (
        <p className="rounded-2xl bg-coral/30 px-4 py-3 text-sm text-[#8a3b23]">
          Não foi possível carregar suas descobertas agora. Tente novamente em instantes.
        </p>
      ) : discoveries.length === 0 ? (
        <EmptyState hiddenCount={hiddenDiscoveries.length} onDiary={() => onNavigate('diary')} onHidden={() => setActiveTab('hidden')} />
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Resumo das descobertas">
            <SummaryMetric value={discoveries.length} label="ativas" />
            <SummaryMetric value={observingDiscoveries.filter(discovery => discovery.status === 'forming').length} label="ganhando contexto" />
            <SummaryMetric value={observedPatterns} label="padrões observados" />
          </section>

          {(strongestSignal || strongestContext || strongestConnection) && (
            <section className="rounded-3xl border border-line bg-paper-soft/70 p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Visão geral</p>
                  <h2 className="font-serif text-xl sm:text-2xl text-forest-900 mt-0.5">O que seus registros estão destacando</h2>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <OverviewItem label="Sinal em destaque" discovery={strongestSignal} onOpen={setSelectedDiscovery} />
                <OverviewItem label="Contexto recorrente" discovery={strongestContext} onOpen={setSelectedDiscovery} />
                <OverviewItem label="Conexão em observação" discovery={strongestConnection} onOpen={setSelectedDiscovery} />
              </div>
            </section>
          )}

          {highlights.length > 0 && (
            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Em destaque agora</p>
                  <h2 className="font-serif text-2xl text-forest-900 mt-0.5">O que merece seu olhar primeiro</h2>
                </div>
                <span className="hidden sm:block text-xs text-ink-soft">Até 3 percepções mais relevantes</span>
              </div>
              <div className="grid md:grid-cols-3 gap-3 mt-4">
                {highlights.map(discovery => (
                  <HighlightCard key={discovery.id} discovery={discovery} onOpen={setSelectedDiscovery} />
                ))}
              </div>
            </section>
          )}

          <section className="border-t border-line pt-5">
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="inline-flex min-w-full sm:min-w-0 gap-1 rounded-2xl bg-paper-soft p-1" role="tablist" aria-label="Categorias de descobertas">
                {tabs.map(tab => {
                  const active = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.key)}
                      className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors ${active ? 'bg-white text-forest-900 shadow-sm' : 'text-ink-soft hover:text-forest-800'}`}
                    >
                      {tab.label} <span className="ml-1 text-[10px] opacity-70">{tab.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {activeTab === 'hidden' ? (
              <HiddenList discoveries={hiddenDiscoveries} onRestore={key => choose(key, 'not_following')} />
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5 mb-3">
                  <div>
                    <h3 className="font-serif text-xl text-forest-900">{tabHeading(activeTab)}</h3>
                    <p className="text-xs text-ink-soft mt-0.5">{tabDescription(activeTab)}</p>
                  </div>
                  {categoryOptions.length > 1 && (
                    <select
                      value={categoryFilter}
                      onChange={event => setCategoryFilter(event.target.value)}
                      className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-forest-800 outline-none focus:border-forest-400"
                      aria-label="Filtrar descobertas por tipo"
                    >
                      <option value="all">Todos os tipos</option>
                      {categoryOptions.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  )}
                </div>

                {filteredDiscoveries.length > 0 ? (
                  <div className="divide-y divide-line rounded-3xl border border-line bg-white/80 overflow-hidden">
                    {filteredDiscoveries.map(discovery => (
                      <CompactDiscoveryRow
                        key={discovery.id}
                        discovery={discovery}
                        saved={feedback[discovery.stableKey] === 'made_sense'}
                        onOpen={setSelectedDiscovery}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-paper-soft px-4 py-6 text-sm text-ink-soft text-center">Nada nesta categoria por enquanto.</p>
                )}

                {activeTab === 'saved' && user && (
                  <div className="mt-6">
                    <DiscoveryMemoryArchive userId={user.id} discoveries={allDiscoveries} feedback={feedback} />
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <details className="border-t border-line pt-4 text-xs text-ink-soft">
        <summary className="cursor-pointer font-medium text-forest-700">Como estas descobertas são formadas</summary>
        <p className="mt-2 max-w-2xl leading-relaxed">
          São observações dos dados estruturados dos seus próprios registros, não diagnósticos. Coocorrência não significa que um sinal cause o outro. Nenhum trecho do texto livre do seu diário é usado nesta área.
        </p>
      </details>

      {selectedDiscovery && (
        <DiscoveryDrawer
          discovery={selectedDiscovery}
          feedback={feedback}
          onChoose={choose}
          onClose={() => setSelectedDiscovery(null)}
          onOpenMap={() => onNavigate('my-evolution')}
        />
      )}
    </div>
  )
}

function PageHeader() {
  return (
    <header>
      <div className="flex items-center gap-2 text-forest-600">
        <Compass className="w-5 h-5" />
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">O que estou percebendo</p>
      </div>
      <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1.5">Descobertas</h1>
      <p className="mt-2 text-ink-soft max-w-2xl leading-relaxed">
        Um resumo do que vem se repetindo nos seus registros. Veja primeiro o essencial e abra os detalhes só quando quiser aprofundar.
      </p>
    </header>
  )
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/80 px-3 py-3 sm:px-4 sm:py-4">
      <strong className="block font-serif text-2xl sm:text-3xl font-normal text-forest-900">{value}</strong>
      <span className="block text-[10px] sm:text-xs text-ink-soft mt-0.5 leading-tight">{label}</span>
    </div>
  )
}

function OverviewItem({ label, discovery, onOpen }: {
  label: string
  discovery?: HomeDiscovery
  onOpen: (discovery: HomeDiscovery) => void
}) {
  if (!discovery) {
    return (
      <div className="rounded-2xl bg-white/70 border border-line/70 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-ink-soft">{label}</p>
        <p className="text-sm text-ink-soft mt-1">Ainda ganhando contexto.</p>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => onOpen(discovery)} className="rounded-2xl bg-white border border-line px-4 py-3 text-left hover:border-forest-300 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">{label}</p>
      <p className="font-serif text-base text-forest-900 mt-1 line-clamp-2">{discovery.title}</p>
      <span className="inline-flex items-center gap-1 text-[11px] text-forest-700 mt-2">Ver detalhes <ChevronRight className="w-3 h-3" /></span>
    </button>
  )
}

function HighlightCard({ discovery, onOpen }: { discovery: HomeDiscovery; onOpen: (discovery: HomeDiscovery) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(discovery)}
      className="rounded-3xl border border-line bg-white p-4 text-left hover:border-forest-300 hover:bg-paper-soft/40 transition-colors"
    >
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">{discoveryCategoryLabel(discovery)}</p>
      <h3 className="font-serif text-lg text-forest-900 mt-1 line-clamp-2">{discovery.title}</h3>
      <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-ink-soft">
        <span>{discovery.matchedDays} de {discovery.baseDays} dias</span>
        <span aria-hidden="true">·</span>
        <span>{discoveryStage(discovery)}</span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 mt-3">Ver detalhes <ChevronRight className="w-3.5 h-3.5" /></span>
    </button>
  )
}

function CompactDiscoveryRow({ discovery, saved, onOpen }: {
  discovery: HomeDiscovery
  saved: boolean
  onOpen: (discovery: HomeDiscovery) => void
}) {
  return (
    <button type="button" onClick={() => onOpen(discovery)} className="w-full px-4 sm:px-5 py-4 text-left hover:bg-paper-soft/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">{discoveryCategoryLabel(discovery)}</p>
            {saved && <Heart className="w-3.5 h-3.5 text-forest-600" aria-label="Guardada por você" />}
          </div>
          <h4 className="font-serif text-lg text-forest-900 mt-0.5">{discovery.title}</h4>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-soft mt-1.5">
            <span>{discovery.matchedDays} de {discovery.baseDays} dias</span>
            <span aria-hidden="true">·</span>
            <span>{discoveryStage(discovery)}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-forest-500 mt-2 flex-shrink-0" />
      </div>
    </button>
  )
}

function HiddenList({ discoveries, onRestore }: { discoveries: HomeDiscovery[]; onRestore: (key: string) => void }) {
  return (
    <div className="mt-5">
      <div className="mb-3">
        <h3 className="font-serif text-xl text-forest-900">Descobertas ocultas</h3>
        <p className="text-xs text-ink-soft mt-0.5">O que você preferiu não acompanhar fica separado e pode ser restaurado quando quiser.</p>
      </div>
      {discoveries.length > 0 ? (
        <div className="divide-y divide-line rounded-3xl border border-line bg-white/80 overflow-hidden">
          {discoveries.map(discovery => (
            <div key={discovery.stableKey} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">{discoveryCategoryLabel(discovery)}</p>
                <p className="font-serif text-base text-forest-900 mt-0.5">{discovery.title}</p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(discovery.stableKey)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-forest-800 hover:bg-mint/50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Voltar a acompanhar
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-paper-soft px-4 py-6 text-sm text-ink-soft text-center">Você não ocultou nenhuma descoberta.</p>
      )}
    </div>
  )
}

function DiscoveryDrawer({ discovery, feedback, onChoose, onClose, onOpenMap }: {
  discovery: HomeDiscovery
  feedback: DiscoveryFeedbackMap
  onChoose: (key: string, value: DiscoveryFeedbackValue) => void
  onClose: () => void
  onOpenMap: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Detalhes: ${discovery.title}`}>
      <button type="button" className="absolute inset-0 bg-forest-950/25 backdrop-blur-[1px]" onClick={onClose} aria-label="Fechar detalhes" />
      <aside className="relative h-full w-full sm:max-w-lg bg-[#fbfaf6] border-l border-line shadow-2xl overflow-y-auto p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{discoveryCategoryLabel(discovery)}</p>
            <h2 className="font-serif text-2xl sm:text-3xl text-forest-900 mt-1">{discovery.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-line bg-white p-2 text-forest-700 hover:bg-paper-soft" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] text-forest-700">{discoveryStage(discovery)}</span>
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] text-ink-soft">{discovery.matchedDays} de {discovery.baseDays} dias</span>
        </div>

        <p className="text-sm text-ink-soft mt-5 leading-relaxed">{discoveryContextualDescription(discovery)}</p>

        <section className="rounded-2xl border border-line bg-white/80 p-4 mt-5">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">O que sustenta essa percepção</p>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">{discovery.evidence}</p>
        </section>

        <section className="rounded-2xl bg-mint/30 p-4 mt-3">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-forest-600">Para observar</p>
          <p className="text-sm text-forest-900 mt-2 leading-relaxed">{discovery.question}</p>
        </section>

        <button
          type="button"
          onClick={onOpenMap}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-medium text-forest-900 hover:bg-mint/40 transition-colors"
        >
          <LineChart className="w-4 h-4" /> Ver no Mapa Emocional
        </button>

        <div className="mt-6 pt-5 border-t border-line">
          <p className="text-xs text-ink-soft mb-2">Isso fez sentido para você?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sua percepção sobre esta descoberta">
            {DISCOVERY_FEEDBACK_OPTIONS.map(option => {
              const active = feedback[discovery.stableKey] === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChoose(discovery.stableKey, option.value)}
                  className={`text-xs px-3 py-2 rounded-full border transition-colors ${active ? 'border-forest-500 bg-mint text-forest-800 font-medium' : 'border-line bg-white text-ink-soft hover:border-forest-300 hover:text-forest-700'}`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}

function EmptyState({ hiddenCount, onDiary, onHidden }: { hiddenCount: number; onDiary: () => void; onHidden: () => void }) {
  return (
    <section className="rounded-3xl border border-line bg-mint/25 p-6 sm:p-7">
      <span className="w-11 h-11 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center">
        <Sparkles className="w-5 h-5" />
      </span>
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600 mt-4">Aparecendo agora</p>
      <h2 className="font-serif text-2xl text-forest-900 mt-1">{hiddenCount > 0 ? 'Nada pedindo atenção agora' : 'Ainda não apareceu algo para destacar'}</h2>
      <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-2xl">
        {hiddenCount > 0
          ? 'O que você preferiu não acompanhar continua guardado e pode ser restaurado quando quiser.'
          : 'Conforme seus registros criam contexto suficiente, alguns sinais podem aparecer aqui. Não existe meta de frequência para isso.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onDiary} className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800 transition-colors">
          Ir para o diário <ArrowRight className="w-4 h-4" />
        </button>
        {hiddenCount > 0 && (
          <button type="button" onClick={onHidden} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-forest-900 hover:bg-mint/40 transition-colors">
            <EyeOff className="w-4 h-4" /> Ver ocultas ({hiddenCount})
          </button>
        )}
      </div>
    </section>
  )
}

function tabHeading(tab: DiscoveryTab) {
  if (tab === 'now') return 'Começando a aparecer'
  if (tab === 'patterns') return 'Padrões mais consistentes'
  if (tab === 'connections') return 'Sinais que aparecem juntos'
  if (tab === 'saved') return 'O que já fez sentido para você'
  return 'Descobertas ocultas'
}

function tabDescription(tab: DiscoveryTab) {
  if (tab === 'now') return 'Percepções recentes que ainda estão ganhando contexto.'
  if (tab === 'patterns') return 'Sinais que já se repetiram o suficiente para merecer um olhar mais atento.'
  if (tab === 'connections') return 'Coocorrências observadas entre contextos, emoções, sono, energia e ansiedade.'
  if (tab === 'saved') return 'Percepções que você reconheceu e decidiu guardar.'
  return 'Itens que você preferiu não acompanhar.'
}
