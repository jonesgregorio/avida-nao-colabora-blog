import { useState } from 'react'
import { Heart, Menu, X, LogIn, User, BookOpen, ClipboardList, LogOut, Crown } from 'lucide-react'
import { Profile } from '../types'

interface HeaderProps {
  onNavigate: (section: string) => void
  user: any
  profile: Profile | null
  onSignOut: () => void
}

export default function Header({ onNavigate, user, profile, onSignOut }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = [
    { label: 'Início', id: 'home' },
    { label: 'Artigos', id: 'articles' },
    { label: 'Questionário', id: 'questionnaire' },
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
        <nav className="hidden md:flex items-center gap-6">
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
            <div className="flex items-center gap-3 ml-2">
              {(profile?.plan === 'essential' || profile?.plan === 'therapeutic') && (
                <button
                  onClick={() => handleNav('diary')}
                  className="flex items-center gap-1 text-sm text-ocean-600 hover:text-ocean-800 font-medium"
                >
                  <BookOpen className="w-4 h-4" /> Diário
                </button>
              )}
              <button
                onClick={() => handleNav('profile')}
                className="flex items-center gap-2 bg-sage-100 hover:bg-sage-200 text-sage-800 text-sm px-3 py-1.5 rounded-full transition-colors"
              >
                <User className="w-4 h-4" />
                <span>{profile?.full_name || 'Perfil'}</span>
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
            <button
              onClick={() => handleNav('auth')}
              className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-sage-700"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-sand-50 border-t border-sand-200 py-4 px-4 space-y-3">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="block w-full text-left text-sm text-sage-700 hover:text-sage-900 py-2 font-medium"
            >
              {item.label}
            </button>
          ))}
          {user ? (
            <>
              <button
                onClick={() => handleNav('diary')}
                className="flex items-center gap-2 text-sm text-ocean-600 py-2"
              >
                <BookOpen className="w-4 h-4" /> Diário
              </button>
              <button
                onClick={() => handleNav('profile')}
                className="flex items-center gap-2 text-sm text-sage-700 py-2"
              >
                <User className="w-4 h-4" /> Perfil
                {profile && <span className="text-xs bg-sage-100 px-2 py-0.5 rounded-full">{planLabel[profile.plan]}</span>}
              </button>
              <button
                onClick={() => { onSignOut(); setMobileOpen(false) }}
                className="flex items-center gap-2 text-sm text-red-500 py-2"
              >
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </>
          ) : (
            <button
              onClick={() => handleNav('auth')}
              className="flex items-center gap-2 bg-sage-600 text-white text-sm px-4 py-2 rounded-lg w-full justify-center"
            >
              <LogIn className="w-4 h-4" /> Entrar / Cadastrar
            </button>
          )}
        </div>
      )}

      {/* Plan badge bar */}
      {user && profile && (
        <div className={`text-center text-xs py-1 font-medium ${
          profile.plan === 'therapeutic'
            ? 'bg-ocean-600 text-white'
            : profile.plan === 'essential'
            ? 'bg-sage-600 text-white'
            : 'bg-sand-100 text-sand-700'
        }`}>
          {profile.plan === 'free' && 'Plano Gratuito — '}
          {profile.plan === 'essential' && '✦ Plano Essencial — '}
          {profile.plan === 'therapeutic' && '✦ Plano Terapêutico — '}
          Olá, {profile.full_name || 'bem-vindo(a)'}!
          {profile.plan === 'free' && (
            <button onClick={() => handleNav('pricing')} className="ml-2 underline">Fazer upgrade</button>
          )}
        </div>
      )}
    </header>
  )
}
