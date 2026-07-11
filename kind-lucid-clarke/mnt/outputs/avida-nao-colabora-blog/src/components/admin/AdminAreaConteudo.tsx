import { useState } from 'react'
import { FileText, Wind, Moon, Sparkles, Tag, Image, Search, Star, FileCode } from 'lucide-react'
import AdminArticles from './AdminArticles'
import AdminCategories from './AdminCategories'
import AdminMediaLibrary from './AdminMediaLibrary'
import AdminSEOCockpit from './AdminSEOCockpit'
import AdminSocialProof from './AdminSocialProof'
import AdminPersonalization from './AdminPersonalization'
import AdminTemplatesIA from './AdminTemplatesIA'

// Conteúdos guiados (#conteudos). Abas do mockup primeiro; ferramentas de apoio depois.
// Questionários migraram para Diário e mapa emocional.
const TABS = [
  { id: 'artigos',      label: 'Artigos',            icon: FileText },
  { id: 'praticas',     label: 'Práticas',           icon: Wind },
  { id: 'meditacoes',   label: 'Meditações',         icon: Moon },
  { id: 'recomendacoes', label: 'Recomendações IA',  icon: Sparkles },
  { id: 'templates',    label: 'Templates IA',       icon: FileCode },
  { id: 'categorias',   label: 'Categorias',         icon: Tag },
  { id: 'imagens',      label: 'Mídia',              icon: Image },
  { id: 'seo',          label: 'SEO',                icon: Search },
  { id: 'depoimentos',  label: 'Home e Depoimentos', icon: Star },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  onEditArticle: (id?: string) => void
  initialTab?: string
}

export default function AdminAreaConteudo({ onEditArticle, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-conteudo-tab') ?? 'artigos'
      return (TABS.find(t => t.id === saved)?.id ?? 'artigos') as Tab
    } catch { return 'artigos' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-conteudo-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-forest-900">Conteúdos guiados</h1>
        <p className="text-sm text-ink-soft mt-1">Gerencie textos, práticas, meditações e recomendações de IA.</p>
      </div>
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Conteúdo">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-forest-700 text-forest-900'
                    : 'border-transparent text-ink-soft hover:text-forest-900 hover:border-line'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="flex-1">
        {tab === 'artigos'      && <AdminArticles contentType="article" onEdit={onEditArticle} onNew={() => onEditArticle()} />}
        {tab === 'praticas'     && <AdminArticles contentType="practice" onEdit={onEditArticle} onNew={() => onEditArticle()} />}
        {tab === 'meditacoes'   && <AdminArticles contentType="meditation" onEdit={onEditArticle} onNew={() => onEditArticle()} />}
        {tab === 'recomendacoes' && <AdminPersonalization />}
        {tab === 'templates'    && <AdminTemplatesIA />}
        {tab === 'categorias'   && <AdminCategories />}
        {tab === 'imagens'      && <AdminMediaLibrary />}
        {tab === 'seo'          && <AdminSEOCockpit onEditArticle={onEditArticle} />}
        {tab === 'depoimentos'  && <AdminSocialProof />}
      </div>
    </div>
  )
}
