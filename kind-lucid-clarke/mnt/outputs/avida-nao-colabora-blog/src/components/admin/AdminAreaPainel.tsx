import { useState } from 'react'
import { LayoutDashboard, BarChart2, Activity } from 'lucide-react'
import type { AdminView } from './types'
import AdminDashboard from './AdminDashboard'
import AdminAnalytics from './AdminAnalytics'
import AdminSystemHealth from './AdminSystemHealth'

const TABS = [
  { id: 'visao-geral', label: 'Visão Geral',       icon: LayoutDashboard },
  { id: 'metricas',    label: 'Métricas',           icon: BarChart2 },
  { id: 'saude',       label: 'Saúde do Sistema',   icon: Activity },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  onNavigate: (v: AdminView) => void
  initialTab?: string
}

export default function AdminAreaPainel({ onNavigate, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-painel-tab') ?? 'visao-geral'
      return (TABS.find(t => t.id === saved)?.id ?? 'visao-geral') as Tab
    } catch { return 'visao-geral' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-painel-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas do Painel">
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
        {tab === 'visao-geral' && <AdminDashboard onNavigate={onNavigate} />}
        {tab === 'metricas'    && <AdminAnalytics />}
        {tab === 'saude'       && <AdminSystemHealth />}
      </div>
    </div>
  )
}
