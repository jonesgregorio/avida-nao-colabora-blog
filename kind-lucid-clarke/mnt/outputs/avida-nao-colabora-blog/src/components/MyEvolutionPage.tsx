import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, CalendarDays, ChevronLeft, Leaf, Loader2, Sparkles } from 'lucide-react'
import type { Profile } from '../types'
import { monthKey } from '../lib/dateUtils'
import { hasPlanAccess } from '../lib/officialPlans'
import { supabase } from '../lib/supabase'
import PlanBadge from './PlanBadge'
import LegacyMyEvolutionPage from './MyEvolutionPageLegacy'

export type Tab = 'resumo' | 'graficos'

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  onNavigatePricing: () => void
  onNavigateDiary: () => void
  onNavigate?: (v: string) => void
  onOpenArticle?: (slug: string) => void
  initialTab?: Tab
}

type MapEntry = {
  mood_score: number | null
  emotional_tags: string[] | null
  context_tags: string[] | null
  date: string | null
  created_at: string
}

type DayMood = { day: number; mood: number }
type Pair = { emotion: string; context: string; count: number }

function nextMonthKey(key: string) {
  const [year, month] = key.split('-').map(Number)
  const next = new Date(year, month, 1, 12)
  return monthKey(next)
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function heatClass(mood: number) {
  if (mood >= 4) return 'bg-forest-600'
  if (mood >= 3) return 'bg-mint'
  return 'bg-coral/70'
}

function moodLabel(mood: number) {
  if (mood >= 4) return 'mais leves'
  if (mood >= 3) return 'mais neutros'
  return 'mais difíceis'
}

export default function MyEvolutionPage(props: Props) {
  const { user, profile, initialTab } = props
  const [showDetails, setShowDetails] = useState(initialTab === 'graficos')
  const [entries, setEntries] = useState<MapEntry[]>([])
  const [loading, setLoading] = useState(initialTab !== 'graficos')
  const [failed, setFailed] = useState(false)
  const periodKey = monthKey()
  const plan = profile?.plan ?? 'free'
  const isEssential = hasPlanAccess(plan, 'essential')

  useEffect(() => {
    if (initialTab === 'graficos') setShowDetails(true)
  }, [initialTab])

  useEffect(() => {
    if (!user || showDetails) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setFailed(false)
    const start = `${periodKey}-01`
    const end = `${nextMonthKey(periodKey)}-01`

    supabase
      .from('diary_entries')
      .select('mood_score,emotional_tags,context_tags,date,created_at')
      .eq('user_id', user.id)
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setFailed(true)
          setEntries([])
        } else {
          setEntries((data ?? []) as MapEntry[])
        }
        setLoading(false)
      }, () => {
        if (!active) return
        setFailed(true)
        setEntries([])
        setLoading(false)
      })

    return () => { active = false }
  }, [periodKey, showDetails, user])

  const dailyMoods = useMemo<DayMood[]>(() => {
    const byDay = new Map<number, number[]>()
    for (const entry of entries) {
      const score = Number(entry.mood_score)
      if (!Number.isFinite(score) || score <= 0) continue
      const rawDate = entry.date || entry.created_at
      const day = Number(String(rawDate).slice(8, 10))
      if (!day) continue
      const values = byDay.get(day) ?? []
      values.push(Math.min(5, Math.max(1, score)))
      byDay.set(day, values)
    }
    return [...byDay.entries()]
      .map(([day, values]) => ({ day, mood: values.reduce((sum, value) => sum + value, 0) / values.length }))
      .sort((a, b) => a.day - b.day)
  }, [entries])

  const topEmotions = useMemo(() => {
    if (!isEssential) return [] as { label: string; count: number }[]
    const counts = new Map<string, number>()
    entries.flatMap(entry => entry.emotional_tags ?? []).forEach(label => counts.set(label, (counts.get(label) ?? 0) + 1))
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [entries, isEssential])

  const strongestPair = useMemo<Pair | null>(() => {
    if (!isEssential) return null
    const counts = new Map<string, Pair>()
    for (const entry of entries) {
      for (const emotion of entry.emotional_tags ?? []) {
        for (const context of entry.context_tags ?? []) {
          const key = `${emotion}\u0000${context}`
          const current = counts.get(key)
          counts.set(key, current ? { ...current, count: current.count + 1 } : { emotion, context, count: 1 })
        }
      }
    }
    const first = [...counts.values()].sort((a, b) => b.count - a.count)[0]
    return first && first.count >= 2 ? first : null
  }, [entries, isEssential])

  if (showDetails) {
    return (
      <div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar ao resumo do mês
          </button>
        </div>
        <LegacyMyEvolutionPage {...props} />
      </div>
    )
  }

  const maxEmotion = Math.max(...topEmotions.map(item => item.count), 1)
  const averageMood = dailyMoods.length
    ? dailyMoods.reduce((sum, item) => sum + item.mood, 0) / dailyMoods.length
    : 0
  const difficultDays = dailyMoods.filter(item => item.mood < 3).length
  const lighterDays = dailyMoods.filter(item => item.mood >= 4).length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-forest-600">
            <Leaf className="w-5 h-5" />
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Seu mês</p>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mt-1">Mapa Emocional</h1>
          <p className="mt-2 text-ink-soft max-w-xl leading-relaxed">Primeiro, um retrato simples do que apareceu. Você escolhe quando quer aprofundar.</p>
        </div>
        <PlanBadge plan={plan} member size="sm" />
      </header>

      <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{monthLabel(periodKey)}</p>
            <h2 className="font-serif text-2xl text-forest-900 mt-1">O que mais esteve presente</h2>
          </div>
          <span className="text-xs text-ink-soft">{dailyMoods.length} {dailyMoods.length === 1 ? 'dia com registro' : 'dias com registros'}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-14" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-500" /></div>
        ) : failed ? (
          <p className="mt-5 rounded-2xl bg-coral/25 px-4 py-3 text-sm text-[#8a3b23]">Não foi possível carregar seu mapa agora. Você ainda pode abrir os detalhes e tentar novamente por lá.</p>
        ) : dailyMoods.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-mint/30 p-5">
            <p className="font-serif text-xl text-forest-900">Ainda não há um retrato deste mês</p>
            <p className="text-sm text-ink-soft mt-2">Quando houver registros, os dias começam a formar um mapa visual aqui. Não existe meta de frequência.</p>
            <button type="button" onClick={props.onNavigateDiary} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800 transition-colors">Ir para o diário <ArrowRight className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="mt-6 grid md:grid-cols-[0.9fr_1.1fr] gap-6">
            <div className="rounded-2xl bg-mint/35 p-5">
              <p className="text-xs text-ink-soft">Tom geral dos dias registrados</p>
              <p className="font-serif text-3xl text-forest-900 mt-1">{moodLabel(averageMood)}</p>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div><p className="font-serif text-2xl text-forest-900">{lighterDays}</p><p className="text-xs text-ink-soft">dias mais leves</p></div>
                <div><p className="font-serif text-2xl text-forest-900">{difficultDays}</p><p className="text-xs text-ink-soft">dias mais difíceis</p></div>
              </div>
            </div>

            <div>
              {isEssential && topEmotions.length > 0 ? (
                <div className="space-y-3">
                  {topEmotions.map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between gap-3 text-sm"><span className="text-forest-900">{item.label}</span><span className="text-xs text-ink-soft">{item.count}x</span></div>
                      <div className="mt-1.5 h-2.5 rounded-full bg-mint overflow-hidden"><div className="h-full rounded-full bg-forest-500" style={{ width: `${(item.count / maxEmotion) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full rounded-2xl border border-dashed border-line p-5 flex flex-col justify-center">
                  <p className="text-sm text-forest-900 font-medium">O panorama básico continua disponível para você.</p>
                  <p className="text-xs text-ink-soft mt-2">No Essencial, o mapa também organiza emoções e outros sinais estruturados para aprofundar o período.</p>
                  <button type="button" onClick={props.onNavigatePricing} className="mt-3 self-start text-xs font-medium text-forest-700 underline">Conhecer o Essencial</button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {!loading && dailyMoods.length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-forest-600"><CalendarDays className="w-4 h-4" /><p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Quando isso aconteceu?</p></div>
          <h2 className="font-serif text-2xl text-forest-900 mt-1">Seu mês, dia a dia</h2>
          <p className="text-sm text-ink-soft mt-1">Sem comparar desempenho: apenas uma forma visual de lembrar quando os dias pareceram diferentes.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {dailyMoods.map(item => (
              <span key={item.day} title={`Dia ${item.day}`} className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium ${heatClass(item.mood)} ${item.mood >= 4 ? 'text-white' : 'text-forest-900'}`}>{item.day}</span>
            ))}
          </div>
        </section>
      )}

      {!loading && dailyMoods.length > 0 && (
        <section className="rounded-3xl border border-line bg-mint/25 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-forest-600"><Sparkles className="w-4 h-4" /><p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Algo chama atenção</p></div>
          <h2 className="font-serif text-2xl text-forest-900 mt-1">Uma pista para observar, não uma conclusão</h2>
          <p className="text-sm text-forest-800 mt-3 leading-relaxed">
            {strongestPair
              ? `“${strongestPair.emotion}” e “${strongestPair.context}” apareceram juntos em ${strongestPair.count} registros deste mês. Isso não indica causa; pode valer observar a relação.`
              : topEmotions[0]
                ? `“${topEmotions[0].label}” foi um dos sinais mais presentes nos registros deste mês. Ainda assim, frequência sozinha não explica o motivo.`
                : `Você registrou ${dailyMoods.length} ${dailyMoods.length === 1 ? 'dia' : 'dias'} neste mês. O mapa já mostra quando houve mudanças, sem transformar isso em diagnóstico ou meta.`}
          </p>
          <button type="button" onClick={() => setShowDetails(true)} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-forest-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-forest-800 transition-colors">
            {strongestPair ? 'Explorar essa relação' : 'Explorar detalhes'} <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      <section className="border-t border-line pt-5">
        <button type="button" onClick={() => setShowDetails(true)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors">
          Explorar detalhes <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-ink-soft mt-2 max-w-2xl">Em “Explorar detalhes”, métricas, comparações, padrões e a opção “Entender melhor meu mapa” continuam disponíveis conforme o seu plano.</p>
      </section>

      <p className="text-xs text-ink-soft border-t border-line pt-4">Esta leitura considera apenas os dados resumidos deste mapa, formados por sinais estruturados — não o texto completo do seu Diário. Ela não é diagnóstico.</p>
    </div>
  )
}
