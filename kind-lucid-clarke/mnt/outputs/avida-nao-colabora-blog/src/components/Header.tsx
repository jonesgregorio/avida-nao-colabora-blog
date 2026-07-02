import { useState, useEffect, useRef } from 'react'
import {
  Heart, Menu, X, LogIn, User, BookOpen, LogOut, Crown,
  Bookmark, Bell, LifeBuoy, TrendingUp, ChevronDown, Wrench,
  HelpCircle, Map, ClipboardList, Shield,
} from 'lucide-react'
import { Profile } from '../types'
import { supabase } from '../lib/supabase'

interface HeaderProps {
  onNavigate: (section: string) => void
  user: any
  profile: Profile | null
  onSignOut: () => void
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

const PLAN_STATUS_TEXT: Record<string, string[]> = {
  free: ['Plano Gratuito', 'Conheça os recursos premium'],
  essential: ['Plano Essencial', 'Relatórios mensais disponíveis'],
  therapeutic: ['Plano Terapêutico', 'Orientação mensal disponível'],
  'therapeutic-plus': ['Plano Terapêutico Plus', 'Sessão mensal disponível', 'Orientação do mês disponível'],
}

const PLAN_BAR_COLORS: Record<string, string> = {
  free: 'bg-sand-100 text-sand-700',
  essential: 'bg-sage-600 text-white',
  therapeutic: 'bg-ocean-600 text-white',
  'therapeutic-plus': 'bg-purple-700 text-white',
}

export default function Header({ onNavigate, user, profile, onSignOut }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const toolsRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) { setUnreadCount(0); return }
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))
  }, [user])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleNav = (id: string) => {
    onNavigate(id)
    setMobileOpen(false)
    setToolsOpen(false)
    setProfileOpen(false)
    setMobileToolsOpen(false)
  }

  const handleSignOut = () => {
    onSignOut()
    setProfileOpen(false)
    setMobileOpen(false)
  }

  const isAdmin = profile?.role === 'admin'

  const toolItems = [
    { id: 'diary', label: 'Diário', icon: <BookOpen className="w-4 h-4" />, desc: 'Registros emocionais diários' },
    { id: 'saved', label: 'Caixa de Cuidado', icon: <Bookmark className="w-4 h-4" />, desc: 'Conteúdos salvos para você' },
    { id: 'trails', label: 'Trilhas', icon: <Map className="w-4 h-4" />, desc: 'Jornadas de autocuidado' },
    { id: 'questionarios', label: 'Questionários', icon: <ClipboardList className="w-4 h-4" />, desc: 'Avaliações de bem-estar' },
    { id: 'challenges', label: 'Mini-desafios', icon: <HelpCircle className="w-4 h-4" />, desc: 'Pequenos exercícios diários' },
  ]

  const planStatusParts = PLAN_STATUS_TEXT[profile?.plan ?? 'free'] ?? ['Plano Gratuito']

  return (
    <header className="sticky top-0 z-50 bg-sand-50/95 backdrop-blur border-b border-sand-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">

        {/* Logo */}
        <button
          onClick={() => handleNav('home')}
          className="flex items-center gap-2 group flex-shrink-0"
        >
          <Heart className="w-5 h-5 text-sage-500 group-hover:text-sage-600 transition-colors" />
          <span className="font-serif text-base font-medium text-sage-800 leading-tight hidden sm:block">
            A Vida Não Colabora
          </span>
          <span className="font-serif text-base font-medium text-sage-800 leading-tight sm:hidden">
            AVNC
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 ml-4">
          {/* Public */}
          <button
            onClick={() => handleNav('home')}
            className="text-sm text-sage-700 hover:text-sage-900 hover:bg-sage-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Início
          </button>
          <button
            onClick={() => handleNav('articles')}
            className="text-sm text-sage-700 hover:text-sage-900 hover:bg-sage-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Blog
          </button>

          {/* Ferramentas dropdown — only logged in */}
          {user && (
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => { setToolsOpen(!toolsOpen); setProfileOpen(false) }}
                className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  toolsOpen
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-sage-700 hover:text-sage-900 hover:bg-sage-50'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Ferramentas
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {toolsOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50">
                  {toolItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors text-left"
                    >
                      <span className="text-stone-400 mt-0.5 flex-shrink-0">{item.icon}</span>
                      <span>
                        <span className="block text-sm font-medium text-stone-800">{item.label}</span>
                        <span className="block text-xs text-stone-400">{item.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Minha Evolução — logged in */}
          {user && (
            <button
              onClick={() => handleNav('my-evolution')}
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Minha Evolução
            </button>
          )}

          {/* Meu Plano — logged in */}
          {user && (
            <button
              onClick={() => handleNav('my-plan')}
              className="flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Crown className="w-3.5 h-3.5" />
              Meu Plano
            </button>
          )}

          {/* Planos — deslogado */}
          {!user && (
            <button
              onClick={() => handleNav('pricing')}
              className="text-sm text-sage-700 hover:text-sage-900 hover:bg-sage-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Planos
            </button>
          )}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          {user ? (
            <>
              {/* Suporte */}
              <button
                onClick={() => handleNav('support')}
                className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                Suporte
              </button>

              {/* Notificações */}
              <button
                onClick={() => handleNav('notifications')}
                title="Notificações"
                className="relative p-2 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Perfil dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => { setProfileOpen(!profileOpen); setToolsOpen(false) }}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    profileOpen
                      ? 'bg-stone-100 text-stone-800'
                      : 'bg-sage-100 hover:bg-sage-200 text-sage-800'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[100px] truncate">
                    {(profile as any)?.preferred_name || (profile as any)?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'Perfil'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50">
                    <button
                      onClick={() => handleNav('profile')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors text-left"
                    >
                      <User className="w-4 h-4 text-stone-400" />
                      <span className="text-sm text-stone-700 font-medium">Meu perfil</span>
                    </button>
                    <button
                      onClick={() => handleNav('notifications')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors text-left"
                    >
                      <Bell className="w-4 h-4 text-stone-400" />
                      <span className="text-sm text-stone-700">Notificações</span>
                      {unreadCount > 0 && (
                        <span className="ml-auto text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                      )}
                    </button>
                    {isAdmin && (
                      <>
                        <div className="border-t border-stone-100 my-1" />
                        <button
                          onClick={() => handleNav('admin')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors text-left"
                        >
                          <Shield className="w-4 h-4 text-amber-500" />
                          <span className="text-sm text-amber-700 font-medium">Painel Admin</span>
                        </button>
                      </>
                    )}
                    <div className="border-t border-stone-100 my-1" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-red-500">Sair</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNav('auth')}
                className="text-sm text-sage-700 hover:text-sage-900 font-medium px-3 py-1.5 rounded-lg hover:bg-sage-50 transition-colors"
              >
                Entrar
              </button>
              <button
                onClick={() => handleNav('auth')}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
              >
                <LogIn className="w-4 h-4" />
                Começar grátis
              </button>
            </>
          )}
        </div>

        {/* Mobile: notification + hamburger */}
        <div className="md:hidden flex items-center gap-1">
          {user && (
            <button
              onClick={() => handleNav('notifications')}
              className="relative p-2 text-stone-500"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            className="p-2 text-sage-700"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-sand-50 border-t border-sand-200 py-3 px-4 space-y-0.5 max-h-[80vh] overflow-y-auto">
          {/* Public links */}
          <button
            onClick={() => handleNav('home')}
            className="block w-full text-left text-sm text-sage-700 hover:bg-sage-50 px-3 py-2.5 rounded-lg font-medium"
          >
            Início
          </button>
          <button
            onClick={() => handleNav('articles')}
            className="block w-full text-left text-sm text-sage-700 hover:bg-sage-50 px-3 py-2.5 rounded-lg font-medium"
          >
            Blog
          </button>

          {!user && (
            <button
              onClick={() => handleNav('pricing')}
              className="block w-full text-left text-sm text-sage-700 hover:bg-sage-50 px-3 py-2.5 rounded-lg font-medium"
            >
              Planos
            </button>
          )}

          {user && (
            <>
              <div className="border-t border-sand-200 my-2" />

              {/* Ferramentas — expandable */}
              <button
                onClick={() => setMobileToolsOpen(!mobileToolsOpen)}
                className="w-full flex items-center justify-between text-sm font-medium text-stone-700 hover:bg-stone-50 px-3 py-2.5 rounded-lg"
              >
                <span className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-stone-400" />
                  Ferramentas
                </span>
                <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${mobileToolsOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileToolsOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-stone-100 pl-3">
                  {toolItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className="flex items-center gap-2 w-full text-left text-sm text-stone-600 hover:bg-stone-50 px-3 py-2 rounded-lg"
                    >
                      <span className="text-stone-400">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Evolution */}
              <button
                onClick={() => handleNav('my-evolution')}
                className="flex items-center gap-2 w-full text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 px-3 py-2.5 rounded-lg"
              >
                <TrendingUp className="w-4 h-4" />
                Minha Evolução
              </button>

              {/* Plan */}
              <button
                onClick={() => handleNav('my-plan')}
                className="flex items-center gap-2 w-full text-left text-sm font-medium text-purple-700 hover:bg-purple-50 px-3 py-2.5 rounded-lg"
              >
                <Crown className="w-4 h-4" />
                Meu Plano
                {profile && (
                  <span className="ml-auto text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                    {PLAN_LABELS[profile.plan] ?? profile.plan}
                  </span>
                )}
              </button>

              {/* Support */}
              <button
                onClick={() => handleNav('support')}
                className="flex items-center gap-2 w-full text-left text-sm text-stone-600 hover:bg-stone-50 px-3 py-2.5 rounded-lg"
              >
                <LifeBuoy className="w-4 h-4 text-stone-400" />
                Suporte
              </button>

              <div className="border-t border-sand-200 my-2" />

              {/* Profile */}
              <button
                onClick={() => handleNav('profile')}
                className="flex items-center gap-2 w-full text-left text-sm text-sage-700 hover:bg-sage-50 px-3 py-2.5 rounded-lg"
              >
                <User className="w-4 h-4 text-stone-400" />
                Meu perfil
              </button>

              {/* Notifications */}
              <button
                onClick={() => handleNav('notifications')}
                className="flex items-center gap-2 w-full text-left text-sm text-stone-600 hover:bg-stone-50 px-3 py-2.5 rounded-lg"
              >
                <Bell className="w-4 h-4 text-stone-400" />
                Notificações
                {unreadCount > 0 && (
                  <span className="ml-auto text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </button>

              {/* Admin */}
              {isAdmin && (
                <button
                  onClick={() => handleNav('admin')}
                  className="flex items-center gap-2 w-full text-left text-sm text-amber-700 hover:bg-amber-50 px-3 py-2.5 rounded-lg"
                >
                  <Shield className="w-4 h-4 text-amber-500" />
                  Painel Admin
                </button>
              )}

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full text-left text-sm text-red-500 hover:bg-red-50 px-3 py-2.5 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </>
          )}

          {!user && (
            <>
              <div className="border-t border-sand-200 my-2 pt-2 space-y-2 px-1">
                <button
                  onClick={() => handleNav('auth')}
                  className="block w-full text-center text-sm text-sage-700 border border-sage-200 py-2.5 rounded-lg hover:bg-sage-50 font-medium"
                >
                  Entrar
                </button>
                <button
                  onClick={() => handleNav('auth')}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white text-sm px-4 py-2.5 rounded-lg w-full font-medium hover:bg-green-700"
                >
                  <LogIn className="w-4 h-4" /> Começar grátis
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Plan status bar */}
      {user && profile && (
        <div className={`text-center text-xs py-1 font-medium ${PLAN_BAR_COLORS[profile.plan] ?? PLAN_BAR_COLORS.free}`}>
          {planStatusParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1.5 opacity-60">•</span>}
              {i === 0 ? <span className="font-semibold">{part}</span> : part}
            </span>
          ))}
          {profile.plan === 'free' && (
            <button onClick={() => handleNav('pricing')} className="ml-2 underline opacity-80 hover:opacity-100">
              Ver planos
            </button>
          )}
        </div>
      )}
    </header>
  )
}
