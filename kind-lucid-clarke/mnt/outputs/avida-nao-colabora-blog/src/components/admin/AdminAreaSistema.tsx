import { useState } from 'react'
import { Activity, Plug, ClipboardList, Shield, Zap, Gauge, MapPin } from 'lucide-react'
import AdminSystemHealthFriendly from './AdminSystemHealthFriendly'
import AdminIntegrations from './AdminIntegrations'
import AdminLogs from './AdminLogs'
import AdminPermissions from './AdminPermissions'
import AdminAutomationsHealth from './AdminAutomationsHealth'
import AdminIdea1Rollout from './AdminIdea1Rollout'
import AdminInfraReference from './AdminInfraReference'

// Sistema — apenas abas FUNCIONAIS. "Integrações" mostra o status AO VIVO dos
// serviços (Supabase/Stripe/IA/e-mail/hospedagem) — não é mais texto fixo. A
// antiga aba "IA" (marketing estático, sem controle) foi removida.
// "Automações" mostra o status real de todos os cron jobs. A Saúde do sistema
// começa por uma leitura em linguagem de produto e mantém o diagnóstico técnico
// existente disponível como detalhe secundário, sem perder ferramentas de reparo.
// "Liberação" controla a entrada progressiva em superfícies proativas da Ideia 1
// sem alterar planos, assinaturas nem recursos contratados.
const TABS = [
  { id: 'saude', label: 'Saúde do sistema', icon: Activity },
  { id: 'automacoes', label: 'Automações', icon: Zap },
  { id: 'liberacao', label: 'Liberação', icon: Gauge },
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
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-forest-900">Sistema</h1>
        <p className="text-sm text-ink-soft mt-1">Monitore a saúde do produto, as automações, a liberação progressiva, as integrações, os logs de auditoria e as permissões.</p>
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
        {tab === 'saude' && <AdminSystemHealthFriendly />}
        {tab === 'automacoes' && <AdminAutomationsHealth />}
        {tab === 'liberacao' && <AdminIdea1Rollout />}
        {tab === 'integracoes' && <AdminIntegrations />}
        {tab === 'logs' && <AdminLogs />}
        {tab === 'permissoes' && <AdminPermissions />}
        {tab === 'infra' && <AdminInfraReference />}
      </div>
    </div>
  )
}
