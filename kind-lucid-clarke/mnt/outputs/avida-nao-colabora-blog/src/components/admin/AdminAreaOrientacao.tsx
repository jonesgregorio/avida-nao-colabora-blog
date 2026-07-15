import { useState } from 'react'
import { MessageSquare, Sparkles } from 'lucide-react'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminPersonalization from './AdminPersonalization'

// Orientação profissional — ações por usuário:
//   • Orientação por mensagem (pedidos e respostas do ciclo)
//   • Recomendações IA (fila de entregas personalizadas) — migrou de Conteúdos,
//     pois trata de conteúdo enviado a UM usuário específico, não do catálogo.
const TABS = [
  { id: 'mensagem',      label: 'Orientação por mensagem', icon: MessageSquare },
  { id: 'recomendacoes', label: 'Recomendações IA',        icon: Sparkles },
] as const

type Tab = typeof TABS[number]['id']

export default function AdminAreaOrientacao({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-orientacao-tab') ?? 'mensagem'
      return (TABS.find(t => t.id === saved)?.id ?? 'mensagem') as Tab
    } catch { return 'mensagem' }
  })
  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-orientacao-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <h1 className="font-serif text-3xl text-forest-900">Orientação profissional</h1>
        <p className="text-sm text-ink-soft mt-1">Responda às orientações por mensagem e gerencie as recomendações personalizadas por IA.</p>
      </div>
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Orientação">
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
        {tab === 'mensagem'      && <AdminGuidanceRequests />}
        {tab === 'recomendacoes' && <AdminPersonalization />}
      </div>
    </div>
  )
}
