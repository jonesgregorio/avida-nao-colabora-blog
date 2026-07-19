import { X, Clock, Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { renderArticleContent, estimateReadTime } from '../../lib/renderArticle'

interface Props {
  title: string
  category: string
  content: string
  imageUrl: string
  imageAlt: string
  readTime: number
  onClose: () => void
}

// O corpo é renderizado por renderArticleContent (lib/renderArticle) — a MESMA
// função que o blog usa. Assim o preview e o blog nunca divergem.

// Placeholder do blog quando não há capa (mesmo fallback do ArticleView).
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80'

// Pré-visualização do artigo como ficará no blog, ANTES de publicar. Usa o
// rascunho atual do editor (não precisa salvar). Mostra capa + artigo completo.
export default function ArticlePreview({ title, category, content, imageUrl, imageAlt, readTime, onClose }: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')

  return (
    <div className="fixed inset-0 bg-black/50 z-[90] flex flex-col" onClick={onClose}>
      {/* Barra de topo da pré-visualização (não faz parte do artigo) */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-line flex-shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-forest-900">Pré-visualização</span>
          <span className="text-xs text-stone-400">como ficará no blog · não publica</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line overflow-hidden">
            <button onClick={() => setDevice('desktop')} title="Desktop"
              className={`px-2.5 py-1.5 ${device === 'desktop' ? 'bg-forest-900 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
              <Monitor className="w-4 h-4" />
            </button>
            <button onClick={() => setDevice('mobile')} title="Celular"
              className={`px-2.5 py-1.5 ${device === 'mobile' ? 'bg-forest-900 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Palco: fundo claro como o blog, artigo centralizado */}
      <div className="flex-1 overflow-auto bg-paper py-8 px-4" onClick={onClose}>
        <article
          onClick={e => e.stopPropagation()}
          className={`bg-white rounded-2xl shadow-sm border border-line px-5 sm:px-8 py-8 mx-auto transition-all ${device === 'mobile' ? 'max-w-sm' : 'max-w-2xl'}`}
        >
          {/* Categoria */}
          {category && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-forest-700 bg-mint px-3 py-1 rounded-full">{category}</span>
            </div>
          )}

          {/* Título */}
          <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-4 leading-tight">
            {title || <span className="text-sage-300">Título do artigo</span>}
          </h1>

          {/* Tempo de leitura — sempre, calculado do conteúdo se o campo estiver zerado */}
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-8">
            <Clock size={14} /> {readTime || estimateReadTime(content)} min de leitura
          </div>

          {/* Capa */}
          <div className="rounded-2xl overflow-hidden mb-8 aspect-video bg-stone-100">
            <img
              src={imageUrl || FALLBACK_IMG}
              alt={imageAlt || title}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG }}
            />
          </div>

          {/* Conteúdo */}
          <div className="prose prose-sage max-w-none article-content">
            {content.trim() ? renderArticleContent(content) : <p className="text-sage-400 italic">Sem conteúdo ainda.</p>}
          </div>
        </article>
      </div>
    </div>
  )
}
