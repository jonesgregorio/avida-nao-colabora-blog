import { useState, useEffect, useRef } from 'react'
import { exportElementToPdf } from '../lib/exportPdf'
import { supabase } from '../lib/supabase'
import { DiaryEntry, Plan } from '../types'
import { hasPlanAccess } from '../lib/officialPlans'
import {
  Lock, TrendingUp, BarChart2, FileText, Star,
  Loader2, Calendar, BookOpen, MessageCircle,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  onNavigatePricing: () => void
  onNavigateDiary: () => void
  onNavigateGuidance: () => void
}

interface ProfessionalComment {
  id: string
  comment_text: string
  comment?: string
  report_month: string
  professional_name: string | null
  created_at: string
}

const moodScoreMap: Record<string, number> = {
  bem: 8, neutro: 5, triste: 3, ansioso: 3, irritado: 3, sobrecarregado: 2,
}

const moodEmoji: Record<string, string> = {
  bem: '😊', neutro: '😐', triste: '😔', ansioso: '😰', irritado: '😤', sobrecarregado: '😩',
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(iso: string) {
  const [year, month] = iso.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function buildMonthOptions() {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = monthKey(d)
    opts.push({ value: key, label: monthLabel(key) })
  }
  return opts
}

// ─── Mini bar chart via SVG ──────────────────────────────────────────────────

function MiniBarChart({ data, label, color = '#a78bfa', max = 10 }: {
  data: { day: string; value: number }[]
  label: string
  color?: string
  max?: number
}) {
  if (!data.length) return null
  const W = 320
  const H = 80
  const barW = Math.min(16, Math.floor(W / data.length) - 2)
  const gap = Math.floor((W - barW * data.length) / (data.length + 1))

  return (
    <div>
      <p className="text-[10px] text-sage-500 uppercase tracking-wider mb-1">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        {data.map((d, i) => {
          const x = gap + i * (barW + gap)
          const barH = Math.max(4, Math.round((d.value / max) * (H - 16)))
          const y = H - barH - 4
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
              <text x={x + barW / 2} y={H} textAnchor="middle" fontSize={7} fill="#9ca3af">{d.day}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Locked section card ──────────────────────────────────────────────────────

function LockedSection({ title, description, onUpgrade }: {
  title: string
  description: string
  onUpgrade: () => void
}) {
  return (
    <div className="relative rounded-2xl border border-dashed border-line bg-mint/30 p-5 overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[1px] bg-paper-soft/50 flex flex-col items-center justify-center z-10 gap-3">
        <div className="flex items-center gap-2 text-forest-600">
          <Lock className="w-4 h-4" />
          <span className="text-sm font-medium text-forest-700">{title}</span>
        </div>
        <p className="text-xs text-ink-soft text-center max-w-xs">{description}</p>
        <button
          onClick={onUpgrade}
          className="text-xs text-forest-700 font-semibold border border-forest-200 bg-white px-4 py-1.5 rounded-full hover:bg-mint/50 transition-colors"
        >
          Ver planos
        </button>
      </div>
      {/* Ghost content to define height */}
      <div className="opacity-10 pointer-events-none select-none space-y-3">
        <div className="h-3 bg-stone-300 rounded w-1/3" />
        <div className="h-20 bg-stone-200 rounded" />
        <div className="h-3 bg-stone-300 rounded w-1/2" />
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, badge, children }: {
  icon: React.ReactNode
  title: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-paper-soft rounded-2xl border border-line p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-forest-500">{icon}</span>
        <h3 className="text-sm font-semibold text-forest-900">{title}</h3>
        {badge && (
          <span className="ml-auto text-[10px] bg-mint text-forest-700 px-2 py-0.5 rounded-full font-medium">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-mint/40 rounded-xl px-3 py-2 text-center">
      <p className="text-[10px] text-ink-soft mb-0.5">{label}</p>
      <p className="text-base font-bold text-forest-900">
        {value}<span className="text-xs font-normal text-ink-soft ml-0.5">{unit}</span>
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MyReportPage({ user, profile, onBack: _onBack, onNavigatePricing, onNavigateDiary, onNavigateGuidance }: Props) {
  const plan: Plan = profile?.plan ?? 'free'
  const isEssential = hasPlanAccess(plan, 'essential')
  const isPlus = hasPlanAccess(plan, 'plus')

  const monthOptions = buildMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [prevEntries, setPrevEntries] = useState<DiaryEntry[]>([])
  const [comment, setComment] = useState<ProfessionalComment | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)

    const [year, month] = selectedMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10)
    const end = new Date(year, month, 0).toISOString().slice(0, 10)

    // Previous month for comparison
    const prevDate = new Date(year, month - 2, 1)
    const prevStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1).toISOString().slice(0, 10)
    const prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).toISOString().slice(0, 10)

    const p1 = supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .then(({ data }) => setEntries((data as DiaryEntry[]) ?? []))

    const p2 = supabase
      .from('diary_entries')
      .select('date,mood,mood_score,energy,anxiety_level,stress_level,sleep_quality,self_esteem')
      .eq('user_id', user.id)
      .gte('date', prevStart)
      .lte('date', prevEnd)
      .then(({ data }) => setPrevEntries((data as DiaryEntry[]) ?? []))

    const queries: Promise<unknown>[] = [Promise.resolve(p1), Promise.resolve(p2)]

    if (isPlus) {
      const p3 = supabase
        .from('professional_comments')
        .select('id,comment_text,comment,report_month,professional_name,created_at')
        .eq('user_id', user.id)
        .eq('report_month', selectedMonth)
        .maybeSingle()
        .then(({ data }) => {
          const d = data as ProfessionalComment | null
          setComment(d ? { ...d, comment_text: d.comment_text || d.comment || '' } : null)
        })
      queries.push(Promise.resolve(p3))
    }

    Promise.all(queries).finally(() => setLoading(false))
  }, [user, selectedMonth, isPlus])

  // ─── Derived stats ────────────────────────────────────────────────────────

  const diaryEntries = entries.filter(e => !e.entry_type || e.entry_type === 'diary')

  const moodCounts: Record<string, number> = {}
  for (const e of diaryEntries) {
    const m = String(e.mood)
    moodCounts[m] = (moodCounts[m] ?? 0) + 1
  }
  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]

  const moodScores = diaryEntries
    .map(e => e.mood_score ?? moodScoreMap[String(e.mood)] ?? 5)
    .filter(Boolean)

  const avgMood = avg(moodScores)

  const moodChartData = diaryEntries.map(e => ({
    day: e.date ? new Date(e.date + 'T12:00:00').getDate().toString() : '',
    value: e.mood_score ?? moodScoreMap[String(e.mood)] ?? 5,
  }))

  const energyData = diaryEntries
    .filter(e => e.energy != null)
    .map(e => ({ day: e.date ? new Date(e.date + 'T12:00:00').getDate().toString() : '', value: e.energy! }))

  const anxietyData = diaryEntries
    .filter(e => e.anxiety_level != null)
    .map(e => ({ day: e.date ? new Date(e.date + 'T12:00:00').getDate().toString() : '', value: e.anxiety_level! }))

  const sleepData = diaryEntries
    .filter(e => e.sleep_quality != null)
    .map(e => ({ day: e.date ? new Date(e.date + 'T12:00:00').getDate().toString() : '', value: e.sleep_quality! }))

  // Comparison prev month
  const prevMoodScores = prevEntries.map(e => e.mood_score ?? moodScoreMap[String(e.mood)] ?? 5)
  const prevAvgMood = avg(prevMoodScores)
  const moodDiff = prevAvgMood > 0 ? +(avgMood - prevAvgMood).toFixed(1) : null

  const tagFreq: Record<string, number> = {}
  for (const e of diaryEntries) {
    for (const t of e.emotional_tags ?? []) {
      tagFreq[t] = (tagFreq[t] ?? 0) + 1
    }
  }
  const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ─── Print/PDF ────────────────────────────────────────────────────────────

  async function handleExportPdf() {
    if (!reportRef.current || generating) return
    setGenerating(true)
    try {
      await exportElementToPdf(reportRef.current, `relatorio-${selectedMonth}.pdf`)
    } catch {
      // silencioso — em caso de falha, o usuário pode tentar novamente
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-6 h-6 text-forest-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 print:px-0 print:py-4">
      {/* Header */}
      <header className="mb-6 print:hidden">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Relatórios e evolução <BarChart2 className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft">Acompanhe sua jornada de autocuidado e perceba o quanto você já evoluiu.</p>
      </header>

      {/* Month selector */}
      <div className="flex flex-wrap items-center gap-3 mb-6 print:hidden">
        <div className="flex items-center gap-2 bg-paper-soft border border-line rounded-2xl px-3 py-1.5">
          <Calendar className="w-4 h-4 text-forest-500 flex-shrink-0" />
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            aria-label="Selecionar mês do relatório"
            className="text-sm bg-transparent text-forest-800 focus:outline-none"
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {isEssential && (
          <button
            onClick={handleExportPdf}
            disabled={generating}
            className="ml-auto text-xs text-forest-700 border border-line px-3.5 py-2 rounded-2xl hover:bg-mint/50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generating ? 'Gerando…' : 'Baixar PDF'}
          </button>
        )}
      </div>

      <div ref={reportRef} className="space-y-4 bg-paper">

        {/* ─── SEÇÃO 1: Resumo de humor (todos os planos) ────────────── */}
        <Section icon={<BookOpen className="w-4 h-4" />} title="Resumo do mês">
          {diaryEntries.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-stone-400 mb-3">Nenhuma entrada no diário em {monthLabel(selectedMonth)}.</p>
              <button
                onClick={onNavigateDiary}
                className="text-xs text-forest-700 font-medium border border-forest-200 px-4 py-1.5 rounded-full hover:bg-mint transition-colors"
              >
                Abrir diário
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <StatPill label="Entradas" value={diaryEntries.length} />
                <StatPill label="Humor médio" value={avgMood || '—'} unit={avgMood ? '/10' : ''} />
                <StatPill
                  label="Humor dominant."
                  value={dominantMood ? `${moodEmoji[dominantMood[0]] ?? ''} ${dominantMood[0]}` : '—'}
                />
              </div>

              {topTags.length > 0 && (
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-2">Emoções mais registradas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topTags.map(([tag, count]) => (
                      <span key={tag} className="text-xs bg-mint text-forest-700 px-2.5 py-1 rounded-full">
                        {tag} <span className="text-forest-500">×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ─── SEÇÃO 2: Gráficos de evolução (Essencial+) ────────────── */}
        {isEssential ? (
          <Section icon={<TrendingUp className="w-4 h-4" />} title="Evolução do humor" badge="Essencial+">
            {moodChartData.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">Sem dados suficientes este mês.</p>
            ) : (
              <div className="space-y-5">
                <MiniBarChart data={moodChartData} label="Humor (1–10)" color="#a78bfa" />
                {energyData.length > 0 && (
                  <MiniBarChart data={energyData} label="Energia (1–10)" color="#34d399" />
                )}
                {anxietyData.length > 0 && (
                  <MiniBarChart data={anxietyData} label="Ansiedade (1–10)" color="#fb923c" />
                )}
              </div>
            )}
          </Section>
        ) : (
          <LockedSection
            title="Gráficos de evolução"
            description="Visualize sua evolução de humor, energia e ansiedade ao longo do mês. Disponível no plano Essencial."
            onUpgrade={onNavigatePricing}
          />
        )}

        {/* ─── SEÇÃO 3: Relatório comparativo (Plus) ─────────── */}
        {isPlus ? (
          <Section icon={<BarChart2 className="w-4 h-4" />} title="Análise comparativa" badge="Plus">
            <div className="space-y-5">
              {/* Comparação com mês anterior */}
              {prevAvgMood > 0 && (
                <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-4">
                  <div className="flex-1">
                    <p className="text-xs text-stone-500 mb-0.5">Comparação com o mês anterior</p>
                    <p className="text-sm font-semibold text-sage-800">
                      Humor: {avgMood}/10
                      {moodDiff !== null && (
                        <span className={`ml-2 text-xs font-medium ${moodDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {moodDiff >= 0 ? `+${moodDiff}` : moodDiff} vs mês anterior
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {sleepData.length > 0 && (
                <MiniBarChart data={sleepData} label="Qualidade do sono (1–10)" color="#60a5fa" />
              )}

              {/* Médias avançadas */}
              <div className="grid grid-cols-2 gap-2">
                {avg(diaryEntries.filter(e => e.sleep_quality != null).map(e => e.sleep_quality!)) > 0 && (
                  <StatPill label="Sono médio" value={avg(diaryEntries.filter(e => e.sleep_quality != null).map(e => e.sleep_quality!))} unit="/10" />
                )}
                {avg(diaryEntries.filter(e => e.self_esteem != null).map(e => e.self_esteem!)) > 0 && (
                  <StatPill label="Autoestima média" value={avg(diaryEntries.filter(e => e.self_esteem != null).map(e => e.self_esteem!))} unit="/10" />
                )}
                {avg(diaryEntries.filter(e => e.stress_level != null).map(e => e.stress_level!)) > 0 && (
                  <StatPill label="Estresse médio" value={avg(diaryEntries.filter(e => e.stress_level != null).map(e => e.stress_level!))} unit="/10" />
                )}
                {avg(diaryEntries.filter(e => e.irritability != null).map(e => e.irritability!)) > 0 && (
                  <StatPill label="Irritabilidade" value={avg(diaryEntries.filter(e => e.irritability != null).map(e => e.irritability!))} unit="/10" />
                )}
              </div>

              {/* Orientação mensal */}
              <div className="border-t border-stone-100 pt-4">
                <p className="text-xs text-stone-400 mb-2">Tem dúvidas sobre seu relatório?</p>
                <button
                  onClick={onNavigateGuidance}
                  className="flex items-center gap-1.5 text-xs text-forest-700 font-medium hover:text-forest-900 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Orientação mensal por mensagem
                </button>
              </div>
            </div>
          </Section>
        ) : (
          <LockedSection
            title="Análise comparativa mensal"
            description="Compare seu progresso mês a mês — sono, autoestima, estresse e mais. Disponível no plano Plus."
            onUpgrade={onNavigatePricing}
          />
        )}

        {/* ─── SEÇÃO 4: Comentário do profissional (Plus) ─────────────── */}
        {isPlus ? (
          <Section icon={<Star className="w-4 h-4" />} title="Comentário do profissional" badge="Plus">
            {comment ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-forest-700 capitalize">{monthLabel(comment.report_month)}</p>
                  {comment.professional_name && (
                    <p className="text-[10px] text-stone-400">{comment.professional_name}</p>
                  )}
                </div>
                <p className="text-sm text-sage-700 leading-relaxed whitespace-pre-wrap">{comment.comment_text}</p>
                <button
                  onClick={onNavigateDiary}
                  className="flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-900 font-medium transition-colors mt-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Responder no diário
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <Star className="w-7 h-7 text-stone-200 mx-auto mb-2" />
                <p className="text-sm font-medium text-sage-700 mb-1">Comentário ainda não enviado</p>
                <p className="text-xs text-stone-400">
                  Seu comentário de {monthLabel(selectedMonth)} chegará em breve.
                </p>
              </div>
            )}
          </Section>
        ) : (
          <LockedSection
            title="Comentário individual do profissional"
            description="Receba um comentário personalizado sobre seu mês por um profissional parceiro. Disponível no plano Plus."
            onUpgrade={onNavigatePricing}
          />
        )}

      </div>
    </div>
  )
}
