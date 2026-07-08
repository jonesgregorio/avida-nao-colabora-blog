import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  Home, NotebookPen, LineChart, BookOpen, ClipboardList, Sprout, MessageCircle, CreditCard,
  BarChart3, Heart, Bell, BellRing, Trophy, Menu, X, User as UserIcon, LogOut, Shield, ChevronDown,
  LifeBuoy, Leaf,
} from 'lucide-react'
import type { Profile } from '../../types'
import { supabase } from '../../lib/supabase'
import { LogoIcon } from '../Logo'
import PlanBadge from '../PlanBadge'

interface UserLayoutProps {
  user: SupabaseUser | null
  profile: Profile | null
  currentView: string
  onNavigate: (section: string) => void
  onSignOut: () => void
  children: ReactNode
}

interface NavItem {
  id: string
  label: string
  Icon: typeof Home
  match: string[]
}

// Navegação lateral — as áreas logadas do usuário. Cada item mapeia para uma view real.
const PRIMARY_NAV: NavItem[] = [
  { id: 'home',                        label: 'Início',              Icon: Home,          match: ['home'] },
  { id: 'diary',                       label: 'Diário',              Icon: NotebookPen,   match: ['diary'] },
  { id: 'my-evolution',                label: 'Mapa Emocional',      Icon: LineChart,     match: ['my-evolution'] },
  { id: 'articles',                    label: 'Conteúdos',           Icon: BookOpen,      match: ['articles', 'article', 'content', 'trails', 'meditations', 'challenges'] },
  { id: 'questionarios',               label: 'Questionários',       Icon: ClipboardList, match: ['questionarios', 'questionnaire'] },
  { id: 'my-evolution?tab=autocuidado', label: 'Plano de Autocuidado', Icon: Sprout,      match: [] },
  { id: 'monthly-guidance',            label: 'Orientação',          Icon: MessageCircle, match: ['monthly-guidance', 'professional-comments'] },
  { id: 'my-plan',                     label: 'Meu Plano',           Icon: CreditCard,    match: ['my-plan'] },
  { id: 'my-report',                   label: 'Relatórios',          Icon: BarChart3,     match: ['my-report'] },
]

const SECONDARY_NAV: NavItem[] = [
  { id: 'saved',         label: 'Favoritos',             Icon: Heart,    match: ['saved'] },
  { id: 'notifications', label: 'Notificações e salvos', Icon: Bell,     match: ['notifications'] },
  { id: 'conquistas',    label: 'Conquistas',            Icon: Trophy,   match: ['conquistas'] },
  { id: 'lembretes',     label: 'Lembretes',             Icon: BellRing, match: ['lembretes'] },
]

function displayName(profile: Profile | null, user: SupabaseUser | null) {
  return profile?.preferred_name || profile?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'você'
}

export default function UserLayout({ user, profile, currentView, onNavigate, onSignOut, children }: UserLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const profileRef = useRef<HTMLDivElement>(null)

  const name = displayName(profile, user)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!user) { setUnread(0); return }
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnread(count ?? 0))
  }, [user])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Fecha o drawer mobile ao trocar de view
  useEffect(() => { setMobileOpen(false) }, [currentView])

  const isActive = (item: NavItem) => item.match.includes(currentView)
  const go = (id: string) => { onNavigate(id); setMobileOpen(false); setProfileOpen(false) }

  return (
    <div className="min-h-screen bg-paper flex">
      {/* ─── Sidebar (desktop) ─── */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-forest-900 text-white/90 sticky top-0 h-screen overflow-y-auto">
        <SidebarContent name={name} nav={PRIMARY_NAV} secondary={SECONDARY_NAV} isActive={isActive} go={go} onNavigate={onNavigate} />
      </aside>

      {/* ─── Sidebar (mobile drawer) ─── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-forest-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[82%] bg-forest-900 text-white/90 h-full overflow-y-auto animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/70 hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent name={name} nav={PRIMARY_NAV} secondary={SECONDARY_NAV} isActive={isActive} go={go} onNavigate={onNavigate} />
          </aside>
        </div>
      )}

      {/* ─── Coluna principal ─── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header superior */}
        <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
          <div className="h-16 md:h-[72px] px-4 sm:px-6 flex items-center gap-3">
            <button
              className="lg:hidden p-2 -ml-2 text-forest-900 rounded-lg hover:bg-mint/60"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 lg:gap-3 min-w-0">
              <Leaf className="w-4 h-4 text-forest-400 flex-shrink-0 hidden sm:block" />
              <p className="text-sm text-ink-soft truncate">Você está no lugar certo para cuidar de você.</p>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => go('notifications')}
                aria-label="Notificações"
                className="relative p-2 text-ink-soft hover:text-forest-900 rounded-lg transition-colors"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-coral text-[#7a3320] text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-mint/50 transition-colors"
                >
                  <Avatar profile={profile} name={name} />
                  <span className="hidden sm:flex flex-col items-start leading-tight max-w-[130px]">
                    <span className="text-sm font-medium text-forest-900 truncate max-w-[130px]">Olá, {name}</span>
                    <PlanBadge plan={profile?.plan} member size="sm" className="mt-0.5" />
                  </span>
                  <ChevronDown className={`w-4 h-4 text-ink-soft transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>
                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-line py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-line mb-1 sm:hidden">
                      <p className="text-sm font-medium text-forest-900 truncate">Olá, {name}</p>
                      <PlanBadge plan={profile?.plan} member size="sm" className="mt-1" />
                    </div>
                    <DropItem icon={<UserIcon className="w-4 h-4" />} label="Meu perfil" onClick={() => go('profile')} />
                    <DropItem icon={<CreditCard className="w-4 h-4" />} label="Meu plano" onClick={() => go('my-plan')} />
                    <DropItem icon={<LifeBuoy className="w-4 h-4" />} label="Suporte" onClick={() => go('support')} />
                    {isAdmin && (
                      <>
                        <div className="border-t border-line my-1" />
                        <DropItem icon={<Shield className="w-4 h-4 text-amber-500" />} label="Painel Admin" onClick={() => go('admin')} accent="amber" />
                      </>
                    )}
                    <div className="border-t border-line my-1" />
                    <DropItem icon={<LogOut className="w-4 h-4" />} label="Sair" onClick={() => { onSignOut(); setProfileOpen(false) }} accent="red" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}

function SidebarContent({
  name, nav, secondary, isActive, go, onNavigate,
}: {
  name: string
  nav: NavItem[]
  secondary: NavItem[]
  isActive: (i: NavItem) => boolean
  go: (id: string) => void
  onNavigate: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Marca + saudação */}
      <button onClick={() => go('home')} className="flex items-center gap-2.5 px-5 pt-6 pb-5 text-left">
        <LogoIcon className="w-7 h-7 text-white" />
        <span className="font-serif text-lg leading-tight">A Vida Não Colabora</span>
      </button>
      <div className="px-5 pb-5">
        <p className="text-xs text-white/50">Que bom ter você por aqui,</p>
        <p className="font-serif text-2xl text-white leading-tight capitalize">{name}</p>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map(item => (
          <NavButton key={item.id} item={item} active={isActive(item)} onClick={() => go(item.id)} />
        ))}
        <div className="my-3 border-t border-white/10 mx-2" />
        {secondary.map(item => (
          <NavButton key={item.id} item={item} active={isActive(item)} onClick={() => go(item.id)} />
        ))}
      </nav>

      {/* Card de apoio */}
      <div className="p-3 mt-3">
        <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-4">
          <p className="text-sm font-medium text-white">Precisa de apoio agora?</p>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">Fale com nosso time de orientação.</p>
          <button
            onClick={() => onNavigate('support')}
            className="mt-3 w-full flex items-center justify-between gap-2 bg-white text-forest-900 text-sm font-medium px-3.5 py-2 rounded-xl hover:bg-mint transition-colors"
          >
            Buscar orientação
            <span aria-hidden>→</span>
          </button>
        </div>
        <div className="flex justify-center pt-3 opacity-40">
          <Leaf className="w-6 h-6 text-white/50" />
        </div>
      </div>
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { Icon, label } = item
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        active ? 'bg-white/95 text-forest-900 font-medium shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function Avatar({ profile, name }: { profile: Profile | null; name: string }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
  }
  return (
    <span className="w-9 h-9 rounded-full bg-mint text-forest-800 flex items-center justify-center text-sm font-semibold flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

function DropItem({ icon, label, onClick, accent }: { icon: ReactNode; label: string; onClick: () => void; accent?: 'amber' | 'red' }) {
  const color = accent === 'amber' ? 'text-amber-700 hover:bg-amber-50' : accent === 'red' ? 'text-red-500 hover:bg-red-50' : 'text-ink hover:bg-mint/40'
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left text-sm ${color}`}>
      <span className="text-ink-soft flex-shrink-0">{icon}</span>
      {label}
    </button>
  )
}
