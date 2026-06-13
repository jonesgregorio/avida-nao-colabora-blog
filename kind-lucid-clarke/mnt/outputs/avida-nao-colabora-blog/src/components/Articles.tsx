import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Article } from '../types'
import { ChevronLeft, ChevronRight, Clock, Tag } from 'lucide-react'

interface ArticlesProps {
  onSelectArticle: (article: Article) => void
}

const ARTICLES_PER_PAGE = 6

export default function Articles({ onSelectArticle }: ArticlesProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setArticles(data || [])
        setLoading(false)
      })
  }, [])

  const totalPages = Math.ceil(articles.length / ARTICLES_PER_PAGE)
  const paginated = articles.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE)

  return (
    <section id="articles" className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <p className="text-sage-500 text-sm uppercase tracking-widest mb-2">Conteúdo</p>
        <h2 className="font-serif text-4xl text-sage-800 mb-4">Artigos</h2>
        <p className="text-sage-600 max-w-lg mx-auto">
          Reflexões sobre saúde mental, escritas com cuidado e empatia.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map(article => (
              <ArticleCard key={article.id} article={article} onClick={() => onSelectArticle(article)} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-sand-200 disabled:opacity-40 hover:bg-sand-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-sage-600" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === page
                      ? 'bg-sage-600 text-white'
                      : 'border border-sand-200 text-sage-600 hover:bg-sand-100'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-sand-200 disabled:opacity-40 hover:bg-sand-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-sage-600" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <article
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-sand-100 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="aspect-[16/9] overflow-hidden">
        <img
          src={article.cover_image}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="flex items-center gap-1 text-xs text-sage-500">
            <Tag className="w-3 h-3" /> {article.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-sage-400">
            <Clock className="w-3 h-3" /> 5 min
          </span>
        </div>
        <h3 className="font-serif text-xl text-sage-800 mb-2 group-hover:text-sage-600 transition-colors leading-snug">
          {article.title}
        </h3>
        <p className="text-sm text-sage-500 leading-relaxed line-clamp-3">{article.excerpt}</p>
        <button className="mt-4 text-sm text-sage-600 font-medium hover:text-sage-800 transition-colors">
          Ler mais →
        </button>
      </div>
    </article>
  )
}
