import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { hasPlanAccess, getPlanLabel } from '../lib/officialPlans'
import PlanBadge from './PlanBadge'
import {
  BarChart2, Heart, Leaf,
  Lock, AlertCircle, TrendingUp, BookOpen, Loader2,
  Smile, Zap, Moon, Waves, Sparkles, Sun, Sunset, CloudMoon, Clock, Flame,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import {
  computeEmotionalAnalysis, buildEssentialInsights, MOOD_EMOJI,
  type DiaryRowLite, type EmotionalAnalysis,
} from '../lib/emotionalAnalytics'

// ─── Constantes e helpers ──────────────────────────────────────────────────────

const DISCLAIMER = 'Este conteúdo é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

// Mapa Emocional é SÓ visualização (§10): Resumo + Gráficos. As demais funções
// (Relatórios, Plano de Autocuidado, Orientação, Comentário) ficam nos seus menus.
export type Tab = 'resumo' | 'graficos'

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

// Delega para a fonte única (normaliza legados e reconhece 'plus' corretamente).
function hasPlan(userPlan: string, required: string) {
  return hasPlanAccess(userPlan, required)
}

// ─── Subcomponentes utilitários ────────────────────────────────────────────────

function LockedSection({ requiredPlan, onNavigatePricing, message }: {
  requiredPlan: string
  message: string
  onNavigatePricing: () => void
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-8 text-center space-y-4">
      <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
        <Lock className="w-6 h-6 text-stone-400" />
      </div>
      <p className="text-stone-600 text-sm max-w-sm mx-auto">{message}</p>
      <button
        onClick={onNavigatePricing}
        className="bg-emerald-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
      >
        Conhecer plano {getPlanLabel(requiredPlan)}
      </button>
    </div>
  )
}


// ─── Props principal ───────────────────────────────────────────────────────────

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  onNavigatePricing: () => void
  onNavigateDiary: () => void
  onNavigate?: (v: string) => void
  initialTab?: Tab
}

// ─── Dados do diário ──────────────────────────────────────────────────────────

interface DiaryStats {
  totalEntries: number
  avgMood: number
  avgEnergy: number
  avgSleep: number
  avgAnxiety: number
  avgSelfEsteem: number
  dominantMood: string
  topTags: string[]
  weeklyEntries: number[]
  dailyMoods: { day: number; mood: number }[]
  prevMonthAvgMood: number
  prevMonthAvgEnergy: number
  prevMonthAvgSleep: number
}

const emptyStats: DiaryStats = {
  totalEntries: 0, avgMood: 0, avgEnergy: 0, avgSleep: 0, avgAnxiety: 0, avgSelfEsteem: 0,
  dominantMood: '—', topTags: [], weeklyEntries: [0, 0, 0, 0], dailyMoods: [],
  prevMonthAvgMood: 0, prevMonthAvgEnergy: 0, prevMonthAvgSleep: 0,
}

const MOOD_LABELS: Record<number, string> = {
  1: 'Muito baixo', 2: 'Baixo', 3: 'Neutro', 4: 'Bom', 5: 'Muito bom',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MyEvolutionPage({ user, profile, onBack: _onBack, onNavigatePricing, onNavigateDiary, onNavigate, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'resumo')
  const plan = profile?.plan ?? 'free'

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  const tabs: { id: Tab; label: string; icon: React.ReactNode; minPlan: string }[] = [
    { id: 'resumo', label: 'Resumo', icon: <TrendingUp className="w-4 h-4" />, minPlan: 'free' },
    { id: 'graficos', label: 'Gráficos', icon: <BarChart2 className="w-4 h-4" />, minPlan: 'essential' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
              Mapa emocional <Leaf className="w-6 h-6 text-forest-400" />
            </h1>
            <p className="mt-2 text-ink-soft">Entenda seus padrões emocionais e veja sua evolução ao longo do tempo.</p>
          </div>
          <PlanBadge plan={plan} member size="sm" className="mt-1" />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {tabs.map(t => {
          const locked = !hasPlan(plan, t.minPlan)
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-full whitespace-nowrap transition-colors border flex-shrink-0 ${
                active
                  ? 'bg-forest-900 text-white border-forest-900'
                  : locked
                  ? 'bg-paper-soft border-line text-ink-soft/50'
                  : 'bg-paper-soft border-line text-ink-soft hover:border-forest-300 hover:text-forest-900'
              }`}
            >
              {locked ? <Lock className="w-3.5 h-3.5" /> : t.icon}
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content — SÓ visualização */}
      <div>
        {tab === 'resumo' && <TabResumo plan={plan} user={user} onNavigatePricing={onNavigatePricing} onNavigateDiary={onNavigateDiary} />}
        {tab === 'graficos' && <TabGraficos plan={plan} user={user} onNavigatePricing={onNavigatePricing} />}
      </div>

      {/* Próximos passos — atalhos discretos (§10.4). Cada função tem a sua própria área no menu. */}
      {onNavigate && (
        <section className="mt-8 border-t border-line pt-6">
          <h2 className="font-serif text-lg text-forest-900 mb-1">Próximos passos</h2>
          <p className="text-sm text-ink-soft mb-4">Atalhos rápidos — cada função tem a sua própria área no menu.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ShortcutCard label="Registrar check-in" onClick={() => onNavigate('diary')} />
            <ShortcutCard label="Responder questionário" onClick={() => onNavigate('questionarios')} />
            {hasPlan(plan, 'essential') && <ShortcutCard label="Ver relatório semanal" onClick={() => onNavigate('my-report')} />}
            {hasPlan(plan, 'plus') && <ShortcutCard label="Abrir relatório mensal" onClick={() => onNavigate('my-report')} />}
            {hasPlan(plan, 'plus') && <ShortcutCard label="Abrir plano de autocuidado" onClick={() => onNavigate('self-care')} />}
            {hasPlan(plan, 'plus') && <ShortcutCard label="Enviar para orientação" onClick={() => onNavigate('monthly-guidance')} />}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Hook compartilhado: carrega stats do diário ──────────────────────────────

function useDiaryStats(userId: string | undefined, selectedMonth: string) {
  const [stats, setStats] = useState<DiaryStats>(emptyStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)

    const [y, m] = selectedMonth.split('-').map(Number)
    const start = new Date(y, m - 1, 1).toISOString()
    const end = new Date(y, m, 1).toISOString()
    const prevStart = new Date(y, m - 2, 1).toISOString()
    const prevEnd = start

    Promise.all([
      supabase.from('diary_entries').select('*').eq('user_id', userId).gte('created_at', start).lt('created_at', end),
      supabase.from('diary_entries').select('mood,energy,sleep_quality').eq('user_id', userId).gte('created_at', prevStart).lt('created_at', prevEnd),
    ]).then(([curr, prev]) => {
      const entries = curr.data ?? []
      const prevEntries = prev.data ?? []

      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      type DiaryRow = { mood?: number | string; mood_score?: number; energy?: number; sleep_quality?: number; anxiety_level?: number; self_esteem?: number; emotional_tags?: string[] | string; created_at: string }
      // `mood` guarda o RÓTULO em texto ("Bem-estar") e `mood_score` o número na
      // escala oficial 1–5 (Bem-estar=5, Outro=3, Sobrecarga=1). Dados antigos em
      // 1–10 foram normalizados para 1–5 pela migration 080, então aqui só validamos
      // a faixa. (Não dividir por 2: mood_score já vem em 1–5.)
      const moodTo5 = (e: DiaryRow): number => {
        const s = Number(e.mood_score)
        if (!Number.isFinite(s) || s <= 0) return 0
        return Math.min(5, Math.max(1, Math.round(s)))
      }
      // §8: com check-in ILIMITADO, um dia com muitos check-ins não pode distorcer as
      // médias do mês. Cada métrica é a MÉDIA DAS MÉDIAS DIÁRIAS (um valor por dia).
      const avgByDay = (rows: DiaryRow[], getVal: (e: DiaryRow) => number): number => {
        const byDay = new Map<number, number[]>()
        rows.forEach((e) => {
          const v = getVal(e)
          if (!Number.isFinite(v) || v <= 0) return
          const day = new Date(e.created_at).getDate()
          const arr = byDay.get(day) ?? []; arr.push(v); byDay.set(day, arr)
        })
        return avg([...byDay.values()].map((vs) => avg(vs)))
      }
      const en = (e: DiaryRow) => Number(e.energy)
      const sl = (e: DiaryRow) => Number(e.sleep_quality)
      const anx = (e: DiaryRow) => Number(e.anxiety_level)
      const se = (e: DiaryRow) => Number(e.self_esteem)

      const tagCounts: Record<string, number> = {}
      ;(entries as DiaryRow[]).forEach((e) => {
        const tags: string[] = Array.isArray(e.emotional_tags) ? e.emotional_tags : (e.emotional_tags ? JSON.parse(e.emotional_tags) : [])
        tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
      })
      const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)

      const moodAvg = avgByDay(entries as DiaryRow[], moodTo5)
      const dominantMoodScore = Math.round(moodAvg)
      const dominantMood = MOOD_LABELS[dominantMoodScore] ?? '—'

      const weeklyEntries = [0, 0, 0, 0]
      ;(entries as DiaryRow[]).forEach((e) => {
        const d = new Date(e.created_at)
        const weekIdx = Math.min(3, Math.floor((d.getDate() - 1) / 7))
        weeklyEntries[weekIdx]++
      })

      // Agrega por DIA do calendário (média do humor do dia). O usuário pode ter
      // vários registros no mesmo dia (check-ins + diário completo), então isso mantém
      // 1 ponto por dia: deixa o "% dos dias" honesto e evita pontos/células duplicados
      // no gráfico de evolução e no heatmap.
      const moodByDay = new Map<number, number[]>()
      ;(entries as DiaryRow[]).forEach((e) => {
        const m = moodTo5(e)
        if (m <= 0) return
        const day = new Date(e.created_at).getDate()
        const arr = moodByDay.get(day) ?? []
        arr.push(m)
        moodByDay.set(day, arr)
      })
      const dailyMoods = [...moodByDay.entries()]
        .map(([day, ms]) => ({ day, mood: avg(ms) }))
        .sort((a, b) => a.day - b.day)

      setStats({
        totalEntries: entries.length,
        avgMood: moodAvg,
        avgEnergy: avgByDay(entries as DiaryRow[], en),
        avgSleep: avgByDay(entries as DiaryRow[], sl),
        avgAnxiety: avgByDay(entries as DiaryRow[], anx),
        avgSelfEsteem: avgByDay(entries as DiaryRow[], se),
        dominantMood,
        topTags,
        weeklyEntries,
        dailyMoods,
        prevMonthAvgMood: avgByDay(prevEntries as DiaryRow[], moodTo5),
        prevMonthAvgEnergy: avgByDay(prevEntries as DiaryRow[], en),
        prevMonthAvgSleep: avgByDay(prevEntries as DiaryRow[], sl),
      })
      setLoading(false)
    })
  }, [userId, selectedMonth])

  return { stats, loading }
}

// ─── ABA: Resumo ─────────────────────────────────────────────────────────────

const Y_LABELS: Record<number, string> = { 1: 'Muito difícil', 2: 'Difícil', 3: 'Neutro', 4: 'Bem', 5: 'Ótimo' }

function heatColor(mood: number) {
  if (mood >= 4.5) return 'bg-forest-600'
  if (mood >= 3.5) return 'bg-forest-300'
  if (mood >= 2.5) return 'bg-amber-200'
  if (mood >= 1.5) return 'bg-coral/60'
  return 'bg-coral'
}

function BigRing({ pct }: { pct: number }) {
  const r = 46
  const circ = 2 * Math.PI * r
  return (
    <div className="relative w-[132px] h-[132px] flex-shrink-0">
      <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#E8F0EB" strokeWidth="9" />
        <circle cx="55" cy="55" r={r} fill="none" stroke="#1c4a37" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(100, Math.max(0, pct)) / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-3xl text-forest-900 leading-none">{pct}%</span>
      </div>
    </div>
  )
}

function MetricTile({ icon, label, value, sub, trend, goodDown = false }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string
  trend?: number | null; goodDown?: boolean
}) {
  const showTrend = typeof trend === 'number' && trend !== 0
  const up = (trend ?? 0) > 0
  const good = goodDown ? !up : up
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0">{icon}</span>
        <p className="text-sm text-ink-soft leading-tight">{label}</p>
      </div>
      <p className="font-serif text-2xl text-forest-900 leading-none">{value}</p>
      {showTrend ? (
        <p className={`mt-1.5 text-xs flex items-center gap-1 ${good ? 'text-forest-600' : 'text-coral'}`}>
          {up ? '↗' : '↘'} {Math.abs(trend as number).toFixed(1)} vs. mês anterior
        </p>
      ) : sub ? (
        <p className="mt-1.5 text-xs text-ink-soft truncate">{sub}</p>
      ) : null}
    </div>
  )
}

function TabResumo({ plan, user, onNavigatePricing, onNavigateDiary }: {
  plan: string; user: User | null; onNavigatePricing: () => void; onNavigateDiary: () => void
}) {
  const current = monthKey()
  const { stats, loading } = useDiaryStats(user?.id, current)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-forest-400" /></div>

  const isEssential = hasPlan(plan, 'essential')
  const isPlus = hasPlan(plan, 'plus')
  const chartData = [...stats.dailyMoods].sort((a, b) => a.day - b.day).map(d => ({ day: d.day, humor: d.mood }))
  const positiveDays = stats.dailyMoods.filter(d => d.mood >= 4).length
  const positivePct = stats.dailyMoods.length ? Math.round((positiveDays / stats.dailyMoods.length) * 100) : 0
  const trend = (curr: number, prev: number) => (prev > 0 && curr > 0 ? +(curr - prev).toFixed(1) : null)

  return (
    <div className="space-y-5">
      {/* Visão geral: anel + gráfico */}
      <div className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
        <h3 className="font-serif text-lg sm:text-xl text-forest-900">Visão geral da sua evolução emocional</h3>
        <p className="text-sm text-ink-soft mt-1 mb-5">Como você se sentiu em {monthLabel(current)}.</p>
        <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="flex flex-col items-center">
            <BigRing pct={positivePct} />
            <p className="text-xs text-ink-soft text-center mt-2 max-w-[130px] leading-snug">dos dias com emoções positivas</p>
          </div>
          <div className="h-56 min-w-0">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="humorFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f5d47" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#2f5d47" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#5F6661' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={(v: number) => Y_LABELS[v] ?? String(v)} tick={{ fontSize: 10, fill: '#5F6661' }} axisLine={false} tickLine={false} width={78} />
                  <Tooltip
                    formatter={(v: number) => [Y_LABELS[Math.round(v)] ?? v, 'Humor']}
                    labelFormatter={(l) => `Dia ${l}`}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E6E1D8', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="humor" stroke="#1c4a37" strokeWidth={2} fill="url(#humorFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-ink-soft text-center px-4">Registre no diário para ver sua evolução emocional aqui.</div>
            )}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <MetricTile icon={<Smile className="w-4 h-4" />} label="Humor médio" value={stats.avgMood > 0 ? `${stats.avgMood.toFixed(1)}/5` : '—'} trend={trend(stats.avgMood, stats.prevMonthAvgMood)} />
        {isEssential ? (
          <>
            <MetricTile icon={<Zap className="w-4 h-4" />} label="Energia" value={stats.avgEnergy > 0 ? `${stats.avgEnergy.toFixed(1)}/5` : '—'} trend={trend(stats.avgEnergy, stats.prevMonthAvgEnergy)} />
            <MetricTile icon={<Moon className="w-4 h-4" />} label="Sono" value={stats.avgSleep > 0 ? `${stats.avgSleep.toFixed(1)}/5` : '—'} trend={trend(stats.avgSleep, stats.prevMonthAvgSleep)} />
            <MetricTile icon={<Waves className="w-4 h-4" />} label="Ansiedade" value={stats.avgAnxiety > 0 ? `${stats.avgAnxiety.toFixed(1)}/5` : '—'} goodDown />
            <MetricTile icon={<Heart className="w-4 h-4" />} label="Autoestima" value={stats.avgSelfEsteem > 0 ? `${stats.avgSelfEsteem.toFixed(1)}/5` : '—'} />
            <MetricTile icon={<AlertCircle className="w-4 h-4" />} label="Gatilhos frequentes" value={stats.topTags[0] ?? '—'} sub={stats.topTags.slice(0, 3).join(' · ') || undefined} />
          </>
        ) : (
          <div className="col-span-2 rounded-2xl border border-dashed border-line bg-mint/20 p-4 flex flex-col items-center justify-center gap-2 text-center">
            <Lock className="w-4 h-4 text-forest-400" />
            <p className="text-xs text-ink-soft">Energia, sono, ansiedade e mais no plano Essencial.</p>
            <button onClick={onNavigatePricing} className="text-xs text-forest-700 underline">Conhecer o Essencial</button>
          </div>
        )}
      </div>

      {/* Marcadores */}
      {isEssential && stats.topTags.length > 0 && (
        <div className="bg-paper-soft border border-line rounded-3xl p-5">
          <h3 className="font-serif text-base text-forest-900 mb-3">Marcadores mais registrados por você</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map(tag => (
              <span key={tag} className="bg-mint text-forest-700 text-xs px-3 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Linha do tempo emocional */}
      {chartData.length > 0 && (
        <div className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
          <h3 className="font-serif text-base sm:text-lg text-forest-900">Linha do tempo emocional</h3>
          <p className="text-sm text-ink-soft mt-1 mb-4">Seu mês em cores, um registro por dia.</p>
          <div className="flex flex-wrap gap-1.5">
            {chartData.map(d => (
              <span key={d.day} title={`Dia ${d.day} · ${Y_LABELS[Math.round(d.humor)] ?? ''}`} className={`w-5 h-5 rounded-md ${heatColor(d.humor)}`} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-forest-600" /> Ótimo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-forest-300" /> Bem</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200" /> Neutro</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-coral/60" /> Difícil</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-coral" /> Muito difícil</span>
          </div>
        </div>
      )}

      {/* Resumo da jornada */}
      <div className="rounded-3xl border border-line bg-mint/40 p-5 sm:p-6">
        <h3 className="font-serif text-base sm:text-lg text-forest-900 flex items-center gap-2"><Leaf className="w-4 h-4 text-forest-500" /> Resumo da sua jornada</h3>
        <p className="text-sm text-forest-800 mt-2 leading-relaxed">
          {stats.totalEntries > 0
            ? `Você fez ${stats.totalEntries} ${stats.totalEntries === 1 ? 'registro' : 'registros'} em ${monthLabel(current)}. Olhar para o que sente, um dia de cada vez, já é uma forma de cuidado. Continue assim.`
            : 'Ainda não há registros neste mês. Um pequeno registro por dia já ajuda a entender seus padrões. Comece quando quiser.'}
        </p>
        <button onClick={onNavigateDiary} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:gap-2 transition-all">
          <BookOpen className="w-4 h-4" /> Ir para o diário
        </button>
      </div>

      {/* Gratuito: CTA para o Mapa completo */}
      {!isEssential && (
        <div className="rounded-3xl bg-forest-900 text-white px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0"><TrendingUp className="w-5 h-5" /></span>
          <p className="flex-1 text-sm leading-relaxed text-forest-50">O Mapa Emocional completo — com energia, sono, ansiedade, autoestima e a linha do tempo emocional — está disponível a partir do plano Essencial.</p>
          <button onClick={onNavigatePricing} className="inline-flex items-center gap-2 bg-white text-forest-900 hover:bg-mint text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors whitespace-nowrap">Conhecer o Essencial</button>
        </div>
      )}

      {/* Plus: como o Mapa se conecta às demais funções */}
      {isPlus && (
        <div className="rounded-3xl border border-line bg-paper-soft px-6 py-5 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><Leaf className="w-4 h-4" /></span>
          <p className="text-sm text-forest-800 leading-relaxed">
            No plano Plus, o seu Mapa Emocional também alimenta o <strong>relatório mensal aprofundado</strong>, o <strong>plano de autocuidado</strong> e a <strong>orientação mensal</strong>. Quanto mais você registra no diário, mais personalizado fica esse acompanhamento.
          </p>
        </div>
      )}

      <p className="text-xs text-ink-soft border-t border-line pt-4">{DISCLAIMER}</p>
    </div>
  )
}

// ─── ABA: Gráficos ────────────────────────────────────────────────────────────

// Carrega os registros brutos do mês (e do anterior) para a análise emocional.
function useMonthAnalysis(userId: string | undefined, selectedMonth: string) {
  const [analysis, setAnalysis] = useState<EmotionalAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const [y, m] = selectedMonth.split('-').map(Number)
    const start = new Date(y, m - 1, 1).toISOString()
    const end = new Date(y, m, 1).toISOString()
    const prevStart = new Date(y, m - 2, 1).toISOString()
    Promise.all([
      supabase.from('diary_entries').select('*').eq('user_id', userId).gte('created_at', start).lt('created_at', end),
      supabase.from('diary_entries').select('*').eq('user_id', userId).gte('created_at', prevStart).lt('created_at', start),
    ]).then(([cur, prev]) => {
      setAnalysis(computeEmotionalAnalysis((cur.data ?? []) as DiaryRowLite[], (prev.data ?? []) as DiaryRowLite[]))
      setLoading(false)
    })
  }, [userId, selectedMonth])
  return { analysis, loading }
}

// Gráfico de linha compacto (recharts) para energia/ansiedade por dia.
function LineChartCard({ title, subtitle, data, color, yLabels }: {
  title: string; subtitle: string; data: { day: number; value: number }[]; color: string; yLabels: Record<number, string>
}) {
  return (
    <div className="bg-paper-soft border border-line rounded-2xl p-5">
      <h3 className="font-serif text-base text-forest-900">{title}</h3>
      <p className="text-xs text-ink-soft mt-0.5 mb-3">{subtitle}</p>
      {data.length > 1 ? (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id={`g-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#5F6661' }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 9, fill: '#5F6661' }} axisLine={false} tickLine={false} width={22} />
              <Tooltip formatter={(v: number) => [`${v} · ${yLabels[Math.round(v)] ?? ''}`, title]} labelFormatter={(l) => `Dia ${l}`} contentStyle={{ borderRadius: 12, border: '1px solid #E6E1D8', fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g-${color.replace('#', '')})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-ink-soft py-6 text-center">Poucos registros para traçar a linha. Continue registrando check-ins.</p>
      )}
    </div>
  )
}

const PERIOD_ICON: Record<string, React.ReactNode> = {
  madrugada: <CloudMoon className="w-4 h-4" />, manha: <Sun className="w-4 h-4" />,
  tarde: <Sunset className="w-4 h-4" />, noite: <Moon className="w-4 h-4" />,
}

function TabGraficos({ plan, user, onNavigatePricing }: {
  plan: string; user: User | null; onNavigatePricing: () => void
}) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return monthKey(d) })
  const { analysis, loading } = useMonthAnalysis(user?.id, selectedMonth)

  if (!hasPlan(plan, 'essential')) {
    return (
      <LockedSection
        requiredPlan="essential"
        message="Os gráficos e padrões do Mapa Emocional completo estão disponíveis a partir do plano Essencial."
        onNavigatePricing={onNavigatePricing}
      />
    )
  }

  if (loading || !analysis) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-forest-400" /></div>

  const a = analysis
  const insights = buildEssentialInsights(a)
  const maxEmo = Math.max(...a.topEmotions.map(e => e.count), 1)
  const maxTrig = Math.max(...a.triggers.map(t => t.count), 1)
  const moodTrend = a.prev.mood > 0 && a.avg.mood > 0 ? +(a.avg.mood - a.prev.mood).toFixed(1) : null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-soft">Mês:</label>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-line rounded-lg px-3 py-1.5 text-sm bg-paper-soft focus:outline-none">
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {a.totalEntries === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-mint/20 p-8 text-center space-y-3">
          <BarChart2 className="w-10 h-10 mx-auto text-forest-300" />
          <p className="text-sm font-medium text-forest-900">Ainda não há registros em {monthLabel(selectedMonth)}.</p>
          <p className="text-xs text-ink-soft max-w-sm mx-auto">Quanto mais check-ins e diários você registrar, mais claros ficam seus padrões — humor, energia, ansiedade, gatilhos e horários.</p>
        </div>
      ) : (
        <>
          {/* Insights automáticos */}
          {insights.length > 0 && (
            <div className="bg-paper-soft border border-line rounded-3xl p-5">
              <h3 className="font-serif text-lg text-forest-900 flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-forest-500" /> O que seus registros mostram</h3>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {insights.map((t, i) => (
                  <div key={i} className="flex gap-2.5 bg-mint/40 rounded-xl px-3.5 py-2.5">
                    <span className="text-forest-500 mt-0.5">•</span><p className="text-sm text-forest-800 leading-snug">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linhas: energia e ansiedade */}
          <div className="grid md:grid-cols-2 gap-4">
            <LineChartCard title="Energia" subtitle="Média por dia (1 = muito baixa · 5 = alta)" data={a.energyByDay} color="#2f9e6f" yLabels={{ 1: 'muito baixa', 2: 'baixa', 3: 'média', 4: 'boa', 5: 'alta' }} />
            <LineChartCard title="Ansiedade percebida" subtitle="Média por dia (1 = muito baixa · 5 = muito alta)" data={a.anxietyByDay} color="#d98b3c" yLabels={{ 1: 'muito baixa', 2: 'baixa', 3: 'média', 4: 'alta', 5: 'muito alta' }} />
          </div>

          {/* Relação energia × ansiedade */}
          <div className="rounded-2xl border border-line bg-mint/30 p-5">
            <h3 className="font-serif text-base text-forest-900 flex items-center gap-2 mb-2"><Waves className="w-4 h-4 text-forest-500" /> Energia e ansiedade</h3>
            <p className="text-sm text-forest-800 leading-relaxed">{a.energyAnxiety.text}</p>
          </div>

          {/* Emoções mais frequentes + gatilhos */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-paper-soft border border-line rounded-2xl p-5">
              <h3 className="font-serif text-base text-forest-900 flex items-center gap-2 mb-3"><Smile className="w-4 h-4 text-forest-500" /> Emoções mais frequentes</h3>
              {a.topEmotions.length > 0 ? (
                <div className="space-y-2">
                  {a.topEmotions.map(e => (
                    <div key={e.label} className="flex items-center gap-2">
                      <span className="text-base w-5 text-center">{e.emoji}</span>
                      <span className="text-sm text-ink w-28 flex-shrink-0 truncate">{e.label}</span>
                      <div className="flex-1 h-2.5 bg-mint rounded-full overflow-hidden"><div className="h-full bg-forest-500 rounded-full" style={{ width: `${(e.count / maxEmo) * 100}%` }} /></div>
                      <span className="text-xs text-ink-soft w-6 text-right">{e.count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-ink-soft py-4 text-center">Registre check-ins com emoções para ver o ranking.</p>}
            </div>

            <div className="bg-paper-soft border border-line rounded-2xl p-5">
              <h3 className="font-serif text-base text-forest-900 flex items-center gap-2 mb-3"><Flame className="w-4 h-4 text-forest-500" /> Gatilhos mais citados</h3>
              {a.triggers.length > 0 ? (
                <div className="space-y-2">
                  {a.triggers.map(t => (
                    <div key={t.tag} className="flex items-center gap-2">
                      <span className="text-sm text-ink w-28 flex-shrink-0 truncate">{t.tag}</span>
                      <div className="flex-1 h-2.5 bg-coral/20 rounded-full overflow-hidden"><div className="h-full bg-[#d98b3c] rounded-full" style={{ width: `${(t.count / maxTrig) * 100}%` }} /></div>
                      <span className="text-xs text-ink-soft w-6 text-right">{t.count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-ink-soft py-4 text-center">Quanto mais você registra, mais o sistema identifica gatilhos recorrentes.</p>}
            </div>
          </div>

          {/* Mapa por período do dia */}
          <div className="bg-paper-soft border border-line rounded-2xl p-5">
            <h3 className="font-serif text-base text-forest-900 flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-forest-500" /> Por período do dia</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {a.periods.map(p => (
                <div key={p.key} className="rounded-xl border border-line bg-white p-3 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-mint text-forest-600 mb-1.5">{PERIOD_ICON[p.key]}</span>
                  <p className="text-sm font-medium text-forest-900">{p.label}</p>
                  {p.count > 0 ? (
                    <>
                      <p className="text-lg mt-0.5">{p.dominant ? (MOOD_EMOJI[p.dominant] ?? '•') : '—'}</p>
                      <p className="text-[11px] text-ink-soft leading-tight">{p.dominant ?? '—'}</p>
                      <p className="text-[10px] text-ink-soft mt-1">{p.count} reg. · energia {p.avgEnergy || '—'}</p>
                    </>
                  ) : <p className="text-[11px] text-ink-soft mt-2">Sem registros</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Comparativo semanal */}
          {a.weekly.hasData && (
            <div className="rounded-2xl border border-line bg-paper-soft p-5">
              <h3 className="font-serif text-base text-forest-900 flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-forest-500" /> Semana atual x anterior</h3>
              <ul className="space-y-1.5">
                {a.weekly.lines.map((l, i) => <li key={i} className="text-sm text-forest-800 flex gap-2"><span className="text-forest-400 mt-0.5">→</span><span>{l}</span></li>)}
              </ul>
            </div>
          )}

          {/* Calendário emocional */}
          {a.calendar.length > 0 && (
            <div className="bg-paper-soft border border-line rounded-2xl p-5">
              <h3 className="font-serif text-base text-forest-900 flex items-center gap-2 mb-1"><BarChart2 className="w-4 h-4 text-forest-500" /> Calendário emocional</h3>
              <p className="text-xs text-ink-soft mb-3">Cada dia: emoção predominante e nº de registros.</p>
              <div className="grid grid-cols-7 gap-1.5">
                {a.calendar.map(c => (
                  <div key={c.day} title={`Dia ${c.day} · ${c.label} · ${c.count} registro(s)`} className={`aspect-square rounded-lg flex flex-col items-center justify-center ${heatColor(c.avg)}`}>
                    <span className="text-[10px] text-white/90 leading-none">{c.day}</span>
                    <span className="text-xs leading-none mt-0.5">{MOOD_EMOJI[c.label] ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparativo mensal do humor */}
          <div className="bg-paper-soft border border-line rounded-2xl p-5">
            <h3 className="font-serif text-base text-forest-900 mb-3">Humor: comparação com o mês anterior</h3>
            {a.prev.mood > 0 ? (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-ink-soft mb-1">Mês anterior</p><p className="font-serif text-xl text-forest-900">{a.prev.mood.toFixed(1)}</p></div>
                <div><p className="text-xs text-ink-soft mb-1">Variação</p><p className={`font-serif text-xl ${(moodTrend ?? 0) >= 0 ? 'text-forest-600' : 'text-coral'}`}>{(moodTrend ?? 0) >= 0 ? '+' : ''}{moodTrend ?? '—'}</p></div>
                <div><p className="text-xs text-ink-soft mb-1">Este mês</p><p className="font-serif text-xl text-forest-900">{a.avg.mood.toFixed(1)}</p></div>
              </div>
            ) : <p className="text-sm text-ink-soft">Sem registros no mês anterior para comparar.</p>}
          </div>
        </>
      )}

      <p className="text-xs text-ink-soft border-t border-line pt-4">{DISCLAIMER}</p>
    </div>
  )
}


// ─── Atalho de "Próximos passos" (§10.4) ─────────────────────────────────────
function ShortcutCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-paper-soft border border-line rounded-2xl px-4 py-3 hover:shadow-md hover:border-forest-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
    >
      <span className="text-sm text-forest-900 font-medium leading-snug flex items-center justify-between gap-2">
        {label}
        <span aria-hidden className="text-ink-soft group-hover:text-forest-700 group-hover:translate-x-0.5 transition-all">→</span>
      </span>
    </button>
  )
}
