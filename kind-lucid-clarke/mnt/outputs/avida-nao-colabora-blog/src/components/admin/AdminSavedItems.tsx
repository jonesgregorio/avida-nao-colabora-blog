import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Bookmark, Search } from 'lucide-react'

interface SavedItem {
  id: string
  user_id: string
  article_id: string
  created_at: string
  article?: { title: string; slug: string; category: string | null }
  user?: { email: string }
}

export default function AdminSavedItems() {
  const [items, setItems] = useState<SavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('saved_articles')
      .select('*, article:articles(title, slug, category), user:profiles(email)')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const filtered = search
    ? items.filter(i =>
        (i.article as any)?.title?.toLowerCase().includes(search.toLowerCase()) ||
        (i.user as any)?.email?.toLowerCase().includes(search.toLowerCase())
      )
    : items

  // Group by article
  const byArticle: Record<string, { title: string; slug: string; category: string | null; count: number }> = {}
  items.forEach(item => {
    const art = item.article as any
    if (!art) return
    if (!byArticle[item.article_id]) byArticle[item.article_id] = { title: art.title, slug: art.slug, category: art.category, count: 0 }
    byArticle[item.article_id].count++
  })
  const topArticles = Object.entries(byArticle).sort((a, b) => b[1].count - a[1].count).slice(0, 5)

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Itens Salvos</h1>

      {/* Top articles */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Artigos mais salvos</h2>
        {topArticles.length === 0 ? (
          <p className="text-sm text-stone-400">Sem dados ainda.</p>
        ) : (
          <div className="space-y-2">
            {topArticles.map(([id, art]) => (
              <div key={id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700 truncate">{art.title}</p>
                  {art.category && <p className="text-xs text-stone-400">{art.category}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Bookmark className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-sm font-semibold text-stone-700">{art.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-2xl font-bold text-stone-800">{items.length}</p>
          <p className="text-xs text-stone-500">Total de saves</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-2xl font-bold text-stone-800">{Object.keys(byArticle).length}</p>
          <p className="text-xs text-stone-500">Artigos salvos (únicos)</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por artigo ou usuário..."
          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum item salvo encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Artigo</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden md:table-cell">Usuário</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.slice(0, 100).map(item => (
                <tr key={item.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <p className="text-stone-700 font-medium text-sm truncate max-w-xs">{(item.article as any)?.title || item.article_id}</p>
                    {(item.article as any)?.category && (
                      <p className="text-xs text-stone-400">{(item.article as any).category}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 hidden md:table-cell">
                    {(item.user as any)?.email || item.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400">
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p className="text-xs text-stone-400 px-4 py-3 border-t border-stone-100">
              Exibindo 100 de {filtered.length} registros.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
