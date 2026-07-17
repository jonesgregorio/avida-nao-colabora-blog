import { ReactNode, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Users, CreditCard, BookOpen, LineChart, CalendarCheck,
  MessageSquare, Mail, LifeBuoy, Settings2,
  ExternalLink, Menu, LogOut, BarChart3, DollarSign,
} from 'lucide-react'
import { LogoIcon } from '../Logo'
import type { AdminView } from './types'

type NavItem = { id: AdminView; label: string; icon: LucideIcon }

// Menu lateral — as 10 áreas dedicadas do novo admin (contrato: admin-mockup-avnc.html).
const NAV: NavItem[] = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'planos', label: 'Planos e assinaturas', icon: CreditCard },
  { id: 'conteudos', label: 'Conteúdo & IA', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { id: 'mapa', label: 'Diário e mapa emocional', icon: LineChart },
  { id: 'autocuidado', label: 'Plano de autocuidado', icon: CalendarCheck },
  { id: 'orientacao', label: 'Orientação profissional', icon: MessageSquare },
  { id: 'comunicacao', label: 'Comunicação', icon: Mail },
  { id: 'suporte', label: 'Suporte', icon: LifeBuoy },
  { id: 'sistema', label: 'Sistema', icon: Settings2 },
]

// O editor de artigo mora dentro de Conteúdos; o resto é 1:1 com a view.
function deriveActive(view: string): string {
  return view === 'article-editor' ? 'conteudos' : view
}

interface Props {
  currentView: string
  onNavigate: (v: AdminView) => void
  onExit: () => void
  userEmail?: string
  userName?: string
  children: ReactNode
}

export default function AdminLayout({ currentView, onNavigate, onExit, userEmail, userName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const active = deriveActive(currentView)

  const name = userName || (userEmail ? userEmail.split('@')[0] : 'Administrador')
  const initials = (name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || 'AD').toUpperCase()

  function go(item: NavItem) {
    onNavigate(item.id)
    setSidebarOpen(false)
  }

  const Sidebar = () => (
    <aside className="w-60 bg-[#12362a] text-forest-100 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/10">
        <LogoIcon className="w-7 h-7 text-white flex-shrink-0" />
        <div className="leading-tight min-w-0">
          <p className="font-serif text-white text-base truncate">A Vida Não Colabora</p>
          <p className="text-[10px] tracking-[0.2em] text-forest-300 uppercase">Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV.map(item => {
          const Icon = item.icon
          const on = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => go(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                on ? 'bg-[#22553f] text-white font-medium' : 'text-forest-100/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Ver site + perfil */}
      <div className="px-3 py-3 border-t border-white/10 space-y-2 flex-shrink-0">
        <button
          onClick={() => window.open('/', '_blank')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-forest-100 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Ver site
        </button>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{name}</p>
            <p className="text-[11px] text-forest-300">Administrador</p>
          </div>
          <button onClick={onExit} title="Sair do admin" className="text-forest-300 hover:text-white p-1 flex-shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-shrink-0 h-screen sticky top-0">
        <Sidebar />
      </div>
      {/* Sidebar mobile (overlay) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-shrink-0 h-screen"><Sidebar /></div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-line flex items-center gap-3 px-4 h-16 flex-shrink-0">
          <button className="md:hidden p-2 text-forest-900" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="ml-auto flex items-center gap-2 pl-2">
            <span className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-xs font-semibold text-forest-700">{initials}</span>
            <div className="hidden sm:block leading-tight">
              <p className="text-sm text-forest-900">{name}</p>
              <p className="text-[11px] text-ink-soft">Administrador</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
