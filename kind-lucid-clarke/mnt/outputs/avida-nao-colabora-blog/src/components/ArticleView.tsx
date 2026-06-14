import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Clock } from 'lucide-react'
import type { Article } from '../types'

interface ArticleViewProps {
  // Accept either a slug string or a full article object (backward compat)
  slug?: string
  article?: Article
  onBack: () => void
  user: any
  onSelectArticle?: (slug: string) => void
}

export default function ArticleView({ slug, article: initialArticle, onBack, user: _user, onSelectArticle }: ArticleViewProps) {
  const [article, setArticle] = useState<Article | null>(initialArticle || null)
  const [related, setRelated] = useState<Article[]>([])
  const [loading, setLoading] = useState(!initialArticle)

  useEffect(() => {
    if (slug) {
      loadArticle(slug)
    } else if (initialArticle) {
      setArticle(initialArticle)
      loadRelated(initialArticle.category, initialArticle.slug)
    }
  }, [slug, initialArticle])

  async function loadArticle(s: string) {
    setLoading(true)
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', s)
      .single()
    setArticle(data)
    if (data?.category) {
      await loadRelated(data.category, s)
    }
    setLoading(false)
  }

  async function loadRelated(category: string, currentSlug: string) {
    const { data } = await supabase
      .from('articles')
      .select('id, title, slug, category, read_time, image_url, cover_image')
      .eq('category', category)
      .neq('slug', currentSlug)
      .limit(3)
    setRelated(data || [])
  }

  function renderContent(content: string) {
    if (!content) return null
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## '))
        return <h2 key={i} className="font-serif text-2xl text-sage-800 mt-8 mb-3">{line.replace('## ', '')}</h2>
      if (line.startsWith('### '))
        return <h3 key={i} className="text-lg font-semibold text-sage-700 mt-6 mb-2">{line.replace('### ', '')}</h3>
      if (line.startsWith('**') && line.endsWith('**'))
        return <p key={i} className="font-semibold text-sage-800 mt-4 mb-1">{line.slice(2, -2)}</p>
      if (line.startsWith('- '))
        return <li key={i} className="text-sage-600 ml-4 list-disc">{line.replace('- ', '')}</li>
      if (line.startsWith('> '))
        return <blockquote key={i} className="border-l-4 border-sage-300 pl-4 italic text-sage-600 my-4">{line.replace('> ', '')}</blockquote>
      if (line.trim() === '') return <br key={i} />
      return <p key={i} className="text-sage-600 leading-relaxed mb-3">{line}</p>
    })
  }

  const getImage = (a: Article) =>
    a.image_url || a.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-stone-500">Artigo não encontrado.</p>
        <button onClick={onBack} className="mt-4 text-sage-600 hover:underline">
          Ver todos os artigos
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-8 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para o blog
      </button>

      <div className="mb-4">
        <span className="text-sm font-medium text-sage-600 bg-sage-50 px-3 py-1 rounded-full">
          {article.category}
        </span>
      </div>

      <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-4 leading-tight">{article.title}</h1>

      {article.read_time && (
        <div className="flex items-center gap-2 text-stone-400 text-sm mb-8">
          <Clock size={14} /> {article.read_time} min de leitura
        </div>
      )}

      <div className="rounded-2xl overflow-hidden mb-8 aspect-video">
        <img
          src={getImage(article)}
          alt={article.image_alt || article.title}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="prose prose-sage max-w-none">
        {renderContent(article.content || '')}
      </div>

      {/* CTA */}
      <div className="mt-12 bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
        <h3 className="font-bold text-stone-800 mb-2">Quer explorar isso mais de perto?</h3>
        <p className="text-stone-600 text-sm mb-4">
          Use o diário para registrar o que você está sentindo agora ou faça a autoavaliação para entender melhor seus padrões.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#diary"
            onClick={e => { e.preventDefault(); window.history.pushState({}, '', '/'); document.dispatchEvent(new CustomEvent('navigate', { detail: 'diary' })) }}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700"
          >
            Registrar como estou hoje
          </a>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4">
        <p className="text-amber-800 text-sm">
          <strong>Importante:</strong> Os conteúdos deste blog são informativos e educativos. Não substituem acompanhamento profissional de saúde mental. Se você está passando por dificuldades severas, procure um psicólogo ou profissional de saúde.
        </p>
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <div className="mt-12">
          <h3 className="text-lg font-bold text-sage-800 mb-4">Artigos relacionados</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map(rel => (
              <button
                key={rel.id}
                onClick={() => onSelectArticle && onSelectArticle(rel.slug)}
                className="text-left bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-stone-100 overflow-hidden">
                  <img
                    src={rel.image_url || rel.cover_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60'}
                    alt={rel.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <span className="text-xs text-sage-600">{rel.category}</span>
                  <p className="font-medium text-sage-700 text-sm mt-1 line-clamp-2">{rel.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
