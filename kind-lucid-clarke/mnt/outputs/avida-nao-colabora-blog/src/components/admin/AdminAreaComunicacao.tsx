import { useState } from 'react'
import { Bell, Zap, Calendar } from 'lucide-react'
import AdminNotifications from './AdminNotifications'
import AdminAutomated from './AdminAutomated'
import AdminScheduled from './AdminScheduled'

// Abas de Automação de Conteúdo (sub-área)
const AUTO_TABS = [
  { id: 'automaticos',  label: 'Automáticos',  icon: Zap },
  { id: 'programados',  label: 'Programados',  icon: Calendar },
] as const

type AutoTab = typeof AUTO_TABS[number]['id']

const TABS = [
  { id: 'notificacoes', label: 'Notificações',          icon: Bell },
  { id: 'automaticos',  label: 'Automação de Conteúdo', icon: Zap },
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
      <div className="flex gap-2 px-6 pt-4 border-b border-stone-100">
        {AUTO_TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => switchAutoTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t border-b-2 transition-colors whitespace-nowrap ${
                autoTab === t.id
                  ? 'border-emerald-500 text-emerald-700 font-medium'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
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
      <div className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Comunicação">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
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
        {tab === 'automaticos'  && <AutomacaoConteudo />}
      </div>
    </div>
  )
}
