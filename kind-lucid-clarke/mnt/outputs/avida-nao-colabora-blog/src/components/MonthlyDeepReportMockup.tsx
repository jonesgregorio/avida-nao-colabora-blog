import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDown, ArrowRight, ArrowUp, BookOpen, CalendarCheck2, CheckCircle2,
  Download, Heart, Info, Leaf, MessageCircle, Minus, Share2, Sparkles, Sprout, Target,
  TrendingUp,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { exportReportPdf } from '../lib/reportPdf'
import { monthTitle, parseYmd } from '../lib/reportPeriods'
import { recommendGuidedContent, type RecommendedContent } from '../lib/questionnaireResult'
import type { DayPoint, MonthlyContent, StoredReport } from '../lib/reportGeneration'

type Ranked = { tag: string; count: number }
type MonthlyExtended = MonthlyContent & {
  total_entries?: number
  active_days?: number
  total_checkins?: number
  total_main_diaries?: number
  total_addons?: number
  data_quality?: { has_enough_data?: boolean; total_entries?: number; active_days?: number; confidence_level?: string; message?: string }
  care_actions?: Ranked[]
  care_actions_used?: Ranked[]
  sleep_by_day?: DayPoint[]
  mood_by_day?: DayPoint[]
  avgMood?: number
  observed_patterns?: string[]
  attention_points?: string[]
  gentle_next_steps?: string[]
  closing_message?: string
}

interface Props {
  report: StoredReport
  previousReport?: StoredReport | null
  history: StoredReport[]
  plan: string
  onOpenReport: (report: StoredReport) => void
  onOpenArticle?: (slug: string) => void
  onOpenFullReport: () => void
}

const palette = ['bg-[#fde7e2] text-[#cf5548]', 'bg-[#fff0dc] text-[#b9682a]', 'bg-[#e8eef6] text-[#4d789e]', 'bg-[#eee7f5] text-[#785e99]', 'bg-[#e8f2e6] text-[#5f8468]']
function chipClass(index: number) { return palette[index % palette.length] }
function n(value: unknown) { const x = Number(value); return Number.isFinite(x) ? x : 0 }
function Card({ title, number, children, className = '' }: { title: string; number: number; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-line bg-white p-5 sm:p-6 ${className}`}><h2 className="text-base sm:text-lg font-semibold text-forest-900">{number}. {title}</h2><div className="mt-4">{children}</div></section>
}
function BarRows({ items, empty }: { items: Ranked[]; empty: string }) {
  if (!items.length) return <p className="py-4 text-sm text-ink-soft">{empty}</p>
  const max = Math.max(...items.map(item => item.count), 1)
  return <div className="space-y-3">{items.slice(0, 6).map(item => <div key={item.tag} className="grid grid-cols-[minmax(0,1fr)_38px_100px] items-center gap-2 text-sm"><span className="truncate">{item.tag}</span><span className="text-right text-ink-soft tabular-nums">{item.count}</span><span className="h-1.5 overflow-hidden rounded-full bg-[#edf0e8]"><span className="block h-full rounded-full bg-forest-700" style={{ width: `${Math.max(12, item.count / max * 100)}%` }} /></span></div>)}</div>
}
function splitComparison(lines: string[]) {
  return lines.slice(0, 5).map(line => ({ label: line, direction: /maior|subiu|\+/.test(line) ? 1 : /menor|caiu|-\d/.test(line) ? -1 : 0 }))
}

export default function MonthlyDeepReportMockup({ report, previousReport, history, plan, onOpenReport, onOpenArticle, onOpenFullReport }: Props) {
  const c = report.content as MonthlyExtended
  const prev = previousReport?.content as MonthlyExtended | undefined
  const [recs, setRecs] = useState<RecommendedContent[]>([])
  const [shared, setShared] = useState(false)
  const activeDays = n(c.data_quality?.active_days ?? c.active_days)
  const total = n(c.data_quality?.total_entries ?? c.total_entries ?? (c.checkinCount + c.diaryCount))
  const checkins = n(c.total_checkins ?? c.checkinCount)
  const diaries = n(c.total_main_diaries ?? c.diaryCount)
  const addons = n(c.total_addons)
  const hasEnough = c.data_quality?.has_enough_data ?? c.hasEnoughData ?? (activeDays >= 3 && total >= 5)
  const emotions = (c.topEmotions ?? []).slice(0, 6)
  const contexts = (c.topContexts ?? []).slice(0, 6)
  const needs = (c.topNeeds ?? []).slice(0, 6)
  const care = (c.care_actions_used ?? c.care_actions ?? []).slice(0, 6)
  const patterns = (c.observed_patterns ?? c.patterns ?? []).slice(0, 4)
  const relations = (c.relations ?? []).slice(0, 4)
  const attention = (c.attention_points ?? []).slice(0, 3)
  const tags = c.recommendTags ?? c.topEmotionalMarkers?.map(item => item.tag) ?? []

  useEffect(() => {
    let active = true
    if (tags.length) recommendGuidedContent(plan, tags, 3).then(items => { if (active) setRecs(items) }).catch(() => {})
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.period_start, plan])

  const series = useMemo(() => {
    const arrays = [c.energyByDay ?? [], c.anxietyByDay ?? [], c.sleep_by_day ?? [], c.mood_by_day ?? []]
    const maps = arrays.map(arr => new Map(arr.map(p => [p.day, p.value])))
    const end = parseYmd(report.period_end).getUTCDate()
    return Array.from({ length: end }, (_, i) => ({ day: i + 1, energy: maps[0].get(i + 1) ?? null, anxiety: maps[1].get(i + 1) ?? null, sleep: maps[2].get(i + 1) ?? null, mood: maps[3].get(i + 1) ?? null }))
  }, [c.energyByDay, c.anxietyByDay, c.sleep_by_day, c.mood_by_day, report.period_end])

  const share = async () => { try { const text = `Meu relatório mensal aprofundado — ${monthTitle(report.period_start)}`; if (navigator.share) await navigator.share({ title: 'Relatório Mensal Aprofundado', text }); else await navigator.clipboard.writeText(text); setShared(true); window.setTimeout(() => setShared(false), 1800) } catch { /* cancelado */ } }
  const quality = hasEnough ? (activeDays >= 10 && total >= 12 ? 'Ótima' : 'Adequada') : 'Parcial'
  const comparisons = splitComparison(c.monthlyComparison ?? [])
  const historyItems = history.filter(item => item.id !== report.id).slice(0, 4)
  const avgMood = n(c.avgMood)

  return <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
    <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="font-serif text-4xl text-forest-900">Relatório Mensal Aprofundado</h1><p className="mt-1.5 text-sm text-ink-soft">Uma análise completa do seu mês, padrões e mudanças observadas.</p></div><div className="flex gap-2"><button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900"><Share2 className="w-4 h-4" />{shared ? 'Copiado' : 'Compartilhar'}</button><button type="button" onClick={() => exportReportPdf(report, plan, `relatorio-mensal-${report.period_start}.pdf`)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900"><Download className="w-4 h-4" />Baixar PDF</button></div></header>

    <section className="mb-4 grid gap-4 rounded-[22px] border border-line bg-white p-5 sm:p-6 lg:grid-cols-[1fr_280px] lg:items-center"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-900 text-white"><CalendarCheck2 className="w-5 h-5" /></span><div><p className="text-lg font-semibold">{monthTitle(report.period_start)}</p><p className="mt-1 text-xs text-ink-soft">1º a {parseYmd(report.period_end).getUTCDate()} · mês fechado</p></div></div><div><div className="flex items-center gap-2 text-sm font-medium">Qualidade dos dados <Info className="w-3.5 h-3.5 text-ink-soft" /></div><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${hasEnough ? 'bg-mint text-forest-800' : 'bg-[#fff0dc] text-[#9b5b22]'}`}><CheckCircle2 className="w-3.5 h-3.5" />{quality}</span><p className="mt-2 text-xs text-ink-soft">{activeDays} dias ativos e {total} registros.</p></div></section>

    <Card number={1} title="Visão geral do mês"><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[[`${activeDays}/${parseYmd(report.period_end).getUTCDate()}`, 'Dias com registros'], [checkins, 'Check-ins'], [diaries, 'Registros do diário'], [addons, 'Complementos'], [total, 'Total de registros']].map(([value,label],i) => <div key={String(label)} className="rounded-2xl bg-paper-soft/55 px-3 py-4 text-center"><span className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${chipClass(i)}`}><Target className="w-4 h-4" /></span><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-ink-soft">{label}</p></div>)}</div><p className="mt-5 text-sm leading-7 text-ink">{c.summary}</p></Card>

    <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card number={2} title="O que mais marcou este mês"><div className="space-y-3">{[c.predominantEmotions, c.patterns?.[0], c.improvementMoments].filter(Boolean).slice(0,3).map((text,i) => <div key={String(text)} className="flex gap-3 rounded-xl bg-paper-soft/45 p-3"><span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${chipClass(i)}`}><Sparkles className="w-4 h-4" /></span><p className="text-sm leading-6">{text}</p></div>)}</div></Card><Card number={3} title="Emoções e estados predominantes"><div className="space-y-3">{emotions.map((item,i) => <div key={item.label} className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${chipClass(i).split(' ')[0]}`} /><span className="flex-1 text-sm">{item.label}</span><span className="text-sm font-medium tabular-nums">{item.count}</span></div>)}</div><p className="mt-4 text-xs leading-5 text-ink-soft">{c.predominantEmotions}</p></Card></div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card number={4} title="Contextos mais presentes"><BarRows items={contexts} empty="Ainda não há contextos suficientes para destacar." />{needs.length > 0 && <div className="mt-5 border-t border-line pt-4"><p className="mb-2 text-xs font-medium text-ink-soft">Necessidades mais presentes</p><div className="flex flex-wrap gap-2">{needs.slice(0,4).map(item => <span key={item.tag} className="rounded-full bg-mint/50 px-3 py-1.5 text-xs text-forest-800">{item.tag}</span>)}</div></div>}</Card><Card number={5} title="Conexões que se repetiram"><div className="space-y-3">{relations.map((text,i) => <div key={text} className="rounded-xl border border-line bg-paper-soft/35 p-3"><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] ${chipClass(i)}`}>Conexão observada</span><ArrowRight className="w-3.5 h-3.5 text-ink-soft" /></div><p className="mt-2 text-xs leading-5 text-ink">{text}</p></div>)}</div><p className="mt-4 text-[11px] text-ink-soft">Relações observadas nos registros. Não indicam causa.</p></Card></div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_.7fr]"><Card number={6} title="Como o mês se movimentou"><div className="mb-4 grid grid-cols-3 gap-2">{(c.narrative ?? []).map(item => <div key={item.phase} className="rounded-xl bg-paper-soft/50 p-3"><p className="text-xs font-semibold text-forest-800">{item.phase}</p><p className="mt-1 text-[11px] leading-5 text-ink-soft">{item.text}</p></div>)}</div><div className="h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 6, right: 8, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e9e5de" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 10]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E6E1D8', fontSize: 11 }} /><Line type="monotone" dataKey="energy" name="Energia" stroke="#39775b" strokeWidth={2} connectNulls dot={false} /><Line type="monotone" dataKey="anxiety" name="Ansiedade" stroke="#f28a32" strokeWidth={2} connectNulls dot={false} /><Line type="monotone" dataKey="sleep" name="Sono" stroke="#9b78b6" strokeWidth={2} connectNulls dot={false} /><Line type="monotone" dataKey="mood" name="Humor" stroke="#467daf" strokeWidth={2} connectNulls dot={false} /></LineChart></ResponsiveContainer></div></Card><Card number={7} title="Comparação com o mês anterior"><p className="mb-3 text-xs text-ink-soft">{previousReport ? `${monthTitle(previousReport.period_start)} → ${monthTitle(report.period_start)}` : 'Primeiro período comparável'}</p><div className="space-y-3">{comparisons.map(({label,direction}) => <div key={label} className="flex gap-2 border-b border-line pb-3 text-xs leading-5"><span className={`mt-0.5 ${direction > 0 ? 'text-forest-700' : direction < 0 ? 'text-[#c65b50]' : 'text-ink-soft'}`}>{direction > 0 ? <ArrowUp className="w-4 h-4" /> : direction < 0 ? <ArrowDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}</span><span>{label}</span></div>)}</div>{prev && <div className="mt-4 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-paper-soft/50 p-2"><p className="text-lg font-semibold">{n(prev.avgEnergy).toFixed(1)}</p><p className="text-[10px] text-ink-soft">Energia anterior</p></div><div className="rounded-xl bg-paper-soft/50 p-2"><p className="text-lg font-semibold">{n(prev.avgAnxiety).toFixed(1)}</p><p className="text-[10px] text-ink-soft">Ansiedade anterior</p></div></div>}</Card></div>

    <div className="mt-4 grid gap-4 lg:grid-cols-3"><Card number={8} title="Padrões que ganharam força"><div className="space-y-3">{patterns.map((text,i) => <div key={text} className="rounded-xl bg-paper-soft/45 p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${i === 0 ? 'bg-[#fff0dc] text-[#9b5b22]' : 'bg-mint text-forest-800'}`}>{i === 0 ? 'Em destaque' : 'Observado'}</span><p className="mt-2 text-xs leading-5">{text}</p></div>)}</div></Card><Card number={9} title="O que pareceu ajudar"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 w-5 h-5 flex-shrink-0 text-forest-600" /><p className="text-sm leading-6">{c.improvementMoments}</p></div>{care.length > 0 && <div className="mt-4"><BarRows items={care} empty="" /></div>}</Card><Card number={10} title="Momentos mais difíceis"><div className="space-y-3">{(c.attentionDays ?? []).slice(0,3).map(item => <div key={item.day} className="flex gap-3 rounded-xl bg-[#fff7ee] p-3"><Activity className="mt-0.5 w-4 h-4 flex-shrink-0 text-[#c47a32]" /><p className="text-xs leading-5"><strong>Dia {item.day}:</strong> {item.reason}</p></div>)}{attention.map(text => <p key={text} className="text-xs leading-5 text-ink-soft">{text}</p>)}</div></Card></div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card number={11} title="Mudanças e contrastes do mês"><div className="space-y-3">{(c.monthlyComparison ?? []).slice(0,4).map((text,i) => <div key={text} className="flex gap-3 text-sm leading-6"><TrendingUp className={`mt-1 w-4 h-4 flex-shrink-0 ${i % 2 ? 'text-[#c65b50]' : 'text-forest-600'}`} /><span>{text}</span></div>)}</div></Card><Card number={12} title="O que se repete há mais tempo"><div className="space-y-3">{patterns.slice(0,3).map((text,i) => <div key={text} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line pb-3"><p className="text-xs leading-5">{text}</p><span className="rounded-full bg-paper-soft px-2.5 py-1 text-[10px] text-forest-800">{i === 0 && previousReport ? 'Também observado antes' : 'Neste mês'}</span></div>)}</div><p className="mt-3 text-[11px] text-ink-soft">A persistência só é indicada quando há evidência disponível no histórico; não representa diagnóstico.</p></Card></div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_.65fr]"><Card number={13} title="Uma leitura do mês"><div className="grid gap-5 md:grid-cols-[90px_1fr]"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#eef4ea] to-[#f8efe7]"><Leaf className="w-9 h-9 text-forest-500" /></span><div className="space-y-3 text-sm leading-7"><p>{c.summary}</p><p>{c.energyAnxietySleep}</p><p>{c.emotionalMarkersText}</p></div></div></Card><Card number={14} title="Para observar no próximo mês"><div className="space-y-3">{(c.reflectionQuestions ?? []).slice(0,3).map(text => <div key={text} className="flex gap-3"><CheckCircle2 className="mt-0.5 w-4 h-4 flex-shrink-0 text-forest-600" /><p className="text-xs leading-5">{text}</p></div>)}</div></Card></div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_.65fr]"><Card number={15} title="Conteúdos recomendados para você"><div className="grid gap-3 sm:grid-cols-3">{recs.length ? recs.map(item => <button key={item.slug} type="button" onClick={() => onOpenArticle?.(item.slug)} className="rounded-xl border border-line bg-paper-soft/30 p-3 text-left"><span className="mb-3 flex h-16 items-center justify-center rounded-lg bg-gradient-to-br from-[#edf4e8] to-[#fff0df]"><BookOpen className="w-6 h-6 text-forest-600" /></span><p className="text-xs font-medium text-forest-900 line-clamp-2">{item.title}</p></button>) : <p className="col-span-3 text-sm text-ink-soft">Continue registrando para receber recomendações mais relacionadas ao seu momento.</p>}</div></Card><Card number={16} title="Mensagem final"><div className="flex gap-4"><span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-mint text-forest-700"><MessageCircle className="w-5 h-5" /></span><div><p className="text-sm leading-7">{c.closing_message ?? 'Cada mês é único. Seus registros são uma forma de observar sua experiência com mais contexto, sem transformar esse percurso em avaliação de desempenho.'}</p><Heart className="mt-4 w-5 h-5 text-forest-500" /></div></div></Card></div>

    <Card number={17} title="Histórico de relatórios mensais" className="mt-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{historyItems.length ? historyItems.map(item => <button key={item.id} type="button" onClick={() => onOpenReport(item)} className="flex items-center gap-3 rounded-xl border border-line bg-paper-soft/30 p-3 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-forest-700"><CalendarCheck2 className="w-4 h-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-forest-900">{monthTitle(item.period_start)}</strong><span className="text-[10px] text-ink-soft">Relatório fechado</span></span><ArrowRight className="w-4 h-4 text-ink-soft" /></button>) : <p className="text-sm text-ink-soft">Os próximos relatórios mensais aparecerão aqui conforme forem gerados.</p>}</div></Card>

    <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-line bg-paper-soft/55 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><Sprout className="mt-0.5 w-5 h-5 flex-shrink-0 text-forest-600" /><p className="max-w-3xl text-xs leading-5 text-ink-soft">{c.data_quality?.message ?? 'Esta leitura organiza os registros disponíveis do período. Associações não indicam causalidade e o relatório não representa diagnóstico.'}</p></div><button type="button" onClick={onOpenFullReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-medium text-forest-800">Explorar dados completos <ArrowRight className="w-4 h-4" /></button></div>
  </div>
}
