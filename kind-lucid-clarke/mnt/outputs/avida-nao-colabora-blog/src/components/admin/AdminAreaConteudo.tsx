import { useState } from 'react'
import { FileText, Tag, Image, HelpCircle, BookOpen, Search, Star } from 'lucide-react'
import AdminArticles from './AdminArticles'
import AdminCategories from './AdminCategories'
import AdminImages from './AdminImages'
import AdminQuestionnaires from './AdminQuestionnaires'
import AdminTrails from './AdminTrails'
import AdminSEO from './AdminSEO'
import AdminSocialProof from './AdminSocialProof'

const TABS = [
  { id: 'artigos',       label: 'Artigos',            icon: FileText },
  { id: 'categorias',    label: 'Categorias',         icon: Tag },
  { id: 'imagens',       label: 'Imagens',            icon: Image },
  { id: 'questionarios', label: 'Questionários',      icon: HelpCircle },
  { id: 'trilhas',       label: 'Trilhas',            icon: BookOpen },
  { id: 'seo',           label: 'SEO',                icon: Search },
  { id: 'depoimentos',   label: 'Home e Depoimentos', icon: Star },
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
        {tab === 'artigos'       && <AdminArticles onEdit={onEditArticle} onNew={() => onEditArticle()} />}
        {tab === 'categorias'    && <AdminCategories />}
        {tab === 'imagens'       && <AdminImages />}
        {tab === 'questionarios' && <AdminQuestionnaires />}
        {tab === 'trilhas'       && <AdminTrails />}
        {tab === 'seo'           && <AdminSEO />}
        {tab === 'depoimentos'   && <AdminSocialProof />}
      </div>
    </div>
  )
}
