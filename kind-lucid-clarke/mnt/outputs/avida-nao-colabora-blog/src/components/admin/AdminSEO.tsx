import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, AlertCircle, CheckCircle } from 'lucide-react'

interface ArticleSEO {
  id: string
  title: string
  slug: string
  seo_title: string | null
  seo_description: string | null
  cover_image_url: string | null
  category: string | null
  status: string
}

export default function AdminSEO() {
  const [articles, setArticles] = useState<ArticleSEO[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'issues'>('issues')

  useEffect(() => {
    supabase
      .from('articles')
      .select('id, title, slug, seo_title, seo_description, cover_image_url, category, status')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setArticles(data || []); setLoading(false) })
  }, [])

  function issues(a: ArticleSEO) {
    const list: string[] = []
    if (!a.seo_title) list.push('Sem título SEO')
    if (!a.seo_description) list.push('Sem descrição SEO')
    if (a.seo_description && a.seo_description.length > 160) list.push('Descrição SEO longa (>160 chars)')
    if (!a.cover_image_url) list.push('Sem imagem de capa')
    if (!a.category) list.push('Sem categoria')
    return list
  }

  const filtered = filter === 'issues'
    ? articles.filter(a => issues(a).length > 0)
    : articles

  const totalIssues = articles.filter(a => issues(a).length > 0).length
  const ok = articles.length - totalIssues

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">SEO</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-2xl font-bold text-stone-800">{articles.length}</p>
          <p className="text-xs text-stone-500">Artigos publicados</p>
        </div>
        <div className={`rounded-xl border p-4 ${ok === articles.length ? 'bg-green-50 border-green-200' : 'bg-white border-stone-200'}`}>
          <p className="text-2xl font-bold text-green-600">{ok}</p>
          <p className="text-xs text-stone-500">Sem problemas</p>
        </div>
        <div className={`rounded-xl border p-4 ${totalIssues > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
          <p className="text-2xl font-bold text-red-600">{totalIssues}</p>
          <p className="text-xs text-stone-500">Com problemas SEO</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('issues')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'issues' ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
        >
          Com problemas ({totalIssues})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
        >
          Todos ({articles.length})
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-green-700 font-medium">Todos os artigos estão com SEO completo!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const probs = issues(a)
            return (
              <div key={a.id} className={`bg-white rounded-xl border p-4 ${probs.length > 0 ? 'border-red-100' : 'border-stone-200'}`}>
                <div className="flex items-start gap-3">
                  {probs.length > 0
                    ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800 text-sm leading-snug">{a.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{a.slug}</p>
                    {a.seo_title && <p className="text-xs text-stone-500 mt-1">SEO Title: {a.seo_title}</p>}
                    {a.seo_description && (
                      <p className="text-xs text-stone-500">
                        Meta desc: {a.seo_description.substring(0, 80)}{a.seo_description.length > 80 ? '...' : ''}
                        <span className={`ml-1 ${a.seo_description.length > 160 ? 'text-red-500' : 'text-green-600'}`}>
                          ({a.seo_description.length} chars)
                        </span>
                      </p>
                    )}
                    {probs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {probs.map(p => (
                          <span key={p} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Edição de SEO global em breve:</strong> Editar título, descrição e Open Graph por página, gerar sitemap e configurar canonical diretamente aqui.
      </div>
    </div>
  )
}
