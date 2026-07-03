import { ReactNode, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AdminView } from './types'
import {
  LayoutDashboard, FileText, Users, HeadphonesIcon, Bell, Settings2,
  LogOut, ExternalLink, Menu,
} from 'lucide-react'

type NavItem = { id: AdminView; label: string; icon: LucideIcon }

const NAV_ITEMS: NavItem[] = [
  { id: 'painel',          label: 'Painel',          icon: LayoutDashboard },
  { id: 'conteudo',        label: 'Conteúdo',        icon: FileText },
  { id: 'usuarios-planos', label: 'Usuários & Planos',icon: Users },
  { id: 'atendimento',     label: 'Atendimento',     icon: HeadphonesIcon },
  { id: 'comunicacao',     label: 'Comunicação',     icon: Bell },
  { id: 'sistema',         label: 'Sistema',         icon: Settings2 },
]

// Views que pertencem a cada área (para destacar o item correto no menu)
const AREA_OF: Record<string, AdminView> = {
  'article-editor': 'conteudo',
}

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onExit: () => void
  userEmail?: string
  children: ReactNode
}

export default function AdminLayout({ currentView, onNavigate, onExit, userEmail, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function isActive(id: AdminView) {
    return currentView === id || AREA_OF[currentView] === id
  }

  const SidebarContent = () => (
    <aside className="w-56 bg-stone-900 text-white flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-5 border-b border-stone-700 flex-shrink-0">
        <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">Painel Admin</p>
        <p className="font-semibold text-sm">A Vida Não Colabora</p>
        {userEmail && <p className="text-xs text-stone-400 mt-1 truncate">{userEmail}</p>}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = isActive(item.id)
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-emerald-700 text-white font-medium'
                  : 'text-stone-300 hover:bg-stone-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="px-2 py-4 border-t border-stone-700 space-y-0.5 flex-shrink-0">
        <button
          onClick={() => window.open(window.location.pathname, '_blank')}
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
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
