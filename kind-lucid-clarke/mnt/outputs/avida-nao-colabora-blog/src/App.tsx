import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import type { View } from './types'

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
import SuccessPage from './components/SuccessPage'
import SupportPage from './components/SupportPage'
import SupportTicketDetail from './components/SupportTicketDetail'
import NotificationsPage from './components/NotificationsPage'
import ForceChangePassword from './components/ForceChangePassword'
import MonthlyGuidancePage from './components/MonthlyGuidancePage'
import ProfessionalCommentsSection from './components/ProfessionalCommentsSection'
import MyPlanPage from './components/MyPlanPage'
import MyReportPage from './components/MyReportPage'
import MyEvolutionPage from './components/MyEvolutionPage'

const PERSIST_KEY = 'avida_nav'
const VALID_VIEWS: View[] = [
  'home','auth','diary','profile','meditations','challenges',
  'therapeutic-q','about','privacy','terms','questionnaire','questionarios','pricing',
  'articles','article','responsibility','trails','saved','admin','contact','success',
  'support','support-ticket','notifications','monthly-guidance','professional-comments','my-plan','my-report','my-evolution',
]

function restoreNav() {
  try {
    // URL param takes priority (e.g. payment redirect)
    const params = new URLSearchParams(window.location.search)
    const urlView = params.get('view') as View
    if (urlView && VALID_VIEWS.includes(urlView)) {
      return { view: urlView, articleSlug: null, ticketId: null, questionnaireId: null }
    }
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    // Don't restore auth view on refresh — go home instead
    if (saved.view === 'auth') return null
    if (!VALID_VIEWS.includes(saved.view)) return null
    return saved
  } catch {
    return null
  }
}

export default function App() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()

  const saved = restoreNav()
  const [view, setView] = useState<View>(saved?.view ?? 'home')
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(saved?.articleSlug ?? null)
  const [_showDiaryForm, setShowDiaryForm] = useState(false)
  const [activeQuestionnaireId, setActiveQuestionnaireId] = useState<string | null>(saved?.questionnaireId ?? null)
  const [activeSupportTicketId, setActiveSupportTicketId] = useState<string | null>(saved?.ticketId ?? null)
  const [initialEvolutionTab, setInitialEvolutionTab] = useState<string | undefined>(undefined)

  // Persist navigation state so refresh keeps the user on the same page
  useEffect(() => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      view,
      articleSlug: selectedArticleSlug,
      ticketId: activeSupportTicketId,
      questionnaireId: activeQuestionnaireId,
    }))
  }, [view, selectedArticleSlug, activeSupportTicketId, activeQuestionnaireId])
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
    // Suporte a navegação com aba: 'my-evolution?tab=relatorios'
    if (section.startsWith('my-evolution?tab=')) {
      const tab = section.split('tab=')[1]
      setInitialEvolutionTab(tab)
      setView('my-evolution')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const directViews: View[] = [
      'home', 'auth', 'diary', 'profile', 'meditations', 'challenges',
      'therapeutic-q', 'about', 'privacy', 'terms', 'questionnaire', 'questionarios',
      'pricing', 'articles', 'article', 'responsibility', 'trails', 'saved', 'admin', 'contact', 'success',
      'support', 'support-ticket', 'notifications', 'monthly-guidance', 'professional-comments', 'my-plan', 'my-evolution', 'my-report',
    ]
    if (directViews.includes(section as View)) {
      if (section === 'my-evolution') setInitialEvolutionTab(undefined)
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

  // Force password change if admin set a temporary password
  if (user && profile?.must_change_password) {
    return <ForceChangePassword userId={user.id} onDone={refreshProfile} />
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

  if (view === 'notifications') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <NotificationsPage user={user} navigate={navigate} onBack={() => navigate('home')} />
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
          <ContactPage user={user} profile={profile} onBack={() => setView('home')} navigate={navigate} />
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
            onNavigateArticles={() => navigate('articles')}
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

  if (view === 'success') {
    return (
      <SuccessPage
        onNavigateDiary={() => navigate('diary')}
        onNavigateHome={() => navigate('home')}
        onRefreshProfile={refreshProfile}
      />
    )
  }

  if (view === 'support') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <SupportPage
            user={user}
            profile={profile}
            navigate={navigate}
            onBack={() => navigate('home')}
            onOpenTicket={(id) => { setActiveSupportTicketId(id); setView('support-ticket') }}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'support-ticket' && activeSupportTicketId) {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50 pt-2">
          <SupportTicketDetail
            ticketId={activeSupportTicketId}
            user={user}
            onBack={() => { setActiveSupportTicketId(null); navigate('support') }}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'monthly-guidance') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <MonthlyGuidancePage
            user={user}
            profile={profile}
            onBack={() => navigate('home')}
            onNavigatePricing={() => navigate('pricing')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'professional-comments') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50 max-w-2xl mx-auto px-4 py-8">
          <ProfessionalCommentsSection
            user={user}
            profile={profile}
            onNavigateDiary={() => navigate('diary')}
            onNavigatePricing={() => navigate('pricing')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'my-evolution') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <MyEvolutionPage
            user={user}
            profile={profile}
            onBack={() => navigate('home')}
            onNavigatePricing={() => navigate('pricing')}
            onNavigateDiary={() => navigate('diary')}
            initialTab={initialEvolutionTab as any}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'my-report') {
    if (!user) { navigate('auth'); return null }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <MyReportPage
            user={user}
            profile={profile}
            onBack={() => navigate('home')}
            onNavigatePricing={() => navigate('pricing')}
            onNavigateDiary={() => navigate('diary')}
            onNavigateGuidance={() => navigate('monthly-guidance')}
          />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'my-plan') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} />
        <main className="min-h-screen bg-stone-50">
          <MyPlanPage
            user={user}
            profile={profile}
            onBack={() => navigate('home')}
            onNavigateAuth={() => navigate('auth')}
            onRefreshProfile={refreshProfile}
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
              {(profile.plan === 'therapeutic' || profile.plan === 'therapeutic-plus') && (
                <button
                  onClick={() => navigate('monthly-guidance')}
                  className="text-sm bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-full hover:bg-purple-100 transition-colors"
                >
                  💬 Orientação Mensal
                </button>
              )}
              {profile.plan === 'therapeutic-plus' && (
                <button
                  onClick={() => navigate('professional-comments')}
                  className="text-sm bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-full hover:bg-amber-100 transition-colors"
                >
                  ⭐ Comentários do Profissional
                </button>
              )}
              <button
                onClick={() => navigate('my-report')}
                className="text-sm bg-violet-50 border border-violet-200 text-violet-700 px-4 py-2 rounded-full hover:bg-violet-100 transition-colors"
              >
                📊 Meu Relatório
              </button>
              <button
                onClick={() => navigate('my-plan')}
                className="text-sm bg-stone-50 border border-stone-200 text-stone-700 px-4 py-2 rounded-full hover:bg-stone-100 transition-colors"
              >
                👑 Meu Plano
              </button>
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
