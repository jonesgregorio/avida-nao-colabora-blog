import { useState } from 'react'
import { FileText, Sparkles, FileCode, Zap, CalendarDays, Clock, Tag, Image, Search, Star, Plus } from 'lucide-react'
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

function isTab(value: string): value is Tab { return TABS.some(tab => tab.id === value) }
function groupForTab(tab: Tab): Group { return TABS.find(item => item.id === tab)?.group ?? 'producao' }
function firstTabForGroup(group: Group): Tab { return TABS.find(item => item.group === group)?.id ?? DEFAULT_TAB }

interface Props {
  onEditArticle: (id?: string) => void
  initialTab?: string
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
  const activeGroupLabel = GROUPS.find(group => group.id === activeGroup)?.label ?? 'Conteúdo'
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
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-kicker">Conteúdo editorial</p>
          <h1 className="font-serif text-3xl text-forest-900">Conteúdo &amp; IA</h1>
          <p className="admin-subtitle mt-1">Produza, planeje, automatize e acompanhe o conteúdo em uma estrutura visual mais limpa e previsível.</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => onEditArticle()} className="admin-btn-primary"><Plus className="w-4 h-4" /> Novo artigo</button>
          <button onClick={() => switchTab('calendario')} className="admin-btn-secondary"><CalendarDays className="w-4 h-4" /> Calendário</button>
        </div>
      </section>

      <div className="admin-tabs-wrap">
        <nav className="admin-tabs" aria-label="Grupos de Conteúdo & IA">
          {GROUPS.map(group => {
            const Icon = group.icon
            const selected = activeGroup === group.id
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={selected}
                onClick={() => switchGroup(group.id)}
                className={`admin-tab ${selected ? 'is-active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {group.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="admin-toolbar" role="navigation" aria-label={`Opções de ${activeGroupLabel}`}>
        {groupTabs.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`admin-btn-secondary ${tab === item.id ? '!bg-[#123528] !text-white !border-[#123528]' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          )
        })}
        {activeGroup === 'inteligencia' && onOpenCentralIA && (
          <button type="button" onClick={onOpenCentralIA} className="admin-btn-soft">
            <Sparkles className="w-3.5 h-3.5" /> Central de IA
          </button>
        )}
      </div>

      <section className="admin-card overflow-hidden flex-1 min-h-0">
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
      </section>
    </div>
  )
}
