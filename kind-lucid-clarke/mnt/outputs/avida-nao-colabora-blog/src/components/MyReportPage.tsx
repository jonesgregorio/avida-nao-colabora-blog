import { useState, useEffect, useMemo, useCallback } from 'react'
import { exportReportPdf } from '../lib/reportPdf'
import { supabase } from '../lib/supabase'
import { Plan } from '../types'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import {
  Lock, TrendingUp, BarChart2, FileText, Star, Loader2, Calendar, BookOpen,
  MessageCircle, Sparkles, Sprout,
  Clock, ArrowRight, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import {
  computeEmotionalAnalysis, MOOD_EMOJI, type DiaryRowLite,
} from '../lib/emotionalAnalytics'
import { recommendGuidedContent, type RecommendedContent } from '../lib/questionnaireResult'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import {
  getCurrentWeeklyPeriod, getPreviousWeeklyPeriod, getCurrentMonthlyPeriod, getPreviousMonthlyPeriod,
  formatPeriodShort, formatDateBR, monthTitle, ymd, type Period,
} from '../lib/reportPeriods'
import {
  ensureClosedReport, loadReportHistory, buildWeeklyContent, buildMonthlyContent,
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
function SelfCareRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-forest-200 pl-3">
      <p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-stone-700 leading-snug">{value}</p>
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
function MiniLine({ title, data, color, yLabels }: { title: string; data: DayPoint[]; color: string; yLabels?: Record<number, string> }) {
  if (!data || data.length < 2) return null
  const gid = 'rg-' + color.replace('#', '')
  return (
    <div>
      <p className="text-[10px] text-ink-soft uppercase tracking-wider mb-1">{title}</p>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
            <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.25} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#8a8a8a' }} axisLine={false} tickLine={false} />
            <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={{ fontSize: 9, fill: '#8a8a8a' }} axisLine={false} tickLine={false} width={20} />
            <Tooltip formatter={(v: number) => [yLabels ? `${v} · ${yLabels[Math.round(v)] ?? ''}` : v, title]} labelFormatter={(l) => `Dia ${l}`} contentStyle={{ borderRadius: 10, border: '1px solid #E6E1D8', fontSize: 11 }} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gid})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
function MiniRankBars({ title, items, color }: { title: string; items: { label: string; count: number }[]; color: string }) {
  if (!items || items.length === 0) return null
  const max = Math.max(...items.map(i => i.count), 1)
  return (
    <div>
      <p className="text-[10px] text-ink-soft uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-1.5">
        {items.map(i => (
          <div key={i.label} className="flex items-center gap-2">
            <span className="text-xs text-ink w-24 flex-shrink-0 truncate">{i.label}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-mint"><div className="h-full rounded-full" style={{ width: `${(i.count / max) * 100}%`, background: color }} /></div>
            <span className="text-[11px] text-ink-soft w-5 text-right">{i.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function SynthCharts({ energyByDay = [], anxietyByDay = [], emotions = [], triggers = [] }: {
  energyByDay?: DayPoint[]; anxietyByDay?: DayPoint[]
  emotions?: { label: string; count: number }[]; triggers?: { tag: string; count: number }[]
}) {
  const hasLine = energyByDay.length > 1 || anxietyByDay.length > 1
  const hasBars = emotions.length > 0 || triggers.length > 0
  if (!hasLine && !hasBars) return null
  return (
    <div>
      <p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-2">Gráficos de síntese</p>
      {hasLine && (
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <MiniLine title="Energia por dia" data={energyByDay} color="#2f9e6f" />
          <MiniLine title="Ansiedade por dia" data={anxietyByDay} color="#d98b3c" />
        </div>
      )}
      {hasBars && (
        <div className="grid sm:grid-cols-2 gap-4">
          <MiniRankBars title="Emoções mais frequentes" items={emotions} color="#2f5d47" />
          <MiniRankBars title="Gatilhos mais citados" items={triggers.map(t => ({ label: t.tag, count: t.count }))} color="#d98b3c" />
        </div>
      )}
    </div>
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
    return (
      <div className="space-y-5">
        {/* Resumo */}
        <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Resumo da semana</p>
          <p className="text-sm text-forest-800 leading-relaxed">{c.summary}</p></div>

        {/* Dados principais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <StatPill label="Emoção + frequente" value={c.dominantEmotion ?? '—'} />
          <StatPill label="Energia média" value={c.avgEnergy || '—'} unit={c.avgEnergy ? '/5' : ''} />
          <StatPill label="Ansiedade média" value={c.avgAnxiety || '—'} unit={c.avgAnxiety ? '/5' : ''} />
          <StatPill label="Check-ins" value={c.checkinCount ?? 0} />
          <StatPill label="Diários" value={c.diaryCount ?? 0} />
          <StatPill label="Gatilho principal" value={c.topTrigger ?? '—'} />
        </div>

        {/* Gráficos de síntese */}
        <SynthCharts energyByDay={c.energyByDay} anxietyByDay={c.anxietyByDay} emotions={c.topEmotions} triggers={c.triggers} />

        {/* Interpretação */}
        <div className="bg-mint/40 border border-forest-100 rounded-xl p-4"><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">O que seus registros parecem indicar</p>
          <p className="text-sm text-forest-800 leading-relaxed">{c.interpretation}</p></div>

        {c.comparison.length > 0 && (
          <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Comparação com a semana anterior</p>
            <ul className="space-y-1">{c.comparison.map((l, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-forest-400">→</span>{l}</li>)}</ul></div>
        )}
        {c.comparison.length === 0 && (
          <p className="text-xs text-ink-soft">Ainda não há uma semana anterior suficiente para comparação.</p>
        )}

        {!forPdf && recs.length > 0 && (
          <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Conteúdos guiados recomendados</p>
            <div className="space-y-2">{recs.map(rc => <RecCard key={rc.id} rc={rc} onOpen={() => rc.slug && onOpenArticle ? onOpenArticle(rc.slug) : onNavigateDiary()} />)}</div></div>
        )}

        <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Próximos passos</p>
          <ul className="grid sm:grid-cols-2 gap-x-3 gap-y-1">{c.nextSteps.map((s, i) => <li key={i} className="text-sm text-stone-600 flex gap-1.5"><span className="text-forest-400">→</span>{s}</li>)}</ul></div>
      </div>
    )
  }

  // Mensal aprofundado
  const c = report.content as MonthlyContent
  return (
    <div className="space-y-5">
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Resumo geral do mês</p><p className="text-sm text-forest-800 leading-relaxed">{c.summary}</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatPill label="Energia" value={c.avgEnergy || '—'} unit={c.avgEnergy ? '/5' : ''} />
        <StatPill label="Ansiedade" value={c.avgAnxiety || '—'} unit={c.avgAnxiety ? '/5' : ''} />
        {c.avgSleep > 0 && <StatPill label="Sono" value={c.avgSleep} unit="/5" />}
        <StatPill label="Registros" value={c.topEmotions.reduce((n, e) => n + e.count, 0)} />
      </div>
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Principais padrões emocionais</p>
        <ul className="space-y-1.5">{c.patterns.map((p, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-forest-400 mt-0.5">•</span>{p}</li>)}</ul></div>
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Emoções predominantes</p>
        {c.topEmotions.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">{c.topEmotions.map(e => <span key={e.label} className="text-xs bg-mint text-forest-700 px-2.5 py-1 rounded-full">{e.emoji} {e.label} ×{e.count}</span>)}</div>}
        <p className="text-sm text-stone-700 leading-relaxed">{c.predominantEmotions}</p></div>
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Energia, ansiedade e descanso</p><p className="text-sm text-stone-700 leading-relaxed">{c.energyAnxietySleep}</p></div>
      <SynthCharts energyByDay={c.energyByDay} anxietyByDay={c.anxietyByDay} emotions={c.topEmotions} triggers={c.topTriggers} />
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Gatilhos mais recorrentes</p><p className="text-sm text-stone-700 leading-relaxed">{c.triggersText}</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Dias de maior atenção</p>
          {c.attentionDays.length > 0 ? <ul className="space-y-1">{c.attentionDays.map(d => <li key={d.day} className="text-sm text-stone-700"><span className="font-semibold text-forest-700">Dia {d.day}</span> — {d.reason}</li>)}</ul> : <p className="text-sm text-stone-400">Sem dias suficientes.</p>}</div>
        <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Momentos de melhora</p><p className="text-sm text-stone-700 leading-relaxed">{c.improvementMoments}</p></div>
      </div>
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Comparação com o mês anterior</p>
        <ul className="space-y-1">{c.monthlyComparison.map((l, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-forest-400">→</span>{l}</li>)}</ul></div>
      {!forPdf && recs.length > 0 && (
        <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Conteúdos guiados recomendados</p>
          <div className="space-y-2">{recs.map(rc => <RecCard key={rc.id} rc={rc} onOpen={() => rc.slug && onOpenArticle ? onOpenArticle(rc.slug) : onNavigateDiary()} />)}</div></div>
      )}
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Plano de autocuidado sugerido</p>
        <div className="space-y-2">
          <SelfCareRow label="Prioridade do mês" value={c.selfCarePlan.priority} />
          <SelfCareRow label="Cuidado principal" value={c.selfCarePlan.mainCare} />
          <SelfCareRow label="Prática recomendada" value={c.selfCarePlan.practice} />
          <SelfCareRow label="Ponto de atenção" value={c.selfCarePlan.attention} />
          <SelfCareRow label="Pequeno compromisso" value={c.selfCarePlan.commitment} />
        </div>
        {!forPdf && onNavigateSelfCare && <button onClick={onNavigateSelfCare} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-xl hover:bg-mint/50"><Sprout className="w-4 h-4" /> Abrir plano de autocuidado</button>}</div>
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Perguntas para reflexão</p>
        <ul className="space-y-1">{c.reflectionQuestions.map((q, i) => <li key={i} className="text-sm text-stone-700 flex gap-2"><span className="text-forest-400">?</span>{q}</li>)}</ul>
        {!forPdf && <button onClick={onNavigateDiary} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-xl hover:bg-mint/50"><BookOpen className="w-4 h-4" /> Responder no diário</button>}</div>
      <div><p className="text-[11px] font-semibold text-forest-700 uppercase tracking-wide mb-1">Síntese para orientação</p>
        <div className="bg-mint/40 border border-forest-100 rounded-xl p-3"><p className="text-sm text-forest-800 leading-relaxed">{c.guidanceSynthesis}</p></div>
        {!forPdf && <button onClick={onNavigateGuidance} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium bg-forest-900 hover:bg-forest-800 text-white px-4 py-2 rounded-xl"><MessageCircle className="w-4 h-4" /> Enviar para orientação por mensagem</button>}</div>
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

// Cartão do "último relatório fechado" com toggle e PDF.
function ClosedReportCard({ report, plan, onPdf, generating, ...nav }: {
  report: StoredReport; plan: string; onPdf: (r: StoredReport) => void; generating: boolean
  onOpenArticle?: (slug: string) => void; onNavigateDiary: () => void; onNavigateSelfCare?: () => void; onNavigateGuidance: () => void
}) {
  // Recolhido por padrão — só expande quando o usuário clica (não reabre sozinho ao atualizar).
  const [open, setOpen] = useState(false)
  const isMonthly = report.report_type === 'monthly'
  return (
    <div className="bg-white border border-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-forest-900">{report.title}</p>
            <p className="text-[11px] text-ink-soft">Período {formatPeriodShort({ start: report.period_start, end: report.period_end })} · Gerado em {report.generated_at ? formatDateBR(ymd(new Date(report.generated_at))) : formatDateBR(report.available_at)}</p>
            {report.summary && <p className="text-xs text-ink-soft mt-1.5 line-clamp-2">{report.summary}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => onPdf(report)} disabled={generating} className="text-xs text-forest-700 border border-line px-3 py-1.5 rounded-xl hover:bg-mint/50 flex items-center gap-1.5 disabled:opacity-60">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
            </button>
            <button onClick={() => setOpen(o => !o)} className="text-xs font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-xl hover:bg-mint/50 flex items-center gap-1">
              {open ? 'Ocultar' : 'Ver relatório'} {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {isMonthly && (
          <div className="flex flex-wrap gap-2 mt-3">
            {nav.onNavigateSelfCare && <button onClick={nav.onNavigateSelfCare} className="text-xs font-medium text-forest-700 bg-mint/60 px-3 py-1.5 rounded-xl hover:bg-mint flex items-center gap-1.5"><Sprout className="w-3.5 h-3.5" /> Usar no plano de autocuidado</button>}
            <button onClick={nav.onNavigateGuidance} className="text-xs font-medium text-white bg-forest-900 px-3 py-1.5 rounded-xl hover:bg-forest-800 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Enviar para orientação</button>
          </div>
        )}
      </div>
      {open && <div className="p-5"><ReportBody report={report} plan={plan} {...nav} /></div>}
    </div>
  )
}

// Prévia "em construção" (não salva).
function BuildingPreview({ type, period, content, onRefresh }: {
  type: 'weekly' | 'monthly'; period: Period; content: WeeklyContent | MonthlyContent; onRefresh: () => void
}) {
  const notice = type === 'weekly'
    ? 'Este relatório ainda está em construção. Ele será fechado no final de sábado e ficará disponível no domingo.'
    : 'Este relatório ainda está em construção. Ele será fechado no último dia do mês e ficará disponível no primeiro dia do mês seguinte.'
  const emotions = content.topEmotions
  const topTrig = 'topTriggers' in content ? content.topTriggers[0]?.tag : content.triggers[0]?.tag
  return (
    <div className="rounded-2xl border border-forest-200 bg-mint/30 p-5">
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw className="w-4 h-4 text-forest-600" />
        <h3 className="text-sm font-semibold text-forest-900">{type === 'weekly' ? 'Relatório semanal em construção' : 'Relatório mensal em construção'}</h3>
      </div>
      <p className="text-xs text-ink-soft mb-1">{type === 'weekly' ? `Semana de ${formatPeriodShort(period)}` : `${monthTitle(period.start)} · ${formatPeriodShort(period)}`}</p>
      <p className="text-[11px] text-ink-soft mb-3">Fecha em <strong className="text-forest-700">{formatDateBR(period.end)}</strong> · disponível em <strong className="text-forest-700">{formatDateBR(period.availableAt)}</strong></p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
        <StatPill label="Check-ins" value={content.checkinCount} />
        <StatPill label="Diários" value={content.diaryCount} />
        <StatPill label="Energia" value={content.avgEnergy || '—'} unit={content.avgEnergy ? '/5' : ''} />
        <StatPill label="Ansiedade" value={content.avgAnxiety || '—'} unit={content.avgAnxiety ? '/5' : ''} />
        <StatPill label="Gatilho" value={topTrig ?? '—'} />
      </div>
      {emotions.length > 0 && <p className="text-sm text-forest-800 mb-2"><span className="text-ink-soft">Emoção mais frequente até agora:</span> {MOOD_EMOJI[emotions[0].label] ?? ''} {emotions[0].label}</p>}

      {/* Gráficos de síntese parciais do período em andamento */}
      <div className="bg-white/60 rounded-xl p-3 mb-2">
        <SynthCharts
          energyByDay={content.energyByDay}
          anxietyByDay={content.anxietyByDay}
          emotions={content.topEmotions}
          triggers={'topTriggers' in content ? content.topTriggers : content.triggers}
        />
      </div>

      <p className="text-xs text-ink-soft leading-relaxed bg-white/60 rounded-lg px-3 py-2 mt-2">{notice}</p>
      <button onClick={onRefresh} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 border border-forest-200 px-3 py-1.5 rounded-xl hover:bg-white/60">
        <RefreshCw className="w-3.5 h-3.5" /> Atualizar prévia
      </button>
    </div>
  )
}

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
  const [showWeeklyHist, setShowWeeklyHist] = useState(false)
  const [showMonthlyHist, setShowMonthlyHist] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pdfBusy, setPdfBusy] = useState(false)

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
      supabase.from('user_subscriptions').select('current_period_start').eq('user_id', user.id).maybeSingle(),
    ])
    const act = (prof as { plan_activated_at?: string } | null)?.plan_activated_at
      ?? (sub as { current_period_start?: string } | null)?.current_period_start
      ?? (prof as { created_at?: string } | null)?.created_at ?? null
    setActivation(act)
    // Persiste a ativação uma vez (estabiliza o corte do 1º ciclo)
    if (act && !(prof as { plan_activated_at?: string } | null)?.plan_activated_at) {
      void supabase.from('profiles').update({ plan_activated_at: act }).eq('user_id', user.id)
    }

    // 2) Registros — janela ampla (cobre semana/mês atuais e anteriores + comparação)
    const since = new Date(); since.setDate(since.getDate() - 100)
    const { data } = await supabase.from('diary_entries').select('*').eq('user_id', user.id).gte('created_at', since.toISOString())
    const all = (data ?? []) as DiaryRowLite[]
    setEntries(all)

    // 3) Gera (uma vez) os relatórios FECHADOS disponíveis
    const now = new Date()
    const lastW = getPreviousWeeklyPeriod(act, now)
    if (lastW) {
      const wEntries = all.filter(e => inPeriod(e, lastW))
      const wPrev = all.filter(e => inPeriod(e, prevRange(lastW)))
      setLastWeekly(await ensureClosedReport(user.id, 'weekly', planKey, lastW, wEntries, wPrev))
    } else setLastWeekly(null)

    if (isPlus) {
      const lastM = getPreviousMonthlyPeriod(act, now)
      if (lastM) {
        const mEntries = all.filter(e => inPeriod(e, lastM))
        const mPrev = all.filter(e => inPeriod(e, prevRange(lastM)))
        setLastMonthly(await ensureClosedReport(user.id, 'monthly', planKey, lastM, mEntries, mPrev))
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
  const weeklyHistory = history.filter(r => r.report_type === 'weekly' && r.period_start !== lastWeekly?.period_start)
  const monthlyHistory = history.filter(r => r.report_type === 'monthly' && r.period_start !== lastMonthly?.period_start)

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
          <LockedSection title="Relatório semanal automático" description="Resumo da semana com emoções, energia, ansiedade, gatilhos e conteúdos recomendados. Disponível no plano Essencial." onUpgrade={onNavigatePricing} />
          <LockedSection title="Relatório mensal aprofundado" description="Leitura completa do mês — padrões, plano de autocuidado e síntese para orientação. Disponível no plano Plus." onUpgrade={onNavigatePricing} />
        </div>
        <button onClick={onNavigateDiary} className="mt-6 inline-flex items-center gap-1.5 text-sm text-forest-700 font-medium hover:text-forest-900"><BookOpen className="w-4 h-4" /> Abrir meu diário</button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-4">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">Relatórios <BarChart2 className="w-6 h-6 text-forest-400" /></h1>
        <p className="mt-2 text-ink-soft">Acompanhe suas sínteses semanais e mensais com base nos seus check-ins, diário e questionários.</p>
      </header>

      {/* Como funcionam os relatórios */}
      <div className="rounded-2xl border border-line bg-paper-soft p-4 sm:p-5 mb-6">
        <p className="text-sm font-semibold text-forest-900 flex items-center gap-1.5 mb-2"><Calendar className="w-4 h-4 text-forest-500" /> Como funcionam os relatórios</p>
        <ul className="space-y-1 text-sm text-ink-soft">
          <li className="flex gap-2"><span className="text-forest-400 mt-0.5">•</span> Relatórios semanais fecham no sábado e ficam disponíveis aos domingos.</li>
          {isPlus && <li className="flex gap-2"><span className="text-forest-400 mt-0.5">•</span> Relatórios mensais fecham no último dia do mês e ficam disponíveis no primeiro dia do mês seguinte.</li>}
          <li className="flex gap-2"><span className="text-forest-400 mt-0.5">•</span> Seu primeiro relatório considera o período a partir da ativação do plano.</li>
        </ul>
      </div>

      {/* ══ Relatórios semanais (Essencial+) ══ */}
      <section className="space-y-4 mb-8">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-forest-500" />
          <h2 className="font-serif text-xl text-forest-900">Relatórios semanais</h2>
        </div>

        <BuildingPreview type="weekly" period={curWeek} content={weeklyPreview} onRefresh={() => setRefreshKey(k => k + 1)} />

        {lastWeekly ? (
          <ClosedReportCard report={lastWeekly} plan={planKey} onPdf={handlePdf} generating={pdfBusy} {...navProps} />
        ) : (
          <p className="text-sm text-ink-soft bg-paper-soft border border-line rounded-2xl p-4">Seu primeiro relatório semanal fechado ficará disponível no próximo domingo.</p>
        )}

        {weeklyHistory.length > 0 && (
          <div>
            <button onClick={() => setShowWeeklyHist(o => !o)} className="text-sm text-forest-700 font-medium flex items-center gap-1.5 hover:text-forest-900">
              {showWeeklyHist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Ver relatórios anteriores ({weeklyHistory.length})
            </button>
            {showWeeklyHist && (
              <div className="mt-3 space-y-2">
                {weeklyHistory.map(r => <HistoryRow key={r.id} report={r} onPdf={handlePdf} generating={pdfBusy} plan={planKey} {...navProps} />)}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══ Relatórios mensais aprofundados (Plus) ══ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-forest-500" />
          <h2 className="font-serif text-xl text-forest-900">Relatório mensal aprofundado</h2>
          <span className="text-[10px] bg-mint text-forest-700 px-2 py-0.5 rounded-full font-medium">Plus</span>
        </div>

        {isPlus ? (
          <>
            <BuildingPreview type="monthly" period={curMonth} content={monthlyPreview} onRefresh={() => setRefreshKey(k => k + 1)} />
            {lastMonthly ? (
              <ClosedReportCard report={lastMonthly} plan={planKey} onPdf={handlePdf} generating={pdfBusy} {...navProps} />
            ) : (
              <p className="text-sm text-ink-soft bg-paper-soft border border-line rounded-2xl p-4">Seu primeiro relatório mensal aprofundado ficará disponível no dia 1º do próximo mês.</p>
            )}
            <ProfessionalComment userId={user!.id} selectedMonth={lastMonthly?.period_start?.slice(0, 7) ?? ymd(now).slice(0, 7)} onNavigateDiary={onNavigateDiary} />
            {monthlyHistory.length > 0 && (
              <div>
                <button onClick={() => setShowMonthlyHist(o => !o)} className="text-sm text-forest-700 font-medium flex items-center gap-1.5 hover:text-forest-900">
                  {showMonthlyHist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Ver relatórios mensais anteriores ({monthlyHistory.length})
                </button>
                {showMonthlyHist && <div className="mt-3 space-y-2">{monthlyHistory.map(r => <HistoryRow key={r.id} report={r} onPdf={handlePdf} generating={pdfBusy} plan={planKey} {...navProps} />)}</div>}
              </div>
            )}
          </>
        ) : (
          <LockedSection title="Relatório mensal aprofundado" description="No Plus, você desbloqueia o relatório mensal aprofundado com leitura de padrões, plano de autocuidado e síntese para orientação." onUpgrade={onNavigatePricing} />
        )}
      </section>

      <p className="text-xs text-ink-soft border-t border-line pt-4 mt-8">{DISCLAIMER}</p>
    </div>
  )
}

// Linha compacta do histórico (expande sob demanda).
function HistoryRow({ report, plan, onPdf, generating, ...nav }: {
  report: StoredReport; plan: string; onPdf: (r: StoredReport) => void; generating: boolean
  onOpenArticle?: (slug: string) => void; onNavigateDiary: () => void; onNavigateSelfCare?: () => void; onNavigateGuidance: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-paper-soft border border-line rounded-xl">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-forest-900 font-medium truncate">{report.title}</p>
          <p className="text-[11px] text-ink-soft">Gerado em {report.generated_at ? formatDateBR(ymd(new Date(report.generated_at))) : formatDateBR(report.available_at)}</p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-xs text-forest-700 hover:underline">Ver relatório</button>
        <button onClick={() => onPdf(report)} disabled={generating} className="text-xs text-forest-700 border border-line px-2.5 py-1 rounded-lg hover:bg-mint/50 flex items-center gap-1 disabled:opacity-60"><FileText className="w-3 h-3" /> PDF</button>
      </div>
      {open && <div className="px-4 pb-4 border-t border-line pt-3"><ReportBody report={report} plan={plan} {...nav} /></div>}
    </div>
  )
}

// Comentário profissional mensal (Plus) — recurso existente no sistema.
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
          <p className="text-sm text-sage-700 leading-relaxed whitespace-pre-wrap">{comment.comment_text}</p>
          {comment.professional_name && <p className="text-[10px] text-stone-400">{comment.professional_name}</p>}
          <button onClick={onNavigateDiary} className="flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900 font-medium mt-1"><BookOpen className="w-3.5 h-3.5" /> Responder no diário</button>
        </div>
      ) : (
        <p className="text-sm text-stone-500">Seu comentário profissional mensal ainda não está disponível. Ele pode considerar os padrões deste relatório.</p>
      )}
    </Section>
  )
}
