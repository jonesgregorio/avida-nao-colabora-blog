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
                value: eventSummary.reduce((s, e) => s + e.count, 0),
                icon: MousePointerClick, color: 'text-orange-600 bg-orange-50' },
            ].map((card, i) => {
              const Icon = card.icon
              return (
                <div key={i} className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
                  <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                    <Icon size={16} />
                  </div>
                  <p className="text-2xl font-bold text-stone-800">{card.value}</p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-snug">{card.label}</p>
                </div>
              )
            })}
          </div>

          {/* ── Sem dados de eventos ainda ── */}
          {!hasEventData && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <p className="text-sm text-emerald-700 font-medium mb-1">📊 Rastreamento ativo!</p>
              <p className="text-sm text-emerald-600">
                Os eventos estão sendo coletados automaticamente. Cliques em artigos, questionários, trilhas e conteúdos aparecerão aqui assim que os usuários interagirem com o site.
              </p>
            </div>
          )}

          {hasEventData && (
            <>
              {/* ── Atividade diária ── */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h2 className="font-semibold text-stone-700 text-sm mb-4">Atividade diária (últimos 14 dias)</h2>
                <div className="flex items-end gap-1 h-24">
                  {dailyActivity.map(({ day, count }) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-stone-100 rounded-sm relative flex items-end" style={{ height: 80 }}>
                        <div
                          className="w-full bg-emerald-500 rounded-sm transition-all"
                          style={{ height: `${Math.max((count / maxDay) * 100, count > 0 ? 4 : 0)}%` }}
                          title={`${count} eventos`}
                        />
                      </div>
                      <span className="text-xs text-stone-300 hidden sm:block">
                        {new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Eventos + distribuição planos ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Eventos por tipo */}
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <h2 className="font-semibold text-stone-700 text-sm mb-4">Eventos por tipo</h2>
                  <div className="space-y-3">
                    {eventSummary.map(({ event, count }) => {
                      const cfg = EVENT_LABELS[event]
                      const Icon = cfg?.icon || BookOpen
                      const max = eventSummary[0]?.count || 1
                      return (
                        <div key={event} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg?.color || 'text-stone-600 bg-stone-100'}`}>
                            <Icon size={13} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs text-stone-600 mb-1">
                              <span>{cfg?.label || event}</span>
                              <span className="font-semibold">{count}</span>
                            </div>
                            <div className="w-full bg-stone-100 rounded-full h-1.5">
                              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Distribuição por plano */}
                <div className="bg-white rounded-xl border border-stone-200 p-5">
                  <h2 className="font-semibold text-stone-700 text-sm mb-4">Distribuição por plano</h2>
                  <div className="space-y-3">
                    {planDist.sort((a, b) => b.count - a.count).map(({ plan, count }) => {
                      const pct = Math.round((count / totalUsers) * 100)
                      return (
                        <div key={plan}>
                          <div className="flex justify-between text-sm text-stone-700 mb-1">
                            <span>{PLAN_LABELS[plan] || plan}</span>
                            <span className="text-stone-500">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-stone-100 rounded-full h-2">
                            <div className={`${PLAN_COLORS[plan] || 'bg-stone-400'} h-2 rounded-full transition-all`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Funil questionários */}
                  {qStarted > 0 && (
                    <div className="mt-5 pt-4 border-t border-stone-100">
                      <h3 className="text-xs font-semibold text-stone-500 mb-3 uppercase tracking-wide">Funil de questionários</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-600">Iniciados</span>
                          <span className="font-semibold">{qStarted}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-600">Concluídos</span>
                          <span className="font-semibold text-emerald-600">{qDone}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-600">Taxa de conclusão</span>
                          <span className={`font-bold ${qRate >= 50 ? 'text-emerald-600' : 'text-orange-500'}`}>{qRate}%</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2 mt-1">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${qRate}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Top artigos ── */}
              {topArticles.length > 0 && (
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
                    <MousePointerClick size={14} className="text-blue-500" />
                    <h2 className="font-semibold text-stone-700 text-sm">Artigos mais clicados</h2>
                  </div>
                  <div className="divide-y divide-stone-50">
                    {topArticles.map((item, i) => (
                      <div key={item.entity_id} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
                        <span className="text-xs font-bold text-stone-300 w-5">{i + 1}</span>
                        <span className="flex-1 text-sm text-stone-700 truncate">{item.entity_title}</span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                          <ArrowUpRight size={11} />{item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Top questionários + trilhas ── */}
              {(topQuestionnaires.length > 0 || topTrails.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {topQuestionnaires.length > 0 && (
                    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
                        <ClipboardList size={14} className="text-purple-500" />
                        <h2 className="font-semibold text-stone-700 text-sm">Questionários mais iniciados</h2>
                      </div>
                      <div className="divide-y divide-stone-50">
                        {topQuestionnaires.map((item, i) => (
                          <div key={item.entity_id} className="flex items-center gap-3 px-5 py-3">
                            <span className="text-xs font-bold text-stone-300 w-5">{i + 1}</span>
                            <span className="flex-1 text-sm text-stone-700 truncate">{item.entity_title}</span>
                            <span className="text-xs font-semibold text-purple-600">{item.count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {topTrails.length > 0 && (
                    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
                        <Map size={14} className="text-orange-500" />
                        <h2 className="font-semibold text-stone-700 text-sm">Trilhas mais iniciadas</h2>
                      </div>
                      <div className="divide-y divide-stone-50">
                        {topTrails.map((item, i) => (
                          <div key={item.entity_id} className="flex items-center gap-3 px-5 py-3">
                            <span className="text-xs font-bold text-stone-300 w-5">{i + 1}</span>
                            <span className="flex-1 text-sm text-stone-700 truncate">{item.entity_title}</span>
                            <span className="text-xs font-semibold text-orange-600">{item.count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
