import { useState, useEffect } from 'react'
import type { AdminView } from './types'
import { useAuth } from '../../hooks/useAuth'
import AdminLayout from './AdminLayout'
import AdminDashboard from './AdminDashboard'
import AdminArticles from './AdminArticles'
import AdminArticleEditor from './AdminArticleEditor'
import AdminImages from './AdminImages'
import AdminCategories from './AdminCategories'
import AdminQuestionnaires from './AdminQuestionnaires'
import AdminTrails from './AdminTrails'
import AdminSEO from './AdminSEO'
import AdminAutomated from './AdminAutomated'
import AdminScheduled from './AdminScheduled'
import AdminNotifications from './AdminNotifications'
import AdminUsers from './AdminUsers'
import AdminPlans from './AdminPlans'
import AdminDiaryConfig from './AdminDiaryConfig'
import AdminSavedItems from './AdminSavedItems'
import AdminAnalytics from './AdminAnalytics'
import AdminSocialProof from './AdminSocialProof'
import AdminPDF from './AdminPDF'
import AdminSupport from './AdminSupport'
import AdminPermissions from './AdminPermissions'
import AdminLogs from './AdminLogs'
import AdminProfessionals from './AdminProfessionals'
import AdminFinancial from './AdminFinancial'
import AdminProfessionalComments from './AdminProfessionalComments'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminEvolutionSessions from './AdminEvolutionSessions'
import AdminSelfCarePlans from './AdminSelfCarePlans'

export type { AdminView } from './types'

const ADMIN_KEY = 'avida_admin_view'

export default function AdminPanel() {
  const { profile } = useAuth()
  const [view, setView] = useState<AdminView>(() => {
    try { return (localStorage.getItem(ADMIN_KEY) as AdminView) || 'dashboard' } catch { return 'dashboard' }
  })
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(ADMIN_KEY, view) } catch { /* noop */ }
  }, [view])

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <p className="text-stone-500 text-sm">Acesso restrito a administradores.</p>
        </div>
      </div>
    )
  }

  function handleEditArticle(id?: string) {
    setEditingArticleId(id ?? null)
    setView('article-editor')
  }

  function renderView() {
    switch (view) {
      case 'dashboard':      return <AdminDashboard onNavigate={setView} />
      case 'articles':       return <AdminArticles onEdit={handleEditArticle} onNew={() => handleEditArticle()} />
      case 'article-editor': return <AdminArticleEditor articleId={editingArticleId} onBack={() => setView('articles')} />
      case 'images':         return <AdminImages />
      case 'categories':     return <AdminCategories />
      case 'questionnaires': return <AdminQuestionnaires />
      case 'trails':         return <AdminTrails />
      case 'seo':            return <AdminSEO />
      case 'automated':      return <AdminAutomated />
      case 'scheduled':      return <AdminScheduled />
      case 'notifications':  return <AdminNotifications />
      case 'users':          return <AdminUsers />
      case 'plans':          return <AdminPlans />
      case 'diary-config':   return <AdminDiaryConfig />
      case 'saved-items':    return <AdminSavedItems />
      case 'analytics':      return <AdminAnalytics />
      case 'social-proof':   return <AdminSocialProof />
      case 'pdf':            return <AdminPDF />
      case 'support':        return <AdminSupport />
      case 'permissions':    return <AdminPermissions />
      case 'logs':           return <AdminLogs />
      case 'professionals':  return <AdminProfessionals />
      case 'financial':      return <AdminFinancial />
      case 'professional-comments': return <AdminProfessionalComments />
      case 'guidance-requests':    return <AdminGuidanceRequests />
      case 'evolution-sessions':   return <AdminEvolutionSessions />
      case 'self-care-plans':      return <AdminSelfCarePlans />
      default:               return <AdminDashboard onNavigate={setView} />
    }
  }

  function handleExit() {
    window.location.href = window.location.pathname
  }

  return (
    <AdminLayout currentView={view} onNavigate={setView} onExit={handleExit}>
      {renderView()}
    </AdminLayout>
  )
}
