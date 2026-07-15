import { useState } from 'react'
import { Bell, Mail, FileText } from 'lucide-react'
import AdminNotifications from './AdminNotifications'
import AdminEmails from './AdminEmails'

// Comunicação — apenas os canais de mensagem: notificações in-app + e-mails
// (enviados e templates). "Conteúdos automáticos" (Automáticos/Programados)
// migraram para a área "Conteúdo & IA".
const TABS = [
  { id: 'notificacoes', label: 'Notificações',        icon: Bell },
  { id: 'emails',       label: 'E-mails enviados',     icon: Mail },
  { id: 'templates',    label: 'Templates de e-mail',  icon: FileText },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  initialTab?: string
}

export default function AdminAreaComunicacao({ initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-comunicacao-tab') ?? 'notificacoes'
      return (TABS.find(t => t.id === saved)?.id ?? 'notificacoes') as Tab
    } catch { return 'notificacoes' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-comunicacao-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-forest-900">Comunicação</h1>
        <p className="text-sm text-ink-soft mt-1">Notificações in-app, e-mails enviados e templates de e-mail.</p>
      </div>
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Comunicação">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-forest-700 text-forest-900'
                    : 'border-transparent text-ink-soft hover:text-forest-900 hover:border-line'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="flex-1">
        {tab === 'notificacoes' && <AdminNotifications />}
        {tab === 'emails'       && <AdminEmails initialTab="logs" />}
        {tab === 'templates'    && <AdminEmails initialTab="templates" />}
      </div>
    </div>
  )
}
