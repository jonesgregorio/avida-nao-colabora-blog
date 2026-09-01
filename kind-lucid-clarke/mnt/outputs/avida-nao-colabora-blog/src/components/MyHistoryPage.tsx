import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { ArrowLeft, ArrowRight, Leaf, Loader2, Sparkles, Sprout, TreePine } from 'lucide-react'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import { supabase } from '../lib/supabase'
import { loadReportHistory } from '../lib/reportGeneration'
import { buildJourneyChapter, type JourneyChapterKey } from '../lib/journeyChapter'
import { buildMyHistory, type MyHistoryEntry, type MyHistoryReport } from '../lib/myHistory'
import MyHistoryPageLegacy from './MyHistoryPageLegacy'

type Props = ComponentProps<typeof MyHistoryPageLegacy>

type JourneyStep = {
  label: string
  state: 'past' | 'current' | 'future'
}

const PAGE_SIZE = 500
const MAX_PAGES = 10

async function loadStructuredJourney(userId: string): Promise<MyHistoryEntry[]> {
  const entries: MyHistoryEntry[] = []

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
    if (batch.length < PAGE_SIZE) break
  }

  return entries
}

function journeyStageIndex(key: JourneyChapterKey, activeDays: number) {
  if (activeDays === 0) return 0
  if (key === 'starting') return 1
  if (key === 'forming') return 2
  if (key === 'reflecting') return 3
  return 4
}

function journeySteps(currentIndex: number, hasStarted: boolean): JourneyStep[] {
  const labels = [
    hasStarted ? 'Você começou a registrar' : 'Seu primeiro registro abre a jornada',
    'Começando a se observar',
    'Algumas coisas começaram a se repetir',
    'Percebendo padrões',
    'Aprendendo o que ajuda',
  ]

  return labels.map((label, index) => ({
    label,
    state: index < currentIndex ? 'past' : index === currentIndex ? 'current' : 'future',
  }))
}

function Garden({ chapterKey }: { chapterKey: JourneyChapterKey }) {
  const growth = chapterKey === 'starting' ? 0 : chapterKey === 'forming' ? 1 : chapterKey === 'reflecting' ? 2 : 3

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-mint/45 via-paper-soft to-sand-50 p-5 sm:p-6" aria-labelledby="journey-garden-heading">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-forest-50/70" aria-hidden />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Seu jardim</p>
            <h2 id="journey-garden-heading" className="font-serif text-2xl text-forest-900 mt-1">O que já cresceu na sua história</h2>
          </div>
          <span className="w-10 h-10 rounded-2xl border border-line bg-white text-forest-700 flex items-center justify-center"><Leaf className="w-5 h-5" /></span>
        </div>

        <div className="mt-7 min-h-32 flex items-end justify-center gap-5 sm:gap-8" aria-label="Representação visual do crescimento da sua jornada">
          <div className="flex flex-col items-center gap-2 text-forest-500">
            <Sprout className="w-9 h-9" strokeWidth={1.7} />
            <span className="w-10 h-2 rounded-full bg-forest-100" aria-hidden />
          </div>
          {growth >= 1 && (
            <div className="flex flex-col items-center gap-2 text-forest-600">
              <Leaf className="w-11 h-11" strokeWidth={1.6} />
              <span className="w-12 h-2 rounded-full bg-forest-100" aria-hidden />
            </div>
          )}
          {growth >= 2 && (
            <div className="flex flex-col items-center gap-2 text-forest-700">
              <TreePine className="w-14 h-14" strokeWidth={1.5} />
              <span className="w-14 h-2 rounded-full bg-forest-100" aria-hidden />
            </div>
          )}
          {growth >= 3 && (
            <div className="relative flex flex-col items-center gap-2 text-forest-800">
              <Sparkles className="absolute -right-4 -top-3 w-5 h-5 text-forest-400" aria-hidden />
              <TreePine className="w-16 h-16" strokeWidth={1.45} />
              <span className="w-16 h-2 rounded-full bg-forest-100" aria-hidden />
            </div>
          )}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-ink-soft max-w-2xl">Este jardim representa apenas o caminho que já existe. Ele não diminui, zera ou morre se você passar um tempo sem registrar. Sua história continua daqui.</p>
      </div>
    </section>
  )
}

export default function MyHistoryPage(props: Props) {
  const { user, profile } = props
  const plan = normalizePlan(profile?.plan)
  const hasHistory = hasPlanAccess(plan, 'essential')
  const isPlus = plan === 'plus'
  const [entries, setEntries] = useState<MyHistoryEntry[]>([])
  const [reports, setReports] = useState<MyHistoryReport[]>([])
  const [loading, setLoading] = useState(hasHistory)
  const [failed, setFailed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!user || !hasHistory || showDetails) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setFailed(false)

    ;(async () => {
      try {
        const [structuredEntries, storedReports] = await Promise.all([
          loadStructuredJourney(user.id),
          loadReportHistory(user.id),
        ])
        if (!active) return
        setEntries(structuredEntries)
        setReports(storedReports as unknown as MyHistoryReport[])
      } catch {
        if (active) setFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [hasHistory, showDetails, user])

  const history = useMemo(() => {
    const visibleReports = isPlus ? reports : reports.filter(report => report.report_type === 'weekly')
    return buildMyHistory(entries, visibleReports, { includeTriggers: isPlus, memoryLimit: 4 })
  }, [entries, isPlus, reports])

  const chapter = useMemo(() => buildJourneyChapter({
    activeDays: history.totals.activeDays,
    reports: history.totals.reports,
    months: history.months.length,
    milestones: history.milestones.length,
    hasSteadyMonth: history.milestones.some(milestone => milestone.kind === 'first_steady_month'),
  }), [history])

  const currentIndex = journeyStageIndex(chapter.key, history.totals.activeDays)
  const steps = journeySteps(currentIndex, history.totals.activeDays > 0)

  if (!hasHistory || failed) return <MyHistoryPageLegacy {...props} />

  if (showDetails) {
    return (
      <div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
          <button type="button" onClick={() => setShowDetails(false)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar à jornada
          </button>
        </div>
        <MyHistoryPageLegacy {...props} />
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-500" /><span className="ml-3 text-sm text-ink-soft">Organizando sua jornada…</span></div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-7">
      <header className="max-w-3xl">
        <div className="flex items-center gap-2 text-forest-600">
          <Leaf className="w-5 h-5" />
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Minha História</p>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-forest-900 mt-1">Sua jornada</h1>
        <p className="text-sm sm:text-base text-ink-soft mt-3 leading-relaxed">O que você viveu não precisa virar uma pontuação. Aqui, sua trajetória aparece como memória, marcos e mudanças que foram ganhando forma com o tempo.</p>
      </header>

      <section className="rounded-3xl border border-forest-100 bg-gradient-to-br from-forest-50 via-mint/40 to-paper-soft p-5 sm:p-7" aria-labelledby="current-journey-heading">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Seu momento agora</p>
        <h2 id="current-journey-heading" className="font-serif text-2xl sm:text-3xl text-forest-900 mt-1">{chapter.title}</h2>
        <p className="text-sm sm:text-[15px] text-ink-soft mt-2 max-w-3xl leading-relaxed">{chapter.description}</p>
        <p className="text-xs text-ink-soft mt-4 max-w-3xl">{chapter.note}</p>
      </section>

      <section aria-labelledby="trajectory-heading">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Trajetória</p>
        <h2 id="trajectory-heading" className="font-serif text-2xl text-forest-900 mt-1">O caminho que já começou a aparecer</h2>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">Não é uma lista para completar. É apenas uma forma de enxergar onde sua história já deixou sinais.</p>

        <ol className="mt-5 max-w-2xl">
          {steps.map((step, index) => (
            <li key={step.label} className="relative flex gap-4 pb-5 last:pb-0">
              {index < steps.length - 1 && <span className="absolute left-[9px] top-5 bottom-0 w-px bg-line" aria-hidden />}
              <span className={`relative z-10 mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                step.state === 'current'
                  ? 'border-forest-700 bg-mint ring-4 ring-mint/50'
                  : step.state === 'past'
                    ? 'border-forest-500 bg-forest-500'
                    : 'border-line bg-paper-soft'
              }`} aria-hidden>
                {step.state === 'current' && <Leaf className="w-3 h-3 text-forest-800" />}
              </span>
              <div className={step.state === 'future' ? 'text-ink-soft' : 'text-forest-900'}>
                <p className={`text-sm ${step.state === 'current' ? 'font-semibold' : 'font-medium'}`}>{step.label}</p>
                {step.state === 'current' && <p className="text-xs text-forest-600 mt-0.5">É onde a sua história parece estar agora.</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Garden chapterKey={chapter.key} />

      <section className="border-t border-line pt-5">
        <button type="button" onClick={() => setShowDetails(true)} className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800 transition-colors">
          Explorar minha história <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-xs text-ink-soft max-w-2xl">Comparações, marcos detalhados, memórias reconhecidas, meses anteriores e os registros estruturados continuam disponíveis na visão completa.</p>
      </section>

      <p className="text-xs text-ink-soft border-t border-line pt-4">Nenhum trecho do texto livre do Diário é exibido nesta jornada. Ela usa apenas sinais estruturados e fatos que já existem na sua conta.</p>
    </div>
  )
}
