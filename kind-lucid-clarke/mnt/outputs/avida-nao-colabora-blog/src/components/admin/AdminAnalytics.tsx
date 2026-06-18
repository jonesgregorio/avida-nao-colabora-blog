import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { TrendingUp, FileText, Users, BookOpen } from 'lucide-react'

interface ArticleStat { id: string; title: string; category: string; created_at: string }
interface PlanDist { plan: string; count: number }

export default function AdminAnalytics() {
  const [articles, setArticles] = useState<ArticleStat[]>([])
  const [planDist, setPlanDist] = useState<PlanDist[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalDiary, setTotalDiary] = useState(0)
  const [totalArticles, setTotalArticles] = useState(0)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const since = new Date()
        since.setDate(since.getDate() - Number(period))
        const isoSince = since.toISOString()

        const [
          { data: arts },
          { data: profiles },
          { count: diaryCount },
          { count: articleCount },
        ] = await Promise.all([
          supabase.from('articles').select('id,title,category,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(20),
          supabase.from('profiles').select('plan'),
          supabase.from('diary_entries').select('*', { count: 'exact', head: true }).gte('created_at', isoSince),
          supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        ])

        setArticles(arts || [])

        // Plan distribution
        const counts: Record<string, number> = {}
        ;(profiles || []).forEach((p: any) => {
          counts[p.plan] = (counts[p.plan] || 0) + 1
        })
        setPlanDist(Object.entries(counts).map(([plan, count]) => ({ plan, count })))
        setTotalUsers((profiles || []).length)
        setTotalDiary(diaryCount || 0)
        setTotalArticles(articleCount || 0)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period])

  const PLAN_LABELS: Record<string, string> = {
    free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
  }

  const PLAN_COLORS: Record<string, string> = {
    free: 'bg-stone-400', essential: 'bg-blue-500', therapeutic: 'bg-emerald-500', 'therapeutic-plus': 'bg-purple-500',
  }

  const catCounts: Record<string, number> = {}
  articles.forEach(a => { catCounts[a.category] = (catCounts[a.category] || 0) + 1 })
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Analytics</h1>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-stone-400">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          Carregando métricas...
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Usuários totais', value: totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50' },
              { label: 'Artigos publicados', value: totalArticles, icon: FileText, color: 'text-green-600 bg-green-50' },
              { label: `Registros no diário (${period}d)`, value: totalDiary, icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
              { label: 'Categorias ativas', value: sortedCats.length, icon: BookOpen, color: 'text-amber-600 bg-amber-50' },
            ].map((card, i) => {
              const Icon = card.icon
              return (
                <div key={i} className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
                  <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-bold text-stone-800">{card.value}</p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-snug">{card.label}</p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Plan distribution */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-semibold text-stone-700 text-sm mb-4">Distribuição por plano</h2>
              {planDist.length === 0 ? (
                <p className="text-stone-400 text-sm">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {planDist.sort((a, b) => b.count - a.count).map(({ plan, count }) => {
                    const pct = Math.round((count / totalUsers) * 100)
                    return (
                      <div key={plan}>
                        <div className="flex justify-between text-sm text-stone-700 mb-1">
                          <span>{PLAN_LABELS[plan] || plan}</span>
                          <span className="text-stone-500">{count} usuários ({pct}%)</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2">
                          <div
                            className={`${PLAN_COLORS[plan] || 'bg-stone-400'} h-2 rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Articles by category */}
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-semibold text-stone-700 text-sm mb-4">Artigos por categoria</h2>
              {sortedCats.length === 0 ? (
                <p className="text-stone-400 text-sm">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {sortedCats.slice(0, 8).map(([cat, count]) => {
                    const max = sortedCats[0][1]
                    const pct = Math.round((count / max) * 100)
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs text-stone-600 mb-0.5">
                          <span className="capitalize">{cat || 'Sem categoria'}</span>
                          <span>{count}</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent articles */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="font-semibold text-stone-700 text-sm">Artigos publicados recentemente</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Título</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden md:table-cell">Categoria</th>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Publicado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {articles.map(a => (
                  <tr key={a.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-stone-800 font-medium leading-snug">{a.title}</td>
                    <td className="px-4 py-3 text-stone-500 capitalize hidden md:table-cell">{a.category || '—'}</td>
                    <td className="px-4 py-3 text-stone-400 text-xs">{new Date(a.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>Métricas avançadas em breve:</strong> cliques em artigos, conversão por plano, PDFs exportados, trilhas iniciadas/concluídas e conteúdos automáticos abertos serão adicionados via tabela <code>analytics_events</code>.
          </div>
        </>
      )}
    </div>
  )
}
