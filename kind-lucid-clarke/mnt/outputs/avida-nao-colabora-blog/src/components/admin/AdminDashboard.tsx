import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminView } from './index'
import { FileText, Users, Tag, TrendingUp, AlertCircle } from 'lucide-react'

interface Stats {
  totalUsers: number
  activeUsers: number
  totalArticles: number
  publishedArticles: number
  draftArticles: number
  totalDiaryEntries: number
}

export default function AdminDashboard({ onNavigate }: { onNavigate: (v: AdminView) => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [
          { count: totalUsers },
          { count: totalArticles },
          { count: publishedArticles },
          { count: draftArticles },
          { count: totalDiaryEntries },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('articles').select('*', { count: 'exact', head: true }),
          supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
          supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
          supabase.from('diary_entries').select('*', { count: 'exact', head: true }),
        ])
        setStats({
          totalUsers: totalUsers || 0,
          activeUsers: 0,
          totalArticles: totalArticles || 0,
          publishedArticles: publishedArticles || 0,
          draftArticles: draftArticles || 0,
          totalDiaryEntries: totalDiaryEntries || 0,
        })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = stats ? [
    { label: 'Usuários cadastrados', value: stats.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50', action: () => onNavigate('users') },
    { label: 'Artigos publicados', value: stats.publishedArticles, icon: FileText, color: 'text-green-600 bg-green-50', action: () => onNavigate('articles') },
    { label: 'Rascunhos', value: stats.draftArticles, icon: FileText, color: 'text-amber-600 bg-amber-50', action: () => onNavigate('articles') },
    { label: 'Registros no diário', value: stats.totalDiaryEntries, icon: TrendingUp, color: 'text-purple-600 bg-purple-50', action: undefined },
  ] : []

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Dashboard</h1>

      {loading ? (
        <p className="text-stone-400">Carregando métricas...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <div
                key={i}
                onClick={card.action}
                className={`bg-white rounded-xl p-5 border border-stone-200 shadow-sm ${card.action ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              >
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-stone-800">{card.value}</p>
                <p className="text-sm text-stone-500 mt-0.5">{card.label}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-semibold text-stone-800 mb-3">Ações rápidas</h2>
          <div className="space-y-2">
            <button
              onClick={() => onNavigate('article-editor')}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-sm text-stone-700 transition-colors"
            >
              ✏️ Novo artigo
            </button>
            <button
              onClick={() => onNavigate('images')}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-sm text-stone-700 transition-colors"
            >
              🖼️ Gerenciar imagens
            </button>
            <button
              onClick={() => onNavigate('social-proof')}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-sm text-stone-700 transition-colors"
            >
              ⭐ Editar prova social
            </button>
            <button
              onClick={() => onNavigate('plans')}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-sm text-stone-700 transition-colors"
            >
              💳 Configurar planos
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-amber-800">Lembretes</h2>
          </div>
          <ul className="space-y-1.5 text-sm text-amber-700">
            <li>• Verifique rascunhos pendentes de revisão</li>
            <li>• Métricas de prova social são demonstrativas — atualize quando tiver dados reais</li>
            <li>• Etapas 2–4 do admin ainda não foram implementadas</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
