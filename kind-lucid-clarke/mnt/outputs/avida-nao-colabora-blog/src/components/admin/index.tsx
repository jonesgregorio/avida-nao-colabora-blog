import { useState, useEffect } from 'react'
import type { AdminView } from './types'
import { useAuth } from '../../hooks/useAuth'
import { logAdminAction } from '../../lib/adminAudit'
import AdminLayout from './AdminLayout'
import AdminArticleEditor from './AdminArticleEditor'
import AdminOverview from './AdminOverview'
import AdminUsers from './AdminUsers'
import AdminPlanosPage from './AdminPlanosPage'
import AdminSelfCarePlans from './AdminSelfCarePlans'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminSuportePage from './AdminSuportePage'
import AdminAreaConteudo from './AdminAreaConteudo'
import AdminAreaComunicacao from './AdminAreaComunicacao'
import AdminAreaSistema from './AdminAreaSistema'
import AdminMapaArea from './AdminMapaArea'
import AdminFabricaIA from './AdminFabricaIA'
import AdminCalendarioEditorial from './AdminCalendarioEditorial'
import AdminAutomacoesBlog from './AdminAutomacoesBlog'
import AdminPerformanceEditorial from './AdminPerformanceEditorial'

export type { AdminView } from './types'

const ADMIN_KEY = 'avida_admin_view'

// As 10 áreas dedicadas do novo admin (contrato: admin-mockup-avnc.html).
const AREAS: AdminView[] = [
  'visao-geral', 'usuarios', 'planos', 'conteudos',
  'fabrica-ia', 'calendario', 'automacoes-blog', 'desempenho',
  'mapa', 'autocuidado', 'orientacao', 'comunicacao', 'suporte', 'sistema',
]

// Views legadas (URL/localStorage antigos) → nova área (+ aba interna se houver).
const LEGACY_MAP: Record<string, { area: AdminView; tabKey?: string; tab?: string }> = {
  painel: { area: 'visao-geral' }, dashboard: { area: 'visao-geral' }, analytics: { area: 'visao-geral' },
  users: { area: 'usuarios' }, 'usuarios-planos': { area: 'usuarios' },
  plans: { area: 'planos' }, financial: { area: 'planos' },
  conteudo: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'artigos' },
  articles: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'artigos' },
  categories: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'categorias' },
  images: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'imagens' },
  trails: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'artigos' },
  seo: { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'seo' },
  'social-proof': { area: 'conteudos', tabKey: 'admin-conteudo-tab', tab: 'depoimentos' },
  'saved-items': { area: 'conteudos' },
  questionnaires: { area: 'mapa', tabKey: 'admin-mapa-tab', tab: 'questionarios' },
  'diary-config': { area: 'mapa', tabKey: 'admin-mapa-tab', tab: 'configuracoes' },
  pdf: { area: 'mapa', tabKey: 'admin-mapa-tab', tab: 'relatorios' },
  'self-care-plans': { area: 'autocuidado' },
  'guidance-requests': { area: 'orientacao' }, 'professional-comments': { area: 'orientacao' },
  personalization: { area: 'orientacao' }, professionals: { area: 'orientacao' },
  'evolution-sessions': { area: 'orientacao' }, atendimento: { area: 'orientacao' },
  notifications: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'notificacoes' },
  automated: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'campanhas' },
  scheduled: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'campanhas' },
  emails: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'emails' },
  templates: { area: 'comunicacao', tabKey: 'admin-comunicacao-tab', tab: 'templates' },
  support: { area: 'suporte' },
  sistema: { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'saude' },
  'system-health': { area: 'sistema', tabKey: 'admin-sistema-tab', tab: 'saude' },
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
  const { profile, loading } = useAuth()
  // Abre sempre na Visão geral (landing do admin, como no mockup).
  const [view, setView] = useState<AdminView>('visao-geral')
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(ADMIN_KEY, view) } catch { /* noop */ }
  }, [view])

  useEffect(() => {
    if (profile?.role === 'admin') logAdminAction('login', 'admin')
  }, [profile?.role])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center space-y-3">
          <p className="text-ink font-medium">Acesso restrito a administradores.</p>
          <p className="text-ink-soft text-sm">
            {!profile ? 'Você precisa estar autenticado.' : 'Sua conta não tem permissão de administrador.'}
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <a href="/" className="px-4 py-2 text-sm bg-mint text-forest-800 rounded-lg hover:bg-forest-100">
              Voltar ao site
            </a>
            {!profile && (
              <a href="/login" className="px-4 py-2 text-sm bg-forest-900 text-white rounded-lg hover:bg-forest-800">
                Entrar
              </a>
            )}
          </div>
        </div>
      </div>
    )
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
      case 'usuarios': return <AdminUsers />
      case 'planos': return <AdminPlanosPage />
      case 'conteudos': return <AdminAreaConteudo onEditArticle={handleEditArticle} />
      case 'fabrica-ia': return <AdminFabricaIA />
      case 'calendario': return <AdminCalendarioEditorial onEditArticle={handleEditArticle} />
      case 'automacoes-blog': return <AdminAutomacoesBlog />
      case 'desempenho': return <AdminPerformanceEditorial onEditArticle={handleEditArticle} />
      case 'mapa': return <AdminMapaArea />
      case 'autocuidado': return <AdminSelfCarePlans />
      case 'orientacao': return <AdminGuidanceRequests />
      case 'comunicacao': return <AdminAreaComunicacao />
      case 'suporte': return <AdminSuportePage />
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
      userName={profile?.full_name || profile?.display_name || profile?.preferred_name || undefined}
    >
      {renderView()}
    </AdminLayout>
  )
}
