import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { Article, Plan } from './types'

import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import Articles from './components/Articles'
import ArticleView from './components/ArticleView'
import Questionnaire from './components/Questionnaire'
import DiaryCard from './components/DiaryCard'
import DiaryPage from './components/DiaryPage'
import Pricing from './components/Pricing'
import About from './components/About'
import Auth from './components/Auth'
import ProfilePage from './components/Profile'
import GuidedMeditations from './components/GuidedMeditations'
import MiniChallenges from './components/MiniChallenges'
import TherapeuticQuestionnaire from './components/TherapeuticQuestionnaire'

type View =
  | 'home'
  | 'auth'
  | 'article'
  | 'diary'
  | 'profile'
  | 'meditations'
  | 'challenges'
  | 'therapeutic-q'

export default function App() {
  const { user, profile, loading, signOut, updatePlan, refreshProfile } = useAuth()
  const [view, setView] = useState<View>('home')
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [showDiaryForm, setShowDiaryForm] = useState(false)

  const navigate = (section: string) => {
    if (section === 'home') { setView('home'); return }
    if (section === 'auth') { setView('auth'); return }
    if (section === 'diary') { setView('diary'); return }
    if (section === 'profile') { setView('profile'); return }
    if (section === 'meditations') { setView('meditations'); return }
    if (section === 'challenges') { setView('challenges'); return }
    if (section === 'therapeutic-q') { setView('therapeutic-q'); return }

    // Section-based scrolling on home
    setView('home')
    setTimeout(() => {
      const el = document.getElementById(section)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleSubscribe = async (plan: Plan) => {
    await updatePlan(plan)
    navigate('pricing')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sage-300 border-t-sage-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sage-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  // Auth page
  if (view === 'auth') {
    return <Auth onBack={() => setView('home')} />
  }

  // Article view
  if (view === 'article' && selectedArticle) {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-sand-50">
          <ArticleView
            article={selectedArticle}
            onBack={() => { setView('home'); navigate('articles') }}
            user={user}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  // Diary page
  if (view === 'diary') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-sand-50">
          <DiaryPage
            user={user}
            plan={profile?.plan || 'free'}
            onBack={() => setView('home')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  // Profile page
  if (view === 'profile') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-sand-50">
          <ProfilePage
            user={user}
            profile={profile}
            onBack={() => setView('home')}
            onNavigatePricing={() => navigate('pricing')}
            onRefreshProfile={refreshProfile}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  // Meditations
  if (view === 'meditations') {
    if (!user || (profile?.plan !== 'essential' && profile?.plan !== 'therapeutic')) {
      navigate('pricing'); return null
    }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-sand-50">
          <GuidedMeditations onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  // Mini challenges
  if (view === 'challenges') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-sand-50">
          <MiniChallenges onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  // Therapeutic questionnaire
  if (view === 'therapeutic-q') {
    if (!user || profile?.plan !== 'therapeutic') {
      navigate('pricing'); return null
    }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-sand-50">
          <TherapeuticQuestionnaire user={user} onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  // Home
  return (
    <>
      <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />

      {/* Login CTA for non-authenticated */}
      {!user && (
        <div className="bg-sage-50 border-b border-sage-100 py-2.5 px-4 text-center">
          <p className="text-sm text-sage-600">
            Crie sua conta gratuita para acessar o diário de bem-estar.{' '}
            <button onClick={() => navigate('auth')} className="text-sage-700 font-semibold underline hover:text-sage-900">
              Cadastrar agora
            </button>
          </p>
        </div>
      )}

      <main className="min-h-screen bg-sand-50">
        <Hero onNavigate={navigate} />

        {/* Plan-gated quick actions */}
        {user && profile && (
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => navigate('challenges')}
                className="text-sm bg-sage-50 border border-sage-200 text-sage-700 px-4 py-2 rounded-full hover:bg-sage-100 transition-colors"
              >
                🏆 Mini-Desafios
              </button>
              {(profile.plan === 'essential' || profile.plan === 'therapeutic') && (
                <button
                  onClick={() => navigate('meditations')}
                  className="text-sm bg-ocean-50 border border-ocean-200 text-ocean-700 px-4 py-2 rounded-full hover:bg-ocean-100 transition-colors"
                >
                  🧘 Meditações Guiadas
                </button>
              )}
              {profile.plan === 'therapeutic' && (
                <button
                  onClick={() => navigate('therapeutic-q')}
                  className="text-sm bg-sand-50 border border-sand-200 text-sand-700 px-4 py-2 rounded-full hover:bg-sand-100 transition-colors"
                >
                  📋 Questionário Aprofundado
                </button>
              )}
            </div>
          </div>
        )}

        <Articles
          onSelectArticle={(article) => {
            setSelectedArticle(article)
            setView('article')
          }}
        />

        <DiaryCard
          user={user}
          onOpenDiary={() => navigate('diary')}
          onNewEntry={() => { navigate('diary'); setShowDiaryForm(true) }}
        />

        <Questionnaire user={user} onNavigateDiary={() => navigate('diary')} />

        <Pricing
          user={user}
          currentPlan={profile?.plan || 'free'}
          onSubscribe={handleSubscribe}
          onNavigateAuth={() => navigate('auth')}
        />

        <About />
      </main>

      <Footer onNavigate={navigate} />
    </>
  )
}
