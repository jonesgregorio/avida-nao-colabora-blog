import { useState } from 'react'
import { CalendarCheck, MessageSquare, Sparkles, Activity } from 'lucide-react'
import AdminMonthlyCarePlans from './AdminMonthlyCarePlans'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminPersonalization from './AdminPersonalization'
import AdminAIUsage from './AdminAIUsage'

const TABS = [
  { id: 'planos',        label: 'Planos de Autocuidado',    icon: CalendarCheck },
  { id: 'mensagem',      label: 'Orientação por mensagem',  icon: MessageSquare },
  { id: 'recomendacoes', label: 'Recomendações IA',         icon: Sparkles },
  { id: 'uso-ia',        label: 'Central de IA',            icon: Activity },
] as const

type Tab = typeof TABS[number]['id']

export default function AdminAreaEmocional({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-emocional-tab') ?? 'planos'
      return (TABS.find(t => t.id === saved)?.id ?? 'planos') as Tab
    } catch { return 'planos' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-emocional-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-kicker">Cuidado assistido por tecnologia</p>
          <h1 className="font-serif text-3xl text-forest-900">IA Emocional</h1>
          <p className="admin-subtitle mt-1">Planos de autocuidado, orientação e recomendações reunidos em uma área mais clara, com revisão humana antes de qualquer entrega.</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => switchTab('planos')} className="admin-btn-primary"><CalendarCheck className="w-4 h-4" /> Autocuidado</button>
          <button onClick={() => switchTab('uso-ia')} className="admin-btn-secondary"><Activity className="w-4 h-4" /> Central de IA</button>
        </div>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Abas de IA Emocional">
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
        {tab === 'planos'        && <AdminMonthlyCarePlans />}
        {tab === 'mensagem'      && <AdminGuidanceRequests />}
        {tab === 'recomendacoes' && <AdminPersonalization />}
        {tab === 'uso-ia'        && <AdminAIUsage />}
      </section>
    </div>
  )
}
