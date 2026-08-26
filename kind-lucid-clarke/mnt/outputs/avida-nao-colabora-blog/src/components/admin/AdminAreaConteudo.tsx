import { useState } from 'react'
import { FileText, Sparkles, FileCode, Zap, CalendarDays, Clock, Tag, Image, Search, Star } from 'lucide-react'
import AdminArticles from './AdminArticles'
import AdminCategories from './AdminCategories'
import AdminMediaLibrary from './AdminMediaLibrary'
import AdminSEOCockpit from './AdminSEOCockpit'
import AdminSocialProof from './AdminSocialProof'
import AdminTemplatesIA from './AdminTemplatesIA'
import AdminFabricaIA from './AdminFabricaIA'
import AdminCalendarioEditorial from './AdminCalendarioEditorial'
import AdminAutomacoesBlog from './AdminAutomacoesBlog'
import AdminScheduled from './AdminScheduled'

// Etapa 6 da MISSÃO GERAL: a área mantém todas as telas existentes, mas deixa
// de expor dez abas no mesmo nível. A navegação passa a ter somente dois níveis:
// grupo funcional -> tela. Os IDs antigos são preservados para initialTab e
// localStorage, evitando quebrar atalhos e histórico de navegação.
const GROUPS = [
  { id: 'producao', label: 'Produção', icon: FileText },
  { id: 'planejamento', label: 'Planejamento', icon: CalendarDays },
  { id: 'automacao', label: 'Automação', icon: Zap },
  { id: 'biblioteca', label: 'Biblioteca', icon: Tag },
  { id: 'inteligencia', label: 'Inteligência', icon: Search },
] as const

type Group = typeof GROUPS[number]['id']

const TABS = [
  { id: 'artigos', label: 'Artigos', icon: FileText, group: 'producao' },
  { id: 'gerar-ia', label: 'Fábrica IA', icon: Sparkles, group: 'producao' },
  { id: 'templates', label: 'Templates de IA', icon: FileCode, group: 'producao' },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays, group: 'planejamento' },
  { id: 'programados', label: 'Programados', icon: Clock, group: 'planejamento' },
  { id: 'automacoes', label: 'Regras automáticas', icon: Zap, group: 'automacao' },
  { id: 'categorias', label: 'Categorias', icon: Tag, group: 'biblioteca' },
  { id: 'imagens', label: 'Mídia', icon: Image, group: 'biblioteca' },
  { id: 'depoimentos', label: 'Home e depoimentos', icon: Star, group: 'biblioteca' },
  { id: 'seo', label: 'SEO', icon: Search, group: 'inteligencia' },
] as const

type Tab = typeof TABS[number]['id']

const DEFAULT_TAB: Tab = 'artigos'

function isTab(value: string): value is Tab {
  return TABS.some(tab => tab.id === value)
}

function groupForTab(tab: Tab): Group {
  return TABS.find(item => item.id === tab)?.group ?? 'producao'
}

function firstTabForGroup(group: Group): Tab {
  return TABS.find(item => item.group === group)?.id ?? DEFAULT_TAB
}

interface Props {
  onEditArticle: (id?: string) => void
  initialTab?: string
  // A Central de IA continua única em IA Emocional. Aqui existe apenas um
  // atalho contextual em Inteligência, sem renderizar novamente a tela de uso.
  onOpenCentralIA?: () => void
}

export default function AdminAreaConteudo({ onEditArticle, initialTab, onOpenCentralIA }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-conteudo-tab') ?? DEFAULT_TAB
      return isTab(saved) ? saved : DEFAULT_TAB
    } catch { return DEFAULT_TAB }
  })

  const activeGroup = groupForTab(tab)
  const groupTabs = TABS.filter(item => item.group === activeGroup)

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-conteudo-tab', id) } catch { /* noop */ }
  }

  function switchGroup(group: Group) {
    if (activeGroup === group) return
    switchTab(firstTabForGroup(group))
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-forest-900">Conteúdo &amp; IA</h1>
        <p className="text-sm text-ink-soft mt-1">Produza, planeje e acompanhe o conteúdo sem misturar criação, automação e biblioteca no mesmo nível.</p>
      </div>

      <div className="border-y border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-1 px-4 py-2 overflow-x-auto" aria-label="Grupos de Conteúdo & IA">
          {GROUPS.map(group => {
            const Icon = group.icon
            const selected = activeGroup === group.id
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={selected}
                onClick={() => switchGroup(group.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selected
                    ? 'bg-forest-900 text-white'
                    : 'text-ink-soft hover:text-forest-900 hover:bg-paper-soft'
                }`}
              >
                <Icon className="w-4 h-4" />
                {group.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-line/70 bg-paper-soft/60">
          <nav className="flex items-center gap-1 px-4 py-2 overflow-x-auto" aria-label={`Opções de ${GROUPS.find(group => group.id === activeGroup)?.label ?? 'Conteúdo & IA'}`}>
            {groupTabs.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    tab === item.id
                      ? 'bg-white text-forest-900 font-medium shadow-sm border border-line'
                      : 'text-ink-soft hover:text-forest-900 hover:bg-white/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              )
            })}
            {activeGroup === 'inteligencia' && onOpenCentralIA && (
              <button
                type="button"
                onClick={onOpenCentralIA}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap text-forest-700 hover:text-forest-900 hover:bg-white/70"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Central de IA
              </button>
            )}
          </nav>
        </div>
      </div>

      <div className="flex-1">
        {tab === 'artigos'     && <AdminArticles contentType="article" onEdit={onEditArticle} onNew={() => onEditArticle()} />}
        {tab === 'gerar-ia'    && <AdminFabricaIA />}
        {tab === 'templates'   && <AdminTemplatesIA />}
        {tab === 'automacoes'  && <AdminAutomacoesBlog />}
        {tab === 'calendario'  && <AdminCalendarioEditorial onEditArticle={onEditArticle} />}
        {tab === 'programados' && <AdminScheduled />}
        {tab === 'categorias'  && <AdminCategories />}
        {tab === 'imagens'     && <AdminMediaLibrary />}
        {tab === 'seo'         && <AdminSEOCockpit onEditArticle={onEditArticle} />}
        {tab === 'depoimentos' && <AdminSocialProof />}
      </div>
    </div>
  )
}
