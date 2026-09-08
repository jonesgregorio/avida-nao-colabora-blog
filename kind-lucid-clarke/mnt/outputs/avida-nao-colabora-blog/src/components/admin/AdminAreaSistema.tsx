import { useState } from 'react'
import { Activity, Plug, ClipboardList, Shield, Zap, Gauge, MapPin, ListChecks, ToggleRight } from 'lucide-react'
import AdminSystemHealthFriendly from './AdminSystemHealthFriendly'
import AdminQueuesFailures from './AdminQueuesFailures'
import AdminIntegrations from './AdminIntegrations'
import AdminLogs from './AdminLogs'
import AdminPermissions from './AdminPermissions'
import AdminAutomationsHealth from './AdminAutomationsHealth'
import AdminIdea1Rollout from './AdminIdea1Rollout'
import AdminFeatureFlags from './AdminFeatureFlags'
import AdminInfraReference from './AdminInfraReference'

const TABS = [
  { id: 'saude', label: 'Saúde do sistema', icon: Activity },
  { id: 'filas', label: 'Filas e falhas', icon: ListChecks },
  { id: 'automacoes', label: 'Automações', icon: Zap },
  { id: 'liberacao', label: 'Liberação', icon: Gauge },
  { id: 'flags', label: 'Funcionalidades', icon: ToggleRight },
  { id: 'integracoes', label: 'Integrações', icon: Plug },
  { id: 'logs', label: 'Logs de auditoria', icon: ClipboardList },
  { id: 'permissoes', label: 'Permissões', icon: Shield },
  { id: 'infra', label: 'Infra & externas', icon: MapPin },
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
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-kicker">Operação e governança</p>
          <h1 className="font-serif text-3xl text-forest-900">Sistema</h1>
          <p className="admin-subtitle mt-1">Acompanhe saúde, filas, automações, integrações, auditoria, permissões e liberações progressivas do produto.</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => switchTab('saude')} className="admin-btn-primary"><Activity className="w-4 h-4" /> Ver saúde</button>
          <button onClick={() => switchTab('automacoes')} className="admin-btn-secondary"><Zap className="w-4 h-4" /> Automações</button>
        </div>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Abas do Sistema">
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
        {tab === 'saude' && <AdminSystemHealthFriendly />}
        {tab === 'filas' && <AdminQueuesFailures />}
        {tab === 'automacoes' && <AdminAutomationsHealth />}
        {tab === 'liberacao' && <AdminIdea1Rollout />}
        {tab === 'flags' && <AdminFeatureFlags />}
        {tab === 'integracoes' && <AdminIntegrations />}
        {tab === 'logs' && <AdminLogs />}
        {tab === 'permissoes' && <AdminPermissions />}
        {tab === 'infra' && <AdminInfraReference />}
      </section>
    </div>
  )
}
