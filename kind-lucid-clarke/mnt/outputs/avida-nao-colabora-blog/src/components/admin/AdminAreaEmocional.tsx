import { useState } from 'react'
import { CalendarCheck, MessageSquare, Sparkles, Activity } from 'lucide-react'
import AdminMonthlyCarePlans from './AdminMonthlyCarePlans'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminPersonalization from './AdminPersonalization'
import AdminAIUsage from './AdminAIUsage'

// IA Emocional — consolida as entregas de IA da jornada emocional num só lugar:
// Planos de Autocuidado (fila com revisão humana obrigatória), Orientação por
// mensagem (pedidos + respostas com rascunho de IA), Recomendações IA (fila de
// conteúdo personalizado) e a Central de IA (logs de toda geração, editorial +
// emocional, com filtro). AdminAIUsage deixou de ter uma segunda entrada
// dentro de Conteúdo & IA — só existe aqui agora, e um link em Conteúdo & IA
// traz o admin direto pra esta aba.
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
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-forest-900">IA Emocional</h1>
        <p className="text-sm text-ink-soft mt-1">Planos de autocuidado, orientação por mensagem e recomendações geradas por IA — sempre com revisão humana antes de qualquer envio.</p>
      </div>
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de IA Emocional">
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
        {tab === 'planos'        && <AdminMonthlyCarePlans />}
        {tab === 'mensagem'      && <AdminGuidanceRequests />}
        {tab === 'recomendacoes' && <AdminPersonalization />}
        {tab === 'uso-ia'        && <AdminAIUsage />}
      </div>
    </div>
  )
}
