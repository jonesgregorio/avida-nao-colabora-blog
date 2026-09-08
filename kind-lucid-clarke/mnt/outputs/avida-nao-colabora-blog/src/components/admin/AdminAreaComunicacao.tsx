import { useState } from 'react'
import { Bell, FileText, Sparkles, Megaphone, Repeat, History, X } from 'lucide-react'
import AdminNotifications from './AdminNotifications'
import AdminEmails from './AdminEmails'
import AdminEmailCreatorIA from './AdminEmailCreatorIA'
import AdminCommunicationCampaigns from './AdminCommunicationCampaigns'

// COMUNICAÇÃO — de 6 abas para 3: Campanhas, Automáticas, Histórico.
// "Templates de e-mail", "Criador com IA" e "Notificação avulsa" deixaram de ser
// áreas próprias e viraram FERRAMENTAS abertas de dentro de Campanhas.
// "Site & páginas" saiu daqui para Conteúdo → Site.
const TABS = [
  { id: 'campanhas', label: 'Campanhas', icon: Megaphone },
  { id: 'automaticas', label: 'Automáticas', icon: Repeat },
  { id: 'historico', label: 'Histórico', icon: History },
] as const

type Tab = typeof TABS[number]['id']
type Tool = null | 'notificacao' | 'templates' | 'ia'

const STORE = 'admin-comunicacao-tab'

export default function AdminAreaComunicacao({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem(STORE) ?? 'campanhas'
      // aliases antigos
      const map: Record<string, Tab> = { notificacoes: 'campanhas', emails: 'historico', templates: 'campanhas', 'criador-ia': 'campanhas', site: 'campanhas' }
      const resolved = map[saved] ?? saved
      return (TABS.find(t => t.id === resolved)?.id ?? 'campanhas') as Tab
    } catch { return 'campanhas' }
  })
  const [tool, setTool] = useState<Tool>(null)

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem(STORE, id) } catch { /* noop */ }
  }

  const toolTitle = tool === 'notificacao' ? 'Notificação avulsa' : tool === 'templates' ? 'Templates de e-mail' : 'Criar com IA'

  return (
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-kicker">Relacionamento</p>
          <h1 className="font-serif text-3xl text-forest-900">Comunicação</h1>
          <p className="admin-subtitle mt-1">Campanhas (e-mail e notificação), envios automáticos e histórico de entrega em uma área só.</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => setTool('notificacao')} className="admin-btn-secondary"><Bell className="w-4 h-4" /> Notificação avulsa</button>
          <button onClick={() => setTool('templates')} className="admin-btn-secondary"><FileText className="w-4 h-4" /> Templates</button>
          <button onClick={() => setTool('ia')} className="admin-btn-secondary"><Sparkles className="w-4 h-4" /> Criar com IA</button>
        </div>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Abas de Comunicação">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => switchTab(t.id)} className={`admin-tab ${tab === t.id ? 'is-active' : ''}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <section className="admin-card overflow-hidden flex-1 min-h-0">
        {tab === 'campanhas' && <AdminCommunicationCampaigns />}
        {tab === 'automaticas' && <AdminEmails initialTab="resumo" />}
        {tab === 'historico' && <AdminEmails initialTab="logs" />}
      </section>

      {tool && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40" role="dialog" aria-modal="true" aria-label={toolTitle}>
          <div className="mt-auto sm:m-auto w-full sm:max-w-4xl h-[90vh] sm:h-[85vh] bg-paper rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-line flex-shrink-0">
              <h2 className="font-serif text-lg text-forest-900">{toolTitle}</h2>
              <button onClick={() => setTool(null)} aria-label="Fechar" className="p-2 hover:bg-mint/40 rounded-lg"><X className="w-5 h-5 text-ink-soft" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {tool === 'notificacao' && <div className="p-4 sm:p-5"><AdminNotifications /></div>}
              {tool === 'templates' && <AdminEmails initialTab="templates" />}
              {tool === 'ia' && <AdminEmailCreatorIA />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
