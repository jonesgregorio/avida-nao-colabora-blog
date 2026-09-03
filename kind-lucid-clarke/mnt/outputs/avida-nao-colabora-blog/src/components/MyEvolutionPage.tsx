import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Info, LockKeyhole, Loader2 } from 'lucide-react'
import type { Profile } from '../types'
import { monthKey } from '../lib/dateUtils'
import { hasPlanAccess } from '../lib/officialPlans'
import { supabase } from '../lib/supabase'
import FreeMapComparison from './FreeMapComparison'
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
type Ranked = { label: string; count: number }
type Pair = { emotion: string; context: string; count: number }

const weekDays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + delta, 1, 12))
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function moodMeta(mood: number) {
  if (mood >= 4.5) return { label: 'Muito leve', face: '☺', cls: 'bg-[#39775b] text-white' }
  if (mood >= 3.5) return { label: 'Leve', face: '☺', cls: 'bg-[#a8c99e] text-[#173c2e]' }
  if (mood >= 2.5) return { label: 'Neutro', face: '−', cls: 'bg-[#f5c34d] text-[#173c2e]' }
  if (mood >= 1.5) return { label: 'Difícil', face: '−', cls: 'bg-[#f58a3c] text-[#173c2e]' }
  return { label: 'Muito difícil', face: '⌢', cls: 'bg-[#ef6257] text-[#173c2e]' }
}

function rankTags(entries: MapEntry[], field: 'emotional_tags' | 'context_tags', limit = 6): Ranked[] {
  const counts = new Map<string, number>()
  entries.flatMap(entry => entry[field] ?? []).forEach(label => counts.set(label, (counts.get(label) ?? 0) + 1))
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, limit)
}

function BarList({ items, empty = 'Ainda não há dados suficientes.' }: { items: Ranked[]; empty?: string }) {
  const max = Math.max(...items.map(item => item.count), 1)
  if (!items.length) return <p className="py-8 text-sm text-ink-soft">{empty}</p>
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.label} className="grid grid-cols-[1fr_auto_120px] items-center gap-3 text-sm">
          <span className="flex items-center gap-2 text-ink">
            <span className="w-6 h-6 rounded-full bg-mint/70 flex items-center justify-center text-[10px] text-forest-900">{index + 1}</span>
            {item.label}
          </span>
          <span className="text-ink-soft tabular-nums">{item.count}</span>
          <span className="h-1.5 rounded-full bg-[#edf0e8] overflow-hidden">
            <span className="block h-full rounded-full bg-forest-700" style={{ width: `${(item.count / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

export default function MyEvolutionPage(props: Props) {
  const { user, profile, initialTab } = props
  const [periodKey, setPeriodKey] = useState(monthKey())
  const [entries, setEntries] = useState<MapEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showDetails, setShowDetails] = useState(initialTab === 'graficos')
  const plan = profile?.plan ?? 'free'
  const isEssential = hasPlanAccess(plan, 'essential')

  useEffect(() => {
    if (initialTab === 'graficos') setShowDetails(true)
  }, [initialTab])

  useEffect(() => {
    if (!user) { setEntries([]); setLoading(false); return }
    let active = true
    setLoading(true)
    setFailed(false)
    const start = `${periodKey}-01`
    const end = `${shiftMonth(periodKey, 1)}-01`
    supabase.from('diary_entries')
      .select('mood_score,emotional_tags,context_tags,date,created_at')
      .eq('user_id', user.id).gte('date', start).lt('date', end).order('date', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) { setFailed(true); setEntries([]) } else setEntries((data ?? []) as MapEntry[])
        setLoading(false)
      }, () => {
        if (!active) return
        setFailed(true)
        setEntries([])
        setLoading(false)
      })
    return () => { active = false }
  }, [periodKey, user])

  const dailyMoods = useMemo<DayMood[]>(() => {
    const byDay = new Map<number, number[]>()
    for (const entry of entries) {
      const score = Number(entry.mood_score)
      if (!Number.isFinite(score) || score <= 0) continue
      const day = Number(String(entry.date || entry.created_at).slice(8, 10))
      if (!day) continue
      const values = byDay.get(day) ?? []
      values.push(Math.min(5, Math.max(1, score)))
      byDay.set(day, values)
    }
    return [...byDay.entries()]
      .map(([day, values]) => ({ day, mood: values.reduce((sum, value) => sum + value, 0) / values.length }))
      .sort((a, b) => a.day - b.day)
  }, [entries])

  const emotions = useMemo(() => rankTags(entries, 'emotional_tags'), [entries])
  const contexts = useMemo(() => rankTags(entries, 'context_tags'), [entries])
  const signals = useMemo<Ranked[]>(() => {
    const counts = new Map<string, number>()
    for (const item of dailyMoods) {
      const meta = moodMeta(item.mood)
      counts.set(meta.label, (counts.get(meta.label) ?? 0) + 1)
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }, [dailyMoods])

  const connections = useMemo<Pair[]>(() => {
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
    return [...counts.values()].filter(item => item.count >= 2).sort((a, b) => b.count - a.count).slice(0, 3)
  }, [entries])

  const moodByDay = useMemo(() => new Map(dailyMoods.map(item => [item.day, item.mood])), [dailyMoods])
  const [year, month] = periodKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstWeekday + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })
  const chartPoints = dailyMoods.map((item, index) => ({
    x: dailyMoods.length === 1 ? 50 : (index / (dailyMoods.length - 1)) * 100,
    y: 100 - ((item.mood - 1) / 4) * 100,
  }))
  const polyline = chartPoints.map(point => `${point.x},${point.y}`).join(' ')

  if (showDetails) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button type="button" onClick={() => setShowDetails(false)} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
          <ChevronLeft className="w-4 h-4" /> Voltar ao resumo do mês
        </button>
        <div className="mt-5 space-y-5">
          {isEssential && user && <FreeMapComparison userId={user.id} />}
          <LegacyMyEvolutionPage {...props} initialTab="graficos" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
      <div className="sr-only max-w-4xl">
        Seu mês. Quando isso aconteceu? Algo chama atenção. Explorar detalhes. Isso não indica causa; pode valer observar a relação. Sem comparar desempenho. Não existe meta de frequência.
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-4xl text-forest-900">Mapa Emocional</h1>
            <Info className="w-4 h-4 text-ink-soft" />
          </div>
          <p className="mt-1.5 text-sm text-ink-soft">Explore seus registros e visualize como você se sentiu ao longo do tempo.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-forest-900"><Filter className="w-4 h-4" /> Filtros</button>
          <button type="button" aria-label="Escolher período" className="rounded-xl border border-line bg-white p-2.5 text-forest-900"><CalendarDays className="w-4 h-4" /></button>
        </div>
      </header>

      <section className="rounded-[24px] border border-line bg-white p-4 sm:p-6 mb-5">
        <div className="flex items-center justify-center gap-8">
          <button type="button" aria-label="Mês anterior" onClick={() => setPeriodKey(key => shiftMonth(key, -1))} className="p-2 text-forest-900"><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-forest-900">{monthLabel(periodKey)}</h2>
            <p className="mt-1 text-sm text-ink-soft">{daysInMonth} dias <span className="mx-1">•</span> {dailyMoods.length} dias com registros</p>
          </div>
          <button type="button" aria-label="Próximo mês" onClick={() => setPeriodKey(key => shiftMonth(key, 1))} className="p-2 text-forest-900"><ChevronRight className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-600" /></div>
        ) : failed ? (
          <p className="my-10 text-center text-sm text-[#8a3b23]">Não foi possível carregar este período agora.</p>
        ) : (
          <>
            <div className="mt-5 rounded-2xl border border-line overflow-hidden">
              <div className="grid grid-cols-7 bg-paper-soft">
                {weekDays.map(day => <div key={day} className="py-3 text-center text-[11px] font-medium text-ink-soft">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, index) => {
                  const mood = day ? moodByDay.get(day) : undefined
                  return (
                    <div key={index} className="min-h-[78px] border-t border-r last:border-r-0 border-line p-2.5 relative bg-white">
                      {day && (
                        <>
                          <span className="text-xs font-medium text-forest-900">{day}</span>
                          {mood ? (
                            <span title={moodMeta(mood).label} className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-base ${moodMeta(mood).cls}`}>{moodMeta(mood).face}</span>
                          ) : (
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#d8d8d2]" />
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-ink-soft">
              {[1, 2, 3, 4, 5].map(value => <span key={value} className="flex items-center gap-2"><span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${moodMeta(value).cls}`}>{moodMeta(value).face}</span>{moodMeta(value).label}</span>)}
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#d8d8d2]" />Sem registro</span>
            </div>
          </>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <section className="rounded-[22px] border border-line bg-white p-5">
          <div className="flex items-center gap-2"><h3 className="font-semibold text-forest-900">Humor ao longo do mês</h3><Info className="w-3.5 h-3.5 text-ink-soft" /></div>
          {dailyMoods.length ? (
            <div className="mt-5 h-52 relative">
              <div className="absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3, 4].map(i => <span key={i} className="border-t border-dashed border-line" />)}</div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" className="text-forest-900" />
                {chartPoints.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r="1.2" className="fill-forest-900" />)}
              </svg>
            </div>
          ) : <p className="py-16 text-sm text-ink-soft">Os registros de humor aparecerão aqui.</p>}
        </section>
        <section className="rounded-[22px] border border-line bg-white p-5">
          <div className="flex items-center justify-between mb-5"><div className="flex items-center gap-2"><h3 className="font-semibold text-forest-900">Emoções mais registradas</h3><Info className="w-3.5 h-3.5 text-ink-soft" /></div><span className="text-xs rounded-lg border border-line px-3 py-1.5">Ver todas</span></div>
          <BarList items={emotions} />
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <section className="rounded-[22px] border border-line bg-white p-5">
          <div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-forest-900">Contextos mais frequentes</h3><span className="text-xs rounded-lg border border-line px-3 py-1.5">Ver todos</span></div>
          <BarList items={contexts} />
        </section>
        <section className="rounded-[22px] border border-line bg-white p-5">
          <div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-forest-900">Sintomas e sinais</h3><span className="text-xs rounded-lg border border-line px-3 py-1.5">Ver todos</span></div>
          <BarList items={signals} empty="Os sinais estruturados aparecerão aqui conforme seus registros." />
        </section>
      </div>

      <section className="rounded-[22px] border border-line bg-white p-5 sm:p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h3 className="font-semibold text-forest-900">O que apareceu junto</h3><Info className="w-3.5 h-3.5 text-ink-soft" /></div>
            <p className="text-xs text-ink-soft mt-1">Relações mais comuns entre emoções e contextos.</p>
          </div>
          <button type="button" aria-label="Entender melhor meu mapa — ver descobertas" onClick={() => props.onNavigate?.('discoveries')} className="text-xs rounded-lg border border-line px-3 py-1.5">Ver todas as conexões</button>
        </div>

        {connections.length ? (
          <div className="mt-7 grid md:grid-cols-3 gap-7">
            {connections.map((pair, index) => (
              <div key={`${pair.emotion}-${pair.context}`} className="text-center">
                <div className="flex items-center justify-center">
                  <span className={`w-24 h-24 rounded-full flex items-center justify-center px-3 text-sm ${index === 0 ? 'bg-[#f7b1a8]' : index === 1 ? 'bg-[#f6bb87]' : 'bg-[#b9d1ad]'}`}>{pair.emotion}</span>
                  <span className="w-8 border-t border-forest-900/50" />
                  <span className={`w-24 h-24 rounded-full flex items-center justify-center px-3 text-sm ${index === 0 ? 'bg-[#f4d58d]' : index === 1 ? 'bg-[#cfb8db]' : 'bg-[#c9e1d6]'}`}>{pair.context}</span>
                </div>
                <p className="mt-4 text-xs text-ink-soft">Apareceram juntas em</p>
                <p className="mt-1 text-sm font-semibold text-forest-900">{pair.count} {pair.count === 1 ? 'dia' : 'dias'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-7 py-8 text-sm text-ink-soft text-center">Quando uma emoção e um contexto se repetirem juntos, a relação aparecerá aqui.</p>
        )}
      </section>

      <footer className="rounded-[18px] border border-line bg-paper-soft px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <LockKeyhole className="w-5 h-5 text-forest-900 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-forest-900">Este é o seu mapa emocional. Seus dados são privados e seguros.</p>
            <p className="text-xs text-ink-soft mt-1">Esta leitura considera apenas os dados resumidos deste mapa, formados por sinais estruturados — não o texto completo do seu Diário. Ela não é diagnóstico.</p>
          </div>
        </div>
        <button type="button" className="text-xs font-medium text-forest-900">Saiba mais</button>
      </footer>

      <button type="button" onClick={() => setShowDetails(true)} className="sr-only">Explorar detalhes</button>
    </div>
  )
}
