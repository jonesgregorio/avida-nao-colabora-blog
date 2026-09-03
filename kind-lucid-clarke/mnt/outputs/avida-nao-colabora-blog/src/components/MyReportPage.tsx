import { useEffect, useMemo, useState, type ComponentProps, type MouseEvent } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, Download, Eye, History, Leaf, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import MyReportPageContent from './MyReportPageContent'
import WeeklyReportMockup from './WeeklyReportMockup'
import { supabase } from '../lib/supabase'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import { formatPeriodShort, monthTitle } from '../lib/reportPeriods'
import type { MonthlyContent, StoredReport, WeeklyContent } from '../lib/reportGeneration'

type Props = ComponentProps<typeof MyReportPageContent>
type NarrativeType = 'weekly' | 'monthly'
type NarrativeBlock = { title: string; text: string; icon: typeof Sparkles }

const HISTORY_HEADING = 'Histórico de relatórios'
function findReportHistorySection(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const heading = Array.from(root.querySelectorAll('h2')).find(node => node.textContent?.trim() === HISTORY_HEADING)
  return (heading?.closest('section') as HTMLElement | null) ?? null
}
function reportLabel(report: StoredReport) {
  return report.report_type === 'monthly' ? monthTitle(report.period_start) : formatPeriodShort({ start: report.period_start, end: report.period_end })
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
function monthlyBlocks(content: MonthlyContent): NarrativeBlock[] {
  return [
    { title: 'O que mais pesou', text: content.predominantEmotions || content.patterns?.[0] || content.summary, icon: TrendingUp },
    { title: 'O que ajudou', text: content.improvementMoments || 'Ainda não há registros suficientes para destacar o que ajudou neste mês.', icon: Leaf },
    { title: 'O que mudou', text: content.monthlyComparison?.[0] || 'Ainda não há um mês anterior suficiente para comparar com cuidado.', icon: BarChart3 },
    { title: 'Padrão do mês', text: content.patterns?.[0] || content.summary, icon: CalendarDays },
    { title: 'Algo para observar', text: content.reflectionQuestions?.[0] || 'Que parte deste mês você gostaria de observar com mais gentileza no próximo ciclo?', icon: Eye },
  ]
}
function NarrativeCard({ block, wide = false }: { block: NarrativeBlock; wide?: boolean }) {
  const Icon = block.icon
  return <article className={`rounded-2xl border border-line bg-white p-5 shadow-sm ${wide ? 'sm:col-span-1' : ''}`}>
    <div className="flex items-start gap-3"><span className="w-9 h-9 rounded-full bg-mint/70 flex items-center justify-center text-forest-600 flex-shrink-0"><Icon className="w-4 h-4" /></span><div><h3 className="font-serif text-lg text-forest-900">{block.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-soft">{block.text}</p></div></div>
  </article>
}
const detailAreas = [
  { icon: BarChart3, label: 'Gráficos e sinais' }, { icon: Sparkles, label: 'Padrões e comparações' }, { icon: History, label: 'Histórico' }, { icon: Download, label: 'PDF e exportação' },
]

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
    if (!user || !canReadReports) { setLoadingNarrative(false); return }
    let active = true; setLoadingNarrative(true); setNarrativeFailed(false)
    supabase.from('reports').select('id,report_type,plan_required,period_start,period_end,available_at,generated_at,status,title,summary,content').eq('user_id', user.id).order('period_end', { ascending: false }).limit(16)
      .then(({ data, error }) => {
        if (!active) return
        if (error) { setNarrativeFailed(true); setReports([]) } else {
          const loaded = ((data as unknown as StoredReport[]) ?? []).filter(report => report.report_type === 'weekly' || report.report_type === 'monthly')
          setReports(loaded)
          if (!loaded.some(report => report.report_type === 'weekly') && loaded.some(report => report.report_type === 'monthly')) setSelectedType('monthly')
        }
        setLoadingNarrative(false)
      }, () => { if (!active) return; setNarrativeFailed(true); setReports([]); setLoadingNarrative(false) })
    return () => { active = false }
  }, [canReadReports, user])

  const latestWeekly = useMemo(() => reports.find(report => report.report_type === 'weekly') ?? null, [reports])
  const latestMonthly = useMemo(() => reports.find(report => report.report_type === 'monthly') ?? null, [reports])
  const selectedReport = selectedType === 'monthly' ? latestMonthly : latestWeekly
  const canShowMonthly = plan === 'plus' && !!latestMonthly
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest('button')
    if (!button || button.textContent?.trim().startsWith('Ver todos') !== true) return
    window.requestAnimationFrame(() => { const history = findReportHistorySection(event.currentTarget); if (!history) return; history.id = 'report-history'; history.style.scrollMarginTop = '6rem'; history.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
  }

  if (!canReadReports || narrativeFailed || (!loadingNarrative && !latestWeekly && !latestMonthly)) return <div onClickCapture={handleClickCapture}><MyReportPageContent {...props} /></div>

  if (showDetails) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8" onClickCapture={handleClickCapture}>
    <header className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-mint/55 via-paper-soft to-white p-5 sm:p-7 mb-6">
      <button type="button" onClick={() => setShowDetails(false)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft className="w-4 h-4" /> Voltar ao resumo</button>
      <div className="mt-5 max-w-3xl"><p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Leitura aprofundada</p><h1 className="mt-1 font-serif text-3xl md:text-4xl text-forest-900">Detalhes da sua retrospectiva</h1><p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-ink-soft">Explore os dados do período por blocos: emoções, sinais, padrões, comparações, histórico e exportação — sem quebrar a continuidade da experiência.</p></div>
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5" aria-label="O que você encontra nos detalhes">{detailAreas.map(({ icon: Icon, label }) => <div key={label} className="rounded-2xl border border-line bg-white/80 px-3 py-3 flex items-center gap-2 text-xs font-medium text-forest-800"><span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600"><Icon className="w-4 h-4" /></span>{label}</div>)}</div>
    </header>
    <section data-report-details-surface className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-sm"><MyReportPageContent {...props} onBack={() => setShowDetails(false)} /></section>
  </div>

  if (loadingNarrative || !selectedReport) return <div className="flex justify-center items-center py-24" role="status"><Loader2 className="w-6 h-6 text-forest-400 animate-spin" /></div>

  const isWeekly = selectedReport.report_type === 'weekly'
  if (isWeekly) return <WeeklyReportMockup report={selectedReport} plan={plan} onOpenArticle={props.onOpenArticle} onNavigateDiary={props.onNavigateDiary} onOpenFullReport={() => setShowDetails(true)} />

  const content = selectedReport.content
  const blocks = monthlyBlocks(content as MonthlyContent)
  const summary = String(content.summary || selectedReport.summary || '').trim()
  const periodLabel = reportLabel(selectedReport)

  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div><h1 className="font-serif text-3xl md:text-4xl text-forest-900">Relatórios</h1><p className="mt-1 text-sm text-ink-soft">Compreenda seu percurso, reconheça padrões e cuide do que importa.</p></div>
      {latestWeekly && canShowMonthly && <div className="inline-flex self-start rounded-full border border-line bg-white p-1" aria-label="Escolher retrospectiva"><button type="button" onClick={() => setSelectedType('weekly')} className={`px-4 py-2 rounded-full text-xs font-medium ${selectedType === 'weekly' ? 'bg-forest-900 text-white' : 'text-forest-700'}`}>Semana</button><button type="button" onClick={() => setSelectedType('monthly')} className={`px-4 py-2 rounded-full text-xs font-medium ${selectedType === 'monthly' ? 'bg-forest-900 text-white' : 'text-forest-700'}`}>Mês</button></div>}
    </header>

    <section className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-r from-mint/55 via-paper-soft to-white p-6 sm:p-8 shadow-sm">
      <div className="relative z-10 max-w-3xl"><p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-forest-600">Seu mês está pronto</p><h2 className="mt-2 font-serif text-2xl sm:text-3xl text-forest-900">{summary || 'Veja o que seus registros contam sobre este mês.'}</h2><p className="mt-2 text-sm text-ink-soft">{periodLabel} · retrospectiva baseada nos registros disponíveis</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-forest-900 text-white px-4 py-2 text-xs font-medium">Resumo</span></div></div>
      <div className="hidden md:block absolute right-10 top-1/2 -translate-y-1/2 opacity-70"><Leaf className="w-28 h-28 text-forest-300" strokeWidth={1} /></div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">{blocks.slice(0,3).map(block => <NarrativeCard key={block.title} block={block} />)}</section>
    <section className="grid gap-4 md:grid-cols-2">{blocks.slice(3).map(block => <NarrativeCard key={block.title} block={block} wide />)}</section>

    {plan === 'plus' && <section className="rounded-2xl border border-[#d8cbea] bg-[#f2ecf9] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-lg text-forest-900">Comentário sobre o seu relatório</h3><p className="mt-2 text-sm leading-relaxed text-forest-900">{blocks[4]?.text}</p></div><span className="rounded-full bg-coral/50 px-2.5 py-1 text-[10px] font-semibold text-[#a85e3d]">Plus</span></div></section>}

    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm"><h3 className="font-serif text-lg text-forest-900">Para continuar explorando</h3><p className="mt-1 text-sm text-ink-soft">Aprofunde apenas o que fizer sentido agora. Seu histórico continua organizado por período.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setShowDetails(true)} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 text-white px-4 py-2.5 text-sm font-medium">Explorar relatório completo <ArrowRight className="w-4 h-4" /></button><button type="button" onClick={() => setShowDetails(true)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-forest-800"><History className="w-4 h-4" /> Ver histórico de relatórios</button></div></section>
    <p className="text-xs text-ink-soft border-t border-line pt-4">Esta retrospectiva organiza o conteúdo já fechado do seu relatório. Ela não é diagnóstico e não transforma seus registros em metas de desempenho.</p>
  </div>
}
