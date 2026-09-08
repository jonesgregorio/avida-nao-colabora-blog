import { ReactNode, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, Users, HeartHandshake, BookOpen,
  Mail, LifeBuoy, Settings2, Activity,
  ExternalLink, Menu, BarChart3, DollarSign, ArrowLeftFromLine, Megaphone, ListFilter,
  Search, Bell, CreditCard,
} from 'lucide-react'
import { LogoIcon } from '../Logo'
import type { AdminView } from './types'
import './admin-theme.css'

type NavItem = { id: AdminView; label: string; icon: LucideIcon }
type NavGroup = { label: string; items: NavItem[] }

// Menu reorganizado (IA 2026-09): menos itens de topo, agrupados por TAREFA.
// Engajamento permanece como item independente, sem alteração.
const NAV_GROUPS: NavGroup[] = [
  { label: 'Visão geral', items: [
    { id: 'visao-geral', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { label: 'Pessoas', items: [
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'segmentacao', label: 'Segmentação', icon: ListFilter },
    { id: 'engajamento', label: 'Engajamento', icon: Activity },
  ]},
  { label: 'Negócio', items: [
    { id: 'assinaturas', label: 'Assinaturas', icon: CreditCard },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  ]},
  { label: 'Conteúdo', items: [
    { id: 'conteudos', label: 'Conteúdo', icon: BookOpen },
    { id: 'estudio', label: 'Estúdio de Conteúdo', icon: Megaphone },
  ]},
  { label: 'Cuidado', items: [
    { id: 'cuidado', label: 'Cuidado', icon: HeartHandshake },
  ]},
  { label: 'Relacionamento', items: [
    { id: 'comunicacao', label: 'Comunicação', icon: Mail },
    { id: 'suporte', label: 'Suporte', icon: LifeBuoy },
  ]},
  { label: 'Análise', items: [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ]},
  { label: 'Administração', items: [
    { id: 'sistema', label: 'Sistema', icon: Settings2 },
  ]},
]

function deriveActive(view: string): string {
  if (view === 'article-editor') return 'conteudos'
  return view
}

const AREA_MODULE: Record<string, string> = {
  'visao-geral': 'overview', usuarios: 'users', segmentacao: 'users', engajamento: 'analytics',
  assinaturas: 'finance', financeiro: 'finance',
  conteudos: 'content', estudio: 'content',
  cuidado: 'content', analytics: 'analytics',
  comunicacao: 'communication', suporte: 'users', sistema: 'system',
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
  const [allowed, setAllowed] = useState<Set<string> | null>(null)
  const active = deriveActive(currentView)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.rpc('admin_my_permissions')
      if (!alive) return
      const mods = (data as string[] | null) ?? null
      if (error || !mods || mods.includes('*')) { setAllowed(null); return }
      setAllowed(new Set(mods))
    })().catch(() => { setAllowed(null) })
    return () => { alive = false }
  }, [])

  const name = userName || (userEmail ? userEmail.split('@')[0] : 'Administrador')
  const initials = (name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || 'AD').toUpperCase()

  function canShow(item: NavItem) {
    if (!allowed) return true
    const mod = AREA_MODULE[item.id]
    return !mod || mod === 'permissions' || allowed.has(mod)
  }

  const visibleNav = NAV_GROUPS
    .map(group => ({ ...group, items: group.items.filter(canShow) }))
    .filter(group => group.items.length > 0)

  function go(item: NavItem) {
    onNavigate(item.id)
    setSidebarOpen(false)
  }

  const Sidebar = () => (
    <aside className="admin-sidebar w-[250px] text-forest-100 flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
        <LogoIcon className="w-8 h-8 text-white flex-shrink-0" />
        <div className="leading-tight min-w-0">
          <p className="font-serif text-white text-[17px] truncate">A Vida Não Colabora</p>
          <p className="text-[10px] tracking-[0.22em] text-forest-300 uppercase mt-1">Área Administrativa</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleNav.map(group => (
          <div key={group.label}>
            <div className="admin-nav-section">{group.label}</div>
            <div className="space-y-1 px-1">
              {group.items.map(item => {
                const Icon = item.icon
                const on = active === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item)}
                    className={`admin-nav-button ${on ? 'is-active' : ''} w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-left`}
                  >
                    <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/10 space-y-2 flex-shrink-0">
        <button
          onClick={() => window.open('/', '_blank')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-forest-100 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Ver site
        </button>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{name}</p>
            <p className="text-[11px] text-forest-300">Administrador</p>
          </div>
          <button onClick={onExit} title="Voltar ao blog (continua logado)" className="text-forest-300 hover:text-white p-1 flex-shrink-0">
            <ArrowLeftFromLine className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="admin-shell flex min-h-screen">
      <div className="hidden md:flex flex-shrink-0 h-screen sticky top-0"><Sidebar /></div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-shrink-0 h-screen"><Sidebar /></div>
          <div className="flex-1 bg-black/45" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="admin-topbar sticky top-0 z-20 border-b flex items-center gap-3 px-4 md:px-6 h-[62px] flex-shrink-0">
          <button className="md:hidden p-2 text-forest-900" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu className="w-5 h-5" />
          </button>

          <div className="admin-search-wrap hidden sm:block">
            <Search className="admin-search-icon w-4 h-4" />
            <input className="admin-search" placeholder="Buscar no admin..." aria-label="Buscar no admin" />
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <button className="w-9 h-9 rounded-full border border-[#ded5c8] bg-[#fffdf9] flex items-center justify-center text-[#637069] hover:bg-[#f5efe6]" aria-label="Notificações">
              <Bell className="w-4 h-4" />
            </button>
            <span className="w-9 h-9 rounded-full bg-[#E7F0EA] flex items-center justify-center text-xs font-semibold text-forest-700">{initials}</span>
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
