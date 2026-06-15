import { ReactNode } from 'react'
import { AdminView } from './index'
import {
  LayoutDashboard, FileText, Users, Tag, CreditCard,
  Star, Image, LogOut, ExternalLink, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const navItems: { id: AdminView; label: string; icon: any }[] = [
  { id: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'articles',     label: 'Artigos',         icon: FileText },
  { id: 'images',       label: 'Imagens',         icon: Image },
  { id: 'categories',   label: 'Categorias',      icon: Tag },
  { id: 'users',        label: 'Usuários',        icon: Users },
  { id: 'plans',        label: 'Planos',          icon: CreditCard },
  { id: 'social-proof', label: 'Prova Social',    icon: Star },
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

  const Sidebar = () => (
    <aside className="w-56 bg-stone-900 text-white flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-stone-700">
        <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">Admin</p>
        <p className="font-semibold text-sm">A Vida Não Colabora</p>
        {userEmail && <p className="text-xs text-stone-400 mt-1 truncate">{userEmail}</p>}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentView === item.id || (currentView === 'article-editor' && item.id === 'articles')
                  ? 'bg-stone-700 text-white'
                  : 'text-stone-300 hover:bg-stone-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="px-2 py-4 border-t border-stone-700 space-y-0.5">
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
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-shrink-0"><Sidebar /></div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-stone-900 text-white">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Admin</span>
        </div>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
