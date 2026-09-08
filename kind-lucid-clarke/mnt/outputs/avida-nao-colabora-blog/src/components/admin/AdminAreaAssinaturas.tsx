import { useState } from 'react'
import { Ban, CreditCard, RefreshCcw, LayoutDashboard } from 'lucide-react'
import AdminCancellations from './AdminCancellations'
import AdminPlanosPage from './AdminPlanosPage'
import AdminPlanChanges from './AdminPlanChanges'
import AdminAssinaturasOverview from './AdminAssinaturasOverview'

// ASSINATURAS — a operação comercial da assinatura, separada do FINANCEIRO
// (que só analisa dinheiro). Junta o que antes eram as áreas "Planos e
// assinaturas" e "Cancelamentos" + a visão de "Alterações de plano".
const TABS = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'planos', label: 'Planos & benefícios', icon: CreditCard },
  { id: 'alteracoes', label: 'Alterações', icon: RefreshCcw },
  { id: 'cancelamentos', label: 'Cancelamentos', icon: Ban },
] as const

type Tab = typeof TABS[number]['id']
const STORE = 'admin-assinaturas-tab'

export default function AdminAreaAssinaturas({ initialTab, onViewUser }: { initialTab?: string; onViewUser?: (userId: string) => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem(STORE) ?? 'visao-geral'
      const map: Record<string, Tab> = { plans: 'planos', financial: 'planos' }
      const resolved = map[saved] ?? saved
      return (TABS.find(t => t.id === resolved)?.id ?? 'visao-geral') as Tab
    } catch { return 'visao-geral' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem(STORE, id) } catch { /* noop */ }
  }

  return (
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero">
        <p className="admin-kicker">Negócio</p>
        <h1 className="font-serif text-3xl text-forest-900">Assinaturas</h1>
        <p className="admin-subtitle mt-1">A operação comercial das assinaturas: cancelamentos, planos e benefícios, e o histórico de mudanças de plano. Os números de receita ficam em Financeiro.</p>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Abas de Assinaturas">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => switchTab(t.id)} className={`admin-tab ${tab === t.id ? 'is-active' : ''}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <section className="admin-card overflow-hidden flex-1 min-h-0">
        {tab === 'visao-geral' && <AdminAssinaturasOverview onGoTab={switchTab} />}
        {tab === 'cancelamentos' && <AdminCancellations />}
        {tab === 'planos' && <AdminPlanosPage />}
        {tab === 'alteracoes' && <AdminPlanChanges onOpenUser={onViewUser} />}
      </section>
    </div>
  )
}
