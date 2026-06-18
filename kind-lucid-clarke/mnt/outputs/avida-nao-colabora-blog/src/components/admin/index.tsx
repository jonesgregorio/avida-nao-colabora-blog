import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
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

export type AdminView =
  | 'dashboard'
  | 'articles'
  | 'article-editor'
  | 'images'
  | 'categories'
  | 'questionnaires'
  | 'trails'
  | 'seo'
  | 'automated'
  | 'scheduled'
  | 'notifications'
  | 'users'
  | 'plans'
  | 'diary-config'
  | 'saved-items'
  | 'analytics'
  | 'social-proof'
  | 'pdf'
  | 'support'
  | 'permissions'
  | 'logs'
  | 'professionals'
  | 'financial'

export default function AdminPanel() {
  const { profile } = useAuth()
  const [view, setView] = useState<AdminView>('dashboard')
  const [editingArticleId, setEditingArticleId] = useState<string | undefined>(undefined)

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
    setEditingArticleId(id)
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
      default:               return <AdminDashboard onNavigate={setView} />
    }
  }

  return (
    <AdminLayout currentView={view} onNavigate={setView}>
      {renderView()}
    </AdminLayout>
  )
}
