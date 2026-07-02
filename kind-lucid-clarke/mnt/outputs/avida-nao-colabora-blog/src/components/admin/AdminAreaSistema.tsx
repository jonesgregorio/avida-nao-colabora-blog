import { useState } from 'react'
import { Activity, ClipboardList } from 'lucide-react'
import AdminSystemHealth from './AdminSystemHealth'
import AdminLogs from './AdminLogs'

const TABS = [
  { id: 'saude', label: 'Saúde do Sistema', icon: Activity },
  { id: 'logs',  label: 'Logs',             icon: ClipboardList },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  initialTab?: string
}

export default function AdminAreaSistema({ initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-sistema-tab') ?? 'saude'
      return (TABS.find(t => t.id === saved)?.id ?? 'saude') as Tab
    } catch { return 'saude' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-sistema-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas do Sistema">
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
        {tab === 'saude' && <AdminSystemHealth />}
        {tab === 'logs'  && <AdminLogs />}
      </div>
    </div>
  )
}
