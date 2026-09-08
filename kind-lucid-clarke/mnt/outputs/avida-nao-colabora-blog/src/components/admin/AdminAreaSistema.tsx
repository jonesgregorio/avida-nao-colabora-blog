import { useState, type ComponentType } from 'react'
import { Activity, Plug, ClipboardList, Shield, Gauge } from 'lucide-react'
import AdminSystemHealthFriendly from './AdminSystemHealthFriendly'
import AdminQueuesFailures from './AdminQueuesFailures'
import AdminIntegrations from './AdminIntegrations'
import AdminLogs from './AdminLogs'
import AdminPermissions from './AdminPermissions'
import AdminAutomationsHealth from './AdminAutomationsHealth'
import AdminIdea1Rollout from './AdminIdea1Rollout'
import AdminFeatureFlags from './AdminFeatureFlags'
import AdminInfraReference from './AdminInfraReference'
import AdminAIUsage from './AdminAIUsage'

// SISTEMA — de 9 abas soltas para 5 áreas. Nada foi removido: "Saúde", "Filas",
// "Automações" e a antiga "Central de IA" (que estava em Cuidado) viraram
// subseções de Monitoramento; "Infra & externas" entrou em Integrações;
// "Liberação" + "Funcionalidades" viraram Recursos.
type Sub = { id: string; label: string; Component: ComponentType }

const AREAS: { id: string; label: string; icon: typeof Activity; subs: Sub[] }[] = [
  { id: 'monitoramento', label: 'Monitoramento', icon: Activity, subs: [
    { id: 'saude', label: 'Saúde do sistema', Component: AdminSystemHealthFriendly },
    { id: 'filas', label: 'Filas e falhas', Component: AdminQueuesFailures },
    { id: 'automacoes', label: 'Automações', Component: AdminAutomationsHealth },
    { id: 'ia', label: 'IA — uso e falhas', Component: AdminAIUsage },
  ]},
  { id: 'integracoes', label: 'Integrações', icon: Plug, subs: [
    { id: 'servicos', label: 'Serviços conectados', Component: AdminIntegrations },
    { id: 'infra', label: 'Infra & externas', Component: AdminInfraReference },
  ]},
  { id: 'recursos', label: 'Recursos', icon: Gauge, subs: [
    { id: 'liberacao', label: 'Liberação progressiva', Component: AdminIdea1Rollout },
    { id: 'flags', label: 'Feature flags', Component: AdminFeatureFlags },
  ]},
  { id: 'administradores', label: 'Administradores', icon: Shield, subs: [
    { id: 'permissoes', label: 'Papéis e permissões', Component: AdminPermissions },
  ]},
  { id: 'auditoria', label: 'Auditoria', icon: ClipboardList, subs: [
    { id: 'logs', label: 'Registro de ações', Component: AdminLogs },
  ]},
]

const STORE = 'admin-sistema-tab'
const ALL_SUBS = AREAS.flatMap(a => a.subs.map(s => ({ areaId: a.id, subId: s.id })))

export default function AdminAreaSistema({ initialTab }: { initialTab?: string }) {
  const initial = (() => {
    try {
      const saved = initialTab ?? localStorage.getItem(STORE) ?? 'monitoramento'
      const asArea = AREAS.find(a => a.id === saved)
      if (asArea) return { areaId: asArea.id, subId: asArea.subs[0].id }
      const asSub = ALL_SUBS.find(x => x.subId === saved)
      if (asSub) return asSub
    } catch { /* noop */ }
    return { areaId: 'monitoramento', subId: 'saude' }
  })()

  const [areaId, setAreaId] = useState(initial.areaId)
  const [subId, setSubId] = useState(initial.subId)

  const area = AREAS.find(a => a.id === areaId) ?? AREAS[0]
  const sub = area.subs.find(s => s.id === subId) ?? area.subs[0]
  const Body = sub.Component

  function switchArea(id: string) {
    const a = AREAS.find(x => x.id === id) ?? AREAS[0]
    setAreaId(a.id); setSubId(a.subs[0].id)
    try { localStorage.setItem(STORE, a.id) } catch { /* noop */ }
  }
  function switchSub(id: string) {
    setSubId(id)
    try { localStorage.setItem(STORE, id) } catch { /* noop */ }
  }

  return (
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero">
        <p className="admin-kicker">Operação e governança</p>
        <h1 className="font-serif text-3xl text-forest-900">Sistema</h1>
        <p className="admin-subtitle mt-1">Monitoramento, integrações, controle de recursos, administradores e auditoria.</p>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Áreas do Sistema">
          {AREAS.map(a => {
            const Icon = a.icon
            return (
              <button key={a.id} onClick={() => switchArea(a.id)} className={`admin-tab ${areaId === a.id ? 'is-active' : ''}`}>
                <Icon className="w-4 h-4" />
                {a.label}
              </button>
            )
          })}
        </nav>
      </div>

      {area.subs.length > 1 && (
        <nav className="flex flex-wrap gap-1.5 px-0.5" aria-label={`Seções de ${area.label}`}>
          {area.subs.map(s => (
            <button
              key={s.id}
              onClick={() => switchSub(s.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${sub.id === s.id ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-line hover:border-forest-300'}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}

      <section className="admin-card overflow-hidden flex-1 min-h-0">
        <Body />
      </section>
    </div>
  )
}
