import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, BookOpen, CalendarDays, Check, CheckCircle2, ClipboardCheck,
  Download, Info, MessageCircle, Share2, Sparkles, Sprout, Target,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { exportReportPdf } from '../lib/reportPdf'
import { parseYmd, REPORT_TIME_ZONE } from '../lib/reportPeriods'
import { recommendGuidedContent, type RecommendedContent } from '../lib/questionnaireResult'
import type { StoredReport, WeeklyContent, DayPoint } from '../lib/reportGeneration'

type Ranked = { tag: string; count: number }
type WeeklyExtended = WeeklyContent & {
  short_summary?: string
  week_in_numbers?: { active_days?: number; checkins_count?: number; diaries_count?: number; addons_count?: number; total_entries?: number }
  dominant_emotions?: { label: string; count: number; emoji?: string }[]
  emotional_markers?: Ranked[]
  main_contexts?: Ranked[]
  main_needs?: Ranked[]
  care_actions_used?: Ranked[]
  sleep_by_day?: DayPoint[]
  mood_by_day?: DayPoint[]
  avgSleep?: number
  data_quality_notice?: string
  observed_patterns?: string[]
  attention_points?: string[]
  gentle_next_steps?: string[]
  closing_message?: string
}

interface Props {
  report: StoredReport
  plan: string
  onOpenArticle?: (slug: string) => void
  onNavigateDiary: () => void
  onOpenFullReport: () => void
}

const WEEK = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const palette = ['bg-[#fde7e2] text-[#cf5548]', 'bg-[#fff0dc] text-[#b9682a]', 'bg-[#e8eef6] text-[#4d789e]', 'bg-[#e8f2e6] text-[#5f8468]', 'bg-[#f5efcf] text-[#997d28]']

function formatLongPeriod(start: string, end: string) {
  const s = parseYmd(start); const e = parseYmd(end)
  const month = e.toLocaleString('pt-BR', { timeZone: REPORT_TIME_ZONE, month: 'long' })
  return `${s.getUTCDate()} a ${e.getUTCDate()} de ${month} de ${e.getUTCFullYear()}`
}

function Card({ title, number, children, className = '' }: { title: string; number?: number; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-line bg-white p-5 sm:p-6 ${className}`}>
    <h2 className="text-base sm:text-lg font-semibold text-forest-900">{number ? `${number}. ` : ''}{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
}

function BarRows({ items, empty }: { items: Ranked[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-ink-soft py-4">{empty}</p>
  const max = Math.max(...items.map(item => item.count), 1)
  return <div className="space-y-3">{items.slice(0, 6).map(item => <div key={item.tag} className="grid grid-cols-[minmax(0,1fr)_42px_120px] items-center gap-3 text-sm">
    <span className="truncate text-ink">{item.tag}</span><span className="text-right tabular-nums text-ink-soft">{item.count}</span>
    <span className="h-1.5 rounded-full bg-[#edf0e8] overflow-hidden"><span className="block h-full rounded-full bg-forest-700" style={{ width: `${Math.max(12, (item.count / max) * 100)}%` }} /></span>
  </div>)}</div>
}

function chipClass(index: number) { return palette[index % palette.length] }

export default function WeeklyReportMockup({ report, plan, onOpenArticle, onNavigateDiary }: Props) {
  const c = report.content as WeeklyExtended
  const [recs, setRecs] = useState<RecommendedContent[]>([])
  const [shared, setShared] = useState(false)
  const numbers = c.week_in_numbers ?? {
    active_days: c.data_quality?.active_days ?? 0,
    checkins_count: c.checkinCount ?? 0,
    diaries_count: c.diaryCount ?? 0,
    addons_count: 0,
    total_entries: c.data_quality?.total_entries ?? ((c.checkinCount ?? 0) + (c.diaryCount ?? 0)),
  }
  const hasEnough = c.data_quality?.has_enough_data ?? c.hasEnoughData ?? ((numbers.active_days ?? 0) >= 3 && (numbers.total_entries ?? 0) >= 5)
  const emotions = (c.dominant_emotions ?? c.topEmotions ?? []).slice(0, 5)
  const markers = (c.emotional_markers ?? c.emotionalMarkers ?? []).slice(0, 5)
  const contexts = (c.main_contexts ?? c.topContexts ?? []).slice(0, 6)
  const needs = (c.main_needs ?? []).slice(0, 6)
  const care = (c.care_actions_used ?? []).slice(0, 6)
  const patterns = (c.observed_patterns ?? c.patterns ?? []).slice(0, 3)
  const attention = (c.attention_points ?? c.attentionPoints ?? []).slice(0, 2)
  const nextSteps = (c.gentle_next_steps ?? c.nextSteps ?? []).slice(0, 3)
  const tags = c.recommendTags ?? markers.map(item => item.tag)

  useEffect(() => {
    let active = true
    if (!tags.length) return () => { active = false }
    recommendGuidedContent(plan, tags, 3).then(items => { if (active) setRecs(items) }).catch(() => {})
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.period_start, plan])

  const series = useMemo(() => {
    const maps = [c.energyByDay ?? [], c.anxietyByDay ?? [], c.sleep_by_day ?? [], c.mood_by_day ?? []].map(arr => new Map(arr.map(p => [p.day, p.value])))
    const start = parseYmd(report.period_start)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setUTCDate(start.getUTCDate() + i)
      const day = d.getUTCDate()
      return { day: WEEK[d.getUTCDay()], energy: maps[0].get(day) ?? null, anxiety: maps[1].get(day) ?? null, sleep: maps[2].get(day) ?? null, mood: maps[3].get(day) ?? null }
    })
  }, [c.energyByDay, c.anxietyByDay, c.sleep_by_day, c.mood_by_day, report.period_start])

  const share = async () => {
    const text = `Minha leitura semanal — ${formatLongPeriod(report.period_start, report.period_end)}`
    try {
      if (navigator.share) await navigator.share({ title: 'Sua leitura semanal', text })
      else await navigator.clipboard.writeText(text)
      setShared(true); window.setTimeout(() => setShared(false), 1800)
    } catch { /* usuário cancelou */ }
  }
  const download = () => exportReportPdf(report, plan, `relatorio-semanal-${report.period_start}.pdf`)
  const qualityLabel = hasEnough ? 'Ótima' : 'Parcial'
  const avgSleep = Number(c.avgSleep ?? 0)

  return <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
    <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
      <div><h1 className="font-serif text-4xl text-forest-900">Sua leitura semanal</h1><p className="mt-1.5 text-sm text-ink-soft">Uma visão rápida de como foi sua semana.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900"><Share2 className="w-4 h-4" /> {shared ? 'Copiado' : 'Compartilhar'}</button>
        <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900"><Download className="w-4 h-4" /> Baixar PDF</button>
      </div>
    </header>

    <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6 mb-4 grid gap-4 lg:grid-cols-[1fr_280px] lg:items-center">
      <div className="flex items-center gap-4"><span className="w-12 h-12 rounded-full bg-forest-900 text-white flex items-center justify-center"><CalendarDays className="w-5 h-5" /></span><div><p className="text-lg font-semibold text-ink">{formatLongPeriod(report.period_start, report.period_end)}</p><p className="text-xs text-ink-soft mt-1">Semana encerrada no sábado</p></div></div>
      <div><div className="flex items-center gap-2 text-sm font-medium">Qualidade dos dados <Info className="w-3.5 h-3.5 text-ink-soft" /></div><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${hasEnough ? 'bg-mint text-forest-800' : 'bg-[#fff0dc] text-[#9b5b22]'}`}><CheckCircle2 className="w-3.5 h-3.5" /> {qualityLabel}</span><p className="mt-2 text-xs text-ink-soft">{numbers.active_days ?? 0} dias ativos e {numbers.total_entries ?? 0} registros.</p></div>
    </section>

    <Card number={2} title="Resumo da semana">
      <div className="grid md:grid-cols-[120px_1fr] gap-5 items-center"><div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#eef4ea] to-[#f8efe7] flex items-center justify-center"><Sprout className="w-11 h-11 text-forest-500" strokeWidth={1.4} /></div><p className="text-[15px] leading-7 text-ink">{c.short_summary ?? c.summary}</p></div>
    </Card>

    <Card number={3} title="A semana em números" className="mt-4">
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-line">
        {[
          [<CalendarDays className="w-5 h-5" />, `${numbers.active_days ?? 0}/7`, 'Dias com registros'],
          [<ClipboardCheck className="w-5 h-5" />, numbers.checkins_count ?? 0, 'Check-ins'],
          [<BookOpen className="w-5 h-5" />, numbers.diaries_count ?? 0, 'Registros do diário'],
          [<Sparkles className="w-5 h-5" />, numbers.addons_count ?? 0, 'Complementos'],
          [<Target className="w-5 h-5" />, numbers.total_entries ?? 0, 'Total de registros'],
        ].map(([icon, value, label], i) => <div key={String(label)} className="px-3 py-2 text-center"><span className={`mx-auto mb-2 w-10 h-10 rounded-full flex items-center justify-center ${chipClass(i)}`}>{icon}</span><p className="text-xl font-semibold text-ink">{value}</p><p className="mt-1 text-[11px] text-ink-soft">{label}</p></div>)}
      </div>
    </Card>

    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Card number={4} title="O que mais apareceu">
        <div className="flex items-center gap-3 pb-4 border-b border-line"><span className="w-11 h-11 rounded-full bg-[#fde1dd] text-[#d65348] flex items-center justify-center"><Activity className="w-5 h-5" /></span><div><p className="text-xs text-ink-soft">Emoção predominante</p><p className="text-lg font-semibold text-ink">{c.dominantEmotion ?? emotions[0]?.label ?? '—'}</p></div></div>
        {emotions.length > 0 && <><p className="mt-4 text-xs font-medium text-ink-soft">Emoções dominantes</p><div className="mt-2 flex flex-wrap gap-2">{emotions.map((item, i) => <span key={item.label} className={`rounded-full px-3 py-1.5 text-xs ${chipClass(i)}`}>{item.label}</span>)}</div></>}
        {markers.length > 0 && <><p className="mt-4 text-xs font-medium text-ink-soft">Principais marcadores emocionais</p><div className="mt-2 flex flex-wrap gap-2">{markers.map(item => <span key={item.tag} className="rounded-full border border-[#bfd3c4] bg-[#f5faf5] px-2.5 py-1 text-[11px] text-forest-800">{item.tag}</span>)}</div><p className="mt-3 text-[11px] text-ink-soft">Marcadores emocionais descrevem sinais registrados e não são tratados como gatilhos.</p></>}
      </Card>
      <Card number={5} title="Contextos da semana"><BarRows items={contexts} empty="Não houve dados de contexto suficientes nesta semana." /></Card>
    </div>

    <div className="grid lg:grid-cols-3 gap-4 mt-4">
      <Card number={6} title="Necessidades percebidas"><BarRows items={needs} empty="Nenhuma necessidade estruturada suficiente para destacar." /></Card>
      <Card number={7} title="Ações de cuidado"><BarRows items={care} empty="Nenhuma ação de cuidado estruturada suficiente para destacar." />{care.length > 0 && <p className="mt-4 rounded-xl bg-mint/35 p-3 text-xs text-forest-800">Você registrou pequenas ações de cuidado durante a semana. Elas entram aqui como observação, não como meta.</p>}</Card>
      <Card number={8} title="Energia, ansiedade, sono e humor">
        <div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e9e5de" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 10]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E6E1D8', fontSize: 11 }} /><Line type="monotone" dataKey="energy" name="Energia" stroke="#39775b" strokeWidth={2} connectNulls dot={{ r: 2 }} /><Line type="monotone" dataKey="anxiety" name="Ansiedade" stroke="#f28a32" strokeWidth={2} connectNulls dot={{ r: 2 }} /><Line type="monotone" dataKey="sleep" name="Sono" stroke="#9b78b6" strokeWidth={2} connectNulls dot={{ r: 2 }} /><Line type="monotone" dataKey="mood" name="Humor" stroke="#467daf" strokeWidth={2} connectNulls dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">{[[c.avgEnergy, 'Energia'], [c.avgAnxiety, 'Ansiedade'], [avgSleep, 'Sono'], [c.avgMood, 'Humor']].map(([value, label], i) => <div key={String(label)}><div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${chipClass(i)}`}>{Number(value) > 0 ? Number(value).toFixed(1).replace('.', ',') : '—'}</div><p className="mt-1 text-[10px] text-ink-soft">{label}</p></div>)}</div>
      </Card>
    </div>

    <div className="grid lg:grid-cols-3 gap-4 mt-4">
      <Card number={9} title="Padrões observados">{patterns.length ? <ul className="space-y-3">{patterns.map((p, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed"><Check className="w-4 h-4 text-forest-600 mt-0.5 flex-shrink-0" />{p}</li>)}</ul> : <p className="text-sm text-ink-soft">Ainda não há padrão suficiente para destacar com cuidado.</p>}<p className="mt-4 text-[11px] text-ink-soft">Associações observadas nos registros da semana, sem afirmar causa.</p></Card>
      <Card number={10} title="Pontos de atenção">{attention.length ? <ul className="space-y-3">{attention.map((p, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed"><AlertTriangle className="w-4 h-4 text-[#d98b3c] mt-0.5 flex-shrink-0" />{p}</li>)}</ul> : <p className="text-sm text-ink-soft">Nenhum ponto específico precisa ser destacado nesta semana.</p>}</Card>
      <Card number={11} title="Próximos passos leves">{nextSteps.length ? <ul className="space-y-3">{nextSteps.map((p, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed"><span className="w-5 h-5 rounded-full bg-mint text-forest-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">{i + 1}</span>{p}</li>)}</ul> : <p className="text-sm text-ink-soft">Continue observando seu ritmo sem transformar o registro em obrigação.</p>}</Card>
    </div>

    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 mt-4">
      <Card number={12} title="Conteúdos recomendados para você">
        {recs.length ? <div className="grid sm:grid-cols-3 gap-3">{recs.map((rc, i) => <button key={rc.id} type="button" onClick={() => rc.slug && onOpenArticle ? onOpenArticle(rc.slug) : onNavigateDiary()} className="text-left rounded-2xl border border-line overflow-hidden bg-paper-soft hover:bg-mint/20 transition-colors"><div className={`h-20 flex items-center justify-center ${chipClass(i)}`}><BookOpen className="w-7 h-7" /></div><div className="p-3"><p className="text-[10px] uppercase tracking-wide text-ink-soft">{rc.category}{rc.readTime ? ` · ${rc.readTime} min` : ''}</p><p className="mt-1 text-sm font-medium text-forest-900 line-clamp-2">{rc.title}</p></div></button>)}</div> : <p className="text-sm text-ink-soft">Os conteúdos aparecem quando há temas compatíveis com o seu plano e com os registros desta semana.</p>}
      </Card>
      <Card number={13} title="Mensagem final">
        <div className="flex gap-4"><span className="w-12 h-12 rounded-full bg-mint text-forest-700 flex items-center justify-center flex-shrink-0"><MessageCircle className="w-5 h-5" /></span><p className="text-sm leading-7">{c.closing_message ?? c.improvementMoments ?? 'Cada registro ajuda a perceber o seu ritmo com um pouco mais de clareza. Continue no seu tempo, sem cobrança.'}</p></div>
      </Card>
    </div>

    <Card number={14} title="Qualidade dos dados desta semana" className="mt-4 bg-[#fbfcf7]">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center"><div className="flex gap-3"><span className={`w-9 h-9 rounded-full flex items-center justify-center ${hasEnough ? 'bg-mint text-forest-700' : 'bg-[#fff0dc] text-[#a25f24]'}`}>{hasEnough ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}</span><div><p className="text-sm font-medium text-forest-900">{hasEnough ? 'Dados suficientes para uma leitura cuidadosa.' : 'Leitura com poucos dados.'}</p><p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.data_quality_notice ?? c.data_quality?.message ?? (hasEnough ? 'Continue registrando quando fizer sentido para acompanhar seu percurso.' : 'Abaixo de 3 dias ativos e 5 registros, esta leitura é apenas um ponto de partida, não uma conclusão.')}</p></div></div><div className="text-center lg:px-5 lg:border-l lg:border-line"><p className="text-2xl font-semibold">{numbers.active_days ?? 0}</p><p className="text-[10px] text-ink-soft">dias ativos<br />(mín. 3)</p></div><div className="text-center lg:px-5 lg:border-l lg:border-line"><p className="text-2xl font-semibold">{numbers.total_entries ?? 0}</p><p className="text-[10px] text-ink-soft">registros totais<br />(mín. 5)</p></div></div>
    </Card>

    <div className="mt-4 rounded-[18px] border border-line bg-white px-5 py-4"><p className="text-xs text-ink-soft"><strong className="text-forest-900">Esta leitura considera seus registros da semana e não representa diagnóstico ou orientação profissional.</strong></p></div>
  </div>
}
