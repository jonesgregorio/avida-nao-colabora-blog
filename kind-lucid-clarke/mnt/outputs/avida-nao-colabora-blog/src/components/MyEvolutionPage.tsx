import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getContentTypeLabel, getTargetAreaLabel } from '../lib/personalizedContentLabels'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import {
  BarChart2, FileText, Heart, Leaf, MessageSquare, Video,
  Lock, ChevronLeft, Download, Send, RefreshCw, CheckCircle,
  Clock, Calendar, AlertCircle, TrendingUp, BookOpen, Loader2, Sparkles,
} from 'lucide-react'

// ─── Constantes e helpers ──────────────────────────────────────────────────────

const DISCLAIMER = 'Este conteúdo é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

const PLAN_RANK: Record<string, number> = {
  free: 0, essential: 1, therapeutic: 2, 'therapeutic-plus': 3,
}

type Tab = 'resumo' | 'graficos' | 'relatorios' | 'autocuidado' | 'orientacoes' | 'comentarios' | 'sessao' | 'para-voce'

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function hasPlan(userPlan: string, required: string) {
  return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[required] ?? 99)
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
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
        Conhecer plano {PLAN_LABELS[requiredPlan]}
      </button>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'stone' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    stone: 'bg-stone-50 border-stone-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    amber: 'bg-amber-50 border-amber-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.stone}`}>
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function MoodBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-stone-500">
        <span>{label}</span>
        <span>{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
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

export default function MyEvolutionPage({ user, profile, onBack, onNavigatePricing, onNavigateDiary, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'resumo')
  const plan = profile?.plan ?? 'free'

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  const tabs: { id: Tab; label: string; icon: React.ReactNode; minPlan: string }[] = [
    { id: 'resumo', label: 'Resumo', icon: <TrendingUp className="w-4 h-4" />, minPlan: 'free' },
    { id: 'graficos', label: 'Gráficos', icon: <BarChart2 className="w-4 h-4" />, minPlan: 'essential' },
    { id: 'relatorios', label: 'Relatórios', icon: <FileText className="w-4 h-4" />, minPlan: 'essential' },
    { id: 'autocuidado', label: 'Plano de Autocuidado', icon: <Leaf className="w-4 h-4" />, minPlan: 'therapeutic' },
    { id: 'orientacoes', label: 'Orientações', icon: <MessageSquare className="w-4 h-4" />, minPlan: 'therapeutic' },
    { id: 'comentarios', label: 'Comentários Profissionais', icon: <Heart className="w-4 h-4" />, minPlan: 'therapeutic-plus' },
    { id: 'sessao', label: 'Sessão Plus', icon: <Video className="w-4 h-4" />, minPlan: 'therapeutic-plus' },
    { id: 'para-voce', label: 'Para você', icon: <Sparkles className="w-4 h-4" />, minPlan: 'free' },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="text-stone-400 hover:text-stone-700 p-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Minha Evolução</h1>
            <p className="text-sm text-stone-500">Plano {PLAN_LABELS[plan]}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-stone-200">
          {tabs.map(t => {
            const locked = !hasPlan(plan, t.minPlan)
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px font-medium ${
                  tab === t.id
                    ? 'border-emerald-600 text-emerald-700 bg-white'
                    : locked
                    ? 'border-transparent text-stone-300 cursor-pointer'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                {locked ? <Lock className="w-3.5 h-3.5 opacity-50" /> : t.icon}
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
          {tab === 'sessao' && <TabSessaoPlus plan={plan} user={user} onNavigatePricing={onNavigatePricing} />}
          {tab === 'para-voce' && <TabParaVoce user={user} />}
        </div>
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
      const moods = entries.map((e: any) => Number(e.mood || e.mood_score || 0)).filter(Boolean)
      const energies = entries.map((e: any) => Number(e.energy || 0)).filter(Boolean)
      const sleeps = entries.map((e: any) => Number(e.sleep_quality || 0)).filter(Boolean)
      const anxieties = entries.map((e: any) => Number(e.anxiety_level || 0)).filter(Boolean)
      const selfEsteems = entries.map((e: any) => Number(e.self_esteem || 0)).filter(Boolean)

      const tagCounts: Record<string, number> = {}
      entries.forEach((e: any) => {
        const tags: string[] = Array.isArray(e.emotional_tags) ? e.emotional_tags : (e.emotional_tags ? JSON.parse(e.emotional_tags) : [])
        tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
      })
      const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)

      const moodAvg = avg(moods)
      const dominantMoodScore = Math.round(moodAvg)
      const dominantMood = MOOD_LABELS[dominantMoodScore] ?? '—'

      const weeklyEntries = [0, 0, 0, 0]
      entries.forEach((e: any) => {
        const d = new Date(e.created_at)
        const weekIdx = Math.min(3, Math.floor((d.getDate() - 1) / 7))
        weeklyEntries[weekIdx]++
      })

      const dailyMoods = entries.map((e: any) => ({
        day: new Date(e.created_at).getDate(),
        mood: Number(e.mood || e.mood_score || 0),
      })).filter(x => x.mood > 0)

      const prevMoods = prevEntries.map((e: any) => Number(e.mood || e.mood_score || 0)).filter(Boolean)
      const prevEnergies = prevEntries.map((e: any) => Number(e.energy || 0)).filter(Boolean)
      const prevSleeps = prevEntries.map((e: any) => Number(e.sleep_quality || 0)).filter(Boolean)

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

function TabResumo({ plan, user, onNavigatePricing, onNavigateDiary }: {
  plan: string; user: User | null; onNavigatePricing: () => void; onNavigateDiary: () => void
}) {
  const current = monthKey()
  const { stats, loading } = useDiaryStats(user?.id, current)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500">Resumo de {monthLabel(current)}</p>

      {/* Cards base — todos os planos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Registros no mês" value={stats.totalEntries} sub={plan === 'free' ? `de 5 disponíveis` : undefined} color="emerald" />
        <StatCard label="Humor predominante" value={stats.dominantMood} sub={stats.avgMood > 0 ? `média ${stats.avgMood.toFixed(1)}/5` : 'sem registros'} color="amber" />
        {hasPlan(plan, 'essential') && (
          <>
            <StatCard label="Energia média" value={stats.avgEnergy > 0 ? `${stats.avgEnergy.toFixed(1)}/5` : '—'} color="blue" />
            <StatCard label="Sono médio" value={stats.avgSleep > 0 ? `${stats.avgSleep.toFixed(1)}/5` : '—'} color="purple" />
          </>
        )}
        {!hasPlan(plan, 'essential') && (
          <>
            <div className="rounded-xl border border-dashed border-stone-200 p-4 flex flex-col items-center justify-center gap-2 col-span-2">
              <Lock className="w-4 h-4 text-stone-300" />
              <p className="text-xs text-stone-400 text-center">Energia, sono e mais estão no plano Essencial</p>
              <button onClick={onNavigatePricing} className="text-xs text-emerald-600 underline">Ver planos</button>
            </div>
          </>
        )}
      </div>

      {/* Tags emocionais */}
      {hasPlan(plan, 'essential') && stats.topTags.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Marcadores mais registrados por você</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map(tag => (
              <span key={tag} className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full border border-emerald-100">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Terapêutico: comparativo */}
      {hasPlan(plan, 'therapeutic') && stats.prevMonthAvgMood > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-4">Comparativo com mês anterior</h3>
          <div className="space-y-3">
            <MoodBar label="Humor (este mês)" value={stats.avgMood} />
            <MoodBar label="Humor (mês anterior)" value={stats.prevMonthAvgMood} />
            {stats.avgEnergy > 0 && <MoodBar label="Energia (este mês)" value={stats.avgEnergy} />}
            {stats.avgSleep > 0 && <MoodBar label="Sono (este mês)" value={stats.avgSleep} />}
          </div>
        </div>
      )}

      {/* Plus: próxima sessão / comentário */}
      {hasPlan(plan, 'therapeutic-plus') && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-purple-800 mb-2">✦ Recursos Terapêutico Plus</h3>
          <p className="text-sm text-purple-700">Acesse as abas "Sessão Plus" e "Comentários Profissionais" para ver sua sessão mensal e os comentários sobre seu relatório.</p>
        </div>
      )}

      {/* Gratuito: CTA */}
      {!hasPlan(plan, 'essential') && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2">
          <p className="text-sm text-emerald-800 font-medium">Quer ver gráficos, relatórios mensais e resumos completos?</p>
          <p className="text-xs text-emerald-700">Gráficos, relatórios mensais e resumos completos estão disponíveis a partir do plano Essencial.</p>
          <button onClick={onNavigatePricing} className="bg-emerald-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-emerald-700 font-medium">
            Conhecer plano Essencial
          </button>
        </div>
      )}

      <button onClick={onNavigateDiary} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 underline">
        <BookOpen className="w-4 h-4" /> Ir para o diário
      </button>

      <p className="text-xs text-stone-400 border-t border-stone-100 pt-4">{DISCLAIMER}</p>
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
              <p className="text-xs text-stone-500">Gráficos comparativos mensais e marcadores avançados estão disponíveis no plano Terapêutico.</p>
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
  data_json: any
}

function TabRelatorios({ plan, user, profile, onNavigatePricing }: {
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

  function printReport() {
    window.print()
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

          {report.data_json?.topTags?.length > 0 && (
            <div>
              <p className="text-xs text-stone-500 mb-2">Marcadores mais registrados</p>
              <div className="flex flex-wrap gap-2">
                {report.data_json.topTags.map((tag: string) => (
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
          <p className="text-xs text-stone-500">Relatório avançado, gráficos comparativos e recomendações personalizadas estão no plano Terapêutico.</p>
          <button onClick={onNavigatePricing} className="text-xs text-emerald-600 underline">Ver planos</button>
        </div>
      )}
    </div>
  )
}

function ProfessionalCommentStatus({ userId, monthKey: mk, reportId }: {
  userId?: string; monthKey: string; reportId: string
}) {
  const [comment, setComment] = useState<any>(null)
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
        message="O Plano de Autocuidado personalizado está disponível no plano Terapêutico."
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
          <p className="text-xs text-stone-500">Revisão mensal do plano de autocuidado com comentário profissional está disponível no plano Terapêutico Plus.</p>
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
        message="Orientação mensal por mensagem está disponível no plano Terapêutico."
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
        message="Comentários individuais sobre o relatório do mês estão disponíveis no plano Terapêutico Plus."
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

// ─── ABA: Sessão Plus ────────────────────────────────────────────────────────

interface UserSession {
  id: string
  month_key: string
  scheduled_at: string | null
  duration_minutes: number
  status: string
  preferred_slots: Array<{ label: string; datetime: string; period: string }> | null
  user_notes: string | null
  admin_notes: string | null
  professional_name: string | null
  meeting_link: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
}

const SESSION_STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  available:   { label: 'Sessão disponível',         color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-4 h-4" /> },
  requested:   { label: 'Aguardando confirmação',    color: 'bg-amber-100 text-amber-700',     icon: <Clock className="w-4 h-4" /> },
  scheduled:   { label: 'Sessão agendada',           color: 'bg-blue-100 text-blue-700',       icon: <Calendar className="w-4 h-4" /> },
  rescheduled: { label: 'Sessão remarcada',          color: 'bg-purple-100 text-purple-700',   icon: <Calendar className="w-4 h-4" /> },
  completed:   { label: 'Sessão realizada',          color: 'bg-stone-100 text-stone-600',     icon: <CheckCircle className="w-4 h-4" /> },
  used:        { label: 'Sessão deste mês utilizada',color: 'bg-stone-100 text-stone-500',     icon: <CheckCircle className="w-4 h-4" /> },
  cancelled:   { label: 'Sessão cancelada',          color: 'bg-red-100 text-red-600',         icon: <AlertCircle className="w-4 h-4" /> },
}

const PERIOD_OPTIONS = ['Manhã', 'Tarde', 'Noite', 'Qualquer horário']

const SESSION_DISCLAIMER = 'Este serviço é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

function TabSessaoPlus({ plan, user, onNavigatePricing }: {
  plan: string; user: User | null; onNavigatePricing: () => void
}) {
  const current = monthKey()
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Form slots
  const [slot1, setSlot1] = useState('')
  const [slot2, setSlot2] = useState('')
  const [slot3, setSlot3] = useState('')
  const [period, setPeriod] = useState('Qualquer horário')
  const [userNotes, setUserNotes] = useState('')

  const isPlus = hasPlan(plan, 'therapeutic-plus')
  const [sessionExtras, setSessionExtras] = useState<PersonalizedExtra[]>([])

  const load = useCallback(async () => {
    if (!user || !isPlus) { setLoading(false); return }
    const [sessData, delivData] = await Promise.all([
      supabase.from('user_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('personalized_content_deliveries')
        .select('id, title, body, content_type, sent_at, created_at')
        .eq('user_id', user.id).eq('status', 'sent').eq('target_area', 'session_plus')
        .order('sent_at', { ascending: false }).limit(10),
    ])
    const all = (sessData.data ?? []) as UserSession[]
    setSessions(all)
    setSessionExtras((delivData.data ?? []) as PersonalizedExtra[])
    const cur = all.find(s => s.month_key === current) ?? null
    setCurrentSession(cur)
    setLoading(false)
  }, [user, isPlus, current])

  useEffect(() => { load() }, [load])

  if (!isPlus) {
    return (
      <LockedSection
        requiredPlan="therapeutic-plus"
        message="Sessão mensal de 30 minutos com Psicanalista está disponível no plano Terapêutico Plus."
        onNavigatePricing={onNavigatePricing}
      />
    )
  }

  async function submitRequest() {
    if (!user) return
    if (!slot1) { setSubmitError('Informe pelo menos a Opção 1 de data e horário.'); return }

    const now = new Date()
    for (const [label, dt] of [['Opção 1', slot1], ['Opção 2', slot2], ['Opção 3', slot3]] as const) {
      if (dt && new Date(dt) < now) {
        setSubmitError(`${label}: a data não pode ser no passado.`); return
      }
    }

    setSubmitting(true)
    setSubmitError(null)

    const slots = [
      { label: 'Opção 1', datetime: slot1, period },
      ...(slot2 ? [{ label: 'Opção 2', datetime: slot2, period }] : []),
      ...(slot3 ? [{ label: 'Opção 3', datetime: slot3, period }] : []),
    ]

    const payload = {
      user_id: user.id,
      month_key: current,
      status: 'requested',
      duration_minutes: 30,
      preferred_slots: slots,
      user_notes: userNotes || null,
    }

    let result: UserSession | null = null
    let err: any = null

    if (currentSession) {
      // Atualizar solicitação existente (status available → requested)
      const { data, error } = await supabase
        .from('user_sessions')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', currentSession.id)
        .select()
        .maybeSingle()
      result = data; err = error
    } else {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert(payload)
        .select()
        .maybeSingle()
      result = data; err = error
    }

    if (err) {
      setSubmitError('Não foi possível enviar sua solicitação de sessão. Tente novamente.')
      setSubmitting(false)
      return
    }

    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Solicitação de sessão enviada',
      body: 'Sua solicitação de sessão mensal foi recebida. Em breve você receberá a confirmação do agendamento.',
      type: 'system',
      action_view: 'my-evolution',
      action_label: 'Ver minha sessão',
      is_read: false,
    })

    setCurrentSession(result)
    setSubmitting(false)
    setSubmitSuccess(true)
    setShowForm(false)
    setSlot1(''); setSlot2(''); setSlot3(''); setUserNotes('')
    await load()
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>

  const statusInfo = currentSession
    ? (SESSION_STATUS_LABELS[currentSession.status] ?? SESSION_STATUS_LABELS.available)
    : null

  const isRequested   = currentSession?.status === 'requested'
  const isScheduled   = currentSession?.status === 'scheduled' || currentSession?.status === 'rescheduled'
  const isDone        = currentSession?.status === 'completed' || currentSession?.status === 'used'
  const isCancelled   = currentSession?.status === 'cancelled'
  const canRequest    = !currentSession || currentSession.status === 'available'

  const pastSessions = sessions.filter(s => s.month_key !== current)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-purple-800 mb-1">Sessão Plus — {monthLabel(current)}</h3>
        <p className="text-sm text-purple-700">Você tem direito a 1 sessão mensal de 30 minutos com a Psicanalista responsável.</p>
      </div>

      {/* Aviso de saúde */}
      <div className="flex items-start gap-2 bg-stone-50 border border-stone-200 rounded-xl p-4">
        <AlertCircle className="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-stone-500">{SESSION_DISCLAIMER}</p>
      </div>

      {/* Feedback de sucesso */}
      {submitSuccess && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">
            Sua solicitação foi enviada. A equipe irá confirmar o melhor horário e você receberá uma notificação.
          </p>
        </div>
      )}

      {/* Card da sessão do mês */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-stone-700">Sessão de {monthLabel(current)}</h3>

        {/* Status badge */}
        {statusInfo && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusInfo.color}`}>
            {statusInfo.icon}
            <span className="text-sm font-medium">{statusInfo.label}</span>
          </div>
        )}

        {/* Sem sessão → botão solicitar */}
        {canRequest && !showForm && (
          <div className="space-y-3">
            {!currentSession && <p className="text-sm text-stone-600">Sua sessão deste mês está disponível.</p>}
            <button
              onClick={() => { setShowForm(true); setSubmitSuccess(false) }}
              className="flex items-center gap-2 bg-purple-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-800"
            >
              <Calendar className="w-4 h-4" /> Solicitar agendamento
            </button>
          </div>
        )}

        {/* Formulário de horários */}
        {showForm && (
          <div className="space-y-4 border-t border-stone-100 pt-4">
            <p className="text-sm text-stone-600 font-medium">Informe suas opções de data e horário:</p>

            {[['Opção 1 (obrigatória)', slot1, setSlot1] as const,
              ['Opção 2', slot2, setSlot2] as const,
              ['Opção 3', slot3, setSlot3] as const,
            ].map(([label, val, setter]) => (
              <div key={label}>
                <label className="text-xs text-stone-500 block mb-1">{label}</label>
                <input
                  type="datetime-local"
                  value={val}
                  onChange={e => setter(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            ))}

            <div>
              <label className="text-xs text-stone-500 block mb-1">Melhor período</label>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Observações (opcional)</label>
              <textarea
                value={userNotes}
                onChange={e => setUserNotes(e.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Algum ponto específico que gostaria de abordar?"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              />
            </div>

            {submitError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={submitRequest}
                disabled={submitting}
                className="flex items-center gap-2 bg-purple-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-800 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Enviando...' : 'Enviar solicitação'}
              </button>
              <button
                onClick={() => { setShowForm(false); setSubmitError(null) }}
                disabled={submitting}
                className="border border-stone-200 text-stone-600 text-sm px-4 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Status: solicitada */}
        {isRequested && (
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <p className="text-sm text-stone-600">Sua solicitação foi enviada e está aguardando confirmação.</p>
            {currentSession?.preferred_slots && currentSession.preferred_slots.length > 0 && (
              <div className="bg-stone-50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-stone-500 font-medium mb-2">Opções enviadas:</p>
                {currentSession.preferred_slots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-stone-600">
                    <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span className="font-medium text-stone-700">{slot.label}:</span>
                    {new Date(slot.datetime).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
                      year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                    {slot.period && slot.period !== 'Qualquer horário' && (
                      <span className="text-xs text-stone-400">({slot.period})</span>
                    )}
                  </div>
                ))}
                {currentSession.user_notes && (
                  <div className="mt-2 pt-2 border-t border-stone-200">
                    <p className="text-xs text-stone-500 font-medium mb-1">Observações:</p>
                    <p className="text-sm text-stone-600">{currentSession.user_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status: agendada / remarcada */}
        {isScheduled && (
          <div className="space-y-3 border-t border-stone-100 pt-4">
            {currentSession?.scheduled_at && (
              <div className="flex items-center gap-2 text-sm text-stone-700 font-medium">
                <Calendar className="w-4 h-4 text-blue-500" />
                {new Date(currentSession.scheduled_at).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo', weekday: 'long',
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            )}
            <p className="text-sm text-stone-600">
              Duração: <span className="font-medium">{currentSession?.duration_minutes ?? 30} minutos</span>
            </p>
            <p className="text-sm text-stone-600">
              Profissional: <span className="font-medium">{currentSession?.professional_name ?? 'A definir'}</span>
            </p>
            {currentSession?.meeting_link ? (
              <a
                href={currentSession.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-purple-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-800 w-fit"
              >
                <Video className="w-4 h-4" /> Entrar na sessão
              </a>
            ) : (
              <p className="text-sm text-stone-400 italic">O link da sessão será informado pela equipe.</p>
            )}
            {currentSession?.admin_notes && (
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-500 mb-1">Observações da equipe</p>
                <p className="text-sm text-stone-600">{currentSession.admin_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Status: realizada */}
        {isDone && (
          <p className="text-sm text-stone-600 border-t border-stone-100 pt-4">
            Sessão deste mês realizada.
            {currentSession?.completed_at && (
              <span className="text-stone-400 ml-1">({new Date(currentSession.completed_at).toLocaleDateString('pt-BR')})</span>
            )}
          </p>
        )}

        {/* Status: cancelada */}
        {isCancelled && (
          <div className="border-t border-stone-100 pt-4 space-y-2">
            <p className="text-sm text-red-600">Sessão cancelada.</p>
            {currentSession?.admin_notes && (
              <p className="text-xs text-stone-500">{currentSession.admin_notes}</p>
            )}
            <p className="text-xs text-stone-400">Entre em contato com o suporte se precisar de ajuda.</p>
          </div>
        )}
      </div>

      {/* Histórico */}
      {pastSessions.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-800"
          >
            <Clock className="w-4 h-4" />
            Histórico de sessões ({pastSessions.length})
            <span className="text-stone-400">{showHistory ? '▲' : '▼'}</span>
          </button>

          {showHistory && pastSessions.map(s => {
            const si = SESSION_STATUS_LABELS[s.status] ?? SESSION_STATUS_LABELS.completed
            return (
              <div key={s.id} className="bg-white rounded-xl border border-stone-200 p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">{monthLabel(s.month_key)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${si.color}`}>{si.label}</span>
                </div>
                {s.scheduled_at && (
                  <p className="text-xs text-stone-400">
                    {new Date(s.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                )}
                {s.professional_name && (
                  <p className="text-xs text-stone-500">{s.professional_name}</p>
                )}
                {s.completed_at && (
                  <p className="text-xs text-stone-400">
                    Realizada em: {new Date(s.completed_at).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {sessionExtras.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Mensagens da equipe</h3>
          {sessionExtras.map(e => (
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

const PLAN_LABELS_USER: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
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
