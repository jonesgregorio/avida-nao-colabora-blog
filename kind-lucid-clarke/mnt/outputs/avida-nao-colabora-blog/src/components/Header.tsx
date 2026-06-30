import { useState, useEffect } from 'react'
import { Heart, Menu, X, LogIn, User, BookOpen, LogOut, Crown, Map, Bookmark, Bell, LifeBuoy } from 'lucide-react'
import { Profile } from '../types'
import { supabase } from '../lib/supabase'

interface HeaderProps {
  onNavigate: (section: string) => void
  user: any
  profile: Profile | null
  onSignOut: () => void
}

export default function Header({ onNavigate, user, profile, onSignOut }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) { setUnreadCount(0); return }
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))
  }, [user])

  const nav = [
    { label: 'Início', id: 'home' },
    { label: 'Blog', id: 'articles' },
    { label: 'Diário', id: 'diary' },
    { label: 'Trilhas', id: 'trails' },
    { label: 'Questionários', id: 'questionarios' },
    { label: 'Planos', id: 'pricing' },
    { label: 'Sobre', id: 'about' },
  ]

  const handleNav = (id: string) => {
    onNavigate(id)
    setMobileOpen(false)
  }

  const planLabel: Record<string, string> = {
    free: 'Gratuito',
    essential: 'Essencial',
    therapeutic: 'Terapêutico',
    'therapeutic-plus': 'Terapêutico Plus',
  }

  return (
    <header className="sticky top-0 z-50 bg-sand-50/95 backdrop-blur border-b border-sand-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => handleNav('home')}
          className="flex items-center gap-2 group"
        >
          <Heart className="w-5 h-5 text-sage-500 group-hover:text-sage-600 transition-colors" />
          <span className="font-serif text-lg font-medium text-sage-800 leading-tight">
            A Vida Não Colabora
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="text-sm text-sage-700 hover:text-sage-900 transition-colors font-medium"
            >
              {item.label}
            </button>
          ))}

          {user ? (
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => handleNav('support')}
                title="Suporte"
                className="p-1.5 text-sage-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
              >
                <LifeBuoy className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleNav('notifications')}
                title="Notificações"
                className="relative p-1.5 text-sage-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleNav('saved')}
                className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                <span>Caixa de Cuidado</span>
              </button>
              <button
                onClick={() => handleNav('trails')}
                title="Trilhas de Autocuidado"
                className="p-1.5 text-sage-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              >
                <Map className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleNav('profile')}
                className="flex items-center gap-2 bg-sage-100 hover:bg-sage-200 text-sage-800 text-sm px-3 py-1.5 rounded-full transition-colors"
              >
                <User className="w-4 h-4" />
                <span>{(profile as any)?.preferred_name || (profile as any)?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'Perfil'}</span>
                {profile?.plan !== 'free' && (
                  <Crown className="w-3 h-3 text-sand-500" />
                )}
              </button>
              <button
                onClick={onSignOut}
                className="text-sm text-sage-500 hover:text-sage-700 flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => handleNav('auth')}
                className="text-sm text-sage-700 hover:text-sage-900 font-medium transition-colors"
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
            </div>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-sage-700"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Abrir menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-sand-50 border-t border-sand-200 py-4 px-4 space-y-1">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="block w-full text-left text-sm text-sage-700 hover:text-sage-900 hover:bg-sage-50 px-3 py-2.5 rounded-lg font-medium transition-colors"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-sand-200 mt-2">
            {user ? (
              <>
                <button
                  onClick={() => handleNav('diary')}
                  className="flex items-center gap-2 text-sm text-ocean-600 px-3 py-2.5 w-full hover:bg-ocean-50 rounded-lg"
                >
                  <BookOpen className="w-4 h-4" /> Diário
                </button>
                <button
                  onClick={() => handleNav('trails')}
                  className="flex items-center gap-2 text-sm text-blue-600 px-3 py-2.5 w-full hover:bg-blue-50 rounded-lg"
                >
                  <Map className="w-4 h-4" /> Trilhas de Autocuidado
                </button>
                <button
                  onClick={() => handleNav('support')}
                  className="flex items-center gap-2 text-sm text-emerald-600 px-3 py-2.5 w-full hover:bg-emerald-50 rounded-lg"
                >
                  <LifeBuoy className="w-4 h-4" /> Suporte
                </button>
                <button
                  onClick={() => handleNav('saved')}
                  className="flex items-center gap-2 text-sm text-emerald-600 px-3 py-2.5 w-full hover:bg-emerald-50 rounded-lg"
                >
                  <Bookmark className="w-4 h-4" /> Caixa de Cuidado
                </button>
                <button
                  onClick={() => handleNav('profile')}
                  className="flex items-center gap-2 text-sm text-sage-700 px-3 py-2.5 w-full hover:bg-sage-50 rounded-lg"
                >
                  <User className="w-4 h-4" /> Perfil
                  {profile && (
                    <span className="text-xs bg-sage-100 px-2 py-0.5 rounded-full ml-auto">
                      {planLabel[profile.plan] || profile.plan}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { onSignOut(); setMobileOpen(false) }}
                  className="flex items-center gap-2 text-sm text-red-500 px-3 py-2.5 w-full hover:bg-red-50 rounded-lg"
                >
                  <LogOut className="w-4 h-4" /> Sair
                </button>
              </>
            ) : (
              <div className="space-y-2 px-1">
                <button
                  onClick={() => handleNav('auth')}
                  className="block w-full text-center text-sm text-sage-700 border border-sage-200 py-2.5 rounded-lg hover:bg-sage-50 transition-colors font-medium"
                >
                  Entrar
                </button>
                <button
                  onClick={() => handleNav('auth')}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white text-sm px-4 py-2.5 rounded-lg w-full font-medium hover:bg-green-700 transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Começar grátis
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan badge bar */}
      {user && profile && (
        <div className={`text-center text-xs py-1 font-medium ${
          profile.plan === 'therapeutic-plus'
            ? 'bg-purple-700 text-white'
            : profile.plan === 'therapeutic'
            ? 'bg-ocean-600 text-white'
            : profile.plan === 'essential'
            ? 'bg-sage-600 text-white'
            : 'bg-sand-100 text-sand-700'
        }`}>
          {profile.plan === 'free' && 'Plano Gratuito — '}
          {profile.plan === 'essential' && '✦ Plano Essencial — '}
          {profile.plan === 'therapeutic' && '✦ Plano Terapêutico — '}
          {profile.plan === 'therapeutic-plus' && '✦ Plano Terapêutico Plus — '}
          Olá, {(profile as any)?.preferred_name || (profile as any)?.display_name || profile?.full_name || 'bem-vindo(a)'}!
          {profile.plan === 'free' && (
            <button onClick={() => handleNav('pricing')} className="ml-2 underline">Fazer upgrade</button>
          )}
        </div>
      )}
    </header>
  )
}
