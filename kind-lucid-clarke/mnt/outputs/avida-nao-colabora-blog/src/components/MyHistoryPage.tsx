import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowRight, BarChart3, CalendarDays, History, LineChart, Loader2, Lock,
  NotebookPen, Sparkles,
} from 'lucide-react'
import type { Profile } from '../types'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import { supabase } from '../lib/supabase'
import { loadReportHistory } from '../lib/reportGeneration'
import { buildTemporalComparison } from '../lib/temporalComparison'
import { buildJourneyChapter } from '../lib/journeyChapter'
import { fetchDiscoveryMemories, type DiscoveryMemory } from '../lib/discoveryMemoryStore'
import {
  buildMyHistory,
  type MyHistoryEntry,
  type MyHistoryReport,
} from '../lib/myHistory'
import TemporalComparisonPanel from './history/TemporalComparisonPanel'
import JourneyChapterCard from './history/JourneyChapterCard'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigatePricing: () => void
  onNavigateDiary: () => void
  onNavigateReport: () => void
  onNavigateMap: () => void
}

const PAGE_SIZE = 500
const MAX_PAGES = 10

async function loadStructuredHistory(userId: string): Promise<{ entries: MyHistoryEntry[]; truncated: boolean }> {
  const entries: MyHistoryEntry[] = []
  let truncated = false

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('diary_entries')
      .select('created_at,date,mood,energy,anxiety_level,sleep_quality,emotional_tags,context_tags,need_tags,trigger_tags,entry_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    const batch = (data ?? []) as MyHistoryEntry[]
    entries.push(...batch)
    if (batch.length < PAGE_SIZE) return { entries, truncated: false }
  }

  truncated = true
  return { entries, truncated }
}

function firstDateLabel(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day, 12))
    .replace('.', '')
}

function discoveryDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function MemoryCard({ memory }: { memory: ReturnType<typeof buildMyHistory>['memories'][number] }) {
  const chips = [
    ...(memory.mood ? [{ label: memory.mood, kind: 'estado' }] : []),
    ...memory.emotions.map(label => ({ label, kind: 'emoção' })),
    ...memory.contexts.map(label => ({ label, kind: 'contexto' })),
    ...memory.needs.map(label => ({ label, kind: 'necessidade' })),
    ...memory.triggers.map(label => ({ label, kind: 'gatilho' })),
  ].slice(0, 6)

  return (
    <article className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <CalendarDays className="w-4 h-4 text-forest-500" />
        {memory.dateLabel}
      </div>
      <p className="font-serif text-lg text-forest-900 mt-2">Um ponto da sua história</p>
      <p className="text-sm text-ink-soft mt-1 leading-relaxed">
        Estes são apenas marcadores que você registrou naquele dia. O texto escrito no Diário não é reproduzido aqui.
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        {chips.map((chip, index) => (
          <span key={`${chip.kind}:${chip.label}:${index}`} className="rounded-full bg-mint/60 px-3 py-1.5 text-xs text-forest-800">
            {chip.label}
          </span>
        ))}
      </div>
    </article>
  )
}

function DiscoveryMemoryCard({ memory }: { memory: DiscoveryMemory }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-forest-600">Reconhecida por você</p>
      <h3 className="font-serif text-lg text-forest-900 mt-1">{memory.title}</h3>
      <p className="text-sm text-ink-soft mt-2 leading-relaxed">{memory.description}</p>
      <div className="rounded-xl bg-paper-soft border border-line mt-3 px-3.5 py-3">
        <p className="text-[11px] font-semibold text-forest-700">O que sustentou essa percepção</p>
        <p className="text-xs text-ink-soft mt-1 leading-relaxed">{memory.evidence}</p>
      </div>
      <p className="text-[11px] text-ink-soft mt-3 capitalize">Fez sentido para você em {discoveryDateLabel(memory.recognized_at)}</p>
    </article>
  )
}

export default function MyHistoryPage({
  user, profile, onNavigatePricing, onNavigateDiary, onNavigateReport, onNavigateMap,
}: Props) {
  const plan = normalizePlan(profile?.plan)
  const hasHistory = hasPlanAccess(plan, 'essential')
  const isPlus = plan === 'plus'
  const includeTriggers = isPlus
  const [entries, setEntries] = useState<MyHistoryEntry[]>([])
  const [reports, setReports] = useState<MyHistoryReport[]>([])
  const [discoveryMemories, setDiscoveryMemories] = useState<DiscoveryMemory[]>([])
  const [loading, setLoading] = useState(hasHistory)
  const [error, setError] = useState(false)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    if (!user || !hasHistory) { setLoading(false); return }
    let active = true
    ;(async () => {
      try {
        const [history, storedReports, storedDiscoveryMemories] = await Promise.all([
          loadStructuredHistory(user.id),
          loadReportHistory(user.id),
          fetchDiscoveryMemories(user.id),
        ])
        if (!active) return
        setEntries(history.entries)
        setReports(storedReports as unknown as MyHistoryReport[])
        setDiscoveryMemories(storedDiscoveryMemories)
        setTruncated(history.truncated)
        setError(false)
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [user, hasHistory])

  const history = useMemo(() => {
    const visibleReports = isPlus ? reports : reports.filter(report => report.report_type === 'weekly')
    return buildMyHistory(entries, visibleReports, { includeTriggers, memoryLimit: 4 })
  }, [entries, reports, includeTriggers, isPlus])

  const chapter = useMemo(() => buildJourneyChapter({
    activeDays: history.totals.activeDays,
    reports: history.totals.reports,
    months: history.months.length,
    milestones: history.milestones.length,
    hasSteadyMonth: history.milestones.some(milestone => milestone.kind === 'first_steady_month'),
  }), [history])

  const comparison = useMemo(
    () => buildTemporalComparison(entries, { includeTriggers }),
    [entries, includeTriggers],
  )

  const rememberedDiscoveries = useMemo(() => discoveryMemories.slice(0, 3), [discoveryMemories])

  if (!hasHistory) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
        <section className="rounded-[30px] border border-line bg-gradient-to-br from-mint via-paper-soft to-sand-50 p-6 sm:p-8 text-center">
          <span className="w-14 h-14 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center mx-auto"><Lock className="w-6 h-6" /></span>
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600 mt-5">Minha História</p>
          <h1 className="font-serif text-3xl text-forest-900 mt-1">Seu histórico completo começa no Essencial</h1>
          <p className="text-sm text-ink-soft mt-3 max-w-xl mx-auto leading-relaxed">O Essencial reúne seus dias registrados e relatórios em uma linha do tempo para você olhar o caminho com mais distância, sem transformar cada registro em uma conclusão.</p>
          <button onClick={onNavigatePricing} className="mt-6 inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors">Conhecer o Essencial <ArrowRight className="w-4 h-4" /></button>
        </section>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <header className="rounded-[30px] border border-line bg-gradient-to-br from-mint via-paper-soft to-sand-50 p-5 sm:p-7 lg:p-8">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Minha História</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-forest-900 mt-1">O que você registra também forma uma trajetória</h1>
          <p className="text-sm sm:text-base text-ink-soft mt-3 leading-relaxed">Aqui, seus registros e relatórios aparecem como uma linha do tempo. Nada novo é criado para preencher lacunas: esta página apenas organiza fatos que já existem na sua conta.</p>
          <div className="flex flex-wrap gap-2.5 mt-5">
            <button onClick={onNavigateDiary} className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-4 py-2.5 rounded-2xl transition-colors"><NotebookPen className="w-4 h-4" /> Registrar hoje</button>
            <button onClick={onNavigateMap} className="inline-flex items-center gap-2 border border-line bg-white hover:bg-mint/40 text-forest-900 text-sm font-medium px-4 py-2.5 rounded-2xl transition-colors"><LineChart className="w-4 h-4" /> Ver Mapa Emocional</button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-line bg-paper-soft py-16 flex items-center justify-center" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-500" /><span className="ml-3 text-sm text-ink-soft">Organizando sua história…</span></div>
      ) : error ? (
        <div className="rounded-3xl border border-line bg-paper-soft p-7 text-center"><p className="font-medium text-forest-900">Não conseguimos carregar sua história agora.</p><p className="text-sm text-ink-soft mt-1">Seus registros continuam salvos. Tente abrir esta página novamente mais tarde.</p></div>
      ) : (
        <>
          <section className="grid sm:grid-cols-3 gap-3" aria-label="Resumo da sua história">
            <div className="rounded-2xl border border-line bg-paper-soft p-4"><p className="text-xs text-ink-soft">Dias com registro</p><p className="font-serif text-3xl text-forest-900 mt-1">{history.totals.activeDays}</p></div>
            <div className="rounded-2xl border border-line bg-paper-soft p-4"><p className="text-xs text-ink-soft">Relatórios fechados</p><p className="font-serif text-3xl text-forest-900 mt-1">{history.totals.reports}</p></div>
            <div className="rounded-2xl border border-line bg-paper-soft p-4"><p className="text-xs text-ink-soft">Primeiro ponto carregado</p><p className="font-serif text-xl text-forest-900 mt-2 capitalize">{firstDateLabel(history.totals.firstDate)}</p></div>
          </section>

          <JourneyChapterCard chapter={chapter} />
          <TemporalComparisonPanel comparison={comparison} />

          {rememberedDiscoveries.length > 0 && (
            <section className="rounded-3xl border border-line bg-sand-50 p-5 sm:p-6" aria-labelledby="recognized-discoveries-heading">
              <div className="flex items-start gap-3 mb-4">
                <span className="w-10 h-10 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5" /></span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Percepções reconhecidas</p>
                  <h2 id="recognized-discoveries-heading" className="font-serif text-2xl text-forest-900 mt-0.5">Coisas que já fizeram sentido na sua história</h2>
                  <p className="text-sm text-ink-soft mt-1">Aqui aparecem apenas descobertas que você escolheu reconhecer. Elas não viram pontuação, meta ou obrigação de continuidade.</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rememberedDiscoveries.map(memory => <DiscoveryMemoryCard key={memory.id} memory={memory} />)}</div>
            </section>
          )}

          {history.milestones.length > 0 && (
            <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6" aria-labelledby="milestones-heading">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Acontecimentos</p>
              <h2 id="milestones-heading" className="font-serif text-2xl text-forest-900 mt-0.5">Momentos da sua trajetória</h2>
              <p className="text-sm text-ink-soft mt-1">Marcos reais do seu percurso — cada um vem de algo que aconteceu de verdade nos seus registros.</p>
              <ol className="mt-4 relative border-l border-line ml-1.5 space-y-4">
                {history.milestones.map((milestone, index) => {
                  const isLatest = index === history.milestones.length - 1
                  return (
                    <li key={milestone.id} className="pl-5">
                      <span className={`absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border-2 border-paper-soft ${isLatest ? 'bg-forest-700 ring-4 ring-mint/70' : 'bg-forest-400'}`} aria-hidden />
                      <div className={isLatest ? 'rounded-2xl border border-forest-100 bg-mint/35 px-4 py-3.5' : ''}>
                        <div className="flex flex-wrap items-center gap-2"><p className="text-[11px] text-ink-soft capitalize">{milestone.dateLabel}</p>{isLatest && <span className="rounded-full bg-white border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-forest-700">Mais recente</span>}</div>
                        <p className="font-serif text-lg text-forest-900 leading-snug mt-0.5">{milestone.title}</p>
                        <p className="text-sm text-ink-soft mt-1 leading-relaxed">{milestone.description}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          {history.memories.length > 0 && (
            <section className="rounded-3xl border border-line bg-mint/25 p-5 sm:p-6" aria-labelledby="memories-heading">
              <div className="flex items-start gap-3 mb-4"><span className="w-10 h-10 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5" /></span><div><p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Memórias</p><h2 id="memories-heading" className="font-serif text-2xl text-forest-900 mt-0.5">Alguns dias antigos para revisitar</h2><p className="text-sm text-ink-soft mt-1">No máximo um dia por mês aparece aqui, sempre a partir de marcadores estruturados.</p></div></div>
              <div className="grid md:grid-cols-2 gap-3">{history.memories.map(memory => <MemoryCard key={memory.id} memory={memory} />)}</div>
            </section>
          )}

          <section aria-labelledby="timeline-heading">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 px-1">
              <div><p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Linha do tempo</p><h2 id="timeline-heading" className="font-serif text-2xl text-forest-900 mt-0.5">Sua história por mês</h2></div>
              {history.totals.reports > 0 && <button onClick={onNavigateReport} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">Ver todos os relatórios <ArrowRight className="w-4 h-4" /></button>}
            </div>

            {history.months.length === 0 ? (
              <div className="rounded-3xl border border-line bg-paper-soft p-8 text-center"><History className="w-8 h-8 text-forest-300 mx-auto" /><p className="font-medium text-forest-900 mt-3">Sua linha do tempo começa com o próximo registro.</p><p className="text-sm text-ink-soft mt-1">Não é preciso preencher dias anteriores nem manter sequência.</p><button onClick={onNavigateDiary} className="mt-4 text-sm font-medium text-forest-700 underline underline-offset-4">Registrar como estou hoje</button></div>
            ) : (
              <div className="relative space-y-4 before:absolute before:left-[19px] sm:before:left-[23px] before:top-3 before:bottom-3 before:w-px before:bg-line">
                {history.months.map(month => (
                  <article key={month.key} className="relative pl-12 sm:pl-14">
                    <span className="absolute left-2 sm:left-3 top-5 w-6 h-6 rounded-full bg-paper border-4 border-mint ring-1 ring-forest-100" aria-hidden />
                    <div className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div><h3 className="font-serif text-2xl text-forest-900 capitalize">{month.label}</h3><p className="text-sm text-ink-soft mt-1 leading-relaxed">{month.summary}</p></div><span className="text-xs bg-white border border-line rounded-full px-3 py-1.5 text-forest-700 self-start">{month.activeDays} {month.activeDays === 1 ? 'dia' : 'dias'}</span></div>
                      <div className="flex flex-wrap gap-2 mt-4">{month.topEmotion && <span className="text-xs rounded-full bg-mint px-3 py-1.5 text-forest-800">Estado: {month.topEmotion.label}</span>}{month.topContext && <span className="text-xs rounded-full bg-sand-100 px-3 py-1.5 text-forest-800">Contexto: {month.topContext.label}</span>}{month.topNeed && <span className="text-xs rounded-full bg-white border border-line px-3 py-1.5 text-forest-800">Necessidade: {month.topNeed.label}</span>}{month.topTrigger && <span className="text-xs rounded-full bg-coral/35 px-3 py-1.5 text-forest-800">Gatilho: {month.topTrigger.label}</span>}</div>
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center"><div className="rounded-xl bg-white border border-line px-2 py-2.5"><p className="text-[10px] text-ink-soft">Registros</p><p className="text-sm font-semibold text-forest-900">{month.entryCount}</p></div><div className="rounded-xl bg-white border border-line px-2 py-2.5"><p className="text-[10px] text-ink-soft">Check-ins</p><p className="text-sm font-semibold text-forest-900">{month.checkinCount}</p></div><div className="rounded-xl bg-white border border-line px-2 py-2.5"><p className="text-[10px] text-ink-soft">Diário</p><p className="text-sm font-semibold text-forest-900">{month.diaryCount}</p></div></div>
                      {month.reports.length > 0 && <div className="mt-5 pt-4 border-t border-line space-y-2"><p className="text-xs font-semibold text-forest-700 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Marcos fechados do período</p>{month.reports.map(report => <button key={report.id} onClick={onNavigateReport} className="w-full text-left rounded-2xl bg-white border border-line px-4 py-3 hover:bg-mint/30 transition-colors"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-forest-900">{report.title}</p><ArrowRight className="w-4 h-4 text-forest-500 flex-shrink-0" /></div>{report.summary && <p className="text-xs text-ink-soft mt-1 line-clamp-2 leading-relaxed">{report.summary}</p>}</button>)}</div>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="rounded-2xl border border-line bg-sand-50 px-4 sm:px-5 py-4 text-xs text-ink-soft leading-relaxed">Esta página usa datas, humor, energia, ansiedade, sono e marcadores estruturados dos seus registros. As percepções reconhecidas vêm somente das Descobertas que você marcou como “Fez sentido para mim”. Nenhum trecho do texto livre do Diário é exibido na linha do tempo, na comparação temporal, no capítulo da jornada ou nas Memórias.{truncated ? ' Para manter a página leve, esta visualização carregou os 5.000 registros estruturados mais recentes.' : ''}</div>
        </>
      )}
    </div>
  )
}
