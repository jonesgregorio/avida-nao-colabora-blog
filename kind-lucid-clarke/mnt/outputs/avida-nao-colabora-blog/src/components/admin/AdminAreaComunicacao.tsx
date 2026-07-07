import { useState } from 'react'
import { Bell, Zap, Calendar, Mail, FileText } from 'lucide-react'
import AdminNotifications from './AdminNotifications'
import AdminAutomated from './AdminAutomated'
import AdminScheduled from './AdminScheduled'
import AdminEmails from './AdminEmails'

// Abas de Automação de Conteúdo (sub-área)
const AUTO_TABS = [
  { id: 'automaticos',  label: 'Automáticos',  icon: Zap },
  { id: 'programados',  label: 'Programados',  icon: Calendar },
] as const

type AutoTab = typeof AUTO_TABS[number]['id']

// Abas do mockup (#comunicacao): Notificações / E-mails enviados / Templates / Campanhas
const TABS = [
  { id: 'notificacoes', label: 'Notificações',    icon: Bell },
  { id: 'emails',       label: 'E-mails enviados', icon: Mail },
  { id: 'templates',    label: 'Templates',        icon: FileText },
  { id: 'campanhas',    label: 'Campanhas',        icon: Zap },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  initialTab?: string
}

function AutomacaoConteudo() {
  const [autoTab, setAutoTab] = useState<AutoTab>(() => {
    try {
      return (localStorage.getItem('admin-automacao-tab') as AutoTab) ?? 'automaticos'
    } catch { return 'automaticos' }
  })

  function switchAutoTab(id: AutoTab) {
    setAutoTab(id)
    try { localStorage.setItem('admin-automacao-tab', id) } catch { /* noop */ }
  }

  return (
    <div>
      <div className="flex gap-2 px-6 pt-4 border-b border-line">
        {AUTO_TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => switchAutoTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t border-b-2 transition-colors whitespace-nowrap ${
                autoTab === t.id
                  ? 'border-forest-700 text-forest-900 font-medium'
                  : 'border-transparent text-ink-soft hover:text-forest-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>
      {autoTab === 'automaticos' && <AdminAutomated />}
      {autoTab === 'programados' && <AdminScheduled />}
    </div>
  )
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
        <p className="text-sm text-ink-soft mt-1">Envie notificações, acompanhe e-mails, templates e campanhas.</p>
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
        {tab === 'campanhas'    && <AutomacaoConteudo />}
      </div>
    </div>
  )
}
