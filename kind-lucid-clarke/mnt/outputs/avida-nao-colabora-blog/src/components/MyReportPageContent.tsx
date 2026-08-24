import { useState, useEffect, useMemo, useCallback } from 'react'
import { exportReportPdf } from '../lib/reportPdf'
import { supabase } from '../lib/supabase'
import { Plan } from '../types'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import {
  Lock, TrendingUp, BarChart2, FileText, Star, Loader2, Calendar, BookOpen,
  MessageCircle, Sprout,
  Clock, ArrowRight, ChevronDown, RefreshCw,
  Info, Download, Search, ChevronRight, X, Heart, Zap, Activity,
  Target, Smile, AlertCircle, Check, Sparkles, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { computeEmotionalAnalysis, MOOD_EMOJI, type DiaryRowLite } from '../lib/emotionalAnalytics'
import { recommendGuidedContent, type RecommendedContent } from '../lib/questionnaireResult'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import {
  getCurrentWeeklyPeriod, getPreviousWeeklyPeriod, getCurrentMonthlyPeriod, getPreviousMonthlyPeriod,
  formatPeriodShort, formatDateBR, monthTitle, ymd, parseYmd, resolveReportActivation, type Period,
} from '../lib/reportPeriods'
import {
  loadReportHistory, buildWeeklyContent, buildMonthlyContent,
  type StoredReport, type WeeklyContent, type MonthlyContent, type DayPoint,
} from '../lib/reportGeneration'

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  onNavigatePricing: () => void
  onNavigateDiary: () => void
  onNavigateGuidance: () => void
  onNavigateSelfCare?: () => void
  onOpenArticle?: (slug: string) => void
}

const DISCLAIMER = 'Este relatório é uma ferramenta de autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

// data (YYYY-MM-DD) de um registro
function entryYmd(e: DiaryRowLite): string {
  if (e.date) return String(e.date).slice(0, 10)
  if (e.created_at) return ymd(new Date(e.created_at))
  return ''
}
function inPeriod(e: DiaryRowLite, p: { start: string; end: string }): boolean {
  const d = entryYmd(e); return !!d && d >= p.start && d <= p.end
}
// período imediatamente anterior (mesma duração) — para comparação
function prevRange(p: { start: string; end: string }): { start: string; end: string } {
  const s = new Date(p.start + 'T12:00:00'); const e = new Date(p.end + 'T12:00:00')
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  const pe = new Date(s); pe.setDate(pe.getDate() - 1)
  const ps = new Date(pe); ps.setDate(ps.getDate() - days + 1)
  return { start: ymd(ps), end: ymd(pe) }
}

// ─── Wrappers visuais ─────────────────────────────────────────────────────────
function Section({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper-soft rounded-2xl border border-line p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-forest-500">{icon}</span>
        <h3 className="text-sm font-semibold text-forest-900">{title}</h3>
        {badge && <span className="ml-auto text-[10px] bg-mint text-forest-700 px-2 py-0.5 rounded-full font-medium">{badge}</span>}
      </div>
      {children}
    </div>
  )
}
function StatPill({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-mint/40 rounded-xl px-3 py-2 text-center">
      <p className="text-[10px] text-ink-soft mb-0.5">{label}</p>
      <p className="text-base font-bold text-forest-900">{value}<span className="text-xs font-normal text-ink-soft ml-0.5">{unit}</span></p>
    </div>
  )
}
function LockedSection({ title, description, onUpgrade }: { title: string; description: string; onUpgrade: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-mint/30 p-6 text-center space-y-3">
      <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center mx-auto text-forest-500"><Lock className="w-5 h-5" /></div>
      <p className="text-sm font-medium text-forest-800">{title}</p>
      <p className="text-xs text-ink-soft max-w-sm mx-auto">{description}</p>
      <button onClick={onUpgrade} className="text-xs text-forest-700 font-semibold border border-forest-200 bg-white px-4 py-1.5 rounded-full hover:bg-mint/50 transition-colors">Ver planos</button>
    </div>
  )
}

// ─── Gráficos de síntese (apoio ao relatório — não substituem o Mapa) ─────────

// ─── Peças do relatório semanal (redesign visual) ─────────────────────────────
const WD_ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
// Mapa dia-do-mês → rótulo "ter 27/07", cobrindo o período do relatório.
function buildDayLabels(startYmd: string, endYmd: string): Map<number, string> {
  const m = new Map<number, string>()
  let d = parseYmd(startYmd)
  const end = parseYmd(endYmd).getTime()
  let guard = 0
  while (d.getTime() <= end && guard < 40) {
    m.set(d.getDate(), `${WD_ABBR[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`)
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12); guard++
  }
  return m
}
interface ChartDay { day: number; label: string; energia: number | null; ansiedade: number | null }
function mergeDaySeries(energy: DayPoint[], anxiety: DayPoint[], labels: Map<number, string>): ChartDay[] {
  const eMap = new Map(energy.map(p => [p.day, p.value]))
  const aMap = new Map(anxiety.map(p => [p.day, p.value]))
  const days = [...new Set([...eMap.keys(), ...aMap.keys()])].sort((a, b) => a - b)
  return days.map(day => ({ day, label: labels.get(day) ?? `Dia ${day}`, energia: eMap.get(day) ?? null, ansiedade: aMap.get(day) ?? null }))
}
function pickDay(points: DayPoint[], mode: 'max' | 'min'): DayPoint | null {
  if (!points || points.length === 0) return null
  return points.reduce((a, b) => (mode === 'max' ? (b.value > a.value ? b : a) : (b.value < a.value ? b : a)))
}

function HeroDecoration() {
  return (
    <svg className="hidden sm:block absolute right-0 bottom-0 h-full w-56 pointer-events-none" viewBox="0 0 220 120" fill="none" aria-hidden="true">
      <circle cx="152" cy="40" r="15" fill="#F3C6A8" opacity="0.75" />
      <path d="M0 120 Q60 80 120 100 T220 92 V120 Z" fill="#E8F0EB" />
      <path d="M118 120 Q168 82 220 104 V120 Z" fill="#DDE9E0" />
      <path d="M196 120 C196 96 208 84 220 82 V120 Z" fill="#8FB5A1" opacity="0.85" />
      <path d="M190 118 C183 104 187 92 197 86 C201 98 199 111 190 118 Z" fill="#5c8a72" />
    </svg>
  )
}
function WeeklySummaryHero({ summary }: { summary: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-paper-soft p-5">
      <div className="relative z-10 flex items-start gap-3 sm:max-w-[75%]">
        <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><Sprout className="w-5 h-5" /></span>
        <div>
          <h3 className="font-serif text-lg text-forest-900">Resumo da semana</h3>
          <p className="text-sm text-stone-600 leading-relaxed mt-1">{summary}</p>
        </div>
      </div>
      <HeroDecoration />
    </div>
  )
}

function MetricTile({ icon, label, value, unit, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; unit?: string; sub?: string; accent?: 'forest' | 'coral' }) {
  const iconCls = accent === 'coral' ? 'bg-coral/60 text-[#c2673f]' : 'bg-mint text-forest-600'
  const valCls = accent === 'coral' ? 'text-[#c2673f]' : 'text-forest-900'
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-3.5 text-center flex flex-col items-center">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 ${iconCls}`}>{icon}</span>
      <p className="text-[11px] text-ink-soft leading-tight">{label}</p>
      <p className={`font-serif text-lg mt-0.5 leading-tight ${valCls}`}>{value}{unit && <span className="text-xs font-sans text-ink-soft">{unit}</span>}</p>
      {sub && <p className="text-[10px] text-ink-soft mt-0.5">{sub}</p>}
    </div>
  )
}

function HighlightRow({ icon, tone, label, value }: { icon: React.ReactNode; tone: 'forest' | 'coral'; label: string; value: string }) {
  const cls = tone === 'coral' ? 'bg-coral/50 text-[#c2673f]' : 'bg-mint text-forest-600'
  return (
    <div className="flex items-start gap-2 bg-white border border-line rounded-xl p-3 flex-1">
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}>{icon}</span>
      <div className="min-w-0"><p className="text-[11px] text-ink-soft leading-tight">{label}</p><p className="text-sm font-medium text-forest-900 leading-tight">{value}</p></div>
    </div>
  )
}
function EnergyAnxietyPanel({ data, bestEnergy, lowAnx, labels, title = 'Energia e ansiedade ao longo da semana' }: { data: ChartDay[]; bestEnergy: DayPoint | null; lowAnx: DayPoint | null; labels: Map<number, string>; title?: string }) {
  const dayName = (p: DayPoint) => labels.get(p.day) ?? `Dia ${p.day}`
  const tickInterval = data.length > 10 ? Math.ceil(data.length / 8) - 1 : 0
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-5">
      <h3 className="font-serif text-lg text-forest-900 mb-3">{title}</h3>
      {data.length >= 2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_13rem] gap-4 items-center">
          <div className="min-w-0">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8a8a8a' }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#8a8a8a' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E6E1D8', fontSize: 12 }} />
                  <Line type="monotone" dataKey="energia" name="Energia" stroke="#2f9e6f" strokeWidth={2.5} dot={{ r: 3, fill: '#2f9e6f' }} connectNulls />
                  <Line type="monotone" dataKey="ansiedade" name="Ansiedade" stroke="#d98b3c" strokeWidth={2.5} dot={{ r: 3, fill: '#d98b3c' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 justify-center mt-1 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 rounded bg-[#2f9e6f]" /> Energia</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 rounded bg-[#d98b3c]" /> Ansiedade</span>
            </div>
          </div>
          <div className="flex flex-row lg:flex-col gap-2">
            {bestEnergy && <HighlightRow icon={<ArrowUp className="w-4 h-4" />} tone="forest" label="Melhor dia de energia" value={`${dayName(bestEnergy)} · ${bestEnergy.value}/5`} />}
            {lowAnx && <HighlightRow icon={<ArrowDown className="w-4 h-4" />} tone="coral" label="Menor ansiedade" value={`${dayName(lowAnx)} · ${lowAnx.value}/5`} />}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-soft bg-mint/30 border border-line rounded-lg px-3 py-2.5">Gráfico indisponível: são necessários registros com energia/ansiedade em pelo menos 2 dias do período. Continue registrando para acompanhar sua semana.</p>
      )}
    </div>
  )
}

const DONUT_COLORS = ['#2f5d47', '#5c8a72', '#8fb5a1', '#d98b3c', '#e8a87c', '#c0d8c9']
function EmotionDonut({ emotions }: { emotions: { label: string; count: number }[] }) {
  const total = emotions.reduce((n, e) => n + e.count, 0)
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-5">
      <h3 className="font-serif text-lg text-forest-900 mb-3">Emoções mais frequentes</h3>
      {total > 0 ? (
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={emotions.slice(0, 6)} dataKey="count" nameKey="label" innerRadius={32} outerRadius={52} paddingAngle={2} stroke="none">
                  {emotions.slice(0, 6).map((e, i) => <Cell key={e.label} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${Math.round((v / total) * 100)}%`, '']} contentStyle={{ borderRadius: 10, border: '1px solid #E6E1D8', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 min-w-0 space-y-1.5">
            {emotions.slice(0, 6).map((e, i) => (
              <li key={e.label} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span className="text-stone-700 truncate flex-1">{e.label}</span>
                <span className="text-ink-soft text-xs">{Math.round((e.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-soft bg-mint/30 border border-line rounded-lg px-3 py-2.5">Ainda não há check-ins com emoções neste período. Continue registrando para ver seu panorama emocional.</p>
      )}
    </div>
  )
}

function TriggerRanking({ triggers, title = 'Marcadores emocionais mais frequentes', emptyText = 'Ainda não há marcadores emocionais neste período.' }: {
  triggers: { tag: string; count: number }[]; title?: string; emptyText?: string
}) {
  const total = triggers.reduce((n, t) => n + t.count, 0)
  const max = Math.max(...triggers.map(t => t.count), 1)
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-5">
      <h3 className="font-serif text-lg text-forest-900 mb-3">{title}</h3>
      {total > 0 ? (
        <div className="space-y-2.5">
          {triggers.slice(0, 5).map((t, i) => (
            <div key={t.tag} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-mint text-forest-700 text-[11px] font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span className="text-sm text-stone-700 w-24 sm:w-32 flex-shrink-0 truncate">{t.tag}</span>
              <div className="flex-1 h-2 rounded-full bg-mint overflow-hidden"><div className="h-full rounded-full bg-[#e8a87c]" style={{ width: `${(t.count / max) * 100}%` }} /></div>
              <span className="text-xs text-ink-soft w-9 text-right">{Math.round((t.count / total) * 100)}%</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-soft bg-mint/30 border border-line rounded-lg px-3 py-2.5">{emptyText}</p>
      )}
    </div>
  )
}

function InsightCard({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone?: 'forest' | 'coral'; children: React.ReactNode }) {
  const cls = tone === 'coral' ? 'bg-coral/50 text-[#c2673f]' : 'bg-mint text-forest-600'
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}>{icon}</span>
        <h4 className="text-sm font-semibold text-forest-900">{title}</h4>
      </div>
      {children}
    </div>
  )
}

const NEXT_STEP_ICONS = [Check, BookOpen, Sparkles, BarChart2]
function WeeklyNextSteps({ steps }: { steps: string[] }) {
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-5">
      <h3 className="font-serif text-lg text-forest-900 mb-3">Próximos passos</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((s, i) => {
          const Icon = NEXT_STEP_ICONS[i % NEXT_STEP_ICONS.length]
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><Icon className="w-4 h-4" /></span>
              <span className="text-sm text-stone-700 leading-snug">{s}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type QuestionnaireReportSignals = {
  completed_count?: number
  top_tags?: { tag?: string; count?: number }[]
  latest_results?: { questionnaire_id?: string; title?: string; result_label?: string | null }[]
}

function QuestionnaireReportContext({ content }: { content: unknown }) {
  const signals = (content as { questionnaire_signals?: QuestionnaireReportSignals } | null)?.questionnaire_signals
  const count = Number(signals?.completed_count ?? 0)
  if (!Number.isFinite(count) || count <= 0) return null
  const tags = Array.isArray(signals?.top_tags) ? signals.top_tags.filter(item => item?.tag).slice(0, 6) : []
  const latest = Array.isArray(signals?.latest_results) ? signals.latest_results.filter(item => item?.title).slice(0, 4) : []
  return (
    <section className="mb-4 rounded-2xl border border-line bg-mint/25 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-forest-600 flex-shrink-0"><Check className="w-4 h-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-forest-900">Questionários considerados neste relatório</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">Este relatório usou apenas resultado, pontuação e tags estruturadas de {count} questionário{count === 1 ? '' : 's'} concluído{count === 1 ? '' : 's'} no período. Respostas abertas não foram lidas por esta análise.</p>
        </div>
      </div>
      {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{tags.map(item => <span key={String(item.tag)} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-forest-700">{item.tag}{Number(item.count) > 1 ? ` · ${item.count}x` : ''}</span>)}</div>}
      {latest.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{latest.map((item, index) => <div key={`${item.questionnaire_id || index}-${index}`} className="rounded-xl border border-line/70 bg-white/80 px-3 py-2"><p className="text-xs font-medium text-forest-900 truncate">{item.title}</p>{item.result_label && <p className="mt-0.5 text-[11px] text-ink-soft">Resultado: {item.result_label}</p>}</div>)}</div>}
      <p className="mt-3 text-[11px] text-ink-soft">Esses sinais complementam o contexto; não contam como registros do Diário e, isoladamente, não são tratados como padrão, diagnóstico ou causa.</p>
    </section>
  )
}

// ─── Corpo do relatório fechado (on-screen e PDF) ─────────────────────────────
function ReportBody({ report, plan, onOpenArticle, onNavigateDiary, onNavigateSelfCare, onNavigateGuidance, forPdf }: {
  report: StoredReport; plan: string
  onOpenArticle?: (slug: string) => void; onNavigateDiary: () => void
  onNavigateSelfCare?: () => void; onNavigateGuidance: () => void; forPdf?: boolean
}) {
  const [recs, setRecs] = useState<RecommendedContent[]>([])
  const tags = (report.content as { recommendTags?: string[] }).recommendTags ?? []
  useEffect(() => {
    if (forPdf || tags.length === 0) return
    let active = true
    recommendGuidedContent(plan, tags, 3).then(r => { if (active) setRecs(r) }).catch(() => {})
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.period_start])

  if (report.content.kind === 'weekly') {
    const c = report.content as WeeklyContent
    const dayLabels = buildDayLabels(report.period_start, report.period_end)
    const chartData = mergeDaySeries(c.energyByDay, c.anxietyByDay, dayLabels)
    const bestEnergy = pickDay(c.energyByDay, 'max')
    const lowAnx = pickDay(c.anxietyByDay, 'min')
    return (
      <div className="space-y-4">
        {/* Resumo da semana (hero) */}
        <WeeklySummaryHero summary={c.summary} />

        {/* Métricas principais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricTile icon={<Smile className="w-4 h-4" />} label="Emoção + frequente" value={c.dominantEmotion ?? '—'} />
          <MetricTile icon={<Zap className="w-4 h-4" />} label="Energia média" value={c.avgEnergy || '—'} unit={c.avgEnergy ? '/5' : ''} />
          <MetricTile icon={<Activity className="w-4 h-4" />} label="Ansiedade média" value={c.avgAnxiety || '—'} unit={c.avgAnxiety ? '/5' : ''} accent="coral" />
          <MetricTile icon={<Calendar className="w-4 h-4" />} label="Check-ins" value={c.checkinCount ?? 0} sub="registros" />
          <MetricTile icon={<BookOpen className="w-4 h-4" />} label="Diários" value={c.diaryCount ?? 0} sub="registros" />
          <MetricTile icon={<Target className="w-4 h-4" />} label="Marcador emocional" value={c.topEmotionalMarker ?? c.topTrigger ?? '—'} accent="coral" />
        </div>

        {/* Energia e ansiedade ao longo da semana */}
        <EnergyAnxietyPanel data={chartData} bestEnergy={bestEnergy} lowAnx={lowAnx} labels={dayLabels} />

        {/* Emoções + marcadores emocionais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <EmotionDonut emotions={c.topEmotions} />
          <TriggerRanking triggers={c.emotionalMarkers ?? c.triggers ?? []} />
        </div>

        {/* Contextos (§14.1) */}
        {c.topContexts && c.topContexts.length > 0 && (
          <TriggerRanking triggers={c.topContexts} title="Contextos que mais apareceram" emptyText="Ainda não há contextos marcados nesta semana." />
        )}

        {/* Blocos interpretativos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <InsightCard icon={<Sprout className="w-4 h-4" />} title="O que seus registros parecem indicar">
            <p className="text-sm text-stone-700 leading-relaxed">{c.interpretation}</p>
          </InsightCard>
          <InsightCard icon={<TrendingUp className="w-4 h-4" />} title="Comparação com a semana anterior">
            {c.comparison.length > 0
              ? <ul className="space-y-1.5">{c.comparison.map((l, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><ArrowRight className="w-3.5 h-3.5 text-forest-400 mt-0.5 flex-shrink-0" />{l}</li>)}</ul>
              : <p className="text-sm text-ink-soft">Ainda não há uma semana anterior suficiente para comparação.</p>}
          </InsightCard>
          {(c.attentionPoints?.length ?? 0) > 0 && (
            <InsightCard icon={<AlertCircle className="w-4 h-4" />} title="Pontos de atenção da semana" tone="coral">
              <ul className="space-y-1.5">{c.attentionPoints.map((p, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-[#d98b3c] mt-0.5">•</span>{p}</li>)}</ul>
            </InsightCard>
          )}
          {c.improvementMoments && (
            <InsightCard icon={<Heart className="w-4 h-4" />} title="Momentos de melhora">
              <p className="text-sm text-stone-700 leading-relaxed">{c.improvementMoments}</p>
            </InsightCard>
          )}
          {(c.patterns?.length ?? 0) > 0 && (
            <InsightCard icon={<BarChart2 className="w-4 h-4" />} title="Principais padrões da semana">
              <ul className="space-y-1.5">{c.patterns.map((p, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-forest-400 mt-0.5">•</span>{p}</li>)}</ul>
            </InsightCard>
          )}
        </div>

        {/* Conteúdos recomendados */}
        {!forPdf && recs.length > 0 && (
          <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1.5">Conteúdos guiados recomendados</p>
            <div className="space-y-2">{recs.map(rc => <RecCard key={rc.id} rc={rc} onOpen={() => rc.slug && onOpenArticle ? onOpenArticle(rc.slug) : onNavigateDiary()} />)}</div></div>
        )}

        {/* Próximos passos */}
        {c.nextSteps.length > 0 && <WeeklyNextSteps steps={c.nextSteps} />}
      </div>
    )
  }

  // ══════════ Mensal aprofundado (redesign fiel à referência) ══════════
  const c = report.content as MonthlyContent
  const totalRecords = (c.checkinCount ?? 0) + (c.diaryCount ?? 0)
  const mEmotions = c.topEmotions ?? []
  const mEmotionalMarkers = c.topEmotionalMarkers ?? c.topTriggers ?? []
  const mRealTriggers = c.realTriggers ?? []
  const dominantEmotion = mEmotions[0]?.label ?? null
  const topEmotionalMarker = mEmotionalMarkers[0]?.tag ?? null

  const eByDay = c.energyByDay ?? []
  const aByDay = c.anxietyByDay ?? []
  const dayLabelsM = buildDayLabels(report.period_start, report.period_end)
  const chartDataM = mergeDaySeries(eByDay, aByDay, dayLabelsM)
  const bestEnergyM = pickDay(eByDay, 'max')
  const lowAnxM = pickDay(aByDay, 'min')

  const MICRO_INSIGHTS = [
    { icon: <Heart className="w-3.5 h-3.5" />, text: 'Registrar é se ouvir' },
    { icon: <Smile className="w-3.5 h-3.5" />, text: 'Compreender é criar escolhas' },
    { icon: <Sprout className="w-3.5 h-3.5" />, text: 'Pequenas ações geram mudança' },
    { icon: <Star className="w-3.5 h-3.5" />, text: 'Você não precisa fazer tudo hoje' },
  ]

  return (
    <div className="space-y-5">
      {/* ── 1. Hero "Seu mês em perspectiva" ── */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-paper-soft">
        <div className="relative z-10 p-5 sm:p-6 sm:max-w-[72%]">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-600"><Sprout className="w-5 h-5" /></span>
            <h3 className="font-serif text-xl text-forest-900">Seu mês em perspectiva</h3>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed">{c.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 px-5 sm:px-6 pb-5">
          {MICRO_INSIGHTS.map((mi, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs text-forest-700 bg-white/80 border border-line rounded-full px-3 py-1.5">
              {mi.icon} {mi.text}
            </span>
          ))}
        </div>
        <MonthlyHeroDecoration />
      </div>

      {/* ── 2. Grade de métricas (8 cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <MetricTile icon={<BarChart2 className="w-4 h-4" />} label="Registros analisados" value={totalRecords} sub="Total do mês" />
        <MetricTile icon={<Calendar className="w-4 h-4" />} label="Check-ins" value={c.checkinCount ?? 0} sub="Dias registrados" />
        <MetricTile icon={<BookOpen className="w-4 h-4" />} label="Diários" value={c.diaryCount ?? 0} sub="Registros" />
        <MetricTile icon={<Zap className="w-4 h-4" />} label="Energia média" value={c.avgEnergy ? `${c.avgEnergy}` : '—'} unit={c.avgEnergy ? '/5' : ''} sub="Média do mês" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <MetricTile icon={<Activity className="w-4 h-4" />} label="Ansiedade percebida" value={c.avgAnxiety ? `${c.avgAnxiety}` : '—'} unit={c.avgAnxiety ? '/5' : ''} sub="Média do mês" accent="coral" />
        <MetricTile icon={<Smile className="w-4 h-4" />} label="Emoção predominante" value={dominantEmotion ?? '—'} sub="Mais frequente" />
        <MetricTile icon={<AlertCircle className="w-4 h-4" />} label="Marcador emocional" value={topEmotionalMarker ?? '—'} sub="Principal sinal" accent="coral" />
        <MetricTile icon={<TrendingUp className="w-4 h-4" />} label="Dias observados" value={c.energyByDay?.length ?? 0} sub="Com indicadores" />
      </div>

      {/* ── Aviso de poucos dados ── */}
      {!c.hasEnoughData && (
        <div className="flex items-start gap-3 bg-coral/30 border border-coral/60 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-[#c2673f] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#9a3b26]">Relatório com poucos registros</p>
            <p className="text-sm text-stone-700 leading-relaxed mt-1">Este relatório foi gerado com poucos registros no período. Por isso, algumas análises aparecem como iniciais ou indisponíveis. Continue registrando check-ins e diários para que os próximos relatórios tragam insights mais precisos.</p>
          </div>
        </div>
      )}

      {/* ── 3. Seção "Análises do mês" ── */}
      <div>
        <h3 className="font-serif text-xl text-forest-900 flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600"><TrendingUp className="w-4 h-4" /></span>
          Análises do mês
        </h3>

        <div className="space-y-3">
          {/* Gráfico energia × ansiedade */}
          <EnergyAnxietyPanel data={chartDataM} bestEnergy={bestEnergyM} lowAnx={lowAnxM} labels={dayLabelsM} title="Energia e ansiedade ao longo do mês" />

          {/* Emoções + marcadores emocionais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <EmotionDonut emotions={mEmotions} />
            <TriggerRanking triggers={mEmotionalMarkers} />
          </div>

          {/* Contextos e necessidades mais recorrentes (§14.2) */}
          {((c.topContexts?.length ?? 0) > 0 || (c.topNeeds?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <TriggerRanking triggers={c.topContexts ?? []} title="Contextos mais recorrentes" emptyText="Ainda não há contextos marcados neste mês." />
              <TriggerRanking triggers={c.topNeeds ?? []} title="Necessidades emocionais mais presentes" emptyText="Ainda não há necessidades marcadas neste mês." />
            </div>
          )}

          {mRealTriggers.length > 0 && (
            <TriggerRanking triggers={mRealTriggers} title="Gatilhos reais mais citados" emptyText="Ainda não há gatilhos reais registrados neste mês." />
          )}

          {/* Dias de maior atenção */}
          <div className="bg-paper-soft border border-line rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-full bg-coral/50 flex items-center justify-center text-[#c2673f]"><AlertCircle className="w-4 h-4" /></span>
              <div>
                <h4 className="text-sm font-semibold text-forest-900">Dias de maior atenção</h4>
                <p className="text-xs text-ink-soft">Os dias abaixo tiveram mais registros de ansiedade ou energia muito baixa.</p>
              </div>
            </div>
            {c.attentionDays.length > 0 ? (
              <div className="space-y-2">
                {c.attentionDays.slice(0, 5).map((d, i) => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-coral/40 text-[#9a3b26] text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-stone-700"><strong className="text-forest-900">Dia {d.day}</strong> — {d.reason}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft bg-mint/30 border border-line rounded-lg px-3 py-2.5">Não houve dias com sinais fortes de atenção neste período.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Seção "Interpretações e insights" ── */}
      <div>
        <h3 className="font-serif text-xl text-forest-900 flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600"><FileText className="w-4 h-4" /></span>
          Interpretações e insights
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Resumo geral do mês */}
          <InsightCard icon={<Sprout className="w-4 h-4" />} title="Resumo geral do mês">
            <p className="text-sm text-stone-700 leading-relaxed">{c.summary}</p>
            {c.energyAnxietySleep && <p className="text-sm text-stone-600 leading-relaxed mt-2">{c.energyAnxietySleep}</p>}
          </InsightCard>

          {/* Principais padrões emocionais */}
          <InsightCard icon={<BarChart2 className="w-4 h-4" />} title="Principais padrões emocionais">
            <p className="text-sm text-stone-700 leading-relaxed mb-2">{c.predominantEmotions}</p>
            {c.patterns.length > 0 && (
              <ul className="space-y-1.5">{c.patterns.map((p, i) => <li key={i} className="text-sm text-stone-600 flex gap-2"><span className="text-forest-400 mt-0.5">•</span>{p}</li>)}</ul>
            )}
          </InsightCard>

          {/* Relações percebidas */}
          <InsightCard icon={<Activity className="w-4 h-4" />} title="Relações percebidas">
            {(c.relations?.length ?? 0) > 0 ? (
              <ul className="space-y-1.5">{c.relations.map((r, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-forest-400 mt-0.5">•</span>{r}</li>)}</ul>
            ) : (
              <p className="text-sm text-ink-soft">Ainda não há dados suficientes para identificar relações claras entre seus registros.</p>
            )}
          </InsightCard>

          {/* Momentos de melhora */}
          <InsightCard icon={<Heart className="w-4 h-4" />} title="Momentos de melhora">
            <p className="text-sm text-stone-700 leading-relaxed">{c.improvementMoments || 'Continue registrando para que seus momentos de melhora fiquem mais visíveis.'}</p>
          </InsightCard>

          {/* Comparação com o mês anterior (span full) */}
          <div className="lg:col-span-2 bg-paper-soft border border-line rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600"><TrendingUp className="w-4 h-4" /></span>
              <h4 className="text-sm font-semibold text-forest-900">Comparação com o mês anterior</h4>
            </div>
            {c.monthlyComparison.length > 0 ? (
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <ul className="flex-1 space-y-1.5">{c.monthlyComparison.map((l, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><ArrowRight className="w-3.5 h-3.5 text-forest-400 mt-0.5 flex-shrink-0" />{l}</li>)}</ul>
                <MonthlyDeltas avgEnergy={c.avgEnergy} avgAnxiety={c.avgAnxiety} />
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Ainda não há um mês anterior suficiente para comparação. No próximo ciclo, esta seção trará a evolução entre os meses.</p>
            )}
          </div>
        </div>
      </div>

      {/* Como o mês se desenhou (narrativa) */}
      {(c.narrative?.length ?? 0) > 0 && (
        <div className="bg-paper-soft border border-line rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600"><Calendar className="w-4 h-4" /></span>
            <h4 className="text-sm font-semibold text-forest-900">Como o mês se desenhou</h4>
          </div>
          <div className="space-y-3">{c.narrative.map((n, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-xs font-semibold text-forest-700 bg-mint rounded-lg px-2 py-1 flex-shrink-0 mt-0.5">{n.phase}</span>
              <span className="text-sm text-stone-700 leading-relaxed">{n.text}</span>
            </div>
          ))}</div>
        </div>
      )}

      {/* ── 5. Reflexões do período ── */}
      <div>
        <h3 className="font-serif text-xl text-forest-900 flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600"><BookOpen className="w-4 h-4" /></span>
          Perguntas para refletir
        </h3>
        <div className="bg-paper-soft border border-line rounded-2xl p-5">
            <h4 className="text-sm font-semibold text-forest-900 mb-4">Leve estas perguntas no seu tempo</h4>
            {c.reflectionQuestions.length > 0 ? (
              <ul className="space-y-3">{c.reflectionQuestions.map((q, i) => (
                <li key={i} className="text-sm text-stone-700 flex gap-2.5 leading-relaxed">
                  <span className="text-forest-500 mt-0.5 flex-shrink-0">•</span>{q}
                </li>
              ))}</ul>
            ) : (
              <p className="text-sm text-ink-soft">Perguntas de reflexão ficarão disponíveis quando houver mais registros no período.</p>
            )}
            {!forPdf && (
              <button onClick={onNavigateDiary} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-xl hover:bg-mint/50"><BookOpen className="w-4 h-4" /> Responder no diário</button>
            )}
        </div>
      </div>

      {/* Conteúdos recomendados */}
      {!forPdf && recs.length > 0 && (
        <div className="bg-paper-soft border border-line rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-forest-900 mb-3">Conteúdos guiados recomendados</h4>
          <div className="space-y-2">{recs.map(rc => <RecCard key={rc.id} rc={rc} onOpen={() => rc.slug && onOpenArticle ? onOpenArticle(rc.slug) : onNavigateDiary()} />)}</div>
        </div>
      )}

      {/* Pontes curtas: o plano e a orientação vivem em seus próprios recursos. */}
      <div className="bg-paper-soft border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-8 h-8 rounded-full bg-forest-900 flex items-center justify-center text-white"><MessageCircle className="w-4 h-4" /></span>
          <h3 className="font-serif text-lg text-forest-900">Continue a partir daqui</h3>
        </div>
        <div className="bg-mint/40 border border-forest-100 rounded-xl p-4">
          <p className="text-sm text-forest-800 leading-relaxed">Este relatório olha para o mês que passou. O Plano de Autocuidado transforma essa leitura em pequenos passos para o próximo ciclo; a Orientação Mensal acolhe uma pergunta específica que você queira explorar.</p>
        </div>
        {!forPdf && <div className="mt-3 flex flex-wrap gap-2">
          {onNavigateSelfCare && <button onClick={onNavigateSelfCare} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 border border-forest-200 px-3 py-2 rounded-xl hover:bg-mint/50"><Sprout className="w-4 h-4" /> Abrir plano de autocuidado</button>}
          <button onClick={onNavigateGuidance} className="inline-flex items-center gap-1.5 text-sm font-medium bg-forest-900 hover:bg-forest-800 text-white px-4 py-2 rounded-xl"><MessageCircle className="w-4 h-4" /> Pedir orientação mensal</button>
        </div>}
      </div>

      {/* ── 7. Disclaimer ── */}
      <div className="flex items-start gap-2.5 text-xs text-ink-soft bg-paper-soft border border-line rounded-2xl px-4 py-3">
        <Lock className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" />
        <span>{DISCLAIMER}</span>
      </div>
    </div>
  )
}

function MonthlyHeroDecoration() {
  return (
    <svg className="hidden sm:block absolute right-0 top-0 h-full w-64 pointer-events-none" viewBox="0 0 260 160" fill="none" aria-hidden="true">
      <circle cx="200" cy="35" r="20" fill="#F3C6A8" opacity="0.7" />
      <path d="M80 160 Q130 90 180 120 T260 100 V160 Z" fill="#E8F0EB" />
      <path d="M150 160 Q200 80 260 110 V160 Z" fill="#DDE9E0" />
      <path d="M220 160 C220 120 240 100 260 95 V160 Z" fill="#8FB5A1" opacity="0.85" />
      <path d="M210 155 C202 135 208 118 220 110 C225 125 223 145 210 155 Z" fill="#5c8a72" />
      <path d="M235 158 C230 145 232 132 240 126 C243 136 242 150 235 158 Z" fill="#5c8a72" opacity="0.6" />
    </svg>
  )
}

function MonthlyDeltas({ avgEnergy, avgAnxiety }: { avgEnergy: number; avgAnxiety: number }) {
  if (!avgEnergy && !avgAnxiety) return null
  return (
    <div className="flex flex-row lg:flex-col gap-3 flex-shrink-0">
      {avgEnergy > 0 && (
        <div className="bg-white border border-line rounded-xl p-3 text-center min-w-[7rem]">
          <p className="text-[11px] text-ink-soft">Energia</p>
          <p className="font-serif text-lg text-forest-700">{avgEnergy.toFixed(1)}</p>
        </div>
      )}
      {avgAnxiety > 0 && (
        <div className="bg-white border border-line rounded-xl p-3 text-center min-w-[7rem]">
          <p className="text-[11px] text-ink-soft">Ansiedade</p>
          <p className="font-serif text-lg text-[#c2673f]">{avgAnxiety.toFixed(1)}</p>
        </div>
      )}
    </div>
  )
}

function RecCard({ rc, onOpen }: { rc: RecommendedContent; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="w-full text-left flex items-center gap-3 bg-white border border-line rounded-xl p-3 hover:border-forest-200 hover:shadow-sm transition-all">
      <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><BookOpen className="w-4 h-4" /></span>
      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-forest-900 leading-snug line-clamp-2">{rc.title}</p>
        <p className="text-[11px] text-ink-soft flex items-center gap-2 mt-0.5"><span className="bg-mint text-forest-700 px-1.5 py-0.5 rounded-full">{rc.category}</span>{rc.readTime != null && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {rc.readTime} min</span>}</p></div>
      <span className="text-xs font-medium text-forest-700 flex items-center gap-1 flex-shrink-0">Abrir <ArrowRight className="w-3.5 h-3.5" /></span>
    </button>
  )
}

// Prévia "em construção" — apenas um FRAGMENTO (teaser). A análise completa
// (padrões, relações, gráficos, plano, síntese) só é liberada quando o ciclo
// fecha e o relatório fica disponível (domingo / dia 1º).
function BuildingPreview({ type, period, content, onRefresh }: {
  type: 'weekly' | 'monthly'; period: Period; content: WeeklyContent | MonthlyContent; onRefresh: () => void
}) {
  const emotions = content.topEmotions
  const topTrig = type === 'monthly'
    ? ((content as MonthlyContent).topEmotionalMarkers?.[0]?.tag ?? (content as MonthlyContent).topTriggers?.[0]?.tag)
    : ((content as WeeklyContent).emotionalMarkers?.[0]?.tag ?? (content as WeeklyContent).triggers?.[0]?.tag)
  const unlockWhen = formatDateBR(period.availableAt)
  return (
    <div className="rounded-2xl border border-forest-200 bg-mint/20 p-5">
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw className="w-4 h-4 text-forest-600" />
        <h3 className="text-sm font-semibold text-forest-900">{type === 'weekly' ? 'Relatório semanal em construção' : 'Relatório mensal em construção'}</h3>
      </div>
      <p className="text-xs text-ink-soft mb-1">{type === 'weekly' ? `Semana de ${formatPeriodShort(period)}` : `${monthTitle(period.start)} · ${formatPeriodShort(period)}`}</p>
      <p className="text-[11px] text-ink-soft mb-3">Fecha em <strong className="text-forest-700">{formatDateBR(period.end)}</strong> · disponível em <strong className="text-forest-700">{unlockWhen}</strong></p>

      {/* Fragmento: só um panorama parcial em números */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatPill label="Check-ins" value={content.checkinCount ?? 0} />
        <StatPill label="Diários" value={content.diaryCount ?? 0} />
        <StatPill label="Energia" value={content.avgEnergy || '—'} unit={content.avgEnergy ? '/5' : ''} />
        <StatPill label="Ansiedade" value={content.avgAnxiety || '—'} unit={content.avgAnxiety ? '/5' : ''} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-forest-800">
        {emotions.length > 0 && <span><span className="text-ink-soft">Emoção mais frequente:</span> {MOOD_EMOJI[emotions[0].label] ?? ''} {emotions[0].label}</span>}
        {topTrig && <span><span className="text-ink-soft">Marcador emocional:</span> {topTrig}</span>}
      </div>

      <p className="text-xs text-ink-soft leading-relaxed bg-white/60 rounded-lg px-3 py-2 mt-4">
        Esta é apenas uma prévia. O relatório completo — com padrões, análise, gráficos e recomendações — fica disponível em <strong className="text-forest-700">{unlockWhen}</strong>, quando o ciclo fecha.
      </p>
      <button onClick={onRefresh} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-xl hover:bg-white/60">
        <RefreshCw className="w-3.5 h-3.5" /> Atualizar prévia
      </button>
    </div>
  )
}

// Estado do modal visualizador de relatório (fechado = ver conteúdo salvo;
// preview = ver a prévia "em construção" do ciclo atual).
type ViewerState =
  | { kind: 'report'; report: StoredReport }
  | { kind: 'preview'; type: 'weekly' | 'monthly'; period: Period; content: WeeklyContent | MonthlyContent }
  | null

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MyReportPage({ user, profile, onBack: _onBack, onNavigatePricing, onNavigateDiary, onNavigateGuidance, onNavigateSelfCare, onOpenArticle }: Props) {
  const plan: Plan = profile?.plan ?? 'free'
  const planKey = normalizePlan(plan)
  const isEssential = hasPlanAccess(plan, 'essential')
  const isPlus = hasPlanAccess(plan, 'plus')

  const [entries, setEntries] = useState<DiaryRowLite[]>([])
  const [activation, setActivation] = useState<string | null>(null)
  const [lastWeekly, setLastWeekly] = useState<StoredReport | null>(null)
  const [lastMonthly, setLastMonthly] = useState<StoredReport | null>(null)
  const [history, setHistory] = useState<StoredReport[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pdfBusy, setPdfBusy] = useState(false)
  // ── Estados de UI (apenas visuais) ──
  const [viewer, setViewer] = useState<ViewerState>(null)
  const [essTab, setEssTab] = useState<'atual' | 'anteriores'>('anteriores')
  const [essPeriod, setEssPeriod] = useState('all')
  const [essVisible, setEssVisible] = useState(5)
  const [showHowto, setShowHowto] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'weekly' | 'monthly'>('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [plusVisible, setPlusVisible] = useState(5)

  const handlePdf = useCallback(async (r: StoredReport) => {
    setPdfBusy(true)
    try { await exportReportPdf(r, planKey, `relatorio-${r.report_type}-${r.period_start}.pdf`) } catch { /* noop */ }
    setPdfBusy(false)
  }, [planKey])

  const load = useCallback(async () => {
    if (!user || !isEssential) { setLoading(false); return }
    setLoading(true)
    // 1) Ativação do plano (para cortar o 1º ciclo)
    const [{ data: prof }, { data: sub }] = await Promise.all([
      supabase.from('profiles').select('plan_activated_at, created_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_subscriptions').select('subscription_created_at').eq('user_id', user.id).maybeSingle(),
    ])
    const act = resolveReportActivation({
      planActivatedAt: (prof as { plan_activated_at?: string } | null)?.plan_activated_at,
      subscriptionCreatedAt: (sub as { subscription_created_at?: string } | null)?.subscription_created_at,
      profileCreatedAt: (prof as { created_at?: string } | null)?.created_at,
    })
    setActivation(act)

    // 2) Registros — janela ampla (cobre semana/mês atuais e anteriores + comparação)
    const since = new Date(); since.setDate(since.getDate() - 100)
    const { data } = await supabase.from('diary_entries').select('*').eq('user_id', user.id).gte('created_at', since.toISOString())
    const all = (data ?? []) as DiaryRowLite[]
    setEntries(all)

    // 3) Relatórios fechados são produzidos pela automação no servidor. A tela
    // apenas lê o conteúdo persistido: abrir esta página jamais cria, altera ou
    // regenera um relatório histórico.
    const now = new Date()
    const lastW = getPreviousWeeklyPeriod(act, now)
    if (lastW) {
      const saved = await loadReportHistory(user.id, 'weekly')
      setLastWeekly(saved.find(r => r.period_start === lastW.start && r.period_end === lastW.end) ?? null)
    } else setLastWeekly(null)

    if (isPlus) {
      const lastM = getPreviousMonthlyPeriod(act, now)
      if (lastM) {
        const saved = await loadReportHistory(user.id, 'monthly')
        setLastMonthly(saved.find(r => r.period_start === lastM.start && r.period_end === lastM.end) ?? null)
      } else setLastMonthly(null)
    }

    setHistory(await loadReportHistory(user.id))
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isEssential, isPlus, planKey, refreshKey])

  useEffect(() => { void load() }, [load])

  // Prévias "em construção" (ao vivo, não salvas)
  const now = new Date()
  const curWeek = getCurrentWeeklyPeriod(activation, now)
  const curMonth = getCurrentMonthlyPeriod(activation, now)
  const weeklyPreview: WeeklyContent = useMemo(() => {
    const e = entries.filter(x => inPeriod(x, curWeek))
    const p = entries.filter(x => inPeriod(x, prevRange(curWeek)))
    return buildWeeklyContent(computeEmotionalAnalysis(e, p))
  }, [entries, curWeek])
  const monthlyPreview: MonthlyContent = useMemo(() => {
    const e = entries.filter(x => inPeriod(x, curMonth))
    const p = entries.filter(x => inPeriod(x, prevRange(curMonth)))
    return buildMonthlyContent(computeEmotionalAnalysis(e, p), monthTitle(curMonth.start))
  }, [entries, curMonth])

  const navProps = { onOpenArticle, onNavigateDiary, onNavigateSelfCare, onNavigateGuidance }
  const weeklyReports = history.filter(r => r.report_type === 'weekly')
  const monthlyReports = history.filter(r => r.report_type === 'monthly')

  const openReport = (report: StoredReport) => setViewer({ kind: 'report', report })
  const openWeeklyPreview = () => setViewer({ kind: 'preview', type: 'weekly', period: curWeek, content: weeklyPreview })
  const openMonthlyPreview = () => setViewer({ kind: 'preview', type: 'monthly', period: curMonth, content: monthlyPreview })

  if (loading) return <div className="flex justify-center items-center py-24"><Loader2 className="w-6 h-6 text-forest-400 animate-spin" /></div>

  // ── Gratuito ──
  if (!isEssential) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <header className="mb-6">
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">Relatórios <BarChart2 className="w-6 h-6 text-forest-400" /></h1>
          <p className="mt-2 text-ink-soft">Seus check-ins ajudam a formar seu histórico emocional. No Essencial, você desbloqueia relatórios semanais automáticos com padrões, gráficos e recomendações guiadas.</p>
        </header>
        <div className="rounded-3xl bg-forest-900 text-white px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <span className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0"><TrendingUp className="w-5 h-5" /></span>
          <p className="flex-1 text-sm leading-relaxed text-forest-50">Continue registrando no diário. Ao assinar o Essencial, você recebe relatórios semanais fechados aos domingos, com resumo, emoções, energia, ansiedade e conteúdos recomendados.</p>
          <button onClick={onNavigatePricing} className="inline-flex items-center gap-2 bg-white text-forest-900 hover:bg-mint text-sm font-medium px-5 py-2.5 rounded-2xl whitespace-nowrap">Conhecer o Essencial</button>
        </div>
        <div className="space-y-4">
          <LockedSection title="Relatório semanal automático" description="Resumo da semana com emoções, marcadores emocionais, energia, ansiedade e conteúdos recomendados. Disponível no plano Essencial." onUpgrade={onNavigatePricing} />
          <LockedSection title="Relatório mensal aprofundado" description="Leitura retrospectiva do mês com padrões emocionais, evolução, contextos, necessidades, sinais de melhora, dias de atenção e perguntas de reflexão. Disponível no Plus." onUpgrade={onNavigatePricing} />
        </div>
        <button onClick={onNavigateDiary} className="mt-6 inline-flex items-center gap-1.5 text-sm text-forest-700 font-medium hover:text-forest-900"><BookOpen className="w-4 h-4" /> Abrir meu diário</button>
      </div>
    )
  }

  const viewerModal = viewer && (
    <ReportViewerModal viewer={viewer} plan={planKey} onClose={() => setViewer(null)}
      onPdf={handlePdf} pdfBusy={pdfBusy} onRefresh={() => setRefreshKey(k => k + 1)} nav={navProps} />
  )

  // ══════════════════════════ PLANO PLUS ══════════════════════════
  if (isPlus) {
    const weeklyStatus = lastWeekly
      ? { label: 'Relatório mais recente', value: `${perShort(lastWeekly)} · Gerado em ${genDate(lastWeekly)}` }
      : { label: 'Sem relatório disponível ainda', value: `Disponível em ${formatDateBR(curWeek.availableAt)}` }
    const monthlyStatus = lastMonthly
      ? { label: 'Relatório mais recente', value: `${cap(monthTitle(lastMonthly.period_start))} · Gerado em ${genDate(lastMonthly)}` }
      : { label: 'Sem relatório disponível ainda', value: `Disponível em ${formatDateBR(curMonth.availableAt)}` }

    const periodOptions = [...new Set(history.map(r => r.period_start.slice(0, 7)))].sort().reverse()
    const plusRows = history.filter(r => {
      if (typeFilter !== 'all' && r.report_type !== typeFilter) return false
      if (periodFilter !== 'all' && r.period_start.slice(0, 7) !== periodFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!`${r.title} ${r.summary} ${perShort(r)}`.toLowerCase().includes(q)) return false
      }
      return true
    })

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">Relatórios <BarChart2 className="w-6 h-6 text-forest-400" /></h1>
            <p className="mt-2 text-ink-soft max-w-2xl">Acompanhe sua evolução com relatórios semanais e mensais completos, com análises e recomendações personalizadas.</p>
          </div>
          <button onClick={() => setShowHowto(o => !o)} className="inline-flex items-center gap-2 text-sm text-forest-800 border border-line bg-paper-soft px-4 py-2 rounded-xl hover:border-forest-300 whitespace-nowrap flex-shrink-0">
            <Info className="w-4 h-4 text-forest-500" /> Como funcionam os relatórios
          </button>
        </header>

        {showHowto && <HowtoPanel isPlus />}

        {/* Cards principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <SummaryCard accent="forest" icon={<Calendar className="w-6 h-6" />} title="Relatório semanal"
            desc="Visão contínua da sua semana com check-ins e diário, gráficos e recomendações."
            statusLabel={weeklyStatus.label} statusValue={weeklyStatus.value}
            primary={lastWeekly ? { label: 'Ver relatório', onClick: () => openReport(lastWeekly) } : { label: 'Ver próximo relatório', onClick: openWeeklyPreview }}
            secondary={lastWeekly ? { label: 'PDF', onClick: () => handlePdf(lastWeekly), busy: pdfBusy } : undefined} />
          <SummaryCard accent="plus" icon={<BarChart2 className="w-6 h-6" />} title="Relatório mensal aprofundado"
            desc="Análise completa do mês com padrões, evolução e orientações para o próximo ciclo."
            statusLabel={monthlyStatus.label} statusValue={monthlyStatus.value}
            primary={lastMonthly ? { label: 'Ver relatório', onClick: () => openReport(lastMonthly) } : { label: 'Ver próximo relatório', onClick: openMonthlyPreview }}
            secondary={lastMonthly ? { label: 'PDF', onClick: () => handlePdf(lastMonthly), busy: pdfBusy } : undefined} />
        </div>

        {/* Relatórios disponíveis */}
        <section className="mb-8 space-y-5">
          <h2 className="font-serif text-2xl text-forest-900">Relatórios disponíveis</h2>

          {/* Semanais */}
          <div className="bg-paper-soft border border-line rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-forest-900">Semanais <span className="text-ink-soft font-normal">(semanas completas)</span></p>
              {weeklyReports.length > 0 && <button onClick={() => setTypeFilter('weekly')} className="text-xs text-forest-700 font-medium inline-flex items-center gap-0.5 hover:text-forest-900">Ver todos <ChevronRight className="w-3.5 h-3.5" /></button>}
            </div>
            <p className="text-xs text-ink-soft mb-3">Relatórios gerados a cada ciclo semanal.</p>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {weeklyReports.slice(0, 8).map(r => (
                <MiniReportCard key={r.id} accent="forest" title={perShort(r)} subtitle={`Gerado em ${genDate(r)}`}
                  onView={() => openReport(r)} onPdf={() => handlePdf(r)} pdfBusy={pdfBusy} />
              ))}
              <MiniReportCard accent="forest" locked title={formatPeriodShort(curWeek)} lockedLabel="Em andamento" onView={openWeeklyPreview} />
              {weeklyReports.length === 0 && <p className="text-sm text-ink-soft py-4">Seu primeiro relatório semanal ficará disponível no próximo domingo.</p>}
            </div>
          </div>

          {/* Mensais aprofundados */}
          <div className="bg-paper-soft border border-line rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-forest-900 flex items-center gap-2">Mensais aprofundados <span className="text-[10px] bg-coral text-[#9a3b26] px-2 py-0.5 rounded-full font-medium">Plus</span></p>
              {monthlyReports.length > 0 && <button onClick={() => setTypeFilter('monthly')} className="text-xs text-forest-700 font-medium inline-flex items-center gap-0.5 hover:text-forest-900">Ver todos <ChevronRight className="w-3.5 h-3.5" /></button>}
            </div>
            <p className="text-xs text-ink-soft mb-3">Análise completa gerada a cada ciclo mensal.</p>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {monthlyReports.slice(0, 8).map(r => (
                <MiniReportCard key={r.id} accent="plus" title={cap(monthTitle(r.period_start))} subtitle={`Gerado em ${genDate(r)}`} badge="Plus"
                  onView={() => openReport(r)} onPdf={() => handlePdf(r)} pdfBusy={pdfBusy} />
              ))}
              <MiniReportCard accent="plus" locked title={cap(monthTitle(curMonth.start))} lockedLabel="Em andamento" onView={openMonthlyPreview} />
              {monthlyReports.length === 0 && <p className="text-sm text-ink-soft py-4">Seu primeiro relatório mensal ficará disponível no dia 1º do próximo mês.</p>}
            </div>
          </div>
        </section>

        {/* Comentário profissional sobre o relatório (Plus) */}
        <div className="mb-8">
          <ProfessionalComment userId={user!.id} selectedMonth={lastMonthly?.period_start?.slice(0, 7) ?? ymd(now).slice(0, 7)} onNavigateDiary={onNavigateDiary} />
        </div>

        {/* Histórico de relatórios (unificado) */}
        <section className="bg-paper-soft border border-line rounded-2xl p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-4">
            <div>
              <h2 className="font-serif text-2xl text-forest-900">Histórico de relatórios</h2>
              <p className="text-xs text-ink-soft mt-0.5">Encontre e acesse relatórios anteriores.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <FilterSelect label="Tipo" value={typeFilter} onChange={v => { setTypeFilter(v as typeof typeFilter); setPlusVisible(5) }}
                options={[['all', 'Todos'], ['weekly', 'Semanal'], ['monthly', 'Mensal aprofundado']]} />
              <FilterSelect label="Período" value={periodFilter} onChange={v => { setPeriodFilter(v); setPlusVisible(5) }}
                options={[['all', 'Todos os períodos'], ...periodOptions.map(p => [p, cap(monthTitle(p + '-01'))] as [string, string])]} />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPlusVisible(5) }} placeholder="Buscar relatórios…"
                  className="w-full sm:w-56 pl-9 pr-3 py-2 border border-line rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-300" />
              </div>
            </div>
          </div>

          {plusRows.length === 0 ? (
            <EmptyState onNavigateDiary={onNavigateDiary} />
          ) : (
            <>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft border-b border-line">
                      <th className="py-2.5 pr-3 font-medium">Tipo</th>
                      <th className="py-2.5 pr-3 font-medium">Período</th>
                      <th className="py-2.5 pr-3 font-medium hidden md:table-cell">Gerado em</th>
                      <th className="py-2.5 pr-3 font-medium hidden lg:table-cell">Resumo</th>
                      <th className="py-2.5 pl-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plusRows.slice(0, plusVisible).map(r => (
                      <tr key={r.id} className="border-b border-line/70 last:border-0">
                        <td className="py-3 pr-3 align-middle"><TypePill type={r.report_type} /></td>
                        <td className="py-3 pr-3 align-middle">
                          <p className="text-forest-900 font-medium">{r.report_type === 'monthly' ? cap(monthTitle(r.period_start)) : perShort(r)}</p>
                          <p className="text-[11px] text-ink-soft md:hidden">Gerado em {genDate(r)}</p>
                        </td>
                        <td className="py-3 pr-3 align-middle text-ink-soft hidden md:table-cell">{genDate(r)}</td>
                        <td className="py-3 pr-3 align-middle text-ink-soft hidden lg:table-cell">{rowSummary(r)}</td>
                        <td className="py-3 pl-3 align-middle"><RowActions report={r} onView={() => openReport(r)} onPdf={() => handlePdf(r)} pdfBusy={pdfBusy} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-center gap-2 pt-4">
                <p className="text-xs text-ink-soft">Mostrando {Math.min(plusVisible, plusRows.length)} de {plusRows.length} relatórios</p>
                {plusVisible < plusRows.length && (
                  <button onClick={() => setPlusVisible(v => v + 5)} className="inline-flex items-center gap-1.5 text-sm text-forest-800 border border-line px-4 py-2 rounded-xl hover:bg-mint/40">
                    <ChevronDown className="w-4 h-4" /> Ver mais
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <ReportDisclaimer />
        {viewerModal}
      </div>
    )
  }

  // ══════════════════════════ PLANO ESSENCIAL ══════════════════════════
  const essPeriodOptions = [...new Set(weeklyReports.map(r => r.period_start.slice(0, 7)))].sort().reverse()
  const essRows = weeklyReports.filter(r => essPeriod === 'all' || r.period_start.slice(0, 7) === essPeriod)
  const essEnergy = weeklyPreview.avgEnergy
  const essAnx = weeklyPreview.avgAnxiety

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">Relatórios <BarChart2 className="w-6 h-6 text-forest-400" /></h1>
          <p className="mt-2 text-ink-soft max-w-2xl">Acompanhe suas sínteses semanais com base nos seus check-ins e diário.</p>
        </div>
        <div className="flex items-start gap-3 bg-paper-soft border border-line rounded-2xl p-3.5 max-w-xs flex-shrink-0">
          <span className="w-9 h-9 rounded-full bg-mint/60 flex items-center justify-center text-forest-600 flex-shrink-0"><Calendar className="w-4 h-4" /></span>
          <div>
            <p className="text-sm font-semibold text-forest-900 leading-tight">Como funciona o ciclo semanal</p>
            <p className="text-xs text-ink-soft mt-0.5 leading-snug">Relatórios semanais fecham no sábado e ficam disponíveis aos domingos.</p>
          </div>
        </div>
      </header>

      {/* Resumo da semana */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <MetricCard icon={<Heart className="w-5 h-5" />} label="Check-ins nesta semana" value={weeklyPreview.checkinCount ?? 0} sub="de 7 dias" />
        <MetricCard icon={<BookOpen className="w-5 h-5" />} label="Diários" value={weeklyPreview.diaryCount ?? 0} sub="registros" />
        <MetricCard icon={<Zap className="w-5 h-5" />} label="Energia média" value={essEnergy > 0 ? essEnergy : '—'} sub={essEnergy > 0 ? 'de 5' : 'sem dados'} />
        <MetricCard icon={<Activity className="w-5 h-5" />} label="Ansiedade média" value={essAnx > 0 ? essAnx : '—'} sub={essAnx > 0 ? 'de 5' : 'sem dados'} />
      </div>
      <div className="flex items-start gap-2 text-xs text-ink-soft bg-mint/30 border border-line rounded-xl px-3 py-2 mb-8">
        <Info className="w-3.5 h-3.5 text-forest-500 flex-shrink-0 mt-0.5" />
        Complete seus check-ins e registros para que seus relatórios tragam insights mais precisos sobre você.
      </div>

      {/* Relatório semanal atual */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-serif text-2xl text-forest-900">Relatório semanal atual</h2>
        <span className="text-[10px] bg-forest-100 text-forest-800 px-2 py-0.5 rounded-full font-medium">Atual</span>
      </div>
      <div className="bg-paper-soft border border-line rounded-2xl p-5 sm:p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-5">
          {/* Ilustração */}
          <div className="hidden sm:flex w-full lg:w-28 h-28 rounded-2xl bg-gradient-to-br from-mint to-coral/40 items-center justify-center flex-shrink-0">
            <div className="relative"><FileText className="w-10 h-10 text-forest-500" /><Sprout className="w-5 h-5 text-forest-400 absolute -bottom-1 -right-2" /></div>
          </div>
          {/* Conteúdo */}
          <div className="min-w-0">
            <h3 className="font-serif text-xl text-forest-900">Relatório semanal — {formatPeriodShort(curWeek)}</h3>
            <p className="text-sm text-ink-soft mt-0.5">Período em andamento · Fecha em <strong className="text-forest-700">{formatDateBR(curWeek.end)}</strong> (sábado)</p>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">Continue registrando seus check-ins e diários para que seu relatório fique ainda mais completo.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <StatPill label="Check-ins" value={`${weeklyPreview.checkinCount ?? 0}/7`} />
              <StatPill label="Diários" value={weeklyPreview.diaryCount ?? 0} />
              <StatPill label="Energia média" value={essEnergy > 0 ? essEnergy : '—'} unit={essEnergy > 0 ? '/5' : ''} />
              <StatPill label="Ansiedade média" value={essAnx > 0 ? essAnx : '—'} unit={essAnx > 0 ? '/5' : ''} />
            </div>
          </div>
          {/* Dica + ações */}
          <div className="lg:w-64 flex flex-col gap-3 flex-shrink-0">
            <div className="bg-mint/40 border border-forest-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-forest-800 flex items-center gap-1.5 mb-1"><Sprout className="w-3.5 h-3.5" /> Dica para esta semana</p>
              <p className="text-xs text-forest-700/90 leading-snug">Pequenos registros diários geram grandes clarezas. Continue um passo de cada vez.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={openWeeklyPreview} className="inline-flex items-center justify-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl"><BarChart2 className="w-4 h-4" /> Ver relatório</button>
              <button disabled title="O PDF fica disponível quando a semana fechar (domingo)." className="inline-flex items-center justify-center gap-2 border border-line text-ink-soft text-sm font-medium px-4 py-2.5 rounded-xl opacity-60 cursor-not-allowed"><Download className="w-4 h-4" /> Baixar PDF</button>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de relatórios semanais */}
      <section className="bg-paper-soft border border-line rounded-2xl p-5 mb-6">
        <h2 className="font-serif text-2xl text-forest-900 mb-3">Histórico de relatórios semanais</h2>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="inline-flex bg-mint/40 rounded-full p-1 self-start">
            {(['atual', 'anteriores'] as const).map(t => (
              <button key={t} onClick={() => setEssTab(t)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${essTab === t ? 'bg-forest-900 text-white' : 'text-forest-700 hover:text-forest-900'}`}>
                {t === 'atual' ? 'Atual' : 'Anteriores'}
              </button>
            ))}
          </div>
          {essTab === 'anteriores' && (
            <FilterSelect label="Período" value={essPeriod} onChange={v => { setEssPeriod(v); setEssVisible(5) }}
              options={[['all', 'Todos os períodos'], ...essPeriodOptions.map(p => [p, cap(monthTitle(p + '-01'))] as [string, string])]} />
          )}
        </div>

        {essTab === 'atual' ? (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm border-collapse">
              <WeeklyTableHead />
              <tbody>
                <tr className="border-b border-line/70 last:border-0">
                  <td className="py-3 pr-3 align-middle">
                    <p className="text-forest-900 font-medium">{formatPeriodShort(curWeek)}</p>
                    <span className="text-[10px] bg-forest-100 text-forest-800 px-1.5 py-0.5 rounded-full font-medium">Em andamento</span>
                  </td>
                  <td className="py-3 pr-3 align-middle text-ink-soft hidden md:table-cell">Fecha em {formatDateBR(curWeek.end)}</td>
                  <td className="py-3 pr-3 align-middle hidden sm:table-cell">{weeklyPreview.checkinCount ?? 0}/7</td>
                  <td className="py-3 pr-3 align-middle hidden sm:table-cell">{weeklyPreview.diaryCount ?? 0}</td>
                  <td className="py-3 pl-3 align-middle text-right">
                    <button onClick={openWeeklyPreview} className="text-xs font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-lg hover:bg-mint/50 inline-flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" /> Ver relatório</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : essRows.length === 0 ? (
          <EmptyState onNavigateDiary={onNavigateDiary} weekly />
        ) : (
          <>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm border-collapse">
                <WeeklyTableHead />
                <tbody>
                  {essRows.slice(0, essVisible).map(r => {
                    const c = r.content as WeeklyContent
                    return (
                      <tr key={r.id} className="border-b border-line/70 last:border-0">
                        <td className="py-3 pr-3 align-middle">
                          <p className="text-forest-900 font-medium">{perShort(r)}</p>
                          <p className="text-[11px] text-ink-soft">Gerado em {genDate(r)}</p>
                        </td>
                        <td className="py-3 pr-3 align-middle text-ink-soft hidden md:table-cell">{r.summary}</td>
                        <td className="py-3 pr-3 align-middle hidden sm:table-cell">{c.checkinCount ?? 0}</td>
                        <td className="py-3 pr-3 align-middle hidden sm:table-cell">{c.diaryCount ?? 0}</td>
                        <td className="py-3 pl-3 align-middle"><RowActions report={r} onView={() => openReport(r)} onPdf={() => handlePdf(r)} pdfBusy={pdfBusy} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {essVisible < essRows.length && (
              <div className="flex justify-center pt-4">
                <button onClick={() => setEssVisible(v => v + 5)} className="inline-flex items-center gap-1.5 text-sm text-forest-800 border border-line px-4 py-2 rounded-xl hover:bg-mint/40">
                  <ChevronDown className="w-4 h-4" /> Carregar mais relatórios
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <ReportDisclaimer />
      {viewerModal}
    </div>
  )
}

// ─── Helpers de apresentação ──────────────────────────────────────────────────
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const perShort = (r: { period_start: string; period_end: string }) => formatPeriodShort({ start: r.period_start, end: r.period_end })
const genDate = (r: StoredReport) => r.generated_at ? formatDateBR(ymd(new Date(r.generated_at))) : formatDateBR(r.available_at)
function daysInPeriod(start: string, end: string): number {
  return Math.round((parseYmd(end).getTime() - parseYmd(start).getTime()) / 86400000) + 1
}
function rowSummary(r: StoredReport): string {
  if (r.report_type === 'weekly') { const c = r.content as WeeklyContent; return `Check-ins: ${c.checkinCount ?? 0} · Diários: ${c.diaryCount ?? 0}` }
  return `Mês completo · ${daysInPeriod(r.period_start, r.period_end)} dias`
}

function HowtoPanel({ isPlus }: { isPlus: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-soft p-4 sm:p-5 mb-6">
      <p className="text-sm font-semibold text-forest-900 flex items-center gap-1.5 mb-2"><Info className="w-4 h-4 text-forest-500" /> Como funcionam os relatórios</p>
      <ul className="space-y-1 text-sm text-ink-soft">
        <li className="flex gap-2"><span className="text-forest-400 mt-0.5">•</span> Relatórios semanais fecham no sábado e ficam disponíveis aos domingos.</li>
        {isPlus && <li className="flex gap-2"><span className="text-forest-400 mt-0.5">•</span> Relatórios mensais fecham no último dia do mês e ficam disponíveis no primeiro dia do mês seguinte.</li>}
        <li className="flex gap-2"><span className="text-forest-400 mt-0.5">•</span> Seu primeiro relatório considera o período a partir da ativação do plano.</li>
      </ul>
    </div>
  )
}

// Card de métrica (faixa de resumo — Essencial).
function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-soft leading-tight">{label}</p>
        <p className="font-serif text-3xl text-forest-900 leading-none mt-1.5">{value}</p>
        <p className="text-[11px] text-ink-soft mt-1">{sub}</p>
      </div>
      <span className="w-11 h-11 rounded-full bg-mint/60 flex items-center justify-center text-forest-600 flex-shrink-0">{icon}</span>
    </div>
  )
}

// Card principal de resumo (Plus).
function SummaryCard({ accent, icon, title, desc, statusLabel, statusValue, primary, secondary }: {
  accent: 'forest' | 'plus'; icon: React.ReactNode; title: string; desc: string
  statusLabel: string; statusValue: string
  primary: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void; busy?: boolean }
}) {
  const iconCls = accent === 'plus' ? 'bg-coral text-[#9a3b26]' : 'bg-mint text-forest-600'
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-5 sm:p-6 flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-start gap-4">
        <span className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${iconCls}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-xl text-forest-900 leading-tight">{title}</h3>
          <p className="text-sm text-ink-soft mt-1 leading-snug">{desc}</p>
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] bg-mint text-forest-700 px-2 py-0.5 rounded-full font-medium"><Star className="w-3 h-3" /> Incluído no Plus</span>
        </div>
      </div>
      <div className="border-t border-line my-4" />
      <div className="flex items-start gap-2 mb-4">
        <Calendar className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs text-ink-soft">{statusLabel}</p>
          <p className="text-sm text-forest-900 font-medium leading-snug">{statusValue}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <button onClick={primary.onClick} className="inline-flex items-center justify-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl flex-1">
          {primary.label} <ArrowRight className="w-4 h-4" />
        </button>
        {secondary && (
          <button onClick={secondary.onClick} disabled={secondary.busy} className="inline-flex items-center justify-center gap-1.5 border border-line text-forest-800 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-mint/40 disabled:opacity-60">
            {secondary.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {secondary.label}
          </button>
        )}
      </div>
    </div>
  )
}

// Cartão pequeno de relatório disponível (grids Plus).
function MiniReportCard({ accent, title, subtitle, badge, locked, lockedLabel, onView, onPdf, pdfBusy }: {
  accent: 'forest' | 'plus'; title: string; subtitle?: string; badge?: string
  locked?: boolean; lockedLabel?: string; onView: () => void; onPdf?: () => void; pdfBusy?: boolean
}) {
  const ring = accent === 'plus' ? 'border-coral/70' : 'border-line'
  if (locked) {
    return (
      <button onClick={onView} className={`text-left flex-shrink-0 w-40 rounded-xl border border-dashed ${ring} bg-mint/20 p-3 hover:bg-mint/30 transition-colors`}>
        <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-forest-900 truncate">{title}</span><Lock className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" /></div>
        <p className="text-[11px] text-ink-soft">{lockedLabel ?? 'Em andamento'}</p>
      </button>
    )
  }
  return (
    <div className={`flex-shrink-0 w-40 rounded-xl border ${ring} bg-white p-3 hover:shadow-sm transition-shadow`}>
      <button onClick={onView} className="w-full text-left">
        <div className="flex items-center justify-between mb-1 gap-1">
          <span className="text-xs font-semibold text-forest-900 truncate">{title}</span>
          {badge && <span className="text-[9px] bg-coral text-[#9a3b26] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">{badge}</span>}
        </div>
        {subtitle && <p className="text-[11px] text-ink-soft leading-tight">{subtitle}</p>}
      </button>
      {onPdf && (
        <button onClick={onPdf} disabled={pdfBusy} className="mt-2 inline-flex items-center gap-1 text-[11px] text-forest-700 hover:text-forest-900 disabled:opacity-60">
          <FileText className="w-3 h-3" /> PDF
        </button>
      )}
    </div>
  )
}

// Badge de tipo de relatório (histórico Plus).
function TypePill({ type }: { type: 'weekly' | 'monthly' }) {
  return type === 'monthly' ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9a3b26] whitespace-nowrap"><span className="w-6 h-6 rounded-lg bg-coral flex items-center justify-center"><FileText className="w-3.5 h-3.5" /></span><span className="hidden sm:inline">Mensal aprofundado</span><span className="sm:hidden">Mensal</span></span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 whitespace-nowrap"><span className="w-6 h-6 rounded-lg bg-mint flex items-center justify-center"><Calendar className="w-3.5 h-3.5" /></span>Semanal</span>
  )
}

// Ações de linha da tabela (Ver relatório + PDF).
function RowActions({ report, onView, onPdf, pdfBusy }: { report: StoredReport; onView: () => void; onPdf: () => void; pdfBusy: boolean }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button onClick={onPdf} disabled={pdfBusy} title={`Baixar PDF do ${report.title}`} className="inline-flex items-center gap-1 text-xs text-forest-700 border border-line px-2.5 py-1.5 rounded-lg hover:bg-mint/50 disabled:opacity-60"><FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">PDF</span></button>
      <button onClick={onView} className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 border border-forest-200 px-2.5 py-1.5 rounded-lg hover:bg-mint/50 whitespace-nowrap">Ver relatório <ChevronRight className="w-3.5 h-3.5" /></button>
    </div>
  )
}

function WeeklyTableHead() {
  return (
    <thead>
      <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft border-b border-line">
        <th className="py-2.5 pr-3 font-medium">Período</th>
        <th className="py-2.5 pr-3 font-medium hidden md:table-cell">Resumo</th>
        <th className="py-2.5 pr-3 font-medium hidden sm:table-cell">Check-ins</th>
        <th className="py-2.5 pr-3 font-medium hidden sm:table-cell">Diários</th>
        <th className="py-2.5 pl-3 font-medium text-right">Ações</th>
      </tr>
    </thead>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="relative block">
      <span className="absolute left-3 top-1 text-[9px] uppercase tracking-wide text-stone-400">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="appearance-none bg-white border border-line rounded-xl pl-3 pr-8 pt-4 pb-1.5 text-sm text-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-300 min-w-[9rem]">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </label>
  )
}

function EmptyState({ onNavigateDiary, weekly }: { onNavigateDiary: () => void; weekly?: boolean }) {
  return (
    <div className="text-center py-12 px-4">
      <span className="w-12 h-12 rounded-full bg-mint/60 flex items-center justify-center text-forest-500 mx-auto mb-3"><Sprout className="w-6 h-6" /></span>
      <p className="text-sm font-medium text-forest-900">Ainda não há relatórios {weekly ? 'semanais ' : ''}por aqui</p>
      <p className="text-sm text-ink-soft max-w-sm mx-auto mt-1">Continue registrando seus check-ins e diário para que o próximo relatório tenha mais informações.</p>
      <button onClick={onNavigateDiary} className="mt-4 inline-flex items-center gap-1.5 text-sm text-forest-700 font-medium border border-forest-200 px-4 py-2 rounded-xl hover:bg-mint/50"><BookOpen className="w-4 h-4" /> Abrir meu diário</button>
    </div>
  )
}

function ReportDisclaimer() {
  return (
    <div className="flex items-start gap-2 text-xs text-ink-soft bg-paper-soft border border-line rounded-2xl px-4 py-3 mt-2">
      <Lock className="w-3.5 h-3.5 text-forest-500 flex-shrink-0 mt-0.5" />
      <span><strong className="text-forest-800">Seus dados são privados e protegidos.</strong> {DISCLAIMER}</span>
    </div>
  )
}

// Modal visualizador — mostra o relatório fechado (ReportBody) ou a prévia em construção.
function ReportViewerModal({ viewer, plan, onClose, onPdf, pdfBusy, onRefresh, nav }: {
  viewer: Exclude<ViewerState, null>; plan: string; onClose: () => void
  onPdf: (r: StoredReport) => void; pdfBusy: boolean; onRefresh: () => void
  nav: { onOpenArticle?: (slug: string) => void; onNavigateDiary: () => void; onNavigateSelfCare?: () => void; onNavigateGuidance: () => void }
}) {
  const isReport = viewer.kind === 'report'
  const title = isReport ? viewer.report.title : (viewer.type === 'weekly' ? `Relatório semanal — ${formatPeriodShort(viewer.period)}` : `Relatório mensal — ${cap(monthTitle(viewer.period.start))}`)
  const sub = isReport
    ? `Período ${perShort(viewer.report)} · Gerado em ${genDate(viewer.report)}`
    : `Prévia em construção · Fecha em ${formatDateBR(viewer.period.end)}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40" onClick={onClose}>
      <div className="bg-paper-soft rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-line">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg sm:text-xl text-forest-900 leading-tight">{title}</h2>
            <p className="text-xs text-ink-soft mt-0.5">{sub}</p>
          </div>
          {isReport && (
            <button onClick={() => onPdf(viewer.report)} disabled={pdfBusy} className="inline-flex items-center gap-1.5 text-xs text-forest-700 border border-line px-3 py-1.5 rounded-xl hover:bg-mint/50 disabled:opacity-60 flex-shrink-0">
              {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Exportar PDF
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">
          {isReport
            ? <><QuestionnaireReportContext content={viewer.report.content} /><ReportBody report={viewer.report} plan={plan} {...nav} /></>
            : <BuildingPreview type={viewer.type} period={viewer.period} content={viewer.content} onRefresh={onRefresh} />}
        </div>
      </div>
    </div>
  )
}

// Comentário profissional sobre o relatório (Plus) — recurso existente no sistema.
function ProfessionalComment({ userId, selectedMonth, onNavigateDiary }: { userId: string; selectedMonth: string; onNavigateDiary: () => void }) {
  const [comment, setComment] = useState<{ comment_text: string; professional_name: string | null; report_month: string } | null>(null)
  useEffect(() => {
    let active = true
    supabase.from('professional_comments').select('comment_text,comment,report_month,professional_name').eq('user_id', userId).eq('report_month', selectedMonth).maybeSingle()
      .then(({ data }) => { if (!active) return; const d = data as { comment_text?: string; comment?: string; professional_name: string | null; report_month: string } | null; setComment(d ? { comment_text: d.comment_text || d.comment || '', professional_name: d.professional_name, report_month: d.report_month } : null) })
    return () => { active = false }
  }, [userId, selectedMonth])
  return (
    <Section icon={<Star className="w-4 h-4" />} title="Comentário do profissional" badge="Plus">
      {comment ? (
        <div className="space-y-2">
          <p className="text-sm text-forest-700 leading-relaxed whitespace-pre-wrap">{comment.comment_text}</p>
          {comment.professional_name && <p className="text-[10px] text-stone-400">{comment.professional_name}</p>}
          <button onClick={onNavigateDiary} className="flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900 font-medium mt-1"><BookOpen className="w-3.5 h-3.5" /> Responder no diário</button>
        </div>
      ) : (
        <p className="text-sm text-stone-500">Seu comentário profissional sobre o relatório ainda não está disponível. Ele pode considerar os padrões deste relatório.</p>
      )}
    </Section>
  )
}
