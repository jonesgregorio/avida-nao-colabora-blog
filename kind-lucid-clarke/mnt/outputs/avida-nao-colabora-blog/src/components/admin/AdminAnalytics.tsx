import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  TrendingUp, FileText, Users, BookOpen, MousePointerClick,
  ClipboardList, Map, Zap, RefreshCw, ArrowUpRight
} from 'lucide-react'

interface PlanDist { plan: string; count: number }
interface TopItem { entity_id: string; entity_title: string; count: number }
interface DayCount { day: string; count: number }
interface EventSummary { event: string; count: number }

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-400', essential: 'bg-blue-500',
  therapeutic: 'bg-emerald-500', 'therapeutic-plus': 'bg-purple-500',
}
const EVENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  article_click:           { label: 'Cliques em artigos',       icon: MousePointerClick, color: 'text-blue-600 bg-blue-50' },
  questionnaire_start:     { label: 'Questionários iniciados',  icon: ClipboardList,     color: 'text-purple-600 bg-purple-50' },
  questionnaire_complete:  { label: 'Questionários concluídos', icon: ClipboardList,     color: 'text-emerald-600 bg-emerald-50' },
  trail_start:             { label: 'Trilhas iniciadas',         icon: Map,               color: 'text-orange-600 bg-orange-50' },
  daily_content_view:      { label: 'Conteúdos automáticos vistos', icon: Zap,           color: 'text-yellow-600 bg-yellow-50' },
  daily_content_expand:    { label: 'Conteúdos expandidos',     icon: Zap,               color: 'text-amber-600 bg-amber-50' },
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('30')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Base metrics
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalArticles, setTotalArticles] = useState(0)
  const [totalDiary, setTotalDiary] = useState(0)
  const [planDist, setPlanDist] = useState<PlanDist[]>([])

  // Event metrics
  const [eventSummary, setEventSummary] = useState<EventSummary[]>([])
  const [topArticles, setTopArticles] = useState<TopItem[]>([])
  const [topQuestionnaires, setTopQuestionnaires] = useState<TopItem[]>([])
  const [topTrails, setTopTrails] = useState<TopItem[]>([])
  const [dailyActivity, setDailyActivity] = useState<DayCount[]>([])
  const [hasEventData, setHasEventData] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const since = new Date()
    since.setDate(since.getDate() - Number(period))
    const isoSince = since.toISOString()

    try {
      // ── Base metrics ────────────────────────────────────────────────────
      const [
        { data: profiles },
        { count: diaryCount },
        { count: articleCount },
      ] = await Promise.all([
        supabase.from('profiles').select('plan'),
        supabase.from('diary_entries').select('*', { count: 'exact', head: true }).gte('created_at', isoSince),
        supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      ])

      setTotalUsers((profiles || []).length)
      setTotalDiary(diaryCount || 0)
      setTotalArticles(articleCount || 0)

      const counts: Record<string, number> = {}
      ;(profiles || []).forEach((p: any) => { counts[p.plan] = (counts[p.plan] || 0) + 1 })
      setPlanDist(Object.entries(counts).map(([plan, count]) => ({ plan, count })))

      // ── Analytics events ────────────────────────────────────────────────
      const { data: events } = await supabase
        .from('analytics_events')
        .select('event, entity_id, entity_title, created_at')
        .gte('created_at', isoSince)

      if (events && events.length > 0) {
        setHasEventData(true)

        // Summary por tipo de evento
        const evMap: Record<string, number> = {}
        events.forEach((e: any) => { evMap[e.event] = (evMap[e.event] || 0) + 1 })
        setEventSummary(Object.entries(evMap).map(([event, count]) => ({ event, count })).sort((a, b) => b.count - a.count))

        // Top artigos
        const artMap: Record<string, { title: string; count: number }> = {}
        events.filter((e: any) => e.event === 'article_click').forEach((e: any) => {
          if (!e.entity_id) return
          if (!artMap[e.entity_id]) artMap[e.entity_id] = { title: e.entity_title || e.entity_id, count: 0 }
          artMap[e.entity_id].count++
        })
        setTopArticles(
          Object.entries(artMap).map(([id, v]) => ({ entity_id: id, entity_title: v.title, count: v.count }))
            .sort((a, b) => b.count - a.count).slice(0, 8)
        )

        // Top questionários
        const qMap: Record<string, { title: string; count: number }> = {}
        events.filter((e: any) => e.event === 'questionnaire_start').forEach((e: any) => {
          if (!e.entity_id) return
          if (!qMap[e.entity_id]) qMap[e.entity_id] = { title: e.entity_title || e.entity_id, count: 0 }
          qMap[e.entity_id].count++
        })
        setTopQuestionnaires(
          Object.entries(qMap).map(([id, v]) => ({ entity_id: id, entity_title: v.title, count: v.count }))
            .sort((a, b) => b.count - a.count).slice(0, 5)
        )

        // Top trilhas
        const trMap: Record<string, { title: string; count: number }> = {}
        events.filter((e: any) => e.event === 'trail_start').forEach((e: any) => {
          if (!e.entity_id) return
          if (!trMap[e.entity_id]) trMap[e.entity_id] = { title: e.entity_title || e.entity_id, count: 0 }
          trMap[e.entity_id].count++
        })
        setTopTrails(
          Object.entries(trMap).map(([id, v]) => ({ entity_id: id, entity_title: v.title, count: v.count }))
            .sort((a, b) => b.count - a.count).slice(0, 5)
        )

        // Atividade diária (últimos 14 dias)
        const dayMap: Record<string, number> = {}
        const last14 = Array.from({ length: 14 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (13 - i))
          return d.toISOString().split('T')[0]
        })
        last14.forEach(d => { dayMap[d] = 0 })
        events.forEach((e: any) => {
          const day = e.created_at.split('T')[0]
          if (dayMap[day] !== undefined) dayMap[day]++
        })
        setDailyActivity(last14.map(day => ({ day, count: dayMap[day] })))
      } else {
        setHasEventData(false)
        setEventSummary([])
        setTopArticles([])
        setTopQuestionnaires([])
        setTopTrails([])
        setDailyActivity([])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [period])

  const maxDay = Math.max(...dailyActivity.map(d => d.count), 1)

  // Funil: iniciados → concluídos
  const qStarted = eventSummary.find(e => e.event === 'questionnaire_start')?.count || 0
  const qDone    = eventSummary.find(e => e.event === 'questionnaire_complete')?.count || 0
  const qRate    = qStarted > 0 ? Math.round((qDone / qStarted) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Analytics</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing}
            className="p-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-stone-400 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          Carregando métricas...
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Cards base ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Usuários totais',           value: totalUsers,    icon: Users,       color: 'text-blue-600 bg-blue-50' },
              { label: 'Artigos publicados',         value: totalArticles, icon: FileText,    color: 'text-green-600 bg-green-50' },
              { label: `Entradas no diário (${period}d)`, value: totalDiary, icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
              { label: 'Eventos rastreados',
                value: eventSummary.length, icon: BarChart2, color: 'text-orange-600 bg-orange-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white border rounded-xl p-4">
                <div className={`inline-flex p-2 rounded-lg mb-3 ${color.split(' ')[1]}`}>
                  <Icon size={18} className={color.split(' ')[0]} />
                </div>
                <p className="text-2xl font-bold text-stone-800">{loading ? '…' : value}</p>
                <p className="text-xs text-stone-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Events table */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-stone-700 text-sm">Eventos recentes</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-stone-400 text-sm">Carregando...</div>
            ) : eventSummary.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">Nenhum evento registrado</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-stone-500 font-medium">Evento</th>
                    <th className="text-right px-4 py-2 text-xs text-stone-500 font-medium">Total</th>
                    <th className="text-right px-4 py-2 text-xs text-stone-500 font-medium">Usuários únicos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {eventSummary.map((e, i) => (
                    <tr key={i} className="hover:bg-stone-50">
                      <td className="px-4 py-2 text-stone-700">{e.event_type}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{e.count}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{e.unique_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
