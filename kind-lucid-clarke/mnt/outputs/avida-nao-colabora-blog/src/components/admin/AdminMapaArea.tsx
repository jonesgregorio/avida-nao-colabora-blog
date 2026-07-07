import { useState } from 'react'
import { ClipboardList, Activity, FileText, BarChart2, Settings2 } from 'lucide-react'
import AdminQuestionnaires from './AdminQuestionnaires'
import AdminDiaryConfig from './AdminDiaryConfig'
import AdminPDF from './AdminPDF'

// Diário e mapa emocional — abas do mockup: Questionários / Marcadores / Relatórios / Gráficos / Configurações
const TABS = [
  { id: 'questionarios', label: 'Questionários', icon: ClipboardList },
  { id: 'marcadores', label: 'Marcadores emocionais', icon: Activity },
  { id: 'relatorios', label: 'Relatórios', icon: FileText },
  { id: 'graficos', label: 'Gráficos', icon: BarChart2 },
  { id: 'configuracoes', label: 'Configurações', icon: Settings2 },
] as const

type Tab = typeof TABS[number]['id']

export default function AdminMapaArea() {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const s = localStorage.getItem('admin-mapa-tab') ?? 'questionarios'
      return (TABS.find(t => t.id === s)?.id ?? 'questionarios') as Tab
    } catch { return 'questionarios' }
  })
  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-mapa-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas do Diário e mapa emocional">
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
        {tab === 'questionarios' && <AdminQuestionnaires />}
        {tab === 'relatorios' && <AdminPDF />}
        {tab === 'configuracoes' && <AdminDiaryConfig />}
        {(tab === 'marcadores' || tab === 'graficos') && (
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="p-12 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
              <p className="text-ink-soft text-sm">
                {tab === 'marcadores'
                  ? 'Marcadores emocionais (sono, energia, ansiedade, sobrecarga, relações, rotina) — em construção.'
                  : 'Gráficos do mapa emocional — em construção.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
