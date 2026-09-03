import { useMemo, useState } from 'react'
import { ArrowLeft, BookMarked, ChevronDown, Heart, Layers3, Sparkles, Star, Tags, TrendingUp } from 'lucide-react'
import type { HistoryManagementItem } from '../lib/historyManagement'
import type { HistoryMilestone, HistoryMonth } from '../lib/myHistory'

export type HistoryExploreMode = 'changes' | 'themes' | 'moments' | 'important'
type Period = '6m' | '12m' | 'year' | 'all'

type Props = {
  mode: HistoryExploreMode
  months: HistoryMonth[]
  highlightedMonths: Set<string>
  personalMilestones: HistoryManagementItem[]
  automaticMilestones: HistoryMilestone[]
  onBack: () => void
  onManage: () => void
}

const modeCopy: Record<HistoryExploreMode, { title: string; subtitle: string }> = {
  changes: { title: 'O que mudou ao longo do tempo', subtitle: 'Veja mudanças que ficaram mais visíveis sem precisar percorrer todos os meses.' },
  themes: { title: 'Temas que acompanharam você', subtitle: 'Veja os temas que voltaram a aparecer e em quais períodos eles estiveram presentes.' },
  moments: { title: 'Momentos mais leves e difíceis', subtitle: 'Alguns períodos que se destacaram nos seus registros, sem transformar sua trajetória em desempenho.' },
  important: { title: 'Registros importantes', subtitle: 'Marcos e períodos que você escolheu destacar na sua história.' },
}

function within(month: HistoryMonth, period: Period) {
  const [year, monthNumber] = month.key.split('-').map(Number)
  const now = new Date()
  if (period === 'year') return year === now.getFullYear()
  if (period === 'all') return true
  const monthsBack = period === '6m' ? 6 : 12
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  const target = new Date(year, monthNumber - 1, 1)
  const diff = (cursor.getFullYear() - target.getFullYear()) * 12 + cursor.getMonth() - target.getMonth()
  return diff >= 0 && diff < monthsBack
}

function countTop(months: HistoryMonth[], pick: (month: HistoryMonth) => { label: string; days: number } | null) {
  const map = new Map<string, { months: number; days: number }>()
  months.forEach(month => {
    const item = pick(month)
    if (!item) return
    const current = map.get(item.label) ?? { months: 0, days: 0 }
    map.set(item.label, { months: current.months + 1, days: current.days + item.days })
  })
  return [...map.entries()].map(([label, value]) => ({ label, ...value })).sort((a, b) => b.months - a.months || b.days - a.days)
}

function tone(label: string) {
  const text = label.toLowerCase()
  if (/tranquil|calm|leve|feliz|alegr|bem|esperan|gratid/.test(text)) return 'light'
  if (/ans|trist|raiva|medo|cansa|exaust|sobrec|difíc|angúst/.test(text)) return 'hard'
  return 'neutral'
}

function periodLabel(period: Period) {
  if (period === '6m') return 'últimos 6 meses'
  if (period === '12m') return 'últimos 12 meses'
  if (period === 'year') return 'este ano'
  return 'todo o período'
}

export default function MyHistoryExplorer({ mode, months, highlightedMonths, personalMilestones, automaticMilestones, onBack, onManage }: Props) {
  const [period, setPeriod] = useState<Period>('6m')
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const years = useMemo(() => [...new Set(months.map(month => month.key.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [months])
  const [yearFilter, setYearFilter] = useState(years[0] ?? String(new Date().getFullYear()))

  const filteredMonths = useMemo(() => {
    const base = months.filter(month => within(month, period))
    if (period !== 'all') return base
    return base.filter(month => month.key.startsWith(yearFilter))
  }, [months, period, yearFilter])

  const emotions = useMemo(() => countTop(filteredMonths, month => month.topEmotion), [filteredMonths])
  const contexts = useMemo(() => countTop(filteredMonths, month => month.topContext), [filteredMonths])
  const needs = useMemo(() => countTop(filteredMonths, month => month.topNeed), [filteredMonths])
  const themes = useMemo(() => [...emotions.map(item => ({ ...item, type: 'Emoção' })), ...contexts.map(item => ({ ...item, type: 'Contexto' })), ...needs.map(item => ({ ...item, type: 'Necessidade' }))].sort((a, b) => b.months - a.months || b.days - a.days), [contexts, emotions, needs])

  const changes = useMemo(() => {
    if (filteredMonths.length < 2) return ['Ainda são necessários mais períodos registrados para observar mudanças com segurança.']
    const half = Math.max(1, Math.floor(filteredMonths.length / 2))
    const recent = filteredMonths.slice(0, half)
    const earlier = filteredMonths.slice(half)
    const items: string[] = []
    const recentEmotion = countTop(recent, m => m.topEmotion)[0]?.label
    const earlierEmotion = countTop(earlier, m => m.topEmotion)[0]?.label
    if (recentEmotion && earlierEmotion && recentEmotion !== earlierEmotion) items.push(`${recentEmotion} passou a aparecer mais como destaque recente; antes, ${earlierEmotion} aparecia mais.`)
    const recentContext = countTop(recent, m => m.topContext)[0]?.label
    const earlierContext = countTop(earlier, m => m.topContext)[0]?.label
    if (recentContext && earlierContext && recentContext !== earlierContext) items.push(`Nos contextos, ${recentContext} ganhou mais presença recente em relação a ${earlierContext}.`)
    const recentDays = recent.reduce((sum, month) => sum + month.activeDays, 0) / recent.length
    const earlierDays = earlier.length ? earlier.reduce((sum, month) => sum + month.activeDays, 0) / earlier.length : recentDays
    if (Math.abs(recentDays - earlierDays) >= 2) items.push(recentDays > earlierDays ? 'Você registrou em mais dias por mês no período mais recente.' : 'Você registrou em menos dias por mês no período mais recente.')
    return items.length ? items.slice(0, 3) : ['Os períodos recentes estão parecidos com os anteriores nos sinais que mais se destacaram.']
  }, [filteredMonths])

  const lighter = useMemo(() => filteredMonths.filter(month => month.topEmotion && tone(month.topEmotion.label) === 'light').slice(0, 3), [filteredMonths])
  const harder = useMemo(() => filteredMonths.filter(month => month.topEmotion && tone(month.topEmotion.label) === 'hard').slice(0, 3), [filteredMonths])
  const themeMonths = useMemo(() => selectedTheme ? filteredMonths.filter(month => [month.topEmotion?.label, month.topContext?.label, month.topNeed?.label].includes(selectedTheme)) : [], [filteredMonths, selectedTheme])

  const importantMonths = useMemo(() => filteredMonths.filter(month => highlightedMonths.has(month.key)), [filteredMonths, highlightedMonths])
  const importantMilestones = useMemo(() => {
    const allowedYear = period === 'all' ? yearFilter : null
    const personal = personalMilestones.filter(item => !allowedYear || String(item.event_date ?? '').startsWith(allowedYear))
    const automatic = automaticMilestones.filter(item => !allowedYear || item.date.startsWith(allowedYear))
    return [...personal.map(item => ({ id: item.id, date: item.event_date ?? '', title: item.title ?? 'Marco pessoal', description: item.description ?? '', personal: true })), ...automatic.map(item => ({ id: item.id, date: item.date, title: item.title, description: item.description, personal: false }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  }, [automaticMilestones, period, personalMilestones, yearFilter])

  const visibleDetailMonths = mode === 'themes' && selectedTheme ? themeMonths : filteredMonths
  const copy = modeCopy[mode]

  return <div className="max-w-[1040px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium text-forest-800"><ArrowLeft className="w-4 h-4"/>Minha História</button>
    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-serif text-3xl sm:text-4xl text-forest-900">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{copy.subtitle}</p></div>{mode === 'important' && <button type="button" onClick={onManage} className="rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-medium text-forest-900">Gerenciar destaques</button>}</div>

    <div className="mt-6 flex flex-wrap gap-2">{([['6m','6 meses'],['12m','12 meses'],['year','Este ano'],['all','Tudo']] as Array<[Period,string]>).map(([key,label]) => <button key={key} type="button" onClick={() => { setPeriod(key); setExpandedMonth(null) }} className={`rounded-full px-4 py-2 text-xs font-medium ${period===key?'bg-forest-900 text-white':'border border-line bg-white text-forest-900'}`}>{label}</button>)}</div>
    {period === 'all' && years.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{years.map(year => <button key={year} type="button" onClick={() => { setYearFilter(year); setExpandedMonth(null) }} className={`min-w-max rounded-lg px-3 py-1.5 text-[11px] ${yearFilter===year?'bg-mint font-medium text-forest-900':'text-ink-soft'}`}>{year}</button>)}</div>}

    <section className="mt-6 rounded-[22px] border border-line bg-paper-soft/55 p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-forest-700">{mode==='changes'?<TrendingUp className="w-5 h-5"/>:mode==='themes'?<Tags className="w-5 h-5"/>:mode==='moments'?<Heart className="w-5 h-5"/>:<BookMarked className="w-5 h-5"/>}</span><div><p className="text-[11px] text-ink-soft">Resumo de {periodLabel(period)}{period==='all'?` · ${yearFilter}`:''}</p><p className="mt-1 text-sm font-semibold text-forest-900">{filteredMonths.length} {filteredMonths.length===1?'mês considerado':'meses considerados'}</p></div></div></section>

    {mode === 'changes' && <section className="mt-5"><h2 className="text-sm font-semibold text-forest-900">Principais mudanças</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{changes.map((item,index) => <div key={item} className="rounded-2xl border border-line bg-white p-4"><span className="text-[10px] font-medium text-ink-soft">{String(index+1).padStart(2,'0')}</span><p className="mt-2 text-xs leading-5 text-ink">{item}</p></div>)}</div></section>}

    {mode === 'themes' && <section className="mt-5"><div className="flex items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-forest-900">Temas mais presentes</h2><p className="mt-1 text-xs text-ink-soft">Mostramos apenas os principais. Toque em um tema para ver em quais meses ele se destacou.</p></div>{selectedTheme && <button type="button" onClick={() => setSelectedTheme(null)} className="text-xs font-medium text-forest-800">Limpar</button>}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{themes.slice(0, 6).map(item => <button key={`${item.type}-${item.label}`} type="button" onClick={() => setSelectedTheme(item.label)} className={`flex items-center justify-between rounded-2xl border p-4 text-left ${selectedTheme===item.label?'border-forest-500 bg-mint/30':'border-line bg-white'}`}><div><p className="text-xs font-semibold text-forest-900">{item.label}</p><p className="mt-1 text-[10px] text-ink-soft">{item.type} · destaque em {item.months} {item.months===1?'mês':'meses'}</p></div><ChevronDown className="w-4 h-4 -rotate-90 text-ink-soft"/></button>)}</div></section>}

    {mode === 'moments' && <section className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-[22px] border border-line bg-white p-5"><h2 className="text-sm font-semibold text-forest-900">Períodos mais leves</h2><p className="mt-1 text-xs text-ink-soft">Até 3 períodos que se destacaram por sinais mais leves.</p><div className="mt-4 space-y-2">{lighter.length?lighter.map(month => <button key={month.key} type="button" onClick={() => setExpandedMonth(expandedMonth===month.key?null:month.key)} className="w-full rounded-xl bg-[#edf6ed] p-3 text-left"><p className="text-xs font-medium capitalize text-forest-900">{month.label}</p><p className="mt-1 text-[10px] text-ink-soft">{month.topEmotion?.label} · {month.activeDays} dias registrados</p></button>):<p className="rounded-xl bg-paper-soft p-3 text-xs text-ink-soft">Nenhum período se destacou aqui neste recorte.</p>}</div></div><div className="rounded-[22px] border border-line bg-white p-5"><h2 className="text-sm font-semibold text-forest-900">Períodos mais desafiadores</h2><p className="mt-1 text-xs text-ink-soft">Até 3 períodos que se destacaram por sinais mais difíceis.</p><div className="mt-4 space-y-2">{harder.length?harder.map(month => <button key={month.key} type="button" onClick={() => setExpandedMonth(expandedMonth===month.key?null:month.key)} className="w-full rounded-xl bg-[#fff1ec] p-3 text-left"><p className="text-xs font-medium capitalize text-forest-900">{month.label}</p><p className="mt-1 text-[10px] text-ink-soft">{month.topEmotion?.label} · {month.activeDays} dias registrados</p></button>):<p className="rounded-xl bg-paper-soft p-3 text-xs text-ink-soft">Nenhum período se destacou aqui neste recorte.</p>}</div></div></section>}

    {mode === 'important' && <section className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-[22px] border border-line bg-white p-5"><h2 className="text-sm font-semibold text-forest-900">Períodos em destaque</h2><div className="mt-3 space-y-2">{importantMonths.length?importantMonths.slice(0,6).map(month => <button key={month.key} type="button" onClick={() => setExpandedMonth(expandedMonth===month.key?null:month.key)} className="flex w-full items-center gap-3 rounded-xl bg-[#fff7df] p-3 text-left"><Star className="w-4 h-4 fill-current text-[#76501a]"/><div><p className="text-xs font-medium capitalize text-forest-900">{month.label}</p><p className="text-[10px] text-ink-soft">{month.entryCount} registros</p></div></button>):<p className="rounded-xl bg-paper-soft p-3 text-xs text-ink-soft">Você ainda não destacou nenhum período neste recorte.</p>}</div></div><div className="rounded-[22px] border border-line bg-white p-5"><h2 className="text-sm font-semibold text-forest-900">Marcos da história</h2><div className="mt-3 space-y-3">{importantMilestones.length?importantMilestones.map(item => <div key={item.id} className="flex gap-3"><span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-mint text-forest-800"><Sparkles className="w-4 h-4"/></span><div><p className="text-xs font-medium text-forest-900">{item.title}</p><p className="mt-1 text-[10px] text-ink-soft">{item.personal?'Marco pessoal':'Marco da trajetória'}</p>{item.description&&<p className="mt-1 line-clamp-2 text-[11px] leading-4 text-ink-soft">{item.description}</p>}</div></div>):<p className="rounded-xl bg-paper-soft p-3 text-xs text-ink-soft">Ainda não há marcos neste recorte.</p>}</div></div></section>}

    {mode !== 'important' && <section className="mt-6 rounded-[22px] border border-line bg-white p-5"><button type="button" onClick={() => setExpandedMonth(expandedMonth === '__list__' ? null : '__list__')} className="flex w-full items-center justify-between text-left"><div><h2 className="text-sm font-semibold text-forest-900">Ver evolução mês a mês</h2><p className="mt-1 text-xs text-ink-soft">Os meses ficam recolhidos para a página continuar curta.</p></div><ChevronDown className={`w-4 h-4 text-ink-soft transition-transform ${expandedMonth==='__list__'?'rotate-180':''}`}/></button>{expandedMonth === '__list__' && <div className="mt-4 space-y-2 border-t border-line pt-4">{visibleDetailMonths.length?visibleDetailMonths.map(month => <details key={month.key} className="rounded-xl border border-line"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3"><div><p className="text-xs font-medium capitalize text-forest-900">{month.label}</p><p className="mt-1 text-[10px] text-ink-soft">{month.activeDays} dias · {month.entryCount} registros</p></div><ChevronDown className="w-4 h-4 text-ink-soft"/></summary><div className="border-t border-line px-3 py-3"><p className="text-xs leading-5 text-ink-soft">{month.summary}</p><div className="mt-2 flex flex-wrap gap-2">{[month.topEmotion?.label,month.topContext?.label,month.topNeed?.label].filter(Boolean).map(label => <span key={label} className="rounded-full bg-paper-soft px-2.5 py-1 text-[10px] text-forest-900">{label}</span>)}</div></div></details>):<p className="text-xs text-ink-soft">Nenhum mês disponível neste recorte.</p>}</div>}</section>}

    <div className="mt-5 flex items-start gap-3 rounded-2xl bg-paper-soft/55 p-4 text-[11px] leading-5 text-ink-soft"><Layers3 className="mt-0.5 w-4 h-4 flex-shrink-0 text-forest-600"/><p>Esta visualização resume sinais estruturados dos seus registros. Ela não indica causa, diagnóstico ou desempenho e não usa o texto livre do Diário para preencher conclusões.</p></div>
  </div>
}