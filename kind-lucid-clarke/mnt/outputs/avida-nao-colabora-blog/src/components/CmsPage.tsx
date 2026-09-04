import { renderArticleContent } from '../lib/renderArticle'

// Renderiza uma página institucional vinda do CMS (site_pages). Mesmo shell
// visual das páginas legais embutidas: faixa de cabeçalho + cartão com o texto.

interface CmsPageProps {
  title: string
  body: string
  kicker?: string
  onNavigate?: (section: string) => void
  back?: boolean
}

export default function CmsPage({ title, body, kicker, onNavigate, back }: CmsPageProps) {
  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-14">
          {kicker && (
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-forest-600 mb-3">{kicker}</span>
          )}
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900">{title}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white border border-line rounded-2xl p-6 md:p-8 prose-avida text-ink-soft text-sm leading-relaxed">
          {renderArticleContent(body)}
        </div>

        {back && onNavigate && (
          <div className="pt-6">
            <button onClick={() => onNavigate('home')} className="text-sm text-ink-soft hover:text-forest-800 transition-colors">
              ← Voltar para o início
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
