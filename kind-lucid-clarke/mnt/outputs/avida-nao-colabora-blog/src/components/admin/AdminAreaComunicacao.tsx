import { useState } from 'react'
import { Bell, Mail, FileText, Sparkles, LayoutTemplate, Megaphone } from 'lucide-react'
import AdminNotifications from './AdminNotifications'
import AdminEmails from './AdminEmails'
import AdminEmailCreatorIA from './AdminEmailCreatorIA'
import AdminSiteContent from './AdminSiteContent'
import AdminCommunicationCampaigns from './AdminCommunicationCampaigns'

const TABS = [
  { id: 'campanhas',     label: 'Campanhas',           icon: Megaphone },
  { id: 'notificacoes',  label: 'Notificações',        icon: Bell },
  { id: 'emails',        label: 'E-mails enviados',     icon: Mail },
  { id: 'templates',     label: 'Templates de e-mail',  icon: FileText },
  { id: 'criador-ia',    label: 'Criador com IA',       icon: Sparkles },
  { id: 'site',          label: 'Site & páginas',        icon: LayoutTemplate },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  initialTab?: string
}

export default function AdminAreaComunicacao({ initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-comunicacao-tab') ?? 'campanhas'
      return (TABS.find(t => t.id === saved)?.id ?? 'campanhas') as Tab
    } catch { return 'campanhas' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-comunicacao-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-kicker">Relacionamento</p>
          <h1 className="font-serif text-3xl text-forest-900">Comunicação</h1>
          <p className="admin-subtitle mt-1">Centralize campanhas, notificações, e-mails, templates e criação assistida em uma única área.</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => switchTab('campanhas')} className="admin-btn-primary"><Megaphone className="w-4 h-4" /> Nova campanha</button>
          <button onClick={() => switchTab('notificacoes')} className="admin-btn-secondary"><Bell className="w-4 h-4" /> Notificações</button>
        </div>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Abas de Comunicação">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`admin-tab ${tab === t.id ? 'is-active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <section className="admin-card overflow-hidden flex-1 min-h-0">
        {tab === 'campanhas'    && <AdminCommunicationCampaigns />}
        {tab === 'notificacoes' && <AdminNotifications />}
        {tab === 'emails'       && <AdminEmails initialTab="logs" />}
        {tab === 'templates'    && <AdminEmails initialTab="templates" />}
        {tab === 'criador-ia'   && <AdminEmailCreatorIA />}
        {tab === 'site'         && <div className="p-5 sm:p-6"><AdminSiteContent /></div>}
      </section>
    </div>
  )
}
