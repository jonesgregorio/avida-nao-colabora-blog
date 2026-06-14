import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Clock, ArrowRight } from 'lucide-react'
import type { Article } from '../types'

interface ArticlesProps {
  onSelectArticle: (article: Article | string) => void
}

const CATEGORIES = [
  'Todos', 'Ansiedade', 'Autoestima', 'Cansaço emocional', 'Autoconhecimento',
  'Relações e limites', 'Rotina e hábitos', 'Sono e descanso',
  'Pensamentos difíceis', 'Diário emocional', 'Autocuidado possível', 'Vida real',
]

export default function Articles({ onSelectArticle }: ArticlesProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [filtered, setFiltered] = useState<Article[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setArticles(data || [])
        setFiltered(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let result = articles
    if (category !== 'Todos') result = result.filter(a => a.category === category)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.summary || a.excerpt || '').toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [search, category, articles])

  const getImage = (article: Article) =>
    article.image_url || article.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

  const getSummary = (article: Article) => article.summary || article.excerpt || ''

  const handleSelect = (article: Article) => {
    if (article.slug) {
      onSelectArticle(article)
    }
  }

  return (
    <section id="articles" className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-10">
        <p className="text-sage-500 text-sm uppercase tracking-widest mb-2">Conteúdo</p>
        <h2 className="font-serif text-3xl md:text-4xl text-sage-800 mb-2">Blog</h2>
        <p className="text-sage-600">Conteúdos sobre saúde emocional, autoconhecimento e autocuidado real.</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar artigos..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-300 outline-none bg-white"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              category === cat
                ? 'bg-sage-600 text-white'
                : 'bg-white border border-stone-200 text-sage-600 hover:border-sage-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-sage-400">
          <p>Nenhum artigo encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(article => (
            <article
              key={article.id}
              className="bg-white rounded-2xl border border-sand-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handleSelect(article)}
            >
              <div className="aspect-video bg-stone-100 overflow-hidden">
                <img
                  src={getImage(article)}
                  alt={article.image_alt || article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={e => {
                    ;(e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'
                  }}
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-sage-600 bg-sage-50 px-2 py-1 rounded-full">
                    {article.category}
                  </span>
                  {article.read_time && (
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Clock size={12} /> {article.read_time} min
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-lg text-sage-800 mb-2 line-clamp-2 group-hover:text-sage-600 transition-colors leading-snug">
                  {article.title}
                </h3>
                <p className="text-stone-500 text-sm line-clamp-3 mb-4">{getSummary(article)}</p>
                <span className="flex items-center gap-1 text-sage-600 text-sm font-medium">
                  Ler artigo <ArrowRight size={14} />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
