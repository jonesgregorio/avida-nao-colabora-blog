import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import type { View } from './types'

import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import HomeContent from './components/HomeContent'
import LoggedHome from './components/LoggedHome'
import Articles from './components/Articles'
import ArticleView from './components/ArticleView'
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
import GuidedContent from './components/GuidedContent'
import SavedItemsPage from './components/SavedItemsPage'
import QuestionnairesPage from './components/QuestionnairesPage'
import QuestionnairePlayer from './components/QuestionnairePlayer'
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
import MyEvolutionPage, { type Tab } from './components/MyEvolutionPage'

// AdminPanel carregado sob demanda — o maior chunk do bundle
const AdminPanel = lazy(() => import('./components/admin'))

const PERSIST_KEY = 'avida_nav'
const VALID_VIEWS: View[] = [
  'home','auth','diary','profile','meditations','challenges','content',
  'therapeutic-q','about','privacy','terms','questionnaire','questionarios','pricing',
  'articles','article','responsibility','trails','saved','admin','contact','success',
  'support','support-ticket','notifications','monthly-guidance','professional-comments','my-plan','my-report','my-evolution',
]

// Mapeamento bidirecional URL ↔ view
const URL_TO_VIEW: Record<string, View> = {
  '/':                           'home',
  '/blog':                       'articles',
  '/planos':                     'pricing',
  '/sobre':                      'about',
  '/contato':                    'contact',
  '/privacidade':                'privacy',
  '/termos':                     'terms',
  '/aviso-de-responsabilidade':  'responsibility',
  '/admin':                      'admin',
  '/login':                      'auth',
  '/diario':                     'diary',
  '/perfil':                     'profile',
  '/meditacoes':                 'meditations',
  '/desafios':                   'challenges',
  '/questionario-terapeutico':   'therapeutic-q',
  '/questionarios':              'questionarios',
  '/trilhas':                    'trails',
  '/itens-salvos':               'saved',
  '/sucesso':                    'success',
  '/suporte':                    'support',
  '/notificacoes':               'notifications',
  '/guia-mensal':                'monthly-guidance',
  '/comentarios-profissional':   'professional-comments',
  '/minha-evolucao':             'my-evolution',
  '/meu-relatorio':              'my-report',
  '/meu-plano':                  'my-plan',
}

const VIEW_TO_URL: Record<string, string> = Object.fromEntries(
  Object.entries(URL_TO_VIEW).map(([url, view]) => [view, url])
)

function parseURLNav(): { view: View; articleSlug: string | null; ticketId: string | null } | null {
  try {
    const path = window.location.pathname

    // /blog/:slug → article
    if (path.startsWith('/blog/') && path.length > 6) {
      const slug = path.slice(6)
      return { view: 'article', articleSlug: slug, ticketId: null }
    }

    // /suporte/:ticketId → support-ticket
    if (path.startsWith('/suporte/') && path.length > 9) {
      const ticketId = path.slice(9)
      return { view: 'support-ticket', articleSlug: null, ticketId }
    }

    // URL param ?view=X (compatibilidade com links antigos e redirecionamentos Stripe)
    const params = new URLSearchParams(window.location.search)
    const urlView = params.get('view') as View
    if (urlView && VALID_VIEWS.includes(urlView)) {
      return { view: urlView, articleSlug: null, ticketId: null }
    }

    const mapped = URL_TO_VIEW[path]
    if (mapped) return { view: mapped, articleSlug: null, ticketId: null }

    return null
  } catch {
    return null
  }
}

function restoreNav() {
  // URL tem prioridade máxima (permite deep-link e compartilhamento)
  const fromURL = parseURLNav()
  if (fromURL) return fromURL

  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
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

  // Sincroniza URL com o estado de navegação
  function pushURL(targetView: string, slug?: string | null, ticketId?: string | null) {
    let url: string
    if (targetView === 'article' && slug) {
      url = `/blog/${slug}`
    } else if (targetView === 'support-ticket' && ticketId) {
      url = `/suporte/${ticketId}`
    } else {
      url = VIEW_TO_URL[targetView] ?? '/'
    }
    if (window.location.pathname !== url) {
      window.history.pushState({ view: targetView, slug, ticketId }, '', url)
    }
  }

  const navigate = (section: string, articleSlug?: string) => {
    // Suporte a navegação com aba: 'my-evolution?tab=relatorios'
    if (section.startsWith('my-evolution?tab=')) {
      const tab = section.split('tab=')[1]
      setInitialEvolutionTab(tab)
      setView('my-evolution')
      pushURL('my-evolution')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Suporte a ticket específico: 'support-ticket:<uuid>'
    if (section.startsWith('support-ticket:')) {
      const ticketId = section.split('support-ticket:')[1]
      if (ticketId) setActiveSupportTicketId(ticketId)
      setView('support-ticket')
      pushURL('support-ticket', null, ticketId)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const directViews: View[] = [
      'home', 'auth', 'diary', 'profile', 'meditations', 'challenges',
      'therapeutic-q', 'about', 'privacy', 'terms', 'questionnaire', 'questionarios',
      'pricing', 'articles', 'article', 'responsibility', 'content', 'trails', 'saved', 'admin', 'contact', 'success',
      'support', 'support-ticket', 'notifications', 'monthly-guidance', 'professional-comments', 'my-plan', 'my-evolution', 'my-report',
    ]
    if (directViews.includes(section as View)) {
      if (section === 'my-evolution') setInitialEvolutionTab(undefined)
      setView(section as View)
      if (articleSlug) setSelectedArticleSlug(articleSlug)
      pushURL(section, articleSlug)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Section-based scrolling on home
    setView('home')
    pushURL('home')
    setTimeout(() => {
      const el = document.getElementById(section)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // Suporte ao botão Voltar/Avançar do navegador
  useEffect(() => {
    function handlePopState() {
      const fromURL = parseURLNav()
      if (fromURL) {
        setView(fromURL.view)
        if (fromURL.articleSlug) setSelectedArticleSlug(fromURL.articleSlug)
        if (fromURL.ticketId) setActiveSupportTicketId(fromURL.ticketId)
      } else {
        setView('home')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">
          <ArticleView
            slug={selectedArticleSlug}
            onBack={() => navigate('articles')}
            user={user}
            profile={profile}
            navigate={navigate}
            onSelectArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
    if (!user || (profile?.plan !== 'essential' && profile?.plan !== 'therapeutic' && profile?.plan !== 'therapeutic-plus' && profile?.plan !== 'plus')) {
      navigate('pricing'); return null
    }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">
          <MiniChallenges onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'therapeutic-q') {
    if (!user || (profile?.plan !== 'therapeutic' && profile?.plan !== 'therapeutic-plus' && profile?.plan !== 'plus')) {
      navigate('pricing'); return null
    }
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">
          <Articles
            onSelectArticle={(articleOrSlug) => {
              const slug = typeof articleOrSlug === 'string' ? articleOrSlug : (articleOrSlug as { slug: string }).slug
              setSelectedArticleSlug(slug)
              setView('article')
              pushURL('article', slug)
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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

  if (view === 'content') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
        <main className="min-h-screen bg-paper">
          <GuidedContent onNavigate={navigate} onBack={() => setView('home')} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'trails') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">
          <MyEvolutionPage
            user={user}
            profile={profile}
            onBack={() => navigate('home')}
            onNavigatePricing={() => navigate('pricing')}
            onNavigateDiary={() => navigate('diary')}
            initialTab={initialEvolutionTab as Tab}
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
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
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-50">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <AdminPanel />
      </Suspense>
    )
  }

  // Home
  return (
    <>
      <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />

      <main className="min-h-screen bg-paper">
        {user ? (
          <LoggedHome profile={profile} onNavigate={navigate} />
        ) : (
          <>
            <Hero onNavigate={navigate} />
            <HomeContent onNavigate={navigate} />
          </>
        )}
      </main>

      <Footer onNavigate={navigate} />
    </>
  )
}
