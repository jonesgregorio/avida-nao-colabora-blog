import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getContentTypeLabel, getTargetAreaLabel } from '../lib/personalizedContentLabels'
import { exportElementToPdf } from '../lib/exportPdf'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { hasPlanAccess, getPlanLabel } from '../lib/officialPlans'
import PlanBadge from './PlanBadge'
import {
  BarChart2, FileText, Heart, Leaf, MessageSquare,
  Lock, Download, Send, RefreshCw, CheckCircle,
  Clock, AlertCircle, TrendingUp, BookOpen, Loader2, Sparkles,
  Smile, Zap, Moon, Waves,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

// ─── Constantes e helpers ──────────────────────────────────────────────────────

const DISCLAIMER = 'Este conteúdo é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

export type Tab = 'resumo' | 'graficos' | 'relatorios' | 'autocuidado' | 'orientacoes' | 'comentarios' | 'para-voce'

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

function StatCard({ label, value, sub, color = 'stone' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    stone: 'bg-paper-soft border-line',
    emerald: 'bg-mint/50 border-forest-100',
    blue: 'bg-sky/60 border-sky',
    purple: 'bg-lilac/50 border-lilac',
    amber: 'bg-amber-50 border-amber-100',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color] ?? colors.stone}`}>
      <p className="text-xs text-ink-soft mb-1">{label}</p>
      <p className="font-serif text-2xl text-forest-900">{value}</p>
      {sub && <p className="text-xs text-ink-soft mt-0.5">{sub}</p>}
    </div>
  )
}

function MoodBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-ink-soft">
        <span>{label}</span>
        <span>{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 bg-mint rounded-full overflow-hidden">
        <div className="h-full bg-forest-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
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

export default function MyEvolutionPage({ user, profile, onBack: _onBack, onNavigatePricing, onNavigateDiary, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'resumo')
  const plan = profile?.plan ?? 'free'

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  const tabs: { id: Tab; label: string; icon: React.ReactNode; minPlan: string }[] = [
    { id: 'resumo', label: 'Resumo', icon: <TrendingUp className="w-4 h-4" />, minPlan: 'free' },
    { id: 'graficos', label: 'Gráficos', icon: <BarChart2 className="w-4 h-4" />, minPlan: 'essential' },
    { id: 'relatorios', label: 'Relatórios', icon: <FileText className="w-4 h-4" />, minPlan: 'essential' },
    { id: 'autocuidado', label: 'Plano de autocuidado', icon: <Leaf className="w-4 h-4" />, minPlan: 'plus' },
    { id: 'orientacoes', label: 'Orientação profissional', icon: <MessageSquare className="w-4 h-4" />, minPlan: 'plus' },
    { id: 'comentarios', label: 'Comentário profissional', icon: <Heart className="w-4 h-4" />, minPlan: 'plus' },
    { id: 'para-voce', label: 'Para você', icon: <Sparkles className="w-4 h-4" />, minPlan: 'free' },
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

      {/* Tab content */}
      <div>
        {tab === 'resumo' && <TabResumo plan={plan} user={user} onNavigatePricing={onNavigatePricing} onNavigateDiary={onNavigateDiary} />}
        {tab === 'graficos' && <TabGraficos plan={plan} user={user} onNavigatePricing={onNavigatePricing} />}
        {tab === 'relatorios' && <TabRelatorios plan={plan} user={user} profile={profile} onNavigatePricing={onNavigatePricing} />}
        {tab === 'autocuidado' && <TabAutocuidado plan={plan} user={user} onNavigatePricing={onNavigatePricing} />}
        {tab === 'orientacoes' && <TabOrientacoes plan={plan} user={user} onNavigatePricing={onNavigatePricing} />}
        {tab === 'comentarios' && <TabComentarios plan={plan} user={user} onNavigatePricing={onNavigatePricing} />}
        {tab === 'para-voce' && <TabParaVoce user={user} />}
      </div>
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
      const moods = (entries as DiaryRow[]).map((e) => Number(e.mood || e.mood_score || 0)).filter(Boolean)
      const energies = (entries as DiaryRow[]).map((e) => Number(e.energy || 0)).filter(Boolean)
      const sleeps = (entries as DiaryRow[]).map((e) => Number(e.sleep_quality || 0)).filter(Boolean)
      const anxieties = (entries as DiaryRow[]).map((e) => Number(e.anxiety_level || 0)).filter(Boolean)
      const selfEsteems = (entries as DiaryRow[]).map((e) => Number(e.self_esteem || 0)).filter(Boolean)

      const tagCounts: Record<string, number> = {}
      ;(entries as DiaryRow[]).forEach((e) => {
        const tags: string[] = Array.isArray(e.emotional_tags) ? e.emotional_tags : (e.emotional_tags ? JSON.parse(e.emotional_tags) : [])
        tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
      })
      const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)

      const moodAvg = avg(moods)
      const dominantMoodScore = Math.round(moodAvg)
      const dominantMood = MOOD_LABELS[dominantMoodScore] ?? '—'

      const weeklyEntries = [0, 0, 0, 0]
      ;(entries as DiaryRow[]).forEach((e) => {
        const d = new Date(e.created_at)
        const weekIdx = Math.min(3, Math.floor((d.getDate() - 1) / 7))
        weeklyEntries[weekIdx]++
      })

      const dailyMoods = (entries as DiaryRow[]).map((e) => ({
        day: new Date(e.created_at).getDate(),
        mood: Number(e.mood || e.mood_score || 0),
      })).filter(x => x.mood > 0)

      const prevMoods = (prevEntries as DiaryRow[]).map((e) => Number(e.mood || e.mood_score || 0)).filter(Boolean)
      const prevEnergies = (prevEntries as DiaryRow[]).map((e) => Number(e.energy || 0)).filter(Boolean)
      const prevSleeps = (prevEntries as DiaryRow[]).map((e) => Number(e.sleep_quality || 0)).filter(Boolean)

      setStats({
        totalEntries: entries.length,
        avgMood: moodAvg,
        avgEnergy: avg(energies),
        avgSleep: avg(sleeps),
        avgAnxiety: avg(anxieties),
        avgSelfEsteem: avg(selfEsteems),
        dominantMood,
        topTags,
        weeklyEntries,
        dailyMoods,
        prevMonthAvgMood: avg(prevMoods),
        prevMonthAvgEnergy: avg(prevEnergies),
        prevMonthAvgSleep: avg(prevSleeps),
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

      {/* Gratuito: CTA */}
      {!isEssential && (
        <div className="rounded-3xl bg-forest-900 text-white px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0"><TrendingUp className="w-5 h-5" /></span>
          <p className="flex-1 text-sm leading-relaxed text-forest-50">Gráficos completos, relatórios mensais e marcadores avançados estão disponíveis a partir do plano Essencial.</p>
          <button onClick={onNavigatePricing} className="inline-flex items-center gap-2 bg-white text-forest-900 hover:bg-mint text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors whitespace-nowrap">Conhecer o Essencial</button>
        </div>
      )}

      <p className="text-xs text-ink-soft border-t border-line pt-4">{DISCLAIMER}</p>
    </div>
  )
}

// ─── ABA: Gráficos ────────────────────────────────────────────────────────────

function TabGraficos({ plan, user, onNavigatePricing }: {
  plan: string; user: User | null; onNavigatePricing: () => void
}) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey())

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return monthKey(d)
  })

  const { stats, loading } = useDiaryStats(user?.id, selectedMonth)

  if (!hasPlan(plan, 'essential')) {
    return (
      <LockedSection
        requiredPlan="essential"
        message="Gráficos de evolução estão disponíveis a partir do plano Essencial."
        onNavigatePricing={onNavigatePricing}
      />
    )
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>

  const maxBar = Math.max(...stats.weeklyEntries, 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm text-stone-600">Mês:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {stats.totalEntries === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum registro em {monthLabel(selectedMonth)}.</p>
        </div>
      ) : (
        <>
          {/* Gráfico: registros por semana */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-700 mb-4">Registros por semana</h3>
            <div className="flex items-end gap-3 h-24">
              {stats.weeklyEntries.map((n, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-stone-500">{n}</span>
                  <div className="w-full bg-stone-100 rounded-t relative" style={{ height: `${(n / maxBar) * 80}px`, minHeight: 4 }}>
                    <div className="absolute inset-0 bg-emerald-400 rounded-t" />
                  </div>
                  <span className="text-xs text-stone-400">S{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico: humor ao longo do mês */}
          {stats.dailyMoods.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="text-sm font-semibold text-stone-700 mb-4">Percepção de humor registrada por você</h3>
              <svg viewBox={`0 0 ${Math.max(stats.dailyMoods.length * 20, 100)} 60`} className="w-full" preserveAspectRatio="none" style={{ height: 80 }}>
                {stats.dailyMoods.map((d, i) => {
                  const x = i * 20 + 10
                  const y = 55 - (d.mood / 5) * 45
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={3} fill="#34d399" />
                      {i > 0 && (
                        <line
                          x1={(i - 1) * 20 + 10}
                          y1={55 - (stats.dailyMoods[i - 1].mood / 5) * 45}
                          x2={x} y2={y}
                          stroke="#34d399" strokeWidth={1.5} strokeOpacity={0.6}
                        />
                      )}
                    </g>
                  )
                })}
              </svg>
              <div className="flex justify-between text-xs text-stone-400 mt-1">
                <span>dia 1</span>
                <span>dia 31</span>
              </div>
            </div>
          )}

          {/* Médias */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-stone-700 mb-2">Médias do período</h3>
            {stats.avgMood > 0 && <MoodBar label="Humor" value={stats.avgMood} />}
            {hasPlan(plan, 'essential') && stats.avgEnergy > 0 && <MoodBar label="Energia" value={stats.avgEnergy} />}
            {hasPlan(plan, 'essential') && stats.avgSleep > 0 && <MoodBar label="Sono" value={stats.avgSleep} />}
            {hasPlan(plan, 'therapeutic') && stats.avgAnxiety > 0 && <MoodBar label="Ansiedade percebida" value={stats.avgAnxiety} />}
            {hasPlan(plan, 'therapeutic') && stats.avgSelfEsteem > 0 && <MoodBar label="Autoestima percebida" value={stats.avgSelfEsteem} />}
          </div>

          {/* Terapêutico: comparativo */}
          {hasPlan(plan, 'therapeutic') && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-stone-700 mb-2">Comparativo com mês anterior</h3>
              {stats.prevMonthAvgMood > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <p className="text-xs text-stone-400 mb-1">Humor anterior</p>
                      <p className="font-bold text-stone-700">{stats.prevMonthAvgMood.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-400 mb-1">Variação</p>
                      <p className={`font-bold ${stats.avgMood > stats.prevMonthAvgMood ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {stats.avgMood > stats.prevMonthAvgMood ? '+' : ''}{(stats.avgMood - stats.prevMonthAvgMood).toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-400 mb-1">Humor atual</p>
                      <p className="font-bold text-stone-700">{stats.avgMood.toFixed(1)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-stone-400">Sem registros no mês anterior para comparar.</p>
              )}
            </div>
          )}

          {!hasPlan(plan, 'therapeutic') && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center space-y-2">
              <p className="text-xs text-stone-500">Gráficos comparativos mensais e marcadores avançados estão disponíveis no plano Plus.</p>
              <button onClick={onNavigatePricing} className="text-xs text-emerald-600 underline">Ver planos</button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-stone-400 border-t border-stone-100 pt-4">{DISCLAIMER}</p>
    </div>
  )
}

// ─── ABA: Relatórios ─────────────────────────────────────────────────────────

interface MonthlyReport {
  id: string
  month_key: string
  report_type: string
  title: string | null
  summary: string | null
  status: string
  pdf_url: string | null
  created_at: string
  data_json: { totalEntries?: number; avgMood?: number; avgEnergy?: number; avgSleep?: number; topTags?: string[] } | null
}

function TabRelatorios({ plan, user, profile: _profile, onNavigatePricing }: {
  plan: string; user: User | null; profile: Profile | null; onNavigatePricing: () => void
}) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey())
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [reportExtras, setReportExtras] = useState<PersonalizedExtra[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const { stats } = useDiaryStats(user?.id, selectedMonth)

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return monthKey(d)
  })

  const loadReport = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const type = hasPlan(plan, 'therapeutic') ? 'advanced' : 'simple'
    const [repRes, extrasRes] = await Promise.all([
      supabase.from('monthly_reports').select('*')
        .eq('user_id', user.id).eq('month_key', selectedMonth).eq('report_type', type).maybeSingle(),
      supabase.from('personalized_content_deliveries')
        .select('id, title, body, content_type, sent_at, created_at')
        .eq('user_id', user.id).eq('status', 'sent').eq('target_area', 'reports')
        .order('sent_at', { ascending: false }).limit(10),
    ])
    setReport(repRes.data)
    setReportExtras((extrasRes.data ?? []) as PersonalizedExtra[])
    setLoading(false)
  }, [user, selectedMonth, plan])

  useEffect(() => { loadReport() }, [loadReport])

  if (!hasPlan(plan, 'essential')) {
    return (
      <LockedSection
        requiredPlan="essential"
        message="Relatórios mensais em PDF estão disponíveis a partir do plano Essencial."
        onNavigatePricing={onNavigatePricing}
      />
    )
  }

  async function generateReport() {
    if (!user) return
    setGenerating(true)
    const type = hasPlan(plan, 'therapeutic') ? 'advanced' : 'simple'
    const summary = `Registros: ${stats.totalEntries} | Humor predominante: ${stats.dominantMood} | Energia média: ${stats.avgEnergy.toFixed(1)}/5 | Sono médio: ${stats.avgSleep.toFixed(1)}/5`
    const { data, error } = await supabase.from('monthly_reports').upsert({
      user_id: user.id,
      month_key: selectedMonth,
      plan_key: plan,
      report_type: type,
      title: `Relatório de ${monthLabel(selectedMonth)}`,
      summary,
      data_json: {
        totalEntries: stats.totalEntries,
        avgMood: stats.avgMood,
        avgEnergy: stats.avgEnergy,
        avgSleep: stats.avgSleep,
        avgAnxiety: stats.avgAnxiety,
        topTags: stats.topTags,
        weeklyEntries: stats.weeklyEntries,
      },
      status: 'generated',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,month_key,report_type' }).select().maybeSingle()
    if (!error && data) setReport(data)
    setGenerating(false)
  }

  // Exporta apenas o conteúdo do relatório (sem sidebar/menu/botões) — §16.
  async function printReport() {
    const el = document.getElementById('report-print')
    if (el) await exportElementToPdf(el, `relatorio-${selectedMonth}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-stone-600">Mês:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
          {hasPlan(plan, 'therapeutic') ? 'Relatório Avançado' : 'Relatório Simples'}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : report ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4 print:shadow-none" id="report-print">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-stone-800">{report.title}</h2>
              <p className="text-xs text-stone-400 mt-0.5">Gerado em {new Date(report.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{report.report_type === 'advanced' ? 'Avançado' : 'Simples'}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Registros" value={report.data_json?.totalEntries ?? 0} />
            <StatCard label="Humor médio" value={report.data_json?.avgMood ? `${Number(report.data_json.avgMood).toFixed(1)}/5` : '—'} />
            <StatCard label="Energia média" value={report.data_json?.avgEnergy ? `${Number(report.data_json.avgEnergy).toFixed(1)}/5` : '—'} />
            <StatCard label="Sono médio" value={report.data_json?.avgSleep ? `${Number(report.data_json.avgSleep).toFixed(1)}/5` : '—'} />
          </div>

          {(report.data_json?.topTags?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-stone-500 mb-2">Marcadores mais registrados</p>
              <div className="flex flex-wrap gap-2">
                {report.data_json?.topTags?.map((tag: string) => (
                  <span key={tag} className="bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {hasPlan(plan, 'therapeutic-plus') && (
            <ProfessionalCommentStatus userId={user?.id} monthKey={selectedMonth} reportId={report.id} />
          )}

          <div className="border-t border-stone-100 pt-4 text-xs text-stone-400">{DISCLAIMER}</div>

          <div className="flex gap-2 flex-wrap print:hidden">
            <button
              onClick={printReport}
              className="flex items-center gap-2 border border-stone-200 text-stone-700 text-sm px-4 py-2 rounded-lg hover:bg-stone-50"
            >
              <Download className="w-4 h-4" /> Baixar / Imprimir PDF
            </button>
            <button onClick={generateReport} disabled={generating} className="flex items-center gap-2 text-stone-500 text-sm px-3 py-2 rounded-lg hover:bg-stone-50">
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center space-y-4">
          <FileText className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-stone-600 text-sm">Nenhum relatório gerado para {monthLabel(selectedMonth)}.</p>
          <p className="text-xs text-stone-400">Gere um relatório para ver o resumo do período.</p>
          <button
            onClick={generateReport}
            disabled={generating}
            className="bg-emerald-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? 'Gerando...' : 'Gerar relatório do mês'}
          </button>
        </div>
      )}

      {reportExtras.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Comentários e feedbacks da equipe</h3>
          {reportExtras.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-stone-200 p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-stone-800 text-sm">{e.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {e.content_type && <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{getContentTypeLabel(e.content_type)}</span>}
                  <span className="text-xs text-stone-400">{e.sent_at ? new Date(e.sent_at).toLocaleDateString('pt-BR') : ''}</span>
                </div>
              </div>
              <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{e.body}</p>
            </div>
          ))}
        </div>
      )}

      {!hasPlan(plan, 'therapeutic') && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center space-y-2">
          <p className="text-xs text-stone-500">Relatório avançado, gráficos comparativos e recomendações personalizadas estão no plano Plus.</p>
          <button onClick={onNavigatePricing} className="text-xs text-emerald-600 underline">Ver planos</button>
        </div>
      )}
    </div>
  )
}

function ProfessionalCommentStatus({ userId, monthKey: mk, reportId: _reportId }: {
  userId?: string; monthKey: string; reportId: string
}) {
  const [comment, setComment] = useState<{ id: string; comment?: string; comment_text?: string; report_month: string; created_at: string } | null>(null)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase.from('professional_comments')
      .select('id, comment, comment_text, report_month, created_at')
      .eq('user_id', userId).eq('report_month', mk)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => setComment(data))
  }, [userId, mk])

  async function requestComment() {
    if (!userId) return
    setRequesting(true)
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Comentário profissional solicitado',
      body: `Você solicitou um comentário profissional sobre o relatório de ${monthLabel(mk)}.`,
      type: 'system',
      action_view: 'my-evolution',
      is_read: false,
    })
    setRequesting(false)
    alert('Solicitação enviada! Você será avisado quando o comentário estiver disponível.')
  }

  if (!comment) {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-800 font-medium mb-2">Comentário profissional</p>
        <p className="text-xs text-purple-700 mb-3">Solicite um comentário individual do profissional sobre este relatório.</p>
        <button
          onClick={requestComment}
          disabled={requesting}
          className="flex items-center gap-2 bg-purple-700 text-white text-xs px-4 py-2 rounded-lg hover:bg-purple-800 disabled:opacity-50"
        >
          {requesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
          Solicitar comentário sobre este relatório
        </button>
      </div>
    )
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-purple-600" />
        <p className="text-sm text-purple-800 font-medium">Comentário profissional disponível</p>
      </div>
      <p className="text-sm text-stone-700 leading-relaxed">{comment.comment_text || comment.comment}</p>
      <p className="text-xs text-stone-400">{new Date(comment.created_at).toLocaleDateString('pt-BR')}</p>
      <p className="text-xs text-stone-400 italic">{DISCLAIMER}</p>
    </div>
  )
}

// ─── ABA: Plano de Autocuidado ────────────────────────────────────────────────

interface SelfCarePlan {
  id: string
  month_key: string
  summary: string | null
  suggested_adjustments: string | null
  next_focus: string | null
  pdf_url: string | null
  created_at: string
}

interface PersonalizedExtra {
  id: string; title: string; body: string; content_type: string | null; sent_at: string | null; created_at: string
}

function TabAutocuidado({ plan, user, onNavigatePricing }: {
  plan: string; user: User | null; onNavigatePricing: () => void
}) {
  const [reviews, setReviews] = useState<SelfCarePlan[]>([])
  const [extras, setExtras] = useState<PersonalizedExtra[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !hasPlan(plan, 'therapeutic')) { setLoading(false); return }
    Promise.all([
      supabase.from('self_care_plan_reviews').select('*')
        .eq('user_id', user.id).order('month_key', { ascending: false }).limit(6),
      supabase.from('personalized_content_deliveries')
        .select('id, title, body, content_type, sent_at, created_at')
        .eq('user_id', user.id).eq('status', 'sent').eq('target_area', 'self_care_plan')
        .order('sent_at', { ascending: false }).limit(10),
    ]).then(([r, d]) => {
      setReviews(r.data ?? [])
      setExtras((d.data ?? []) as PersonalizedExtra[])
      setLoading(false)
    })
  }, [user, plan])

  if (!hasPlan(plan, 'therapeutic')) {
    return (
      <LockedSection
        requiredPlan="therapeutic"
        message="O Plano de Autocuidado personalizado está disponível no plano Plus."
        onNavigatePricing={onNavigatePricing}
      />
    )
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-emerald-800 mb-2">Plano de Autocuidado Personalizado</h3>
        <p className="text-sm text-emerald-700">Seu plano de autocuidado é elaborado com base nos seus registros e questionários. O profissional responsável analisa seus dados e cria orientações personalizadas para você.</p>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center space-y-3">
          <Leaf className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-stone-600 text-sm">Nenhum plano de autocuidado disponível ainda.</p>
          <p className="text-xs text-stone-400">O profissional irá criar seu plano personalizado em breve.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-stone-800 text-sm">Plano de {monthLabel(r.month_key)}</h3>
                <span className="text-xs text-stone-400">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {r.summary && (
                <div>
                  <p className="text-xs text-stone-500 mb-1 font-medium">Resumo</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{r.summary}</p>
                </div>
              )}
              {r.suggested_adjustments && (
                <div>
                  <p className="text-xs text-stone-500 mb-1 font-medium">Ajustes sugeridos</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{r.suggested_adjustments}</p>
                </div>
              )}
              {r.next_focus && (
                <div>
                  <p className="text-xs text-stone-500 mb-1 font-medium">Foco próximo período</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{r.next_focus}</p>
                </div>
              )}
              {r.pdf_url && (
                <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-emerald-600 hover:underline">
                  <Download className="w-4 h-4" /> Baixar revisão em PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {extras.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Conteúdos personalizados recebidos</h3>
          {extras.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-stone-800 text-sm">{e.title}</p>
                {e.content_type && <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full flex-shrink-0">{getContentTypeLabel(e.content_type)}</span>}
              </div>
              <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{e.body}</p>
              <p className="text-xs text-stone-400">{e.sent_at ? new Date(e.sent_at).toLocaleDateString('pt-BR') : ''}</p>
            </div>
          ))}
        </div>
      )}

      {!hasPlan(plan, 'therapeutic-plus') && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center space-y-2">
          <Lock className="w-4 h-4 text-stone-300 mx-auto" />
          <p className="text-xs text-stone-500">Revisão mensal do plano de autocuidado com comentário profissional está disponível no plano Plus.</p>
          <button onClick={onNavigatePricing} className="text-xs text-emerald-600 underline">Ver planos</button>
        </div>
      )}

      <p className="text-xs text-stone-400 border-t border-stone-100 pt-4">{DISCLAIMER}</p>
    </div>
  )
}

// ─── ABA: Orientações ────────────────────────────────────────────────────────

interface GuidanceRequest {
  id: string
  month_key: string
  message: string
  context: string | null
  expected_help: string | null
  response: string | null
  status: string
  responded_at: string | null
  created_at: string
}

function TabOrientacoes({ plan, user, onNavigatePricing }: {
  plan: string; user: User | null; onNavigatePricing: () => void
}) {
  const current = monthKey()
  const [currentRequest, setCurrentRequest] = useState<GuidanceRequest | null>(null)
  const [history, setHistory] = useState<GuidanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [context, setContext] = useState('')
  const [expectedHelp, setExpectedHelp] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [curr, hist] = await Promise.all([
      supabase.from('monthly_guidance_requests').select('*').eq('user_id', user.id).eq('month_key', current).maybeSingle(),
      supabase.from('monthly_guidance_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
    ])
    setCurrentRequest(curr.data)
    setHistory(hist.data ?? [])
    setLoading(false)
  }, [user, current])

  useEffect(() => { load() }, [load])

  if (!hasPlan(plan, 'therapeutic')) {
    return (
      <LockedSection
        requiredPlan="therapeutic"
        message="Orientação mensal por mensagem está disponível no plano Plus."
        onNavigatePricing={onNavigatePricing}
      />
    )
  }

  async function send() {
    if (!user || !message.trim()) return
    setSending(true)
    setSendError(null)
    const { error } = await supabase.from('monthly_guidance_requests').insert({
      user_id: user.id,
      month_key: current,
      message: message.trim(),
      context: context.trim() || null,
      expected_help: expectedHelp.trim() || null,
      status: 'open',
    })
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Orientação enviada',
        body: 'Sua orientação mensal foi enviada. Você receberá uma notificação quando houver resposta.',
        type: 'system',
        action_view: 'my-evolution',
        is_read: false,
      })
      setShowForm(false)
      setMessage('')
      setContext('')
      setExpectedHelp('')
      setSendError(null)
      await load()
    } else {
      if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
        setSendError('Você já enviou sua orientação deste mês. Aguarde a resposta antes de enviar outra.')
      } else {
        setSendError('Não foi possível enviar sua orientação agora. Tente novamente em alguns instantes.')
      }
    }
    setSending(false)
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>

  const historyPast = history.filter(h => h.month_key !== current)

  return (
    <div className="space-y-6">
      {/* Info header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="text-sm font-medium text-emerald-800">Orientação mensal</p>
        <p className="text-xs text-emerald-700 mt-0.5">Você tem direito a 1 orientação por mensagem por mês. O profissional responderá em até 3 dias úteis.</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="text-sm font-semibold text-stone-700 mb-1">Orientação de {monthLabel(current)}</h3>

        {!currentRequest ? (
          <>
            <p className="text-sm text-stone-600 mb-4">Você tem 1 orientação disponível este mês.</p>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700"
              >
                <Send className="w-4 h-4" /> Enviar orientação do mês
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Sobre o que você quer orientação? *</label>
                  <textarea
                    value={message} onChange={e => setMessage(e.target.value)}
                    rows={3} placeholder="Descreva sua situação ou dúvida..."
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    disabled={sending}
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 block mb-1">O que você já tentou? (opcional)</label>
                  <textarea
                    value={context} onChange={e => setContext(e.target.value)}
                    rows={2} placeholder="Conte o que você já experimentou..."
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    disabled={sending}
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Que tipo de ajuda você espera receber? (opcional)</label>
                  <textarea
                    value={expectedHelp} onChange={e => setExpectedHelp(e.target.value)}
                    rows={2} placeholder="Ex: quero dicas práticas, quero entender melhor..."
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    disabled={sending}
                  />
                </div>
                {sendError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{sendError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={send}
                    disabled={sending || !message.trim()}
                    className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? 'Enviando...' : 'Enviar orientação'}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setSendError(null) }}
                    disabled={sending}
                    className="border border-stone-200 text-stone-600 text-sm px-4 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : currentRequest.status === 'open' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-800 font-medium">Orientação enviada — aguardando resposta</p>
                <p className="text-xs text-amber-500 mt-0.5">Enviada em {new Date(currentRequest.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-stone-400 font-medium mb-1">Sua mensagem</p>
                <p className="text-sm text-stone-700">{currentRequest.message}</p>
              </div>
              {currentRequest.context && (
                <div>
                  <p className="text-xs text-stone-400 font-medium mb-1">O que já tentou</p>
                  <p className="text-sm text-stone-600">{currentRequest.context}</p>
                </div>
              )}
              {currentRequest.expected_help && (
                <div>
                  <p className="text-xs text-stone-400 font-medium mb-1">Ajuda esperada</p>
                  <p className="text-sm text-stone-600">{currentRequest.expected_help}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-stone-400 italic">Você já utilizou sua orientação mensal. Você será notificado quando houver resposta.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-emerald-800 font-medium">Sua orientação foi respondida</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {currentRequest.responded_at ? new Date(currentRequest.responded_at).toLocaleDateString('pt-BR') : ''}
                </p>
              </div>
            </div>
            <div className="bg-stone-50 border border-stone-100 rounded-lg p-4">
              <p className="text-xs text-stone-400 font-medium mb-1">Sua pergunta</p>
              <p className="text-sm text-stone-700">{currentRequest.message}</p>
            </div>
            {currentRequest.response && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-xs text-emerald-600 mb-1 font-medium">Resposta</p>
                <p className="text-sm text-stone-700 leading-relaxed">{currentRequest.response}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Histórico */}
      {historyPast.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 underline"
          >
            {showHistory ? 'Ocultar histórico' : `Ver histórico de orientações (${historyPast.length})`}
          </button>
          {showHistory && historyPast.map(h => (
            <div key={h.id} className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">{monthLabel(h.month_key)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  h.status === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                  h.status === 'closed' ? 'bg-stone-100 text-stone-500' :
                  'bg-amber-100 text-amber-700'
                }`}>{h.status === 'answered' ? 'Respondida' : h.status === 'closed' ? 'Encerrada' : 'Aguardando'}</span>
              </div>
              <p className="text-xs text-stone-500 line-clamp-2">{h.message}</p>
              {h.response && (
                <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded leading-relaxed">{h.response}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-400 border-t border-stone-100 pt-4">{DISCLAIMER}</p>
    </div>
  )
}

// ─── ABA: Comentários Profissionais ──────────────────────────────────────────

interface ProfessionalComment {
  id: string
  report_month: string | null
  month_key: string | null
  comment: string | null
  comment_text: string | null
  title: string | null
  professional_name: string | null
  status: string | null
  created_at: string
}

function safeMonthLabel(key: string | null | undefined) {
  if (!key) return '—'
  try { return monthLabel(key) } catch { return key }
}

function commentText(c: ProfessionalComment) {
  return c.comment_text || c.comment || ''
}

function commentMonth(c: ProfessionalComment) {
  return c.report_month || c.month_key || null
}

function TabComentarios({ plan, user, onNavigatePricing }: {
  plan: string; user: User | null; onNavigatePricing: () => void
}) {
  const [comments, setComments] = useState<ProfessionalComment[]>([])
  const [extras, setExtras] = useState<PersonalizedExtra[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !hasPlan(plan, 'therapeutic-plus')) { setLoading(false); return }
    Promise.all([
      supabase.from('professional_comments')
        .select('id, report_month, comment, comment_text, title, professional_name, created_at')
        .eq('user_id', user.id).order('report_month', { ascending: false }),
      supabase.from('personalized_content_deliveries')
        .select('id, title, body, content_type, sent_at, created_at')
        .eq('user_id', user.id).eq('status', 'sent').eq('target_area', 'professional_comments')
        .order('sent_at', { ascending: false }).limit(10),
    ]).then(([c, d]) => {
      setComments((c.data as ProfessionalComment[]) ?? [])
      setExtras((d.data ?? []) as PersonalizedExtra[])
      setLoading(false)
    })
  }, [user, plan])

  if (!hasPlan(plan, 'therapeutic-plus')) {
    return (
      <LockedSection
        requiredPlan="therapeutic-plus"
        message="Comentários individuais sobre o relatório do mês estão disponíveis no plano Plus."
        onNavigatePricing={onNavigatePricing}
      />
    )
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-purple-800 mb-1">Comentários Profissionais</h3>
        <p className="text-sm text-purple-700">Receba uma devolutiva breve do profissional sobre os seus registros mensais.</p>
      </div>

      {comments.length === 0 && extras.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center space-y-3">
          <MessageSquare className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-stone-600 text-sm">Nenhum comentário profissional disponível ainda.</p>
          <p className="text-xs text-stone-400">Os comentários aparecem aqui após o profissional analisar seu relatório do mês.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-stone-800 text-sm">
                  {c.title ?? `Comentário de ${safeMonthLabel(commentMonth(c))}`}
                </h3>
                <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {c.professional_name && (
                <p className="text-xs text-stone-400">Por: {c.professional_name}</p>
              )}
              <p className="text-sm text-stone-700 leading-relaxed">{commentText(c)}</p>
              <div className="border-t border-stone-100 pt-3">
                <p className="text-xs text-stone-400 italic">{DISCLAIMER}</p>
              </div>
            </div>
          ))}
          {extras.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-stone-800 text-sm">{e.title}</h3>
                <span className="text-xs text-stone-400">{e.sent_at ? new Date(e.sent_at).toLocaleDateString('pt-BR') : ''}</span>
              </div>
              {e.content_type && <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{getContentTypeLabel(e.content_type)}</span>}
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{e.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Para você ────────────────────────────────────────────────────────────

interface PersonalizedDelivery {
  id: string
  title: string
  body: string
  content_type: string
  plan_key: string | null
  target_area: string | null
  sent_at: string | null
  created_at: string
  read_at: string | null
}

function TabParaVoce({ user }: { user: User | null }) {
  const [deliveries, setDeliveries] = useState<PersonalizedDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    supabase
      .from('personalized_content_deliveries')
      .select('id, title, body, content_type, plan_key, target_area, sent_at, created_at, read_at')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setDeliveries((data ?? []) as PersonalizedDelivery[])
        setLoading(false)
      })
  }, [user?.id])

  async function markAsRead(id: string) {
    await supabase.from('personalized_content_deliveries').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
    setDeliveries(prev => prev.map(d => d.id === id && !d.read_at ? { ...d, read_at: new Date().toISOString() } : d))
  }

  function handleExpand(id: string) {
    const next = expanded === id ? null : id
    setExpanded(next)
    if (next) markAsRead(id)
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-300" /></div>
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="font-medium text-stone-700">Nada aqui ainda</p>
        <p className="text-sm text-stone-400 max-w-xs mx-auto">Quando a equipe preparar algo especialmente para você, vai aparecer aqui.</p>
      </div>
    )
  }

  const unreadCount = deliveries.filter(d => !d.read_at).length

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="mb-4 space-y-1">
        <p className="text-sm text-stone-500">Conteúdos preparados com base no seu uso e revisados pela equipe antes do envio.</p>
        {unreadCount > 0 && (
          <p className="text-xs font-medium text-emerald-600">{unreadCount} novo{unreadCount !== 1 ? 's' : ''} para você</p>
        )}
      </div>
      {deliveries.map(d => {
        const isNew = !d.read_at
        return (
          <div key={d.id} className={`bg-white rounded-xl border p-5 space-y-3 transition-colors ${isNew ? 'border-emerald-200 shadow-sm' : 'border-stone-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {isNew && (
                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Novo</span>
                  )}
                  {d.content_type && (
                    <span className="text-[10px] font-medium bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{getContentTypeLabel(d.content_type)}</span>
                  )}
                  {d.target_area && (
                    <span className="text-[10px] text-stone-400">{getTargetAreaLabel(d.target_area)}</span>
                  )}
                  <span className="text-[10px] text-stone-400 ml-auto">
                    {d.sent_at ? new Date(d.sent_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </span>
                </div>
                <p className="font-semibold text-stone-800 text-sm leading-snug">{d.title}</p>
              </div>
              <button
                onClick={() => handleExpand(d.id)}
                className="text-xs text-emerald-600 hover:text-emerald-700 flex-shrink-0 font-medium"
              >
                {expanded === d.id ? 'Fechar' : 'Ler'}
              </button>
            </div>
            {expanded !== d.id && (
              <p className="text-sm text-stone-500 line-clamp-2">{d.body}</p>
            )}
            {expanded === d.id && (
              <div className="border-t border-stone-100 pt-3 space-y-3">
                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{d.body}</p>
                <p className="text-xs text-stone-400 italic border-t border-stone-100 pt-3">{DISCLAIMER}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
