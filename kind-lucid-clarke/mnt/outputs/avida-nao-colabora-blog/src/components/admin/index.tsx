import { useState } from 'react'
import AdminLayout from './AdminLayout'
import AdminDashboard from './AdminDashboard'
import AdminArticles from './AdminArticles'
import AdminArticleEditor from './AdminArticleEditor'
import AdminUsers from './AdminUsers'
import AdminCategories from './AdminCategories'
import AdminPlans from './AdminPlans'
import AdminSocialProof from './AdminSocialProof'
import AdminImages from './AdminImages'

export type AdminView =
  | 'dashboard'
  | 'articles'
  | 'article-editor'
  | 'users'
  | 'categories'
  | 'plans'
  | 'social-proof'
  | 'images'

interface AdminPanelProps {
  user: any
  profile: any
  onExit: () => void
}

export default function AdminPanel({ user, profile, onExit }: AdminPanelProps) {
  const [adminView, setAdminView] = useState<AdminView>('dashboard')
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow border border-red-100 max-w-sm">
          <span className="text-4xl mb-4 block">🔒</span>
          <h2 className="text-xl font-semibold text-stone-800 mb-2">Acesso negado</h2>
          <p className="text-stone-500 text-sm mb-4">Você não tem permissão para acessar o painel administrativo.</p>
          <button
            onClick={onExit}
            className="bg-stone-800 text-white px-5 py-2 rounded-lg text-sm hover:bg-stone-700"
          >
            Voltar ao site
          </button>
        </div>
      </div>
    )
  }

  function renderContent() {
    switch (adminView) {
      case 'dashboard':
        return <AdminDashboard onNavigate={setAdminView} />
      case 'articles':
        return (
          <AdminArticles
            onNew={() => { setEditingArticleId(null); setAdminView('article-editor') }}
            onEdit={(id) => { setEditingArticleId(id); setAdminView('article-editor') }}
          />
        )
      case 'article-editor':
        return (
          <AdminArticleEditor
            articleId={editingArticleId}
            onBack={() => setAdminView('articles')}
          />
        )
      case 'users':
        return <AdminUsers />
      case 'categories':
        return <AdminCategories />
      case 'plans':
        return <AdminPlans />
      case 'social-proof':
        return <AdminSocialProof />
      case 'images':
        return <AdminImages />
      default:
        return <AdminDashboard onNavigate={setAdminView} />
    }
  }

  return (
    <AdminLayout
      currentView={adminView}
      onNavigate={setAdminView}
      onExit={onExit}
      userEmail={user?.email}
    >
      {renderContent()}
    </AdminLayout>
  )
}
