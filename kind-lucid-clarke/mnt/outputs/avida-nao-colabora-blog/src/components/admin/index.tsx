import { useState, useEffect } from 'react'
import type { AdminView } from './types'
import { useAuth } from '../../hooks/useAuth'
import AdminLayout from './AdminLayout'
import AdminArticleEditor from './AdminArticleEditor'
import AdminAreaPainel from './AdminAreaPainel'
import AdminAreaConteudo from './AdminAreaConteudo'
import AdminAreaUsuariosPlanos from './AdminAreaUsuariosPlanos'
import AdminAreaAtendimento from './AdminAreaAtendimento'
import AdminAreaComunicacao from './AdminAreaComunicacao'
import AdminAreaSistema from './AdminAreaSistema'

export type { AdminView } from './types'

const ADMIN_KEY = 'avida_admin_view'

// ── Alias: views legadas → área principal + aba interna ──────────────────────
// Garante compatibilidade com ?view=X ou localStorage antigo
const AREA_ALIAS: Record<string, { area: AdminView; tabKey: string; tab: string }> = {
  'dashboard':             { area: 'painel',          tabKey: 'admin-painel-tab',       tab: 'visao-geral' },
  'analytics':             { area: 'painel',          tabKey: 'admin-painel-tab',       tab: 'metricas'    },
  'system-health':         { area: 'sistema',         tabKey: 'admin-sistema-tab',      tab: 'saude'       },
  'logs':                  { area: 'sistema',         tabKey: 'admin-sistema-tab',      tab: 'logs'        },
  'articles':              { area: 'conteudo',        tabKey: 'admin-conteudo-tab',     tab: 'artigos'     },
  'categories':            { area: 'conteudo',        tabKey: 'admin-conteudo-tab',     tab: 'categorias'  },
  'images':                { area: 'conteudo',        tabKey: 'admin-conteudo-tab',     tab: 'imagens'     },
  'questionnaires':        { area: 'conteudo',        tabKey: 'admin-conteudo-tab',     tab: 'questionarios'},
  'trails':                { area: 'conteudo',        tabKey: 'admin-conteudo-tab',     tab: 'trilhas'     },
  'seo':                   { area: 'conteudo',        tabKey: 'admin-conteudo-tab',     tab: 'seo'         },
  'social-proof':          { area: 'conteudo',        tabKey: 'admin-conteudo-tab',     tab: 'depoimentos' },
  'users':                 { area: 'usuarios-planos', tabKey: 'admin-usuarios-tab',     tab: 'usuarios'    },
  'plans':                 { area: 'usuarios-planos', tabKey: 'admin-usuarios-tab',     tab: 'planos'      },
  'financial':             { area: 'usuarios-planos', tabKey: 'admin-usuarios-tab',     tab: 'financeiro'  },
  'pdf':                   { area: 'usuarios-planos', tabKey: 'admin-usuarios-tab',     tab: 'relatorios'  },
  'permissions':           { area: 'usuarios-planos', tabKey: 'admin-usuarios-tab',     tab: 'permissoes'  },
  'diary-config':          { area: 'usuarios-planos', tabKey: 'admin-usuarios-tab',     tab: 'diario'      },
  'saved-items':           { area: 'usuarios-planos', tabKey: 'admin-usuarios-tab',     tab: 'itens-salvos'},
  'personalization':       { area: 'atendimento',     tabKey: 'admin-atendimento-tab',  tab: 'fila'        },
  'support':               { area: 'atendimento',     tabKey: 'admin-atendimento-tab',  tab: 'suporte'     },
  'guidance-requests':     { area: 'atendimento',     tabKey: 'admin-atendimento-tab',  tab: 'orientacoes' },
  'evolution-sessions':    { area: 'atendimento',     tabKey: 'admin-atendimento-tab',  tab: 'sessoes'     },
  'professional-comments': { area: 'atendimento',     tabKey: 'admin-atendimento-tab',  tab: 'comentarios' },
  'self-care-plans':       { area: 'atendimento',     tabKey: 'admin-atendimento-tab',  tab: 'autocuidado' },
  'professionals':         { area: 'atendimento',     tabKey: 'admin-atendimento-tab',  tab: 'equipe'      },
  'notifications':         { area: 'comunicacao',     tabKey: 'admin-comunicacao-tab',  tab: 'notificacoes'},
  'automated':             { area: 'comunicacao',     tabKey: 'admin-comunicacao-tab',  tab: 'automaticos' },
  'scheduled':             { area: 'comunicacao',     tabKey: 'admin-comunicacao-tab',  tab: 'automaticos' },
}

function resolveView(raw: string): AdminView {
  const alias = AREA_ALIAS[raw]
  if (alias) {
    try { localStorage.setItem(alias.tabKey, alias.tab) } catch { /* noop */ }
    return alias.area
  }
  return raw as AdminView
}

export default function AdminPanel() {
  const { profile, loading } = useAuth()
  const [view, setView] = useState<AdminView>(() => {
    try {
      const raw = localStorage.getItem(ADMIN_KEY) ?? 'painel'
      return resolveView(raw)
    } catch { return 'painel' }
  })
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(ADMIN_KEY, view) } catch { /* noop */ }
  }, [view])

  // Aguarda autenticação antes de bloquear acesso (evita falso "Acesso restrito")
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-3">
          <p className="text-stone-600 font-medium">Acesso restrito a administradores.</p>
          <p className="text-stone-400 text-sm">
            {!profile ? 'Você precisa estar autenticado.' : 'Sua conta não tem permissão de administrador.'}
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <a href="/" className="px-4 py-2 text-sm bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200">
              Voltar ao site
            </a>
            {!profile && (
              <a href="/login" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                Entrar
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  function navigate(v: string) {
    const resolved = resolveView(v)
    setView(resolved)
    try { localStorage.setItem(ADMIN_KEY, resolved) } catch { /* noop */ }
  }

  function handleEditArticle(id?: string) {
    setEditingArticleId(id ?? null)
    setView('article-editor')
  }

  function renderView() {
    switch (view) {
      // ── Áreas principais ──────────────────────────────────────────────────
      case 'painel':
        return <AdminAreaPainel onNavigate={v => navigate(v)} />
      case 'conteudo':
        return <AdminAreaConteudo onEditArticle={handleEditArticle} />
      case 'usuarios-planos':
        return <AdminAreaUsuariosPlanos />
      case 'atendimento':
        return <AdminAreaAtendimento />
      case 'comunicacao':
        return <AdminAreaComunicacao />
      case 'sistema':
        return <AdminAreaSistema />

      // ── Editor de artigos (view direta, fora das abas) ────────────────────
      case 'article-editor':
        return (
          <AdminArticleEditor
            articleId={editingArticleId}
            onBack={() => {
              try { localStorage.setItem('admin-conteudo-tab', 'artigos') } catch { /* noop */ }
              setView('conteudo')
            }}
          />
        )

      // ── Views legadas: redirecionam para a área correta ───────────────────
      // (garante compat. se view antiga chegou por URL ou localStorage externo)
      default:
        navigate(view)
        return null
    }
  }

  function handleExit() {
    window.location.href = window.location.pathname
  }

  return (
    <AdminLayout currentView={view} onNavigate={v => navigate(v)} onExit={handleExit}>
      {renderView()}
    </AdminLayout>
  )
}
