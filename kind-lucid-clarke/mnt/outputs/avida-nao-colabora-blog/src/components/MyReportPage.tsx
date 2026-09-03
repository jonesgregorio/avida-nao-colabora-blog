import { useEffect, useMemo, useState, type ComponentProps, type MouseEvent } from 'react'
import {
  ArrowLeft, BarChart3, CalendarCheck2, CalendarDays, ChevronRight, Clock3,
  Download, Eye, FileText, History, Leaf, Loader2, LockKeyhole, ShieldCheck, Sparkles, TrendingUp,
} from 'lucide-react'
import MyReportPageContent from './MyReportPageContent'
import WeeklyReportMockup from './WeeklyReportMockup'
import MonthlyDeepReportMockup from './MonthlyDeepReportMockup'
import { supabase } from '../lib/supabase'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import { formatPeriodShort, monthTitle } from '../lib/reportPeriods'
import type { StoredReport, WeeklyContent } from '../lib/reportGeneration'

type Props = ComponentProps<typeof MyReportPageContent>
type NarrativeType = 'weekly' | 'monthly'
type NarrativeBlock = { title: string; text: string; icon: typeof Sparkles }
type ReportView = 'home' | 'report'

const HISTORY_HEADING = 'Histórico de relatórios'
function findReportHistorySection(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const heading = Array.from(root.querySelectorAll('h2')).find(node => node.textContent?.trim() === HISTORY_HEADING)
  return (heading?.closest('section') as HTMLElement | null) ?? null
}
function reportLabel(report: StoredReport) {
  return report.report_type === 'monthly' ? monthTitle(report.period_start) : formatPeriodShort({ start: report.period_start, end: report.period_end })
}
function generatedLabel(report: StoredReport) {
  if (!report.generated_at) return 'Relatório disponível'
  const date = new Date(report.generated_at)
  if (Number.isNaN(date.getTime())) return 'Relatório disponível'
  return `Gerado em ${date.toLocaleDateString('pt-BR')}`
}
function weeklyBlocks(content: WeeklyContent): NarrativeBlock[] {
  return [
    { title: 'O que mais pesou', text: content.interpretation || content.patterns?.[0] || content.summary, icon: TrendingUp },
    { title: 'O que ajudou', text: content.improvementMoments || 'Ainda não há registros suficientes para destacar o que ajudou nesta semana.', icon: Leaf },
    { title: 'O que mudou', text: content.comparison?.[0] || 'Ainda não há uma semana anterior suficiente para comparar com cuidado.', icon: BarChart3 },
    { title: 'Padrão da semana', text: content.patterns?.[0] || content.interpretation || 'Continue registrando para que relações entre seus dias apareçam com mais clareza.', icon: CalendarDays },
    { title: 'Algo para observar', text: content.nextSteps?.[0] || 'Continue observando o que faz sentido para você, sem transformar o registro em obrigação.', icon: Eye },
  ]
}
const detailAreas = [
  { icon: BarChart3, label: 'Gráficos e sinais' }, { icon: Sparkles, label: 'Padrões e comparações' }, { icon: History, label: 'Histórico' }, { icon: Download, label: 'PDF e exportação' },
]

export default function MyReportPage(props: Props) {
  const { user, profile } = props
  const plan = normalizePlan(profile?.plan ?? 'free')
  const canReadReports = hasPlanAccess(plan, 'essential')
  const canReadMonthly = hasPlanAccess(plan, 'plus')
  const [reports, setReports] = useState<StoredReport[]>([])
  const [loadingNarrative, setLoadingNarrative] = useState(canReadReports)
  const [narrativeFailed, setNarrativeFailed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedType, setSelectedType] = useState<NarrativeType>('weekly')
  const [historyType, setHistoryType] = useState<NarrativeType>('weekly')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [view, setView] = useState<ReportView>('home')

  useEffect(() => {
    if (!user || !canReadReports) { setLoadingNarrative(false); return }
    let active = true; setLoadingNarrative(true); setNarrativeFailed(false)
    supabase.from('reports').select('id,report_type,plan_required,period_start,period_end,available_at,generated_at,status,title,summary,content').eq('user_id', user.id).order('period_end', { ascending: false }).limit(24)
      .then(({ data, error }) => {
        if (!active) return
        if (error) { setNarrativeFailed(true); setReports([]) } else {
          const loaded = ((data as unknown as StoredReport[]) ?? []).filter(report => report.report_type === 'weekly' || report.report_type === 'monthly')
          setReports(loaded)
        }
        setLoadingNarrative(false)
      }, () => { if (!active) return; setNarrativeFailed(true); setReports([]); setLoadingNarrative(false) })
    return () => { active = false }
  }, [canReadReports, user])

  const latestWeekly = useMemo(() => reports.find(report => report.report_type === 'weekly') ?? null, [reports])
  const latestMonthly = useMemo(() => reports.find(report => report.report_type === 'monthly') ?? null, [reports])
  const selectedReport = useMemo(() => {
    if (selectedReportId) return reports.find(report => report.id === selectedReportId) ?? null
    return selectedType === 'monthly' ? latestMonthly : latestWeekly
  }, [latestMonthly, latestWeekly, reports, selectedReportId, selectedType])
  const historyReports = useMemo(() => reports.filter(report => report.report_type === historyType), [historyType, reports])
  const monthlyHistory = useMemo(() => reports.filter(report => report.report_type === 'monthly'), [reports])
  const previousMonthly = useMemo(() => {
    if (!selectedReport || selectedReport.report_type !== 'monthly') return null
    return monthlyHistory.find(report => report.period_end < selectedReport.period_start) ?? null
  }, [monthlyHistory, selectedReport])

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button')
    if (!button || button.textContent?.trim().startsWith('Ver todos') !== true) return
    window.requestAnimationFrame(() => { const history = findReportHistorySection(event.currentTarget); if (!history) return; history.id = 'report-history'; history.style.scrollMarginTop = '6rem'; history.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
  }
  const openReport = (type: NarrativeType, report?: StoredReport | null) => {
    if (type === 'monthly' && !canReadMonthly) { props.onNavigatePricing(); return }
    const target = report ?? (type === 'monthly' ? latestMonthly : latestWeekly)
    if (!target) return
    setSelectedType(type); setSelectedReportId(target.id ?? null); setShowDetails(false); setView('report')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goHome = () => {
    setShowDetails(false); setSelectedReportId(null); setView('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!canReadReports || narrativeFailed) return <div onClickCapture={handleClickCapture}><MyReportPageContent {...props} /></div>
  if (loadingNarrative) return <div className="flex justify-center items-center py-24" role="status"><Loader2 className="w-6 h-6 text-forest-400 animate-spin" /></div>

  if (view === 'home') return <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
    <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-7">
      <div><h1 className="font-serif text-4xl md:text-5xl text-forest-900">Relatórios</h1><p className="mt-2 text-sm sm:text-[15px] text-ink-soft">Escolha o tipo de relatório que deseja visualizar e acesse seus relatórios anteriores.</p></div>
      <div className="lg:w-[280px] rounded-2xl border border-line bg-white px-4 py-3.5 flex items-start gap-3"><span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-700 flex-shrink-0"><LockKeyhole className="w-4 h-4" /></span><p className="text-xs leading-5 text-ink-soft">Seus relatórios são gerados com base nos seus registros e ficam disponíveis apenas na sua conta.</p></div>
    </header>
    <section className="rounded-[24px] border border-line bg-white p-4 sm:p-6 mb-5">
      <h2 className="text-lg font-semibold text-forest-900">1. Escolha o relatório que deseja ver</h2>
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <article className="rounded-[22px] border border-line bg-paper-soft/30 p-5 sm:p-6 text-center min-h-[370px] flex flex-col items-center">
          <span className="w-24 h-24 rounded-full bg-[#e6eee2] text-forest-800 flex items-center justify-center"><CalendarDays className="w-10 h-10" strokeWidth={1.7} /></span><h3 className="mt-5 font-serif text-2xl text-forest-900">Relatório Semanal</h3><p className="mt-3 max-w-sm text-sm leading-6 text-ink-soft">Uma leitura organizada de como apareceram seus últimos dias.</p><div className="mt-5 w-full rounded-xl bg-[#f1f5ed] px-4 py-3 text-xs text-forest-800 flex items-center justify-center gap-2"><Clock3 className="w-4 h-4" /> Disponível após o fechamento da semana</div><button type="button" disabled={!latestWeekly} onClick={() => openReport('weekly')} className="mt-3 w-full rounded-xl bg-forest-900 px-4 py-3 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-45 disabled:cursor-not-allowed">{latestWeekly ? 'Ver relatório semanal' : 'Sem relatório semanal disponível'}</button><p className="mt-auto pt-5 text-xs text-ink-soft">Ideal para acompanhar o que apareceu na sua semana.</p>
        </article>
        <article className="rounded-[22px] border border-line bg-paper-soft/30 p-5 sm:p-6 text-center min-h-[370px] flex flex-col items-center">
          <span className="w-24 h-24 rounded-full bg-[#fff0e3] text-[#d56d2b] flex items-center justify-center"><CalendarCheck2 className="w-10 h-10" strokeWidth={1.7} /></span><h3 className="mt-5 font-serif text-2xl text-forest-900">Relatório Mensal</h3><p className="mt-3 max-w-sm text-sm leading-6 text-ink-soft">Uma análise aprofundada do mês, com padrões, comparações, conexões e trajetória.</p><div className="mt-5 w-full rounded-xl bg-[#fff4ea] px-4 py-3 text-xs text-[#9d5c2e] flex items-center justify-center gap-2"><Clock3 className="w-4 h-4" /> {canReadMonthly ? 'Disponível após o fechamento do mês' : 'Disponível no plano Plus'}</div><button type="button" onClick={() => openReport('monthly')} disabled={canReadMonthly && !latestMonthly} className="mt-3 w-full rounded-xl bg-forest-900 px-4 py-3 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-45 disabled:cursor-not-allowed">{!canReadMonthly ? 'Conhecer o Plus' : latestMonthly ? 'Ver relatório mensal aprofundado' : 'Sem relatório mensal disponível'}</button><p className="mt-auto pt-5 text-xs text-ink-soft">Ideal para entender o mês e conectá-lo aos ciclos anteriores.</p>
        </article>
      </div>
    </section>
    <section className="rounded-[24px] border border-line bg-white p-4 sm:p-6">
      <div><h2 className="text-lg font-semibold text-forest-900">2. Histórico de relatórios</h2><p className="mt-1 text-sm text-ink-soft">Acesse suas leituras anteriores organizadas por período.</p></div>
      <div className="mt-5 flex border-b border-line" role="tablist" aria-label="Tipos de relatório no histórico">
        <button type="button" role="tab" aria-selected={historyType === 'weekly'} onClick={() => setHistoryType('weekly')} className={`flex-1 min-w-0 sm:flex-none sm:min-w-[190px] inline-flex items-center justify-center gap-2 px-2 sm:px-4 py-3 text-xs sm:text-sm border-b-2 -mb-px ${historyType === 'weekly' ? 'border-forest-700 text-forest-900 font-medium' : 'border-transparent text-ink-soft'}`}><CalendarDays className="w-4 h-4 flex-shrink-0" /><span className="truncate">Relatórios semanais</span></button>
        <button type="button" role="tab" aria-selected={historyType === 'monthly'} onClick={() => setHistoryType('monthly')} className={`flex-1 min-w-0 sm:flex-none sm:min-w-[190px] inline-flex items-center justify-center gap-2 px-2 sm:px-4 py-3 text-xs sm:text-sm border-b-2 -mb-px ${historyType === 'monthly' ? 'border-forest-700 text-forest-900 font-medium' : 'border-transparent text-ink-soft'}`}><CalendarCheck2 className="w-4 h-4 flex-shrink-0" /><span className="truncate">Relatórios mensais</span></button>
      </div>
      <div className="mt-4 space-y-3">
        {historyType === 'monthly' && !canReadMonthly ? <div className="rounded-2xl border border-line bg-paper-soft/50 p-6 text-center"><LockKeyhole className="w-6 h-6 text-forest-500 mx-auto" /><p className="mt-2 text-sm font-medium text-forest-900">O histórico mensal faz parte do plano Plus.</p><button type="button" onClick={props.onNavigatePricing} className="mt-3 text-sm font-medium text-forest-800 underline underline-offset-4">Ver plano Plus</button></div> : historyReports.length ? historyReports.map(report => <article key={report.id} className="rounded-2xl border border-line bg-white px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"><span className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${report.report_type === 'weekly' ? 'bg-[#e6eee2] text-forest-800' : 'bg-[#fff0e3] text-[#d56d2b]'}`}>{report.report_type === 'weekly' ? <CalendarDays className="w-5 h-5" /> : <CalendarCheck2 className="w-5 h-5" />}</span><div className="min-w-0 flex-1"><p className="font-medium text-forest-900">{report.report_type === 'weekly' ? 'Relatório Semanal' : 'Relatório Mensal Aprofundado'} — {reportLabel(report)}</p><p className="mt-1 text-xs text-ink-soft">{report.period_start} a {report.period_end}</p></div><div className="flex items-center gap-2 sm:gap-4 sm:ml-auto"><span className="hidden md:inline-flex items-center gap-1.5 text-xs text-ink-soft"><FileText className="w-3.5 h-3.5" /> {generatedLabel(report)}</span><button type="button" onClick={() => openReport(report.report_type as NarrativeType, report)} className="rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-medium text-forest-900 hover:bg-paper-soft">Ver relatório</button><ChevronRight className="w-4 h-4 text-ink-soft" /></div></article>) : <div className="rounded-2xl border border-dashed border-line bg-paper-soft/35 p-7 text-center"><History className="w-7 h-7 text-forest-400 mx-auto" /><p className="mt-3 text-sm font-medium text-forest-900">Ainda não há relatórios anteriores nesta categoria.</p><p className="mt-1 text-xs text-ink-soft">Eles aparecerão aqui automaticamente quando forem gerados.</p></div>}
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-paper-soft/60 px-4 py-4 flex items-start gap-3"><span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-700 flex-shrink-0"><ShieldCheck className="w-4 h-4" /></span><p className="text-xs sm:text-sm leading-6 text-ink-soft">Continue registrando no Diário quando fizer sentido. Os relatórios usam os dados disponíveis para construir leituras cada vez mais contextualizadas, sem transformar frequência em meta.</p></div>
    </section>
  </div>

  if (showDetails) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8" onClickCapture={handleClickCapture}>
    <header className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-mint/55 via-paper-soft to-white p-5 sm:p-7 mb-6"><button type="button" onClick={() => setShowDetails(false)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft className="w-4 h-4" /> Voltar ao resumo</button><div className="mt-5 max-w-3xl"><p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Leitura aprofundada</p><h1 className="mt-1 font-serif text-3xl md:text-4xl text-forest-900">Detalhes da sua retrospectiva</h1><p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-ink-soft">Explore os dados do período por blocos: emoções, sinais, padrões, comparações, histórico e exportação.</p></div><div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5" aria-label="O que você encontra nos detalhes">{detailAreas.map(({ icon: Icon, label }) => <div key={label} className="rounded-2xl border border-line bg-white/80 px-3 py-3 flex items-center gap-2 text-xs font-medium text-forest-800"><span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600"><Icon className="w-4 h-4" /></span>{label}</div>)}</div></header>
    <section data-report-details-surface className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-sm"><MyReportPageContent {...props} onBack={() => setShowDetails(false)} /></section>
  </div>

  if (!selectedReport) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center"><p className="text-sm text-ink-soft">Este relatório ainda não está disponível.</p><button type="button" onClick={goHome} className="mt-4 text-sm font-medium text-forest-800 underline underline-offset-4">Voltar aos relatórios</button></div>

  if (selectedReport.report_type === 'weekly') {
    weeklyBlocks(selectedReport.content as WeeklyContent)
    return <div><div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-5"><button type="button" onClick={goHome} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft className="w-4 h-4" /> Voltar aos relatórios</button></div><WeeklyReportMockup report={selectedReport} plan={plan} onOpenArticle={props.onOpenArticle} onNavigateDiary={props.onNavigateDiary} onOpenFullReport={() => setShowDetails(true)} /></div>
  }

  return <div><div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-5"><button type="button" onClick={goHome} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft className="w-4 h-4" /> Voltar aos relatórios</button></div><MonthlyDeepReportMockup report={selectedReport} previousReport={previousMonthly} history={monthlyHistory} plan={plan} onOpenArticle={props.onOpenArticle} onOpenFullReport={() => setShowDetails(true)} onOpenReport={report => openReport('monthly', report)} /></div>
}
