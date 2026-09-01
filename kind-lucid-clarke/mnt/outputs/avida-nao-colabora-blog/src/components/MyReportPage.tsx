import { useEffect, useMemo, useState, type ComponentProps, type MouseEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, FileText, Leaf, Loader2, Sparkles } from 'lucide-react'
import MyReportPageContent from './MyReportPageContent'
import { supabase } from '../lib/supabase'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import { formatPeriodShort, monthTitle } from '../lib/reportPeriods'
import type { MonthlyContent, StoredReport, WeeklyContent } from '../lib/reportGeneration'

type Props = ComponentProps<typeof MyReportPageContent>

type NarrativeType = 'weekly' | 'monthly'
type NarrativeBlock = { title: string; text: string }

const HISTORY_HEADING = 'Histórico de relatórios'

function findReportHistorySection(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const heading = Array.from(root.querySelectorAll('h2')).find(
    node => node.textContent?.trim() === HISTORY_HEADING,
  )
  return (heading?.closest('section') as HTMLElement | null) ?? null
}

function reportLabel(report: StoredReport) {
  return report.report_type === 'monthly'
    ? monthTitle(report.period_start)
    : formatPeriodShort({ start: report.period_start, end: report.period_end })
}

function weeklyBlocks(content: WeeklyContent): NarrativeBlock[] {
  return [
    {
      title: 'O que mais pesou',
      text: content.interpretation || content.patterns?.[0] || content.summary,
    },
    {
      title: 'O que ajudou',
      text: content.improvementMoments || 'Ainda não há registros suficientes para destacar o que ajudou nesta semana.',
    },
    {
      title: 'Algo mudou',
      text: content.comparison?.[0] || 'Ainda não há uma semana anterior suficiente para comparar com cuidado.',
    },
    {
      title: 'Uma coisa para levar daqui',
      text: content.nextSteps?.[0] || 'Continue observando o que faz sentido para você, sem transformar o registro em obrigação.',
    },
  ]
}

function monthlyBlocks(content: MonthlyContent): NarrativeBlock[] {
  return [
    {
      title: 'O que mais pesou',
      text: content.predominantEmotions || content.patterns?.[0] || content.summary,
    },
    {
      title: 'O que ajudou',
      text: content.improvementMoments || 'Ainda não há registros suficientes para destacar o que ajudou neste mês.',
    },
    {
      title: 'Algo mudou',
      text: content.monthlyComparison?.[0] || 'Ainda não há um mês anterior suficiente para comparar com cuidado.',
    },
    {
      title: 'Uma coisa para levar daqui',
      text: content.reflectionQuestions?.[0] || 'Que parte deste mês você gostaria de observar com mais gentileza no próximo ciclo?',
    },
  ]
}

function NarrativeCard({ block }: { block: NarrativeBlock }) {
  return (
    <article className="rounded-2xl border border-line bg-paper-soft p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{block.title}</p>
      <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-forest-900">{block.text}</p>
    </article>
  )
}

/**
 * Fase 22.5: a primeira leitura de um relatório fechado é narrativa.
 * O painel completo permanece intacto atrás de “Explorar detalhes”, onde ficam
 * métricas, gráficos, histórico, PDF e todos os recursos já existentes.
 */
export default function MyReportPage(props: Props) {
  const { user, profile } = props
  const plan = normalizePlan(profile?.plan ?? 'free')
  const canReadReports = hasPlanAccess(plan, 'essential')
  const [reports, setReports] = useState<StoredReport[]>([])
  const [loadingNarrative, setLoadingNarrative] = useState(canReadReports)
  const [narrativeFailed, setNarrativeFailed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedType, setSelectedType] = useState<NarrativeType>('weekly')

  useEffect(() => {
    if (!user || !canReadReports) {
      setLoadingNarrative(false)
      return
    }

    let active = true
    setLoadingNarrative(true)
    setNarrativeFailed(false)

    supabase
      .from('reports')
      .select('id,report_type,plan_required,period_start,period_end,available_at,generated_at,status,title,summary,content')
      .eq('user_id', user.id)
      .order('period_end', { ascending: false })
      .limit(16)
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setNarrativeFailed(true)
          setReports([])
        } else {
          const loaded = ((data as unknown as StoredReport[]) ?? []).filter(
            report => report.report_type === 'weekly' || report.report_type === 'monthly',
          )
          setReports(loaded)
          if (!loaded.some(report => report.report_type === 'weekly') && loaded.some(report => report.report_type === 'monthly')) {
            setSelectedType('monthly')
          }
        }
        setLoadingNarrative(false)
      }, () => {
        if (!active) return
        setNarrativeFailed(true)
        setReports([])
        setLoadingNarrative(false)
      })

    return () => { active = false }
  }, [canReadReports, user])

  const latestWeekly = useMemo(() => reports.find(report => report.report_type === 'weekly') ?? null, [reports])
  const latestMonthly = useMemo(() => reports.find(report => report.report_type === 'monthly') ?? null, [reports])
  const selectedReport = selectedType === 'monthly' ? latestMonthly : latestWeekly
  const canShowMonthly = plan === 'plus' && !!latestMonthly

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const button = target.closest('button')
    if (!button || button.textContent?.trim().startsWith('Ver todos') !== true) return

    window.requestAnimationFrame(() => {
      const root = event.currentTarget
      const history = findReportHistorySection(root)
      if (!history) return
      history.id = 'report-history'
      history.style.scrollMarginTop = '6rem'
      history.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  if (!canReadReports || narrativeFailed || (!loadingNarrative && !latestWeekly && !latestMonthly)) {
    return (
      <div onClickCapture={handleClickCapture}>
        <MyReportPageContent {...props} />
      </div>
    )
  }

  if (showDetails) {
    return (
      <div onClickCapture={handleClickCapture}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar à leitura principal
          </button>
        </div>
        <MyReportPageContent {...props} />
      </div>
    )
  }

  if (loadingNarrative || !selectedReport) {
    return <div className="flex justify-center items-center py-24" role="status"><Loader2 className="w-6 h-6 text-forest-400 animate-spin" /></div>
  }

  const isWeekly = selectedReport.report_type === 'weekly'
  const content = selectedReport.content
  const blocks = isWeekly
    ? weeklyBlocks(content as WeeklyContent)
    : monthlyBlocks(content as MonthlyContent)
  const summary = String(content.summary || selectedReport.summary || '').trim()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <header>
        <div className="flex items-center gap-2 text-forest-600">
          {isWeekly ? <CalendarDays className="w-5 h-5" /> : <Leaf className="w-5 h-5" />}
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Retrospectiva</p>
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-forest-900">{isWeekly ? 'Sua semana' : 'Seu mês'}</h1>
            <p className="mt-1 text-xs text-ink-soft">{reportLabel(selectedReport)}</p>
          </div>
          {latestWeekly && canShowMonthly && (
            <div className="inline-flex rounded-full bg-mint/40 p-1" aria-label="Escolher retrospectiva">
              <button type="button" onClick={() => setSelectedType('weekly')} className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedType === 'weekly' ? 'bg-forest-900 text-white' : 'text-forest-700'}`}>Semana</button>
              <button type="button" onClick={() => setSelectedType('monthly')} className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedType === 'monthly' ? 'bg-forest-900 text-white' : 'text-forest-700'}`}>Mês</button>
            </div>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-line bg-mint/30 p-5 sm:p-7">
        <span className="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center text-forest-600"><Sparkles className="w-5 h-5" /></span>
        <h2 className="font-serif text-2xl text-forest-900 mt-4">O que esta {isWeekly ? 'semana' : 'retrospectiva'} contou</h2>
        <p className="mt-2 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-forest-900">{summary || 'Seus registros formaram uma leitura do período. Veja primeiro os pontos principais e aprofunde apenas se quiser.'}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {blocks.map(block => <NarrativeCard key={block.title} block={block} />)}
      </section>

      <section className="border-t border-line pt-5">
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800 transition-colors"
        >
          Explorar detalhes <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-2 text-xs text-ink-soft max-w-2xl flex items-start gap-1.5">
          <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Gráficos, métricas, PDF, histórico e dados completos continuam disponíveis na área detalhada.
        </p>
      </section>

      <p className="text-xs text-ink-soft border-t border-line pt-4">Esta retrospectiva organiza o conteúdo já fechado do seu relatório. Ela não é diagnóstico e não transforma seus registros em metas de desempenho.</p>
    </div>
  )
}
