import { useState } from 'react'
import { Activity, Plug, ClipboardList, Shield } from 'lucide-react'
import AdminSystemHealth from './AdminSystemHealth'
import AdminIntegrations from './AdminIntegrations'
import AdminLogs from './AdminLogs'
import AdminPermissions from './AdminPermissions'

// Sistema — apenas abas FUNCIONAIS. "Integrações" mostra o status AO VIVO dos
// serviços (Supabase/Stripe/IA/e-mail/hospedagem) — não é mais texto fixo. A
// antiga aba "IA" (marketing estático, sem controle) foi removida.
const TABS = [
  { id: 'saude', label: 'Saúde do sistema', icon: Activity },
  { id: 'integracoes', label: 'Integrações', icon: Plug },
  { id: 'logs', label: 'Logs de auditoria', icon: ClipboardList },
  { id: 'permissoes', label: 'Permissões', icon: Shield },
] as const

type Tab = typeof TABS[number]['id']

export default function AdminAreaSistema({ initialTab }: { initialTab?: string }) {
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
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-forest-900">Sistema</h1>
        <p className="text-sm text-ink-soft mt-1">Monitore a saúde do sistema, as integrações, os logs de auditoria e as permissões de plano.</p>
      </div>
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas do Sistema">
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
        {tab === 'saude' && <AdminSystemHealth />}
        {tab === 'integracoes' && <AdminIntegrations />}
        {tab === 'logs' && <AdminLogs />}
        {tab === 'permissoes' && <AdminPermissions />}
      </div>
    </div>
  )
}
