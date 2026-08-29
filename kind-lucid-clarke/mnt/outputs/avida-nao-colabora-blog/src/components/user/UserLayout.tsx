import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  Home, NotebookPen, LineChart, BookOpen, ClipboardList, Sprout, MessageCircle, CreditCard,
  BarChart3, Menu, X, User as UserIcon, LogOut, Shield, ChevronDown,
  LifeBuoy, Leaf, Bell,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'
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
  /** Rotas (pathname) que também ativam este item — ex.: /plano-de-autocuidado. */
  matchPath?: string[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Fase 1 da nova experiência (Ideia 1): reorganiza o que JÁ existe sem criar
// destinos vazios. Descobertas e Minha História entram somente quando suas
// fases funcionais forem implementadas.
const PRIMARY_NAV: NavItem[] = [
  { id: 'home',             label: 'Hoje',                 Icon: Home,          match: ['home'] },
  { id: 'diary',            label: 'Diário',               Icon: NotebookPen,   match: ['diary'] },
  { id: 'my-evolution',     label: 'Mapa Emocional',       Icon: LineChart,     match: ['my-evolution'] },
  { id: 'my-report',        label: 'Relatórios',           Icon: BarChart3,     match: ['my-report'] },
  { id: 'articles',         label: 'Conteúdos Guiados',    Icon: BookOpen,      match: ['articles', 'article', 'content'] },
  { id: 'questionarios',    label: 'Questionários',        Icon: ClipboardList, match: ['questionarios', 'questionnaire'] },
  { id: 'self-care',        label: 'Plano de Autocuidado', Icon: Sprout,        match: ['self-care'], matchPath: ['/plano-de-autocuidado'] },
  { id: 'monthly-guidance', label: 'Orientação',           Icon: MessageCircle, match: ['monthly-guidance', 'professional-comments'] },
  { id: 'my-plan',          label: 'Meu Plano',            Icon: CreditCard,    match: ['my-plan'] },
  { id: 'profile',          label: 'Perfil',               Icon: UserIcon,      match: ['profile'] },
  { id: 'support',          label: 'Suporte',              Icon: LifeBuoy,      match: ['support', 'support-ticket'] },
]

const NAV_GROUPS: NavGroup[] = [
  { label: 'Seu espaço', items: PRIMARY_NAV.filter(item => ['home', 'diary'].includes(item.id)) },
  { label: 'Entender', items: PRIMARY_NAV.filter(item => ['my-evolution', 'my-report', 'articles', 'questionarios'].includes(item.id)) },
  { label: 'Cuidar', items: PRIMARY_NAV.filter(item => ['self-care', 'monthly-guidance'].includes(item.id)) },
  { label: 'Conta', items: PRIMARY_NAV.filter(item => ['my-plan', 'profile', 'support'].includes(item.id)) },
]

// No mobile, quatro destinos de uso frequente ficam sempre acessíveis. O botão
// "Mais" abre os demais recursos sem remover nenhum fluxo já existente.
const MOBILE_PRIMARY_IDS = ['home', 'diary', 'my-evolution', 'articles'] as const

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

  // Contagem de notificações NÃO lidas (só as pessoais; broadcasts não contam).
  // Refetch ao trocar de view — assim volta zerado depois de abrir as notificações.
  useEffect(() => {
    if (!user) { setUnread(0); return }
    let active = true
    ;(async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (active) setUnread(count ?? 0)
    })()
    return () => { active = false }
  }, [user, currentView])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Fecha o menu mobile ao trocar de view.
  useEffect(() => { setMobileOpen(false) }, [currentView])

  const isActive = (item: NavItem) => {
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    if (item.matchPath?.includes(path)) return true
    // Mapa Emocional não fica ativo quando estamos na rota do Plano de Autocuidado.
    if (item.id === 'my-evolution' && path === '/plano-de-autocuidado') return false
    return item.match.includes(currentView)
  }

  const currentItem = PRIMARY_NAV.find(isActive)
  const currentLabel = currentView === 'notifications' ? 'Notificações' : (currentItem?.label ?? 'Seu espaço')
  const mobileMoreActive = !PRIMARY_NAV.some(item => MOBILE_PRIMARY_IDS.includes(item.id as typeof MOBILE_PRIMARY_IDS[number]) && isActive(item))
  const go = (id: string) => { onNavigate(id); setMobileOpen(false); setProfileOpen(false) }

  return (
    <div className="min-h-screen bg-paper flex">
      {/* ─── Sidebar (desktop) ─── */}
      <aside className="hidden lg:flex flex-col w-[272px] flex-shrink-0 bg-sand-50 border-r border-line sticky top-0 h-screen overflow-y-auto">
        <SidebarContent name={name} groups={NAV_GROUPS} isActive={isActive} go={go} onNavigate={onNavigate} />
      </aside>

      {/* ─── Menu "Mais" (mobile) ─── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 w-full h-full bg-forest-900/35 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-full max-h-[86vh] bg-paper rounded-t-[28px] border-t border-line shadow-2xl overflow-y-auto animate-slide-in">
            <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-line px-5 pt-3 pb-4">
              <div className="w-12 h-1.5 rounded-full bg-line mx-auto mb-4" aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-500">Seu espaço</p>
                  <p className="font-serif text-xl text-forest-900 mt-0.5">Mais recursos</p>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fechar menu"
                  className="p-2 rounded-xl text-ink-soft hover:bg-mint/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-4 py-4 pb-8">
              <MobileMenuContent groups={NAV_GROUPS} isActive={isActive} go={go} />
            </div>
          </aside>
        </div>
      )}

      {/* ─── Coluna principal ─── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header superior */}
        <header className="sticky top-0 z-40 bg-paper/92 backdrop-blur border-b border-line">
          <div className="h-16 md:h-[72px] px-4 sm:px-6 lg:px-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go('home')}
              className="lg:hidden flex items-center gap-2 min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
              aria-label="Ir para Hoje"
            >
              <LogoIcon className="w-6 h-6 text-forest-900 flex-shrink-0" />
              <span className="font-serif text-[15px] leading-tight text-forest-900 truncate">A Vida Não Colabora</span>
            </button>

            <div className="hidden lg:flex items-center gap-3 min-w-0">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-mint text-forest-800">
                <Leaf className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-ink-soft">Seu espaço de cuidado</p>
                <p className="text-sm font-semibold text-forest-900 truncate">{currentLabel}</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => onNavigate('notifications')}
                className="relative p-2 rounded-full hover:bg-mint/50 transition-colors"
                aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : 'Notificações'}
              >
                <Bell className="w-5 h-5 text-forest-800" />
                {unread > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#c05f3c] text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-mint/50 transition-colors"
                  aria-label="Abrir menu do perfil"
                  aria-expanded={profileOpen}
                >
                  <Avatar profile={profile} name={name} />
                  <span className="hidden sm:flex flex-col items-start leading-tight max-w-[130px]">
                    <span className="text-sm font-medium text-forest-900 truncate max-w-[130px]">Olá, {name}</span>
                    <PlanBadge plan={profile?.plan} member size="sm" className="mt-0.5" />
                  </span>
                  <ChevronDown className={`hidden sm:block w-4 h-4 text-ink-soft transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>
                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-line py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-line mb-1 sm:hidden">
                      <p className="text-sm font-medium text-forest-900 truncate">Olá, {name}</p>
                      <PlanBadge plan={profile?.plan} member size="sm" className="mt-1" />
                    </div>
                    <DropItem icon={<Bell className="w-4 h-4" />} label="Notificações" onClick={() => go('notifications')} />
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

        {/* Conteúdo da página. O padding inferior evita que a barra mobile cubra CTAs. */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">{children}</main>
      </div>

      {/* ─── Navegação principal mobile ─── */}
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-line shadow-[0_-8px_28px_rgba(15,47,37,0.08)]"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-5 px-1 pt-1.5">
          {MOBILE_PRIMARY_IDS.map(id => {
            const item = PRIMARY_NAV.find(navItem => navItem.id === id)!
            return <MobileNavButton key={item.id} item={item} active={isActive(item)} onClick={() => go(item.id)} />
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-current={mobileMoreActive ? 'page' : undefined}
            className={`min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors ${
              mobileMoreActive ? 'text-forest-900' : 'text-ink-soft'
            }`}
          >
            <span className={`w-8 h-7 rounded-xl flex items-center justify-center ${mobileMoreActive ? 'bg-mint' : ''}`}>
              <Menu className="w-[19px] h-[19px]" />
            </span>
            Mais
          </button>
        </div>
      </nav>
    </div>
  )
}

function SidebarContent({
  name, groups, isActive, go, onNavigate,
}: {
  name: string
  groups: NavGroup[]
  isActive: (i: NavItem) => boolean
  go: (id: string) => void
  onNavigate: (id: string) => void
}) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Marca oficial + saudação */}
      <button onClick={() => go('home')} className="flex items-center gap-3 px-5 pt-6 pb-5 text-left group">
        <span className="w-10 h-10 rounded-2xl bg-white border border-line flex items-center justify-center shadow-sm group-hover:border-forest-200 transition-colors">
          <LogoIcon className="w-7 h-7 text-forest-900" />
        </span>
        <span className="min-w-0">
          <span className="block font-serif text-[17px] leading-tight text-forest-900">A Vida Não Colabora</span>
          <span className="block text-[11px] text-ink-soft mt-0.5">Seu espaço de cuidado</span>
        </span>
      </button>

      <div className="mx-4 mb-5 rounded-2xl bg-white/80 border border-line px-4 py-3">
        <p className="text-[11px] text-ink-soft">Que bom ter você por aqui,</p>
        <p className="font-serif text-xl text-forest-900 leading-tight capitalize mt-0.5 truncate">{name}</p>
      </div>

      {/* Navegação organizada pela lógica da Ideia 1, sem remover recursos atuais. */}
      <nav className="flex-1 px-3 pb-3 space-y-4" aria-label="Área do usuário">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-soft/75">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavButton key={item.id} item={item} active={isActive(item)} onClick={() => go(item.id)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Card de apoio */}
      <div className="p-4 mt-auto">
        <div className="rounded-2xl bg-mint/75 border border-forest-100 p-4">
          <div className="flex items-center gap-2 text-forest-900">
            <LifeBuoy className="w-4 h-4" />
            <p className="text-sm font-semibold">Precisa de apoio?</p>
          </div>
          <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">O suporte continua acessível sem tirar você da sua jornada.</p>
          <button
            onClick={() => onNavigate('support')}
            className="mt-3 w-full flex items-center justify-between gap-2 bg-forest-900 text-white text-sm font-medium px-3.5 py-2.5 rounded-xl hover:bg-forest-800 transition-colors"
          >
            Buscar suporte
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function MobileMenuContent({
  groups, isActive, go,
}: {
  groups: NavGroup[]
  isActive: (i: NavItem) => boolean
  go: (id: string) => void
}) {
  return (
    <nav className="space-y-5" aria-label="Mais recursos">
      {groups.map(group => (
        <div key={group.label}>
          <p className="px-2 mb-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-soft/75">{group.label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.items.map(item => {
              const { Icon } = item
              const active = isActive(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                    active ? 'bg-mint border-forest-200 text-forest-900' : 'bg-white border-line text-ink hover:bg-mint/40'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-white/80' : 'bg-sand-50'}`}>
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { Icon, label } = item
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${
        active
          ? 'bg-white text-forest-900 font-semibold border border-line shadow-sm'
          : 'text-ink-soft hover:bg-white/70 hover:text-forest-900 border border-transparent'
      }`}
    >
      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function MobileNavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { Icon } = item
  const label = item.id === 'my-evolution' ? 'Mapa' : item.id === 'articles' ? 'Conteúdos' : item.label
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors ${
        active ? 'text-forest-900' : 'text-ink-soft'
      }`}
    >
      <span className={`w-8 h-7 rounded-xl flex items-center justify-center ${active ? 'bg-mint' : ''}`}>
        <Icon className="w-[19px] h-[19px]" />
      </span>
      {label}
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
