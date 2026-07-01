import { ReactNode, useState } from 'react'
import { AdminView } from './types'
import {
  LayoutDashboard, FileText, Image, Tag, Users, CreditCard,
  Star, BookOpen, Box, BarChart2, HeadphonesIcon, Bell,
  Search, Shield, ClipboardList, Briefcase, DollarSign,
  FileOutput, HelpCircle, Calendar, Zap, LogOut, ExternalLink,
  Menu, ChevronDown, ChevronRight, MessageSquare, Video, Leaf, Sparkles,
} from 'lucide-react'

type NavGroup = {
  label: string
  items: { id: AdminView; label: string; icon: any }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { id: 'articles',     label: 'Artigos',          icon: FileText },
      { id: 'images',       label: 'Imagens',          icon: Image },
      { id: 'categories',   label: 'Categorias',       icon: Tag },
      { id: 'questionnaires', label: 'Questionários',  icon: HelpCircle },
      { id: 'trails',       label: 'Trilhas',          icon: BookOpen },
      { id: 'seo',          label: 'SEO',              icon: Search },
    ],
  },
  {
    label: 'Automação',
    items: [
      { id: 'automated',    label: 'Conteúdos Auto.',  icon: Zap },
      { id: 'scheduled',    label: 'Programados',      icon: Calendar },
      { id: 'notifications',label: 'Notificações',     icon: Bell },
    ],
  },
  {
    label: 'Usuários & Planos',
    items: [
      { id: 'users',        label: 'Usuários',         icon: Users },
      { id: 'plans',        label: 'Planos',           icon: CreditCard },
      { id: 'diary-config', label: 'Diário por Plano', icon: ClipboardList },
      { id: 'saved-items',  label: 'Caixa de Cuidado', icon: Box },
    ],
  },
  {
    label: 'Métricas & Social',
    items: [
      { id: 'analytics',    label: 'Analytics',        icon: BarChart2 },
      { id: 'social-proof', label: 'Prova Social',     icon: Star },
      { id: 'pdf',          label: 'Relatórios/PDF',   icon: FileOutput },
    ],
  },
  {
    label: 'Suporte & Segurança',
    items: [
      { id: 'support',      label: 'Suporte',          icon: HeadphonesIcon },
      { id: 'permissions',  label: 'Permissões',       icon: Shield },
      { id: 'logs',         label: 'Logs',             icon: ClipboardList },
    ],
  },
  {
    label: 'Negócio',
    items: [
      { id: 'professionals',label: 'Profissionais',    icon: Briefcase },
      { id: 'professional-comments', label: 'Comentários Plus', icon: Star },
      { id: 'guidance-requests', label: 'Orientações',     icon: MessageSquare },
      { id: 'evolution-sessions', label: 'Sessões Plus',   icon: Video },
      { id: 'self-care-plans', label: 'Planos Autocuidado', icon: Leaf },
      { id: 'personalization', label: 'Personalização por Plano', icon: Sparkles },
      { id: 'financial',    label: 'Financeiro',       icon: DollarSign },
    ],
  },
]

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onExit: () => void
  userEmail?: string
  children: ReactNode
}

export default function AdminLayout({ currentView, onNavigate, onExit, userEmail, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleGroup(label: string) {
    setCollapsed(c => ({ ...c, [label]: !c[label] }))
  }

  function isActive(id: AdminView) {
    return currentView === id || (currentView === 'article-editor' && id === 'articles')
  }

  const SidebarContent = () => (
    <aside className="w-60 bg-stone-900 text-white flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-5 border-b border-stone-700 flex-shrink-0">
        <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">Painel Admin</p>
        <p className="font-semibold text-sm">A Vida Não Colabora</p>
        {userEmail && <p className="text-xs text-stone-400 mt-1 truncate">{userEmail}</p>}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_GROUPS.map(group => {
          const isCollapsed = collapsed[group.label]
          return (
            <div key={group.label}>
              {group.label !== 'Principal' && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-stone-400 uppercase tracking-wider hover:text-stone-300 mt-2"
                >
                  {group.label}
                  {isCollapsed
                    ? <ChevronRight className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />
                  }
                </button>
              )}
              {!isCollapsed && group.items.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setSidebarOpen(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive(item.id)
                        ? 'bg-emerald-700 text-white'
                        : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="px-2 py-4 border-t border-stone-700 space-y-0.5 flex-shrink-0">
        <button
          onClick={onExit}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Ver site
        </button>
        <button
          onClick={onExit}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair do admin
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-shrink-0 h-screen"><SidebarContent /></div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-stone-900 text-white sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Admin — A Vida Não Colabora</span>
        </div>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
