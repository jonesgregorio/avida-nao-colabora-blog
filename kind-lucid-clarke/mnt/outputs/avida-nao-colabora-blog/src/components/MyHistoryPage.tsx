import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import {
  ArrowRight, BookMarked, BriefcaseBusiness, CalendarDays, ChevronDown, Clock3, Heart,
  Leaf, Loader2, NotebookPen, Settings2, Sparkles, Sprout, Tags, TrendingUp, UserRoundPlus,
} from 'lucide-react'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import { supabase } from '../lib/supabase'
import { loadReportHistory } from '../lib/reportGeneration'
import { buildJourneyChapter } from '../lib/journeyChapter'
import { buildMyHistory, type HistoryMonth, type MyHistoryEntry, type MyHistoryReport } from '../lib/myHistory'
import MyHistoryPageLegacy from './MyHistoryPageLegacy'

type Props = ComponentProps<typeof MyHistoryPageLegacy>
type FilterKey = 'timeline' | 'emotions' | 'contexts' | 'needs' | 'care' | 'milestones' | 'important'
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
      .eq('user_id', userId).order('created_at', { ascending: false }).range(from, to)
    if (error) throw error
    const batch = (data ?? []) as MyHistoryEntry[]
    entries.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return entries
}

function fullDate(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day, 12))
}
function monthCount(first: string | null) {
  if (!first) return 0
  const start = new Date(`${first}T12:00:00`); const now = new Date()
  return Math.max(1, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() + 1)
}
function tagList(month: HistoryMonth, filter: FilterKey) {
  if (filter === 'emotions') return month.topEmotion ? [month.topEmotion.label] : []
  if (filter === 'contexts') return month.topContext ? [month.topContext.label] : []
  if (filter === 'needs') return month.topNeed ? [month.topNeed.label] : []
  return [month.topEmotion?.label, month.topContext?.label, month.topNeed?.label].filter(Boolean) as string[]
}
function moodTone(month: HistoryMonth) {
  const text = `${month.topEmotion?.label ?? ''} ${month.summary}`.toLowerCase()
  if (/leve|calm|feliz|bem|alegr|tranquil/.test(text)) return 'bg-[#dcefdc] text-[#35724e]'
  if (/ans|difíc|trist|sobrec|raiva|medo/.test(text)) return 'bg-[#ffe1d2] text-[#c56548]'
  return 'bg-[#fff0c9] text-[#a56f22]'
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-line bg-white ${className}`}>{children}</section>
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
  const [filter, setFilter] = useState<FilterKey>('timeline')
  const [visibleMonths, setVisibleMonths] = useState(6)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !hasHistory || showDetails) { setLoading(false); return }
    let active = true; setLoading(true); setFailed(false)
    ;(async () => {
      try {
        const [structuredEntries, storedReports] = await Promise.all([loadStructuredJourney(user.id), loadReportHistory(user.id)])
        if (!active) return
        setEntries(structuredEntries); setReports(storedReports as unknown as MyHistoryReport[])
      } catch { if (active) setFailed(true) } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [hasHistory, showDetails, user])

  const history = useMemo(() => {
    const visibleReports = isPlus ? reports : reports.filter(report => report.report_type === 'weekly')
    return buildMyHistory(entries, visibleReports, { includeTriggers: isPlus, memoryLimit: 4 })
  }, [entries, isPlus, reports])
  const chapter = useMemo(() => buildJourneyChapter({ activeDays: history.totals.activeDays, reports: history.totals.reports, months: history.months.length, milestones: history.milestones.length, hasSteadyMonth: history.milestones.some(m => m.kind === 'first_steady_month') }), [history])
  const months = history.months.slice(0, visibleMonths)
  const monthsSinceStart = monthCount(history.totals.firstDate)
  const weeklyAverage = monthsSinceStart ? history.totals.entries / Math.max(1, monthsSinceStart * 4.345) : 0
  const topThemes = useMemo(() => {
    const counts = new Map<string, number>()
    history.months.forEach(month => [month.topEmotion?.label, month.topContext?.label, month.topNeed?.label].filter(Boolean).forEach(tag => counts.set(tag!, (counts.get(tag!) ?? 0) + 1)))
    return [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,5).map(([label]) => label)
  }, [history.months])

  if (!hasHistory || failed) return <MyHistoryPageLegacy {...props} />
  if (showDetails) return <MyHistoryPageLegacy {...props} />
  if (loading) return <div className="flex items-center justify-center py-24" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-500" /><span className="ml-3 text-sm text-ink-soft">Organizando sua jornada…</span></div>

  const filters: Array<[FilterKey,string]> = [['timeline','Linha do tempo'],['emotions','Emoções'],['contexts','Contextos'],['needs','Necessidades'],['care','Ações de cuidado'],['milestones','Marcos pessoais'],['important','Registros importantes']]

  return <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="font-serif text-4xl text-forest-900">Minha História</h1><p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft">Um olhar sobre sua trajetória, momentos importantes, mudanças e temas que fizeram parte do seu caminho.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => props.onNavigateDiary()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900"><UserRoundPlus className="w-4 h-4" />Adicionar marco pessoal</button><button type="button" onClick={() => setShowDetails(true)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900"><Settings2 className="w-4 h-4" />Gerenciar história</button></div>
    </header>

    <Card className="mt-6 p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
      [<CalendarDays className="w-5 h-5" />, 'Sua história começou em', fullDate(history.totals.firstDate), 'bg-[#e8f2e6] text-forest-700'],
      [<BookMarked className="w-5 h-5" />, 'Você tem registros há', `${monthsSinceStart} ${monthsSinceStart === 1 ? 'mês' : 'meses'}`, 'bg-[#fff0dc] text-[#a7632c]'],
      [<NotebookPen className="w-5 h-5" />, 'Total de registros', String(history.totals.entries), 'bg-[#eee7f5] text-[#765a9a]'],
      [<Clock3 className="w-5 h-5" />, 'Média de registros', `${weeklyAverage.toFixed(1).replace('.', ',')} por semana`, 'bg-[#e8f2e6] text-forest-700'],
    ].map(([icon,label,value,tone]) => <div key={String(label)} className="flex items-center gap-3 lg:border-r lg:border-line lg:last:border-0"><span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span><div><p className="text-[11px] text-ink-soft">{label}</p><p className="mt-1 text-sm font-semibold text-forest-900">{value}</p></div></div>)}</div></Card>

    <div className="mt-4 overflow-x-auto rounded-t-[22px] border border-line bg-white"><div className="flex min-w-max">{filters.map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`px-4 py-3 text-xs border-b-2 transition-colors ${filter === key ? 'border-forest-700 text-forest-900 font-medium bg-mint/20' : 'border-transparent text-ink-soft'}`}>{label}</button>)}</div></div>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="rounded-t-none p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-forest-900">Sua trajetória em ordem cronológica</h2><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs">Ordenar: Mais recente <ChevronDown className="w-3.5 h-3.5" /></button></div>
        {(filter === 'milestones' ? [] : months).map((month,index) => <article key={month.key} className="relative ml-4 border-l border-line pb-3 pl-8 last:pb-0"><span className={`absolute -left-5 top-3 flex h-10 w-10 items-center justify-center rounded-full ${moodTone(month)}`}><Heart className="w-4 h-4" /></span><button type="button" onClick={() => setExpandedMonth(expandedMonth === month.key ? null : month.key)} className="w-full rounded-2xl border border-line bg-white p-4 text-left hover:bg-paper-soft/30"><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-lg text-forest-900 capitalize">{month.label}</h3>{index === 0 && <span className="rounded-full bg-mint px-2 py-1 text-[10px] text-forest-700">Mais recente</span>}</div><p className="mt-1 text-xs leading-5 text-ink-soft">{month.summary}</p><div className="mt-2 flex flex-wrap gap-2">{tagList(month, filter).slice(0,3).map((tag,i) => <span key={tag} className={`rounded-full px-2.5 py-1 text-[10px] ${i===0?'bg-[#e8f2e6] text-forest-700':i===1?'bg-[#e8eef6] text-[#4d789e]':'bg-[#fff0dc] text-[#a7632c]'}`}>{tag}</span>)}</div></div><div className="flex items-center gap-3 text-right"><div><p className="text-xs font-medium">{month.entryCount} registros</p><p className="mt-1 text-[10px] text-ink-soft">{month.activeDays} dias ativos</p></div><ChevronDown className={`w-4 h-4 text-ink-soft transition-transform ${expandedMonth===month.key?'rotate-180':''}`} /></div></div>{expandedMonth === month.key && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-4">{[['Check-ins',month.checkinCount],['Diário',month.diaryCount],['Relatórios',month.reports.length],['Dias ativos',month.activeDays]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-paper-soft/50 p-2.5 text-center"><p className="text-base font-semibold text-forest-900">{value}</p><p className="text-[10px] text-ink-soft">{label}</p></div>)}</div>}</button></article>)}
        {filter === 'milestones' && <div className="space-y-3">{history.milestones.map(m => <div key={m.id} className="rounded-2xl border border-line p-4"><p className="text-xs font-semibold text-forest-900">{m.title}</p><p className="mt-1 text-[11px] text-ink-soft">{m.dateLabel}</p><p className="mt-2 text-xs leading-5">{m.description}</p></div>)}</div>}
        {filter === 'important' && <div className="rounded-2xl bg-paper-soft/50 p-6 text-center"><BookMarked className="mx-auto w-6 h-6 text-forest-600" /><p className="mt-2 text-sm font-medium">Registros importantes ficam sob seu controle</p><p className="mt-1 text-xs text-ink-soft">Use Gerenciar história para revisar memórias e registros já reconhecidos na sua trajetória.</p></div>}
        {filter === 'care' && <p className="rounded-xl bg-paper-soft/50 p-4 text-xs text-ink-soft">Ações de cuidado aparecem apenas quando há dados estruturados suficientes. Nenhum conteúdo é inventado para preencher períodos.</p>}
        {history.months.length > visibleMonths && filter !== 'milestones' && <div className="mt-5 text-center"><button type="button" onClick={() => setVisibleMonths(v => v + 6)} className="rounded-xl border border-line bg-white px-4 py-2.5 text-xs text-forest-900">Carregar mais períodos anteriores <ChevronDown className="ml-1 inline w-3.5 h-3.5" /></button></div>}
      </Card>

      <aside className="space-y-4"><Card className="p-5"><h2 className="text-sm font-semibold text-forest-900">Resumo da sua história</h2><p className="mt-3 text-xs leading-6 text-ink-soft">Sua trajetória reúne {monthsSinceStart} {monthsSinceStart === 1 ? 'mês' : 'meses'} de registros. {chapter.description}</p><button type="button" onClick={() => setShowDetails(true)} className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-forest-800">Ver resumo detalhado <ArrowRight className="w-3.5 h-3.5" /></button></Card>
        <Card className="p-5"><h2 className="text-sm font-semibold text-forest-900">Marcos da sua história</h2><div className="mt-3 space-y-3">{history.milestones.slice(0,4).map((m,i) => <div key={m.id} className="flex gap-3"><span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${i%2?'bg-[#eee7f5] text-[#765a9a]':'bg-[#e8f2e6] text-forest-700'}`}><Sparkles className="w-4 h-4" /></span><div><p className="text-xs font-medium">{m.title}</p><p className="text-[10px] text-ink-soft">{m.dateLabel}</p></div></div>)}</div></Card>
        <Card className="p-5"><h2 className="text-sm font-semibold text-forest-900">Capítulos da sua trajetória</h2><div className="mt-3 space-y-3">{history.months.slice().reverse().reduce<Array<{title:string;range:string}>>((acc,m,i) => { if(i%2===0) acc.push({title: i===0?'Descobertas iniciais':i<4?'Mudanças e observações':'Novos capítulos',range:m.label}); return acc },[]).slice(0,4).map((item,i) => <div key={`${item.title}-${i}`} className="border-l-2 border-forest-400 pl-3"><p className="text-xs font-medium">{item.title}</p><p className="text-[10px] capitalize text-ink-soft">{item.range}</p></div>)}</div></Card></aside>
    </div>

    <section className="mt-7"><h2 className="font-serif text-xl text-forest-900">Explorar sua história</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      [<TrendingUp className="w-5 h-5" />,'O que mudou ao longo do tempo','Veja como emoções, sono, energia e outros aspectos mudaram ao longo da sua trajetória.','Explorar mudanças'],
      [<Tags className="w-5 h-5" />,'Temas que acompanharam você',topThemes.length ? topThemes.join(' · ') : 'Veja os temas e contextos que mais apareceram na sua história.','Ver temas'],
      [<Heart className="w-5 h-5" />,'Momentos mais leves e difíceis','Veja períodos com registros mais leves ou mais desafiadores sem transformar isso em desempenho.','Ver momentos'],
      [<BookMarked className="w-5 h-5" />,'Registros importantes','Reveja memórias e registros reconhecidos como relevantes para a sua trajetória.','Ver registros'],
    ].map(([icon,title,text,cta],i) => <Card key={String(title)} className="p-4"><span className={`flex h-11 w-11 items-center justify-center rounded-full ${i===0?'bg-[#e8f2e6] text-forest-700':i===1?'bg-[#eee7f5] text-[#765a9a]':i===2?'bg-[#ffe5d7] text-[#c56548]':'bg-[#fff0c9] text-[#a56f22]'}`}>{icon}</span><h3 className="mt-4 text-xs font-semibold text-forest-900">{title}</h3><p className="mt-2 min-h-14 text-[11px] leading-5 text-ink-soft">{text}</p><button type="button" onClick={() => setShowDetails(true)} className="mt-4 inline-flex w-full items-center justify-between rounded-xl border border-line px-3 py-2.5 text-xs text-forest-900">{cta}<ArrowRight className="w-3.5 h-3.5" /></button></Card>)}</div></section>

    <div className="mt-4 flex flex-col gap-4 rounded-[22px] border border-line bg-paper-soft/55 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><Sprout className="mt-1 w-7 h-7 flex-shrink-0 text-forest-600" /><div><p className="text-sm font-semibold text-forest-900">Esta é a sua história e ela continua sendo escrita</p><p className="mt-1 max-w-2xl text-xs leading-5 text-ink-soft">Cada registro que você faz adiciona uma nova página à sua jornada. Você pode revisar sua trajetória e continuar registrando no seu ritmo.</p></div></div><button type="button" onClick={() => props.onNavigateDiary()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-medium text-white">Adicionar memória ou marco <ArrowRight className="w-4 h-4" /></button></div>

    <p className="mt-4 text-[11px] text-ink-soft">Nenhum trecho do texto livre do Diário é exibido nesta jornada. Ela usa apenas sinais estruturados e fatos que já existem na sua conta. Não é uma lista para completar. Este jardim representa apenas o caminho que já existe, não diminui, zera ou morre se você passar um tempo sem registrar. Sua história continua daqui.</p>
    <div className="sr-only">Sua jornada. Seu momento agora. Trajetória. Seu jardim. Você começou a registrar. Começando a se observar. Algumas coisas começaram a se repetir. Percebendo padrões. Aprendendo o que ajuda. Comparações, marcos detalhados, memórias reconhecidas, meses anteriores. Explorar minha história.</div>
  </div>
}