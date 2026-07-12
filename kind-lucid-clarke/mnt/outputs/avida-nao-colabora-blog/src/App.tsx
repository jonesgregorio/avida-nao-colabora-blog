import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react'
import { useAuth } from './hooks/useAuth'
import type { View } from './types'
import { setPendingAction, getPendingAction, clearPendingAction } from './lib/pendingAction'
import { trackEvent, initWebVitals, initAcquisition } from './lib/analytics'

import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import HomeContent from './components/HomeContent'
import LoggedHome from './components/LoggedHome'
import UserLayout from './components/user/UserLayout'
import Articles from './components/Articles'
import ArticleView from './components/ArticleView'
import DiaryPage from './components/DiaryPage'
import Pricing from './components/Pricing'
import Auth from './components/Auth'
import ProfilePage from './components/Profile'
import AboutPage from './components/AboutPage'
import PrivacyPage from './components/PrivacyPage'
import TermsPage from './components/TermsPage'
import { ResponsibilityPage } from './components/ResponsibilityPage'
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
import SelfCarePlanPage from './components/SelfCarePlanPage'

// AdminPanel carregado sob demanda — o maior chunk do bundle
const AdminPanel = lazy(() => import('./components/admin'))

const PERSIST_KEY = 'avida_nav'
// Views válidas — SOMENTE as que existem nos 3 planos oficiais + utilitários de conta.
const VALID_VIEWS: View[] = [
  'home','auth','diary','profile',
  'about','privacy','terms','questionnaire','questionarios','pricing',
  'articles','article','responsibility','admin','contact','success',
  'support','support-ticket','monthly-guidance','professional-comments','my-plan','my-report','my-evolution','self-care',
  'notifications',
]

// Mapeamento bidirecional URL ↔ view
const URL_TO_VIEW: Record<string, View> = {
  '/':                           'home',
  '/blog':                       'articles',
  '/conteudos':                  'articles',
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
  '/questionarios':              'questionarios',
  '/sucesso':                    'success',
  '/suporte':                    'support',
  '/notificacoes':               'notifications',
  '/guia-mensal':                'monthly-guidance',
  '/comentarios-profissional':   'professional-comments',
  '/minha-evolucao':             'my-evolution',
  '/meu-relatorio':              'my-report',
  '/plano-de-autocuidado':       'self-care',
  '/meu-plano':                  'my-plan',
}

// Rotas antigas de módulos removidos do MVP → destino válido nos novos planos.
// Práticas/meditações/desafios/trilhas viram Conteúdos Guiados; o resto volta ao Início.
const LEGACY_PATH_REDIRECT: Record<string, View> = {
  '/meditacoes': 'articles',
  '/desafios':   'articles',
  '/trilhas':    'articles',
  '/conquistas': 'home',
  '/lembretes':  'home',
  '/itens-salvos': 'home',
  '/favoritos':  'home',
  '/sessoes':    'home',
  '/sessao':     'home',
}

// Views antigas ainda referenciadas por chamadas navigate() em telas legadas.
const LEGACY_VIEW_REDIRECT: Record<string, View> = {
  meditations: 'articles',
  challenges:  'articles',
  trails:      'articles',
  content:     'articles',
  'therapeutic-q': 'questionarios',
  saved:         'home',
  conquistas:    'home',
  lembretes:     'home',
}

// Aliases amigáveis: URLs alternativas que resolvem para uma view, mas cuja URL
// canônica (usada ao navegar) continua sendo a de URL_TO_VIEW. Ex.: "Orientação"
// é o rótulo do menu, então /orientacao aponta para a rota real /guia-mensal.
// Ficam FORA de URL_TO_VIEW para não sobrescrever o VIEW_TO_URL canônico.
const URL_ALIASES: Record<string, View> = {
  '/orientacao':  'monthly-guidance',
  '/orientacoes': 'monthly-guidance',
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


    // Redireciona a rota antiga do questionário terapêutico para a área de Questionários.
    if (path === '/questionario-terapeutico') {
      return { view: 'questionarios', articleSlug: null, ticketId: null }
    }

    // Rotas de módulos removidos do MVP → destino válido nos novos planos.
    if (LEGACY_PATH_REDIRECT[path]) {
      return { view: LEGACY_PATH_REDIRECT[path], articleSlug: null, ticketId: null }
    }

    // URL param ?view=X (compatibilidade com links antigos e redirecionamentos Stripe)
    const params = new URLSearchParams(window.location.search)
    const urlView = params.get('view') as View
    if (urlView && VALID_VIEWS.includes(urlView)) {
      return { view: urlView, articleSlug: null, ticketId: null }
    }

    const mapped = URL_TO_VIEW[path] ?? URL_ALIASES[path]
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

  // Só retomamos a sessão salva na RAIZ do site. Um path específico que não casa
  // com nenhuma rota (ex.: /orientacao digitado à mão) deve ir ao Início — não
  // "cair" na última tela visitada, que era um comportamento confuso.
  if (window.location.pathname !== '/') return null

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
  const [diaryMood, setDiaryMood] = useState<string | null>(null)

  // Persist navigation state so refresh keeps the user on the same page
  useEffect(() => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      view,
      articleSlug: selectedArticleSlug,
      ticketId: activeSupportTicketId,
      questionnaireId: activeQuestionnaireId,
    }))
  }, [view, selectedArticleSlug, activeSupportTicketId, activeQuestionnaireId])

  // Analytics: page_view a cada troca de página (privacy-safe, sem conteúdo)
  useEffect(() => {
    trackEvent('page_view', { entity_id: view, entity_title: selectedArticleSlug || view, user_id: user?.id ?? null })
  }, [view, selectedArticleSlug, user?.id])

  // Analytics: Web Vitals (1x) + captura de cliques em CTA marcados com data-cta
  useEffect(() => {
    initWebVitals()
    initAcquisition()
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-cta]') as HTMLElement | null
      if (el) trackEvent('cta_click', { entity_id: el.getAttribute('data-cta') || undefined, entity_title: (el.textContent || '').trim().slice(0, 60), user_id: user?.id ?? null })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [user?.id])
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
    // Redireciona views de módulos removidos do MVP para destinos válidos.
    if (LEGACY_VIEW_REDIRECT[section]) section = LEGACY_VIEW_REDIRECT[section]

    // Autocuidado virou área PRÓPRIA (§12); as demais abas ficam no Mapa Emocional.
    if (section.startsWith('my-evolution?tab=')) {
      const tab = section.split('tab=')[1]
      if (tab === 'autocuidado') {
        section = 'self-care' // cai no fluxo de view direta abaixo → /plano-de-autocuidado
      } else {
        setInitialEvolutionTab(tab)
        setView('my-evolution')
        pushURL('my-evolution')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    // Check-in com humor pré-selecionado: 'diary?mood=ansiosa' (§8.6).
    // Sem login, guarda a intenção e manda ao login; volta ao diário com o humor depois.
    if (section.startsWith('diary?mood=')) {
      const mood = section.split('mood=')[1]
      if (!user) { setPendingAction({ view: 'diary', mood }); setView('auth'); pushURL('auth'); return }
      setDiaryMood(mood)
      setView('diary')
      pushURL('diary')
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
      'home', 'auth', 'diary', 'profile',
      'about', 'privacy', 'terms', 'questionnaire', 'questionarios',
      'pricing', 'articles', 'article', 'responsibility', 'admin', 'contact', 'success',
      'support', 'support-ticket', 'monthly-guidance', 'professional-comments', 'my-plan', 'my-evolution', 'my-report', 'self-care',
      'notifications',
    ]
    if (directViews.includes(section as View)) {
      if (section === 'my-evolution') setInitialEvolutionTab(undefined)
      if (section === 'diary') setDiaryMood(null)
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

  // Leva ao login guardando a ação pretendida, para retornar a ela após autenticar.
  const goAuth = (targetView: string) => {
    setPendingAction({ view: targetView })
    navigate('auth')
  }

  // Canonicaliza a URL inicial: rota legada ou alias → rota canônica da view de
  // destino; path desconhecido (que não casa com nenhuma rota) → "/" (Início).
  // Ex.: /conquistas e /orientacao passam a mostrar "/" e "/guia-mensal".
  useEffect(() => {
    const path = window.location.pathname
    const target = LEGACY_PATH_REDIRECT[path] ?? URL_ALIASES[path]
    if (target) {
      window.history.replaceState({}, '', VIEW_TO_URL[target] ?? '/')
    } else if (path !== '/' && !parseURLNav()) {
      // Path fora da raiz que não resolve para nenhuma view → Início.
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Após autenticar, retoma a ação protegida que o visitante tentou antes.
  useEffect(() => {
    if (!user) return
    const pending = getPendingAction()
    if (!pending) return
    clearPendingAction()
    if (pending.diaryContext) setDiaryPromptContext(pending.diaryContext)
    if (pending.mood) setDiaryMood(pending.mood)
    if (pending.questionnaireId) setActiveQuestionnaireId(pending.questionnaireId)
    navigate(pending.view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Suporte ao botão Voltar/Avançar do navegador
  useEffect(() => {
    function handlePopState() {
      const fromURL = parseURLNav()
      if (fromURL) {
        // Rota própria do Plano de Autocuidado → abre a aba correta ao voltar/avançar.
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

  // Moldura das páginas "app": usuário logado → sidebar (UserLayout);
  // visitante → header público. Mantém a navegação coerente em toda a área logada.
  const appShell = (content: ReactNode) =>
    user ? (
      <UserLayout user={user} profile={profile} currentView={view} onNavigate={navigate} onSignOut={signOut}>
        {content}
      </UserLayout>
    ) : (
      <>
        <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">{content}</main>
        <Footer onNavigate={navigate} />
      </>
    )

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

  // Usuário autenticado mas sem perfil (a criação automática do useAuth falhou) — §19.
  if (user && !profile && view !== 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-4">
        <div className="max-w-sm w-full bg-paper-soft border border-line rounded-3xl p-8 text-center">
          <h1 className="font-serif text-2xl text-forest-900">Complete seu perfil</h1>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">
            Para personalizar sua experiência, complete seu perfil. Leva menos de um minuto.
          </p>
          <button
            onClick={() => { void refreshProfile() }}
            className="mt-5 w-full inline-flex items-center justify-center bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
          >
            Completar perfil
          </button>
          <button onClick={() => signOut()} className="mt-3 text-xs text-ink-soft hover:text-forest-900">Sair</button>
        </div>
      </div>
    )
  }

  if (view === 'auth') {
    return <Auth onBack={() => setView('home')} />
  }

  if (view === 'article' && selectedArticleSlug) {
    return appShell(
      <ArticleView
        slug={selectedArticleSlug}
        onBack={() => navigate('articles')}
        user={user}
        profile={profile}
        navigate={navigate}
        onSelectArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
        onSavePromptToDiary={handleSavePromptToDiary}
      />
    )
  }

  if (view === 'diary') {
    if (!user) { goAuth('diary'); return null }
    return appShell(
      <DiaryPage
        user={user}
        plan={profile?.plan || 'free'}
        onBack={() => setView('home')}
        onNavigatePricing={() => navigate('pricing')}
        initialMood={diaryMood}
        promptContext={diaryPromptContext}
        onClearPromptContext={() => setDiaryPromptContext(null)}
      />
    )
  }

  if (view === 'profile') {
    if (!user) { goAuth('profile'); return null }
    return appShell(
      <ProfilePage
        user={user}
        profile={profile}
        onBack={() => setView('home')}
        onNavigatePricing={() => navigate('pricing')}
        onRefreshProfile={refreshProfile}
      />
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
    return appShell(
      <QuestionnairesPage
        user={user}
        profile={profile}
        onStart={(id) => {
          setActiveQuestionnaireId(id)
          navigate('questionnaire')
        }}
        onStartAuth={(id) => {
          setPendingAction({ view: 'questionnaire', questionnaireId: id })
          navigate('auth')
        }}
        onBack={() => navigate('home')}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateReport={() => navigate('my-report')}
      />
    )
  }

  if (view === 'questionnaire' && activeQuestionnaireId) {
    if (!user) { setPendingAction({ view: 'questionnaire', questionnaireId: activeQuestionnaireId }); navigate('auth'); return null }
    return appShell(
      <QuestionnairePlayer
        questionnaireId={activeQuestionnaireId}
        user={user}
        profile={profile}
        onBack={() => { setActiveQuestionnaireId(null); navigate('questionarios') }}
        onNavigateDiary={() => navigate('diary')}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateArticles={() => navigate('articles')}
        onNavigate={navigate}
      />
    )
  }

  if (view === 'articles') {
    return appShell(
      <Articles
        onSelectArticle={(articleOrSlug) => {
          const slug = typeof articleOrSlug === 'string' ? articleOrSlug : (articleOrSlug as { slug: string }).slug
          setSelectedArticleSlug(slug)
          setView('article')
          pushURL('article', slug)
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  if (view === 'pricing') {
    // Logado → dentro do appShell (sidebar), coerente com a área logada;
    // visitante → header/rodapé públicos. (appShell decide pelo `user`.)
    return appShell(
      <Pricing
        user={user}
        currentPlan={profile?.plan || 'free'}
        onNavigateAuth={() => navigate('auth')}
      />
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
    return appShell(
      <SupportPage
        user={user}
        profile={profile}
        navigate={navigate}
        onBack={() => navigate('home')}
        onOpenTicket={(id) => { setActiveSupportTicketId(id); setView('support-ticket') }}
      />
    )
  }

  if (view === 'notifications') {
    return appShell(
      <NotificationsPage user={user} navigate={navigate} />
    )
  }

  if (view === 'support-ticket' && activeSupportTicketId) {
    return appShell(
      <div className="pt-2">
        <SupportTicketDetail
          ticketId={activeSupportTicketId}
          user={user}
          onBack={() => { setActiveSupportTicketId(null); navigate('support') }}
        />
      </div>
    )
  }

  if (view === 'monthly-guidance') {
    if (!user) { goAuth('monthly-guidance'); return null }
    return appShell(
      <MonthlyGuidancePage
        user={user}
        profile={profile}
        onBack={() => navigate('home')}
        onNavigatePricing={() => navigate('pricing')}
      />
    )
  }

  if (view === 'professional-comments') {
    if (!user) { goAuth('professional-comments'); return null }
    return appShell(
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ProfessionalCommentsSection
          user={user}
          profile={profile}
          onNavigateDiary={() => navigate('diary')}
          onNavigatePricing={() => navigate('pricing')}
        />
      </div>
    )
  }

  if (view === 'my-evolution') {
    if (!user) { goAuth('my-evolution'); return null }
    return appShell(
      <MyEvolutionPage
        user={user}
        profile={profile}
        onBack={() => navigate('home')}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateDiary={() => navigate('diary')}
        onNavigate={navigate}
        initialTab={initialEvolutionTab as Tab}
      />
    )
  }

  if (view === 'self-care') {
    if (!user) { goAuth('self-care'); return null }
    return appShell(
      <SelfCarePlanPage
        user={user}
        profile={profile}
        onNavigatePricing={() => navigate('pricing')}
        onNavigate={navigate}
      />
    )
  }

  if (view === 'my-report') {
    if (!user) { goAuth('my-report'); return null }
    return appShell(
      <MyReportPage
        user={user}
        profile={profile}
        onBack={() => navigate('home')}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateDiary={() => navigate('diary')}
        onNavigateGuidance={() => navigate('monthly-guidance')}
      />
    )
  }

  if (view === 'my-plan') {
    return appShell(
      <MyPlanPage
        user={user}
        profile={profile}
        onBack={() => navigate('home')}
        onNavigateAuth={() => goAuth('my-plan')}
        onRefreshProfile={refreshProfile}
      />
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

  // Home logado → nova experiência com sidebar (UserLayout)
  if (user) {
    return (
      <UserLayout user={user} profile={profile} currentView={view} onNavigate={navigate} onSignOut={signOut}>
        <LoggedHome user={user} profile={profile} onNavigate={navigate} />
      </UserLayout>
    )
  }

  // Home pública (visitante)
  return (
    <>
      <Header onNavigate={navigate} user={user} profile={profile} onSignOut={signOut} currentView={view} />
      <main className="min-h-screen bg-paper">
        <Hero onNavigate={navigate} />
        <HomeContent onNavigate={navigate} />
      </main>
      <Footer onNavigate={navigate} />
    </>
  )
}
