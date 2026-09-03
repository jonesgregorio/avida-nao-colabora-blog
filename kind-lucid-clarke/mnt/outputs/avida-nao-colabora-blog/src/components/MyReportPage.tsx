import { useEffect, useMemo, useState, type ComponentProps, type MouseEvent } from 'react'
import { ArrowLeft, BarChart3, CalendarCheck2, CalendarDays, ChevronRight, Download, Eye, FileText, History, Leaf, Loader2, LockKeyhole, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import MyReportPageContent from './MyReportPageContent'
import WeeklyReportMockup from './WeeklyReportMockup'
import MonthlyDeepReportMockup from './MonthlyDeepReportMockup'
import { supabase } from '../lib/supabase'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import { formatPeriodShort, monthTitle } from '../lib/reportPeriods'
import type { StoredReport, WeeklyContent } from '../lib/reportGeneration'

type Props = ComponentProps<typeof MyReportPageContent>
type NarrativeType = 'weekly' | 'monthly'
type ReportView = 'home' | 'report'
type NarrativeBlock = { title: string; text: string; icon: typeof Sparkles }

// Contrato histórico da retrospectiva semanal: Sua semana permanece narrativa antes dos detalhes.
// A leitura é observacional, não é diagnóstico e não transforma frequência em desempenho.
const HISTORY_HEADING = 'Histórico de relatórios'
function findReportHistorySection(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const heading = Array.from(root.querySelectorAll('h2')).find(node => node.textContent?.trim() === HISTORY_HEADING)
  return (heading?.closest('section') as HTMLElement | null) ?? null
}
function reportLabel(report: StoredReport) { return report.report_type === 'monthly' ? monthTitle(report.period_start) : formatPeriodShort({ start: report.period_start, end: report.period_end }) }
function generatedLabel(report: StoredReport) {
  if (!report.generated_at) return 'Relatório disponível'
  const date = new Date(report.generated_at)
  return Number.isNaN(date.getTime()) ? 'Relatório disponível' : `Gerado em ${date.toLocaleDateString('pt-BR')}`
}
function weeklyBlocks(content: WeeklyContent): NarrativeBlock[] {
  return [
    { title: 'O que mais pesou', text: content.interpretation || content.patterns?.[0] || content.summary, icon: TrendingUp },
    { title: 'O que ajudou', text: content.improvementMoments || 'Ainda não há registros suficientes para destacar o que ajudou nesta semana.', icon: Leaf },
    { title: 'O que mudou', text: content.comparison?.[0] || 'Ainda não há uma semana anterior suficiente para comparar com cuidado.', icon: BarChart3 },
    { title: 'Padrão da semana', text: content.patterns?.[0] || content.interpretation, icon: CalendarDays },
    { title: 'Algo para observar', text: content.nextSteps?.[0] || 'Continue observando o que fizer sentido.', icon: Eye },
  ]
}
const detailAreas = [{ icon: BarChart3, label: 'Gráficos e sinais' }, { icon: Sparkles, label: 'Padrões e comparações' }, { icon: History, label: 'Histórico' }, { icon: Download, label: 'PDF e exportação' }]

export default function MyReportPage(props: Props) {
  const { user, profile } = props
  const plan = normalizePlan(profile?.plan ?? 'free')
  const canReadReports = hasPlanAccess(plan, 'essential')
  const canReadMonthly = hasPlanAccess(plan, 'plus')
  const [reports, setReports] = useState<StoredReport[]>([])
  const [loading, setLoading] = useState(canReadReports)
  const [failed, setFailed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedType, setSelectedType] = useState<NarrativeType>('weekly')
  const [historyType, setHistoryType] = useState<NarrativeType>('weekly')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [view, setView] = useState<ReportView>('home')

  useEffect(() => {
    if (!user || !canReadReports) { setLoading(false); return }
    let active = true
    supabase.from('reports').select('id,report_type,plan_required,period_start,period_end,available_at,generated_at,status,title,summary,content').eq('user_id', user.id).order('period_end', { ascending: false }).limit(24)
      .then(({ data, error }) => {
        if (!active) return
        if (error) { setFailed(true); setReports([]) } else setReports(((data as unknown as StoredReport[]) ?? []).filter(r => r.report_type === 'weekly' || r.report_type === 'monthly'))
        setLoading(false)
      }, () => { if (active) { setFailed(true); setLoading(false) } })
    return () => { active = false }
  }, [canReadReports, user])

  const latestWeekly = useMemo(() => reports.find(r => r.report_type === 'weekly') ?? null, [reports])
  const latestMonthly = useMemo(() => reports.find(r => r.report_type === 'monthly') ?? null, [reports])
  const selectedReport = useMemo(() => selectedReportId ? reports.find(r => r.id === selectedReportId) ?? null : selectedType === 'monthly' ? latestMonthly : latestWeekly, [latestMonthly, latestWeekly, reports, selectedReportId, selectedType])
  const historyReports = useMemo(() => reports.filter(r => r.report_type === historyType), [historyType, reports])
  const monthlyHistory = useMemo(() => reports.filter(r => r.report_type === 'monthly'), [reports])
  const previousMonthly = useMemo(() => selectedReport?.report_type === 'monthly' ? monthlyHistory.find(r => r.period_end < selectedReport.period_start) ?? null : null, [monthlyHistory, selectedReport])

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button')
    if (!button || !button.textContent?.trim().startsWith('Ver todos')) return
    window.requestAnimationFrame(() => { const section = findReportHistorySection(event.currentTarget); if (section) { section.id = 'report-history'; section.scrollIntoView({ behavior: 'smooth' }) } })
  }
  const openReport = (type: NarrativeType, report?: StoredReport | null) => {
    if (type === 'monthly' && !canReadMonthly) { props.onNavigatePricing(); return }
    const target = report ?? (type === 'monthly' ? latestMonthly : latestWeekly)
    if (!target) return
    setSelectedType(type); setSelectedReportId(target.id ?? null); setShowDetails(false); setView('report'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goHome = () => { setShowDetails(false); setSelectedReportId(null); setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (!canReadReports || failed) return <div onClickCapture={handleClickCapture}><MyReportPageContent {...props} /></div>
  if (loading) return <div className="flex items-center justify-center py-24" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-400" /></div>

  if (view === 'home') return <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
    <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="font-serif text-4xl md:text-5xl text-forest-900">Relatórios</h1><p className="mt-2 text-sm text-ink-soft">Escolha o tipo de relatório que deseja visualizar e acesse seus relatórios anteriores.</p></div><div className="rounded-2xl border border-line bg-white px-4 py-3.5 lg:w-[280px] flex gap-3"><LockKeyhole className="mt-1 w-4 h-4 flex-shrink-0 text-forest-700" /><p className="text-xs leading-5 text-ink-soft">Seus relatórios ficam disponíveis apenas na sua conta.</p></div></header>
    <section className="mb-5 rounded-[24px] border border-line bg-white p-4 sm:p-6"><h2 className="text-lg font-semibold text-forest-900">1. Escolha o relatório que deseja ver</h2><div className="mt-5 grid gap-4 md:grid-cols-2">
      <article className="flex min-h-[350px] flex-col items-center rounded-[22px] border border-line bg-paper-soft/30 p-6 text-center"><span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#e6eee2] text-forest-800"><CalendarDays className="w-10 h-10" /></span><h3 className="mt-5 font-serif text-2xl text-forest-900">Relatório Semanal</h3><p className="mt-3 text-sm leading-6 text-ink-soft">Uma leitura organizada de como apareceram seus últimos dias.</p><button type="button" disabled={!latestWeekly} onClick={() => openReport('weekly')} className="mt-6 w-full rounded-xl bg-forest-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-45">{latestWeekly ? 'Ver relatório semanal' : 'Sem relatório semanal disponível'}</button><p className="mt-auto pt-5 text-xs text-ink-soft">Ideal para acompanhar o que apareceu na sua semana.</p></article>
      <article className="flex min-h-[350px] flex-col items-center rounded-[22px] border border-line bg-paper-soft/30 p-6 text-center"><span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#fff0e3] text-[#d56d2b]"><CalendarCheck2 className="w-10 h-10" /></span><h3 className="mt-5 font-serif text-2xl text-forest-900">Relatório Mensal Aprofundado</h3><p className="mt-3 text-sm leading-6 text-ink-soft">Padrões, comparações, conexões e trajetória do mês em uma leitura mais completa.</p><button type="button" disabled={canReadMonthly && !latestMonthly} onClick={() => openReport('monthly')} className="mt-6 w-full rounded-xl bg-forest-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-45">{!canReadMonthly ? 'Conhecer o Plus' : latestMonthly ? 'Ver relatório mensal aprofundado' : 'Sem relatório mensal disponível'}</button><p className="mt-auto pt-5 text-xs text-ink-soft">Disponível no Plus após o fechamento do mês.</p></article>
    </div></section>
    <section className="rounded-[24px] border border-line bg-white p-4 sm:p-6"><h2 className="text-lg font-semibold text-forest-900">2. Histórico de relatórios</h2><p className="mt-1 text-sm text-ink-soft">Acesse suas leituras anteriores organizadas por período.</p><div className="mt-5 flex border-b border-line" role="tablist"><button type="button" onClick={() => setHistoryType('weekly')} className={`flex-1 px-3 py-3 text-sm ${historyType === 'weekly' ? 'border-b-2 border-forest-700 font-medium text-forest-900' : 'text-ink-soft'}`}>Relatórios semanais</button><button type="button" onClick={() => setHistoryType('monthly')} className={`flex-1 px-3 py-3 text-sm ${historyType === 'monthly' ? 'border-b-2 border-forest-700 font-medium text-forest-900' : 'text-ink-soft'}`}>Relatórios mensais</button></div><div className="mt-4 space-y-3">{historyType === 'monthly' && !canReadMonthly ? <div className="rounded-2xl bg-paper-soft/50 p-6 text-center"><p className="text-sm text-forest-900">O histórico mensal faz parte do plano Plus.</p></div> : historyReports.length ? historyReports.map(report => <article key={report.id} className="flex flex-col gap-4 rounded-2xl border border-line p-4 sm:flex-row sm:items-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-mint"><FileText className="w-4 h-4 text-forest-700" /></span><div className="min-w-0 flex-1"><p className="font-medium text-forest-900">{report.report_type === 'weekly' ? 'Relatório Semanal' : 'Relatório Mensal Aprofundado'} — {reportLabel(report)}</p><p className="mt-1 text-xs text-ink-soft">{generatedLabel(report)}</p></div><button type="button" onClick={() => openReport(report.report_type as NarrativeType, report)} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-xs font-medium text-forest-900">Ver relatório <ChevronRight className="w-4 h-4" /></button></article>) : <div className="rounded-2xl border border-dashed border-line p-7 text-center text-sm text-ink-soft">Ainda não há relatórios anteriores nesta categoria.</div>}</div><div className="mt-6 flex gap-3 rounded-2xl bg-paper-soft/60 p-4"><ShieldCheck className="w-5 h-5 flex-shrink-0 text-forest-700" /><p className="text-xs leading-5 text-ink-soft">Os relatórios organizam os dados disponíveis sem transformar frequência em meta.</p></div></section>
  </div>

  if (showDetails) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6" onClickCapture={handleClickCapture}><header className="mb-6 rounded-[2rem] border border-line bg-paper-soft p-6"><button type="button" onClick={() => setShowDetails(false)} className="inline-flex items-center gap-2 text-sm text-forest-700"><ArrowLeft className="w-4 h-4" />Voltar ao resumo</button><h1 className="mt-5 font-serif text-3xl text-forest-900">Detalhes da sua retrospectiva</h1><div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">{detailAreas.map(({icon:Icon,label}) => <div key={label} className="flex items-center gap-2 rounded-2xl border border-line bg-white p-3 text-xs text-forest-800"><Icon className="w-4 h-4" />{label}</div>)}</div></header><section data-report-details-surface className="overflow-hidden rounded-[2rem] border border-line bg-white"><MyReportPageContent {...props} onBack={() => setShowDetails(false)} /></section></div>
  if (!selectedReport) return <div className="p-14 text-center text-sm text-ink-soft">Este relatório ainda não está disponível.</div>
  if (selectedReport.report_type === 'weekly') {
    weeklyBlocks(selectedReport.content as WeeklyContent)
    return <div><div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-5"><button type="button" onClick={goHome} className="inline-flex items-center gap-2 text-sm text-forest-700"><ArrowLeft className="w-4 h-4" />Voltar aos relatórios</button></div><WeeklyReportMockup report={selectedReport} plan={plan} onOpenArticle={props.onOpenArticle} onNavigateDiary={props.onNavigateDiary} onOpenFullReport={() => setShowDetails(true)} /></div>
  }
  return <div><div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-5"><button type="button" onClick={goHome} className="inline-flex items-center gap-2 text-sm text-forest-700"><ArrowLeft className="w-4 h-4" />Voltar aos relatórios</button></div><MonthlyDeepReportMockup report={selectedReport} previousReport={previousMonthly} history={monthlyHistory} plan={plan} onOpenArticle={props.onOpenArticle} onOpenFullReport={() => setShowDetails(true)} onOpenReport={report => openReport('monthly', report)} /></div>
}
