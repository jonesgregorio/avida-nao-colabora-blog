import { useState, useEffect, lazy, Suspense } from 'react'
import type { AdminView } from './types'
import { useAuth } from '../../hooks/useAuth'
import { logAdminAction } from '../../lib/adminAudit'
import AdminLayout from './AdminLayout'
import AdminLogin from './AdminLogin'
import AdminMfaGate from './AdminMfaGate'

// Cada área do painel é independente. Carregá-las sob demanda evita baixar
// editores, gráficos e integrações que o administrador não abriu nesta sessão.
const AdminArticleEditor = lazy(() => import('./AdminArticleEditor'))
const AdminOverview = lazy(() => import('./AdminOverview'))
const AdminUsers = lazy(() => import('./AdminUsers'))
const AdminSegments = lazy(() => import('./AdminSegments'))
const AdminEngagement = lazy(() => import('./AdminEngagement'))
const AdminAreaAssinaturas = lazy(() => import('./AdminAreaAssinaturas'))
const AdminFinanceiro = lazy(() => import('./AdminFinanceiro'))
const AdminAreaCuidado = lazy(() => import('./AdminAreaCuidado'))
const AdminSuportePage = lazy(() => import('./AdminSuportePage'))
const AdminAreaConteudo = lazy(() => import('./AdminAreaConteudo'))
const AdminEstudio = lazy(() => import('./AdminEstudio'))
const AdminAreaComunicacao = lazy(() => import('./AdminAreaComunicacao'))
const AdminAreaSistema = lazy(() => import('./AdminAreaSistema'))
const AnalyticsPage = lazy(() => import('./AnalyticsPage'))

function AdminSectionLoading() {
  return (
    <div className="min-h-[18rem] flex items-center justify-center" role="status" aria-live="polite">
      <div className="w-7 h-7 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export type { AdminView } from './types'

const ADMIN_KEY = 'avida_admin_view'

// Áreas dedicadas do admin. Uma view fora desta lista cai no fallback
// "visao-geral" — por isso adicionar um item no menu exige registrá-lo AQUI
// também, senão ele existe mas não abre.
const AREAS: AdminView[] = [
  'visao-geral', 'usuarios', 'segmentacao', 'engajamento',
  'assinaturas', 'financeiro',
  'conteudos', 'estudio', 'cuidado',
  'comunicacao', 'suporte', 'analytics', 'sistema',
]

// Views legadas (URL/localStorage antigos) → nova área (+ aba interna se houver).
const LEGACY_MAP: Record<string, { area: AdminView; tabKey?: string; tab?: string }> = {
  painel: { area: 'visao-geral' }, dashboard: { area: 'visao-geral' },
  desempenho: { area: 'analytics' }, 'site-analytics': { area: 'analytics' }, metricas: { area: 'analytics' },
  users: { area: 'usuarios' }, 'usuarios-planos': { area: 'usuarios' },

  // Assinaturas (antes: planos + cancelamentos)
  planos: { area: 'assinaturas', tabKey: 'admin-assinaturas-tab', tab: 'planos' },
  plans: { area: 'assinaturas', tabKey: 'admin-assinaturas-tab', tab: 'planos' },
  financial: { area: 'financeiro' },
  cancelamentos: { area: 'assinaturas', tabKey: 'admin-assinaturas-tab', tab: 'cancelamentos' },

  // Conteúdo
  conteudo: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'artigos' },
  articles: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'artigos' },
  categories: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'categorias' },
  images: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'imagens' },
  trails: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'artigos' },
  seo: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'seo' },
  'social-proof': { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'depoimentos' },
  'saved-items': { area: 'conteudos' },
  'fabrica-ia': { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'gerar-ia' },
  calendario: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'calendario' },
  'automacoes-blog': { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'automacoes' },
  automated: { area: 'conteudos' },
  scheduled: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'programados' },

  // Cuidado (antes: "mapa" + "emocional")
  mapa: { area: 'cuidado' },
  emocional: { area: 'cuidado' },
  questionnaires: { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'questionarios' },
  'diary-config': { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'diario' },
  pdf: { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'relatorios' },
  'self-care-plans': { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'autocuidado' },
  autocuidado: { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'autocuidado' },
  'guidance-requests': { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'orientacoes' },
  orientacao: { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'orientacoes' },
  'professional-comments': { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'orientacoes' },
  personalization: { area: 'cuidado', tabKey: 'admin-cuidado-tab', tab: 'recomendacoes' },
  professionals: { area: 'cuidado' },
  'evolution-sessions': { area: 'cuidado' }, atendimento: { area: 'cuidado' },
  // "Central de IA" saiu de Cuidado → Sistema › Monitoramento › IA
  'central-ia': { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'ia' },
  'uso-ia': { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'ia' },

  // Comunicação (antes: 6 abas)
  notifications: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'campanhas' },
  emails: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'historico' },
  templates: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'campanhas' },
  'site-content': { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'site-paginas' },

  support: { area: 'suporte' },

  // Sistema (antes: 9 abas → 5 áreas)
  sistema: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'monitoramento' },
  'system-health': { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'saude' },
  integracoes: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'servicos' },
  integrations: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'servicos' },
  infra: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'infra' },
  liberacao: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'liberacao' },
  flags: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'flags' },
  logs: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'logs' },
  permissions: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'permissoes' },
}

function resolveView(raw: string): AdminView {
  const m = LEGACY_MAP[raw]
  if (m) {
    if (m.tabKey && m.tab) { try { localStorage.setItem(m.tabKey, m.tab) } catch { /* noop */ } }
    return m.area
  }
  if (raw === 'article-editor' || AREAS.includes(raw as AdminView)) return raw as AdminView
  return 'visao-geral'
}

export default function AdminPanel() {
  const { user, profile, loading, signOut } = useAuth()
  const [mfaVerified, setMfaVerified] = useState(false)
  const [view, setView] = useState<AdminView>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_KEY)
      if (saved) {
        const resolved = resolveView(saved)
        return resolved === 'article-editor' ? 'conteudos' : resolved
      }
    } catch { /* noop */ }
    return 'visao-geral'
  })
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null)
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null)

  useEffect(() => { setMfaVerified(false) }, [user?.id])

  useEffect(() => {
    if (view === 'article-editor') return
    try { localStorage.setItem(ADMIN_KEY, view) } catch { /* noop */ }
  }, [view])

  useEffect(() => {
    if (profile?.role === 'admin' && mfaVerified) logAdminAction('login', 'admin')
  }, [profile?.role, mfaVerified])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <AdminLogin />

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center space-y-3">
          <p className="text-ink font-medium">Acesso restrito a administradores.</p>
          <p className="text-ink-soft text-sm">Sua conta não tem permissão de administrador.</p>
          <div className="flex gap-3 justify-center mt-4">
            <a href="/" className="px-4 py-2 text-sm bg-mint text-forest-800 rounded-lg hover:bg-forest-100">Voltar ao site</a>
            <button onClick={() => signOut()} className="px-4 py-2 text-sm bg-forest-900 text-white rounded-lg hover:bg-forest-800">Sair e trocar de conta</button>
          </div>
        </div>
      </div>
    )
  }

  if (!mfaVerified) {
    return <AdminMfaGate onVerified={() => setMfaVerified(true)} onSignOut={() => { void signOut() }} />
  }

  function navigate(v: string) {
    setView(resolveView(v))
  }

  function handleEditArticle(id?: string) {
    setEditingArticleId(id ?? null)
    setView('article-editor')
  }

  function renderView() {
    switch (view) {
      case 'visao-geral': return <AdminOverview onNavigate={v => navigate(v)} />
      case 'usuarios': return <AdminUsers initialUserId={pendingUserId} />
      case 'segmentacao': return <AdminSegments />
      case 'engajamento': return <AdminEngagement />
      case 'assinaturas': return <AdminAreaAssinaturas onViewUser={uid => { setPendingUserId(uid); navigate('usuarios') }} />
      case 'financeiro': return <AdminFinanceiro />
      case 'conteudos': return (
        <AdminAreaConteudo
          onEditArticle={handleEditArticle}
          onOpenCentralIA={() => {
            try { localStorage.setItem('admin-sistema-tab', 'ia') } catch { /* noop */ }
            navigate('sistema')
          }}
        />
      )
      case 'estudio': return <AdminEstudio />
      case 'cuidado': return <AdminAreaCuidado />
      case 'comunicacao': return <AdminAreaComunicacao initialCampaignId={pendingCampaignId} />
      case 'analytics': return <AnalyticsPage onEditArticle={handleEditArticle} />
      case 'suporte': return <AdminSuportePage onViewUser={uid => { setPendingUserId(uid); navigate('usuarios') }} initialTicketId={pendingTicketId} />
      case 'sistema': return <AdminAreaSistema />
      case 'article-editor':
        return (
          <AdminArticleEditor
            articleId={editingArticleId}
            onBack={() => {
              try { localStorage.setItem('admin-conteudo-tab', 'artigos') } catch { /* noop */ }
              setView('conteudos')
            }}
          />
        )
      default:
        return <AdminOverview onNavigate={v => navigate(v)} />
    }
  }

  function handleExit() {
    window.location.href = window.location.pathname
  }

  return (
    <AdminLayout
      currentView={view}
      onNavigate={v => navigate(v)}
      onExit={handleExit}
      onOpenUser={uid => { setPendingUserId(uid); navigate('usuarios') }}
      onOpenArticle={id => handleEditArticle(id)}
      onOpenTicket={id => { setPendingTicketId(id); navigate('suporte') }}
      onOpenCampaign={id => { setPendingCampaignId(id); try { localStorage.setItem('admin-comunicacao-tab', 'campanhas') } catch { /* noop */ } navigate('comunicacao') }}
      userName={profile?.full_name || profile?.display_name || profile?.preferred_name || undefined}
    >
      <Suspense fallback={<AdminSectionLoading />}>{renderView()}</Suspense>
    </AdminLayout>
  )
}
