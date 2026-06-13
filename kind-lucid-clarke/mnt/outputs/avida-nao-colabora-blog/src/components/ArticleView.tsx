import { useState, useEffect } from 'react'
import { ArrowLeft, Clock, Tag, Send } from 'lucide-react'
import { Article, Comment } from '../types'
import { supabase } from '../lib/supabase'

interface ArticleViewProps {
  article: Article
  onBack: () => void
  user: any
}

export default function ArticleView({ article, onBack, user }: ArticleViewProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('comments')
      .select('*')
      .eq('article_id', article.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments(data || []))
  }, [article.id])

  const submitComment = async () => {
    if (!newComment.trim() || !authorName.trim()) return
    setSubmitting(true)
    const { data } = await supabase
      .from('comments')
      .insert({
        article_id: article.id,
        user_id: user?.id || null,
        author_name: authorName,
        content: newComment,
      })
      .select()
      .single()
    if (data) setComments(prev => [...prev, data])
    setNewComment('')
    setSubmitting(false)
  }

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h2 key={i} className="font-serif text-2xl text-sage-800 mt-8 mb-3">{line.slice(3)}</h2>
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-sage-800 mt-4 mb-1">{line.slice(2, -2)}</p>
      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-sage-300 pl-4 italic text-sage-600 my-4">{line.slice(2)}</blockquote>
      if (line.startsWith('- ')) return <li key={i} className="text-sage-600 ml-4 list-disc">{line.slice(2)}</li>
      if (line === '') return <br key={i} />
      return <p key={i} className="text-sage-600 leading-relaxed mb-3">{line}</p>
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sage-500 hover:text-sage-700 mb-6 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar aos artigos
      </button>

      <div className="rounded-2xl overflow-hidden mb-8">
        <img src={article.cover_image} alt={article.title} className="w-full h-64 md:h-80 object-cover" />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1 text-xs text-sage-500 bg-sage-50 px-3 py-1 rounded-full">
          <Tag className="w-3 h-3" /> {article.category}
        </span>
        <span className="flex items-center gap-1 text-xs text-sage-400">
          <Clock className="w-3 h-3" /> 5 min de leitura
        </span>
      </div>

      <h1 className="font-serif text-4xl text-sage-800 mb-3 leading-tight">{article.title}</h1>
      <p className="text-sage-500 text-sm mb-8">Por {article.author}</p>

      <div className="prose prose-sage max-w-none">
        {formatContent(article.content || '')}
      </div>

      {/* Comments */}
      <div className="mt-12 border-t border-sand-200 pt-8">
        <h3 className="font-serif text-2xl text-sage-800 mb-6">Comentários ({comments.length})</h3>

        {comments.length === 0 && (
          <p className="text-sage-400 text-sm mb-6">Seja o primeiro a comentar.</p>
        )}

        <div className="space-y-4 mb-8">
          {comments.map(c => (
            <div key={c.id} className="bg-sand-50 rounded-xl p-4">
              <p className="font-medium text-sage-700 text-sm mb-1">{c.author_name}</p>
              <p className="text-sage-600 text-sm leading-relaxed">{c.content}</p>
              <p className="text-sage-400 text-xs mt-2">
                {new Date(c.created_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-sand-200 rounded-xl p-5">
          <h4 className="font-medium text-sage-700 mb-3 text-sm">Deixe seu comentário</h4>
          <input
            type="text"
            placeholder="Seu nome"
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            className="w-full border border-sand-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
          <textarea
            placeholder="Compartilhe sua reflexão..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            rows={3}
            className="w-full border border-sand-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
          <button
            onClick={submitComment}
            disabled={submitting || !newComment.trim() || !authorName.trim()}
            className="mt-3 flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
