import { useState, useEffect, useRef } from 'react'
import {
  LogIn, Menu, X, Bell, LifeBuoy, User, LogOut, Shield, ChevronDown, CreditCard,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { Profile } from '../types'
import { supabase } from '../lib/supabase'
import Logo from './Logo'

interface HeaderProps {
  onNavigate: (section: string) => void
  user: SupabaseUser | null
  profile: Profile | null
  onSignOut: () => void
  currentView?: string
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus',
  therapeutic: 'Plus', 'therapeutic-plus': 'Plus', // legado → exibe como Plus até a migração
}

export default function Header({ onNavigate, user, profile, onSignOut, currentView }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isAdmin = profile?.role === 'admin'

  // Menu público / logado — as 5 áreas + Blog. "Planos" vira "Meu plano" logado.
  const nav = [
    { id: 'articles', label: 'Blog', match: ['articles', 'article'] },
    { id: 'diary', label: 'Diário', match: ['diary'] },
    { id: 'my-evolution', label: 'Mapa emocional', match: ['my-evolution', 'my-report', 'questionarios'] },
    { id: 'trails', label: 'Conteúdos', match: ['trails', 'saved', 'meditations', 'challenges'] },
    user
      ? { id: 'my-plan', label: 'Meu plano', match: ['my-plan'] }
      : { id: 'pricing', label: 'Planos', match: ['pricing'] },
  ]

  const handleNav = (id: string) => {
    onNavigate(id)
    setMobileOpen(false)
    setProfileOpen(false)
  }
  const handleSignOut = () => { onSignOut(); setProfileOpen(false); setMobileOpen(false) }
  const isActive = (match: string[]) => !!currentView && match.includes(currentView)

  return (
    <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Logo onClick={() => handleNav('home')} compact />

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
                isActive(item.match)
                  ? 'text-forest-900 font-medium'
                  : 'text-ink-soft hover:text-forest-900'
              }`}
            >
              {item.label}
              {isActive(item.match) && <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-forest-700 rounded-full" />}
            </button>
          ))}
        </nav>

        {/* Direita */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {user ? (
            <>
              <button onClick={() => handleNav('support')} title="Suporte" className="p-2 text-ink-soft hover:text-forest-900 rounded-lg transition-colors">
                <LifeBuoy className="w-[18px] h-[18px]" />
              </button>
              <button onClick={() => handleNav('notifications')} title="Notificações" className="relative p-2 text-ink-soft hover:text-forest-900 rounded-lg transition-colors">
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-coral text-[#7a3320] text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-full bg-mint text-forest-800 hover:bg-forest-100 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[110px] truncate">
                    {profile?.preferred_name || profile?.display_name || profile?.full_name || user.email?.split('@')[0] || 'Perfil'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>
                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-line py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-line mb-1">
                      <p className="text-xs text-ink-soft">Plano</p>
                      <p className="text-sm font-medium text-forest-900">{PLAN_LABELS[profile?.plan ?? 'free'] ?? 'Gratuito'}</p>
                    </div>
                    <DropItem icon={<CreditCard className="w-4 h-4" />} label="Meu plano" onClick={() => handleNav('my-plan')} />
                    <DropItem icon={<User className="w-4 h-4" />} label="Meu perfil" onClick={() => handleNav('profile')} />
                    <DropItem icon={<LifeBuoy className="w-4 h-4" />} label="Suporte" onClick={() => handleNav('support')} />
                    {isAdmin && (
                      <>
                        <div className="border-t border-line my-1" />
                        <DropItem icon={<Shield className="w-4 h-4 text-amber-500" />} label="Painel Admin" onClick={() => handleNav('admin')} accent="amber" />
                      </>
                    )}
                    <div className="border-t border-line my-1" />
                    <DropItem icon={<LogOut className="w-4 h-4" />} label="Sair" onClick={handleSignOut} accent="red" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => handleNav('auth')}
              className="flex items-center gap-2 text-sm font-medium text-forest-900 border border-forest-800 px-4 py-2 rounded-xl hover:bg-forest-900 hover:text-white transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
          )}
        </div>

        {/* Mobile: bell + hamburger */}
        <div className="md:hidden flex items-center gap-1">
          {user && (
            <button onClick={() => handleNav('notifications')} className="relative p-2 text-ink-soft">
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-coral text-[#7a3320] text-[8px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          )}
          <button className="p-2 text-forest-900" onClick={() => setMobileOpen(o => !o)} aria-label="Abrir menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-paper border-t border-line py-3 px-4 space-y-0.5 max-h-[80vh] overflow-y-auto">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`block w-full text-left text-sm px-3 py-2.5 rounded-lg font-medium ${isActive(item.match) ? 'bg-mint text-forest-900' : 'text-ink hover:bg-mint/50'}`}
            >
              {item.label}
            </button>
          ))}
          <div className="border-t border-line my-2" />
          {user ? (
            <>
              <MobileItem icon={<User className="w-4 h-4" />} label="Meu perfil" onClick={() => handleNav('profile')} />
              <MobileItem icon={<LifeBuoy className="w-4 h-4" />} label="Suporte" onClick={() => handleNav('support')} />
              {isAdmin && <MobileItem icon={<Shield className="w-4 h-4 text-amber-500" />} label="Painel Admin" onClick={() => handleNav('admin')} />}
              <MobileItem icon={<LogOut className="w-4 h-4 text-red-400" />} label="Sair" onClick={handleSignOut} />
            </>
          ) : (
            <button
              onClick={() => handleNav('auth')}
              className="flex items-center justify-center gap-2 bg-forest-900 text-white text-sm px-4 py-2.5 rounded-xl w-full font-medium hover:bg-forest-800 mt-1"
            >
              <LogIn className="w-4 h-4" /> Entrar
            </button>
          )}
        </div>
      )}
    </header>
  )
}

function DropItem({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: 'amber' | 'red' }) {
  const color = accent === 'amber' ? 'text-amber-700 hover:bg-amber-50' : accent === 'red' ? 'text-red-500 hover:bg-red-50' : 'text-ink hover:bg-mint/40'
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left text-sm ${color}`}>
      <span className="text-ink-soft flex-shrink-0">{icon}</span>
      {label}
    </button>
  )
}

function MobileItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 w-full text-left text-sm text-ink hover:bg-mint/50 px-3 py-2.5 rounded-lg">
      <span className="text-ink-soft">{icon}</span>
      {label}
    </button>
  )
}
