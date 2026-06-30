import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import type { View, Plan } from './types'

import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import HomeContent from './components/HomeContent'
import Articles from './components/Articles'
import ArticleView from './components/ArticleView'
import Questionnaire from './components/Questionnaire'
import DiaryCard from './components/DiaryCard'
import DiaryPage from './components/DiaryPage'
import Pricing from './components/Pricing'
import Auth from './components/Auth'
import ProfilePage from './components/Profile'
import GuidedMeditations from './components/GuidedMeditations'
import MiniChallenges from './components/MiniChallenges'
import TherapeuticQuestionnaire from './components/TherapeuticQuestionnaire'
import AboutPage from './components/AboutPage'
import PrivacyPage from './components/PrivacyPage'
import TermsPage from './components/TermsPage'
import { ResponsibilityPage } from './components/ResponsibilityPage'
import TrailsPage from './components/TrailsPage'
import SavedItemsPage from './components/SavedItemsPage'
import AdminPanel from './components/admin'
import QuestionnairesPage from './components/QuestionnairesPage'
import QuestionnairePlayer from './components/QuestionnairePlayer'
import DailyContentWidget from './components/DailyContentWidget'
import ContactPage from './components/ContactPage'

export default function App() {
  const { user, profile, loading, signOut, updatePlan, refreshProfile } = useAuth()
  const initialView = (): View => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('view') as View
    const valid: View[] = ['home','auth','diary','profile','meditations','challenges',
      'therapeutic-q','about','privacy','terms','questionnaire','questionarios','pricing',
      'articles','article','responsibility','trails','saved','admin','contact']
    return valid.includes(v) ? v : 'home'
  }
  const [view, setView] = useState<View>(initialView)
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(null)
  const [_showDiaryForm, setShowDiaryForm] = useState(false)
  const [activeQuestionnaireId, setActiveQuestionnaireId] = useState<string | null>(null)
  const [diaryPromptContext, setDiaryPromptContext] = useState<{
    prompt: string
    articleTitle: string
    articleSlug: string
    category: string
  } | null>(null)

  function handleSavePromptToDiary(prompt: string, articleTitle: string, articleSlug: string, category: string) {
    setDiaryPromptContext({ prompt, articleTitle, articleSlug, category })
    navigate('diary')
  }

  const navigate = (section: string, articleSlug?: string) => {
    const directViews: View[] = [
      'home', 'auth', 'diary', 'profile', 'meditations', 'challenges',
      'therapeutic-q', 'about', 'privacy', 'terms', 'questionnaire', 'questionarios',
      'pricing', 'articles', 'article', 'responsibility', 'trails', 'saved', 'admin', 'contact',
    ]
    if (directViews.includes(section as View)) {
      setView(section as View)
      if (articleSlug) setSelectedArticleSlug(articleSlug)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-stone-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (view === 'auth') {
    return <Auth onBack={() => setView('home')} />
  }

  if (view === 'article' && selectedArticleSlug) {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <ArticleView
            slug={selectedArticleSlug}
            onBack={() => navigate('articles')}
            user={user}
            profile={profile}
            navigate={navigate}
            onSelectArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); window.scrollTo(0, 0) }}
            onSavePromptToDiary={handleSavePromptToDiary}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'diary') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <DiaryPage
            user={user}
            plan={profile?.plan || 'free'}
            onBack={() => setView('home')}
            onNavigatePricing={() => navigate('pricing')}
            promptContext={diaryPromptContext}
            onClearPromptContext={() => setDiaryPromptContext(null)}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'profile') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
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

  if (view === 'meditations') {
    if (!user || (profile?.plan !== 'essential' && profile?.plan !== 'therapeutic' && profile?.plan !== 'therapeutic-plus')) {
      navigate('pricing'); return null
    }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <GuidedMeditations onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'challenges') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <MiniChallenges onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'therapeutic-q') {
    if (!user || (profile?.plan !== 'therapeutic' && profile?.plan !== 'therapeutic-plus')) {
      navigate('pricing'); return null
    }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <TherapeuticQuestionnaire user={user} onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'contact') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <ContactPage user={user} profile={profile} onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'about') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <AboutPage onNavigate={navigate} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'privacy') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <PrivacyPage onNavigate={navigate} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'terms') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <TermsPage onNavigate={navigate} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'responsibility') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <ResponsibilityPage />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'questionarios') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <QuestionnairesPage
            user={user}
            profile={profile}
            onStart={(id) => {
              setActiveQuestionnaireId(id)
              navigate('questionnaire')
            }}
            onBack={() => navigate('home')}
            onNavigatePricing={() => navigate('pricing')}
            onNavigateAuth={() => navigate('auth')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'questionnaire' && activeQuestionnaireId) {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <QuestionnairePlayer
            questionnaireId={activeQuestionnaireId}
            user={user}
            profile={profile}
            onBack={() => { setActiveQuestionnaireId(null); navigate('questionarios') }}
            onNavigateDiary={() => navigate('diary')}
            onNavigatePricing={() => navigate('pricing')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'articles') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <Articles
            onSelectArticle={(articleOrSlug) => {
              const slug = typeof articleOrSlug === 'string' ? articleOrSlug : (articleOrSlug as any).slug
              setSelectedArticleSlug(slug)
              setView('article')
              window.scrollTo(0, 0)
            }}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'pricing') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <Pricing
            user={user}
            currentPlan={profile?.plan || 'free'}
            onSubscribe={handleSubscribe}
            onNavigateAuth={() => navigate('auth')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'trails') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <TrailsPage
            user={user}
            profile={profile}
            navigate={navigate}
            onBack={() => setView('home')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'saved') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <SavedItemsPage
            user={user}
            profile={profile}
            navigate={navigate}
            onBack={() => setView('home')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'admin') {
    return <AdminPanel />
  }

  // Home
  return (
    <>
      <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />

      {!user && (
        <div className="bg-purple-50 border-b border-purple-100 py-2.5 px-4 text-center">
          <p className="text-sm text-purple-700">
            Crie sua conta gratuita para acessar o diário de bem-estar.{' '}
            <button onClick={() => navigate('auth')} className="text-purple-800 font-semibold underline hover:text-purple-900">
              Cadastrar agora
            </button>
          </p>
        </div>
      )}

      <main className="min-h-screen bg-stone-50">
        <Hero onNavigate={navigate} />

        <DailyContentWidget user={user} profile={profile} />

        <HomeContent onNavigate={navigate} />

        {user && profile && (
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => navigate('challenges')}
                className="text-sm bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-full hover:bg-green-100 transition-colors"
              >
                🏆 Mini-Desafios
              </button>
              <button
                onClick={() => navigate('trails')}
                className="text-sm bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
              >
                🗺️ Trilhas de Autocuidado
              </button>
              <button
                onClick={() => navigate('saved')}
                className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-full hover:bg-emerald-100 transition-colors"
              >
                📦 Caixa de Cuidado
              </button>
              {(profile.plan === 'essential' || profile.plan === 'therapeutic' || profile.plan === 'therapeutic-plus') && (
                <button
                  onClick={() => navigate('meditations')}
                  className="text-sm bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
                >
                  🧘 Meditações Guiadas
                </button>
              )}
              {(profile.plan === 'therapeutic' || profile.plan === 'therapeutic-plus') && (
                <button
                  onClick={() => navigate('therapeutic-q')}
                  className="text-sm bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-full hover:bg-purple-100 transition-colors"
                >
                  📋 Questionário Aprofundado
                </button>
              )}
            </div>
          </div>
        )}

        <Articles
          onSelectArticle={(articleOrSlug) => {
            const slug = typeof articleOrSlug === 'string' ? articleOrSlug : (articleOrSlug as any).slug
            setSelectedArticleSlug(slug)
            setView('article')
            window.scrollTo(0, 0)
          }}
        />

        <DiaryCard
          user={user}
          onOpenDiary={() => navigate('diary')}
          onNewEntry={() => { navigate('diary'); setShowDiaryForm(true) }}
        />

        <Questionnaire
          user={user}
          onNavigateDiary={() => navigate('diary')}
          onNavigatePricing={() => navigate('pricing')}
          onNavigateArticles={() => navigate('articles')}
        />

        </main>

      <Footer onNavigate={navigate} />
    </>
  )
}
