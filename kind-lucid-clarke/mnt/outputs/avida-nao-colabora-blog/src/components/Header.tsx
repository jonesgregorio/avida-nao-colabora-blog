import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, CreditCard, LifeBuoy, LogIn, LogOut, Menu, Shield, User, X,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { Profile } from '../types'
import Logo from './Logo'

interface HeaderProps {
  onNavigate: (section: string) => void
  user: SupabaseUser | null
  profile: Profile | null
  onSignOut: () => void
  currentView?: string
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}

export default function Header({ onNavigate, user, profile, onSignOut, currentView }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isAdmin = profile?.role === 'admin'
  const handleNav = (id: string) => { onNavigate(id); setMobileOpen(false); setProfileOpen(false) }
  const handleSignOut = () => { onSignOut(); setProfileOpen(false); setMobileOpen(false) }
  const scrollHomeSection = (id: string) => {
    if (currentView !== 'home') {
      onNavigate('home')
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMobileOpen(false)
  }

  const loggedNav = [
    { id: 'diary', label: 'Diário', match: ['diary'] },
    { id: 'my-evolution', label: 'Mapa emocional', match: ['my-evolution', 'my-report', 'questionarios'] },
    { id: 'articles', label: 'Conteúdos', match: ['articles', 'article', 'content'] },
    { id: 'my-plan', label: 'Meu plano', match: ['my-plan'] },
  ]
  const isActive = (match: string[]) => !!currentView && match.includes(currentView)

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[#fffdf9]/95 backdrop-blur">
      <div className="mx-auto flex h-[74px] max-w-6xl items-center justify-between gap-3 px-4">
        <Logo onClick={() => handleNav('home')} compact />

        {!user ? (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            <button onClick={() => handleNav('home')} className="px-3 py-2 text-sm text-forest-900 hover:text-forest-600">Início</button>
            <button onClick={() => scrollHomeSection('como-funciona')} className="px-3 py-2 text-sm text-forest-900 hover:text-forest-600">Como funciona</button>
            <button onClick={() => handleNav('pricing')} className="px-3 py-2 text-sm text-forest-900 hover:text-forest-600">Planos</button>
            <button onClick={() => handleNav('articles')} className="px-3 py-2 text-sm text-forest-900 hover:text-forest-600">Conteúdos</button>
            <button onClick={() => handleNav('about')} className="px-3 py-2 text-sm text-forest-900 hover:text-forest-600">Sobre</button>
          </nav>
        ) : (
          <nav className="hidden items-center gap-1 md:flex">
            {loggedNav.map(item => (
              <button key={item.id} onClick={() => handleNav(item.id)} className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${isActive(item.match) ? 'font-medium text-forest-900' : 'text-ink-soft hover:text-forest-900'}`}>
                {item.label}{isActive(item.match) && <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-forest-700" />}
              </button>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-2 md:flex">
          {!user ? <>
            <button onClick={() => handleNav('auth')} className="rounded-full border border-forest-700 px-4 py-2 text-sm font-medium text-forest-900 transition-colors hover:bg-forest-900 hover:text-white">Entrar</button>
            <button onClick={() => handleNav('auth')} className="rounded-full bg-forest-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-800">Criar conta gratuita</button>
          </> : <>
            <button onClick={() => handleNav('support')} title="Suporte" className="rounded-lg p-2 text-ink-soft hover:text-forest-900"><LifeBuoy className="h-[18px] w-[18px]" /></button>
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(open => !open)} className="flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1.5 text-sm font-medium text-forest-800 hover:bg-forest-100">
                <User className="h-4 w-4" /><span className="max-w-[110px] truncate">{profile?.preferred_name || profile?.display_name || profile?.full_name || user.email?.split('@')[0] || 'Perfil'}</span><ChevronDown className={`h-3.5 w-3.5 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-line bg-white py-1.5 shadow-lg">
                <div className="mb-1 border-b border-line px-4 py-2"><p className="text-xs text-ink-soft">Plano</p><p className="text-sm font-medium text-forest-900">{PLAN_LABELS[profile?.plan ?? 'free'] ?? 'Gratuito'}</p></div>
                <DropItem icon={<CreditCard className="h-4 w-4" />} label="Meu plano" onClick={() => handleNav('my-plan')} />
                <DropItem icon={<User className="h-4 w-4" />} label="Meu perfil" onClick={() => handleNav('profile')} />
                <DropItem icon={<LifeBuoy className="h-4 w-4" />} label="Suporte" onClick={() => handleNav('support')} />
                {isAdmin && <><div className="my-1 border-t border-line"/><DropItem icon={<Shield className="h-4 w-4 text-amber-500" />} label="Painel Admin" onClick={() => handleNav('admin')} /></>}
                <div className="my-1 border-t border-line"/><DropItem icon={<LogOut className="h-4 w-4" />} label="Sair" onClick={handleSignOut} />
              </div>}
            </div>
          </>}
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
          {!user && <button onClick={() => handleNav('auth')} className="rounded-full border border-forest-700 px-3 py-1.5 text-sm font-medium text-forest-900">Entrar</button>}
          <button className="p-2 text-forest-900" onClick={() => setMobileOpen(open => !open)} aria-label="Abrir menu">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>

      {mobileOpen && <div className="max-h-[80vh] space-y-1 overflow-y-auto border-t border-line bg-[#fffdf9] px-4 py-3 md:hidden">
        {!user ? <>
          <MobileText label="Início" onClick={() => handleNav('home')} />
          <MobileText label="Como funciona" onClick={() => scrollHomeSection('como-funciona')} />
          <MobileText label="Planos" onClick={() => handleNav('pricing')} />
          <MobileText label="Conteúdos" onClick={() => handleNav('articles')} />
          <MobileText label="Sobre" onClick={() => handleNav('about')} />
          <button onClick={() => handleNav('auth')} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-forest-900 px-4 py-2.5 text-sm font-semibold text-white"><LogIn className="h-4 w-4" /> Criar conta gratuita</button>
        </> : <>
          {loggedNav.map(item => <MobileText key={item.id} label={item.label} onClick={() => handleNav(item.id)} />)}
          <div className="my-2 border-t border-line" />
          <MobileText label="Meu perfil" onClick={() => handleNav('profile')} />
          <MobileText label="Suporte" onClick={() => handleNav('support')} />
          {isAdmin && <MobileText label="Painel Admin" onClick={() => handleNav('admin')} />}
          <MobileText label="Sair" onClick={handleSignOut} />
        </>}
      </div>}
    </header>
  )
}

function DropItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-mint/40"><span className="flex-shrink-0 text-ink-soft">{icon}</span>{label}</button>
}

function MobileText({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-mint/50">{label}</button>
}
