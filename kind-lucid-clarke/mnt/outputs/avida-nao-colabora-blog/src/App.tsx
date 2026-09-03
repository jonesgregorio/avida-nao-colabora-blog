import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { useAuth } from './hooks/useAuth'
import type { View } from './types'
import { setPendingAction, getPendingAction, clearPendingAction } from './lib/pendingAction'
import { confirmDialog } from './lib/confirmDialog'
import { trackEvent, initWebVitals, initAcquisition, initCustomEvents, trackCustomViews } from './lib/analytics'
import { getEffectivePlan } from './lib/officialPlans'
import {
  canonicalPathForLocation,
  normalizeLegacyView,
  parseURLNav,
  PERSIST_KEY,
  restoreNav,
  urlForView,
} from './lib/navigation'

import Header from './components/Header'
import Footer from './components/Footer'
import Hero from './components/Hero'
import HomeContent from './components/HomeContent'
import LoggedHome from './components/LoggedHome'
import UserLayout from './components/user/UserLayout'
import Pricing from './components/Pricing'
import Auth from './components/Auth'
import AboutPage from './components/AboutPage'
import PrivacyPage from './components/PrivacyPage'
import TermsPage from './components/TermsPage'
import { ResponsibilityPage } from './components/ResponsibilityPage'
import ContactPage from './components/ContactPage'
import FAQPage from './components/FAQPage'
import SuccessPage from './components/SuccessPage'
import ForceChangePassword from './components/ForceChangePassword'
import type { Tab } from './components/MyEvolutionPage'

// Páginas de aplicação são carregadas apenas quando a rota exige. Isso preserva
// a home leve, sem mudar URLs, permissões ou a experiência de navegação.
const Articles = lazy(() => import('./components/Articles'))
const ArticleView = lazy(() => import('./components/ArticleView'))
const DiaryPage = lazy(() => import('./components/DiaryPage'))
const ProfilePage = lazy(() => import('./components/Profile'))
const QuestionnairesPage = lazy(() => import('./components/QuestionnairesPage'))
const QuestionnaireEvolutionPage = lazy(() => import('./components/QuestionnaireEvolutionPage'))
const QuestionnairePlayer = lazy(() => import('./components/QuestionnairePlayer'))
const SupportPage = lazy(() => import('./components/SupportPage'))
const SupportTicketDetail = lazy(() => import('./components/SupportTicketDetail'))
const NotificationsPage = lazy(() => import('./components/NotificationsPage'))
const MonthlyGuidancePage = lazy(() => import('./components/MonthlyGuidancePage'))
const ProfessionalCommentsSection = lazy(() => import('./components/ProfessionalCommentsSection'))
const MyPlanPage = lazy(() => import('./components/MyPlanPage'))
const MyReportPage = lazy(() => import('./components/MyReportPage'))
const MyEvolutionPage = lazy(() => import('./components/MyEvolutionPage'))
const MyHistoryPage = lazy(() => import('./components/MyHistoryPage'))
const MyGardenPage = lazy(() => import('./components/MyGardenPage'))
const SelfCarePlanPage = lazy(() => import('./components/SelfCarePlanPage'))
const DescobertasPage = lazy(() => import('./components/DescobertasPage'))
const CuidarPage = lazy(() => import('./components/CuidarPage'))
const MaisPage = lazy(() => import('./components/MaisPage'))

// AdminPanel carregado sob demanda — o maior chunk do bundle.
const AdminPanel = lazy(() => import('./components/admin'))

function PageLoading() {
  return (
    <div className="min-h-[16rem] flex items-center justify-center px-4" role="status" aria-live="polite">
      <div className="text-center text-sm text-ink-soft">
        <div className="w-7 h-7 border-2 border-forest-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Carregando página…
      </div>
    </div>
  )
}

export default function App() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()
  const effectivePlan = getEffectivePlan(profile)
  const accessProfile = profile ? { ...profile, plan: effectivePlan } : profile

  // Blog e admin compartilham UMA sessão do Supabase (um único cliente, uma única
  // chave no navegador). Sair aqui derruba as duas áreas — não há como separar
  // sem dois clientes. Já que a sessão é uma só, ao menos avisamos antes, em vez
  // de o admin descobrir que caiu ao voltar para o painel.
  async function handleSignOut() {
    if (profile?.role === 'admin') {
      const ok = await confirmDialog({
        titulo: 'Encerrar a sessão?',
        mensagem: 'Sua conta de administrador usa a mesma sessão do blog. Ao sair, você também será desconectado do painel administrativo e precisará entrar de novo em /admin.\n\nPara ficar logado nos dois ao mesmo tempo, use o painel numa janela anônima ou em outro perfil do navegador.',
        confirmar: 'Sair mesmo assim',
        cancelar: 'Continuar logado',
        tom: 'perigo',
      })
      if (!ok) return
    }
    await signOut()
  }

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
    trackEvent('page_view', { entity_id: window.location.pathname, entity_title: selectedArticleSlug || view, user_id: user?.id ?? null, metadata: { view } })
  }, [view, selectedArticleSlug, user?.id])

  // Analytics: Web Vitals (1x) + captura de cliques em CTA marcados com data-cta
  useEffect(() => {
    initWebVitals()
    initAcquisition()
    initCustomEvents(user?.id)
    trackCustomViews()
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-cta]') as HTMLElement | null
      if (el) trackEvent('cta_click', {
        entity_id: el.getAttribute('data-cta') || undefined,
        entity_title: (el.textContent || '').trim().slice(0, 60),
        user_id: user?.id ?? null,
        metadata: { location: el.getAttribute('data-cta-location') || view, plan: el.getAttribute('data-cta-plan') || undefined },
      })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [user?.id, view])
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
    const url = urlForView(targetView, slug, ticketId)
    if (window.location.pathname !== url) {
      window.history.pushState({ view: targetView, slug, ticketId }, '', url)
    }
  }

  const navigate = useCallback((section: string, articleSlug?: string) => {
    // Redireciona views de módulos removidos do MVP para destinos válidos.
    section = normalizeLegacyView(section)

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
      'about', 'privacy', 'terms', 'questionnaire', 'questionarios', 'questionarios-evolucao',
      'pricing', 'articles', 'article', 'responsibility', 'admin', 'contact', 'success', 'faq',
      'support', 'support-ticket', 'monthly-guidance', 'professional-comments', 'my-plan', 'my-evolution', 'my-report', 'my-history', 'my-garden', 'self-care',
      'descobertas', 'cuidar', 'mais',
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
  }, [user])

  // Leva ao login guardando a ação pretendida, para retornar a ela após autenticar.
  const goAuth = (targetView: string) => {
    setPendingAction({ view: targetView })
    navigate('auth')
  }

  // Canonicaliza a URL inicial: rota legada ou alias → rota canônica da view de
  // destino; path desconhecido (que não casa com nenhuma rota) → "/" (Início).
  useEffect(() => {
    const canonical = canonicalPathForLocation(window.location.pathname, window.location.search)
    if (canonical && window.location.pathname !== canonical) {
      window.history.replaceState({}, '', canonical)
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
    // Ticket de suporte (link do e-mail): restaura ID + URL /suporte/:id.
    if (pending.view === 'support-ticket' && pending.ticketId) {
      navigate(`support-ticket:${pending.ticketId}`)
    } else if (pending.view === 'article' && pending.articleSlug) {
      setSelectedArticleSlug(pending.articleSlug)
      setView('article')
      pushURL('article', pending.articleSlug)
      window.scrollTo(0, 0)
    } else {
      navigate(pending.view)
    }
  }, [user, navigate])

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
  const appShell = (content: ReactNode) => {
    const page = <Suspense fallback={<PageLoading />}>{content}</Suspense>
    return user ? (
      <UserLayout user={user} profile={accessProfile} currentView={view} onNavigate={navigate} onSignOut={handleSignOut}>
        {page}
      </UserLayout>
    ) : (
      <>
        <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">{page}</main>
        <Footer onNavigate={navigate} />
      </>
    )
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

  // Usuário autenticado mas sem perfil (a criação automática do useAuth falhou) — §19.
  // O painel admin (/admin) trata seu próprio carregamento de perfil.
  if (user && !profile && view !== 'auth' && view !== 'admin') {
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
          <button onClick={() => { void handleSignOut() }} className="mt-3 text-xs text-ink-soft hover:text-forest-900">Sair</button>
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
        profile={accessProfile}
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
        plan={effectivePlan}
        onBack={() => setView('home')}
        onNavigatePricing={() => navigate('pricing')}
        onOpenArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
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
        <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">
          <ContactPage user={user} profile={accessProfile} onBack={() => setView('home')} navigate={navigate} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'about') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
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
        <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
        <main className="min-h-screen bg-stone-50">
          <ResponsibilityPage />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'faq') {
    return (
      <>
        <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
        <main className="min-h-screen">
          <FAQPage onNavigate={navigate} />
        </main>
        <Footer onNavigate={navigate} />
      </>
    )
  }

  if (view === 'questionarios') {
    return appShell(
      <QuestionnairesPage
        user={user}
        profile={accessProfile}
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
        onNavigateEvolution={() => navigate('questionarios-evolucao')}
      />
    )
  }

  if (view === 'questionarios-evolucao') {
    if (!user) { navigate('auth'); return null }
    return appShell(
      <QuestionnaireEvolutionPage user={user} onBack={() => navigate('questionarios')} />
    )
  }

  if (view === 'questionnaire' && activeQuestionnaireId) {
    if (!user) { setPendingAction({ view: 'questionnaire', questionnaireId: activeQuestionnaireId }); navigate('auth'); return null }
    return appShell(
      <QuestionnairePlayer
        questionnaireId={activeQuestionnaireId}
        user={user}
        profile={accessProfile}
        onBack={() => { setActiveQuestionnaireId(null); navigate('questionarios') }}
        onNavigateDiary={() => navigate('diary')}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateArticles={() => navigate('articles')}
        onNavigate={navigate}
        onOpenArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
      />
    )
  }

  if (view === 'articles') {
    return appShell(
      <Articles
        user={user}
        profile={accessProfile}
        onNavigateDiary={() => navigate('diary')}
        onNavigatePricing={() => navigate('pricing')}
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
        userPlan={profile?.plan}
      />
    )
  }

  if (view === 'support') {
    return appShell(
      <SupportPage
        user={user}
        profile={accessProfile}
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
    // Link do e-mail aberto sem sessão (celular/outro navegador): manda ao login
    // guardando o ticket, e volta pra cá depois de autenticar. Sem isto a consulta
    // por user_id não acha nada e mostra "Ticket não encontrado".
    if (!user) { setPendingAction({ view: 'support-ticket', ticketId: activeSupportTicketId }); navigate('auth'); return null }
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
        profile={accessProfile}
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
          profile={accessProfile}
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
        profile={accessProfile}
        onBack={() => navigate('home')}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateDiary={() => navigate('diary')}
        onNavigate={navigate}
        onOpenArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
        initialTab={initialEvolutionTab as Tab}
      />
    )
  }

  if (view === 'self-care') {
    if (!user) { goAuth('self-care'); return null }
    return appShell(
      <SelfCarePlanPage
        user={user}
        profile={accessProfile}
        onNavigatePricing={() => navigate('pricing')}
        onNavigate={navigate}
        onOpenArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
      />
    )
  }

  if (view === 'descobertas') {
    if (!user) { goAuth('descobertas'); return null }
    return appShell(
      <DescobertasPage user={user} profile={accessProfile} onNavigate={navigate} />
    )
  }

  if (view === 'cuidar') {
    if (!user) { goAuth('cuidar'); return null }
    return appShell(
      <CuidarPage
        user={user}
        profile={accessProfile}
        onNavigate={navigate}
        onOpenArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
      />
    )
  }

  if (view === 'mais') {
    if (!user) { goAuth('mais'); return null }
    return appShell(
      <MaisPage profile={accessProfile} onNavigate={navigate} />
    )
  }

  if (view === 'my-report') {
    if (!user) { goAuth('my-report'); return null }
    return appShell(
      <MyReportPage
        user={user}
        profile={accessProfile}
        onBack={() => navigate('home')}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateDiary={() => navigate('diary')}
        onNavigateGuidance={() => navigate('monthly-guidance')}
        onNavigateSelfCare={() => navigate('self-care')}
        onOpenArticle={(slug) => { setSelectedArticleSlug(slug); setView('article'); pushURL('article', slug); window.scrollTo(0, 0) }}
      />
    )
  }

  if (view === 'my-history') {
    if (!user) { goAuth('my-history'); return null }
    return appShell(
      <MyHistoryPage
        user={user}
        profile={accessProfile}
        onNavigatePricing={() => navigate('pricing')}
        onNavigateDiary={() => navigate('diary')}
        onNavigateReport={() => navigate('my-report')}
        onNavigateMap={() => navigate('my-evolution')}
      />
    )
  }

  if (view === 'my-garden') {
    if (!user) { goAuth('my-garden'); return null }
    return appShell(
      <MyGardenPage userId={user.id} />
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
      <UserLayout user={user} profile={accessProfile} currentView={view} onNavigate={navigate} onSignOut={handleSignOut}>
        <LoggedHome user={user} profile={accessProfile} onNavigate={navigate} />
      </UserLayout>
    )
  }

  // Home pública (visitante)
  return (
    <>
      <Header onNavigate={navigate} user={user} profile={accessProfile} onSignOut={handleSignOut} currentView={view} />
      <main className="min-h-screen bg-paper">
        <Hero onNavigate={navigate} />
        <HomeContent onNavigate={navigate} />
      </main>
      <Footer onNavigate={navigate} />
    </>
  )
}
