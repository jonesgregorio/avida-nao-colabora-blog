import { useState } from 'react'
import { NotebookPen, ClipboardList, FileText, CalendarCheck, MessageSquare, Sparkles } from 'lucide-react'
import AdminDiaryConfig from './AdminDiaryConfig'
import AdminQuestionnaires from './AdminQuestionnaires'
import AdminPDF from './AdminPDF'
import AdminMonthlyCarePlans from './AdminMonthlyCarePlans'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminPersonalization from './AdminPersonalization'

// CUIDADO — reúne o que antes eram DUAS áreas ("Diário e mapa emocional" +
// "IA Emocional"). Mesmo domínio, uma área só. O monitoramento técnico de IA
// (antiga "Central de IA") saiu daqui para Sistema → Monitoramento → IA.
const TABS = [
  { id: 'diario', label: 'Diário & Check-ins', icon: NotebookPen },
  { id: 'questionarios', label: 'Questionários', icon: ClipboardList },
  { id: 'relatorios', label: 'Relatórios & PDFs', icon: FileText },
  { id: 'autocuidado', label: 'Autocuidado', icon: CalendarCheck },
  { id: 'orientacoes', label: 'Orientações', icon: MessageSquare },
  { id: 'recomendacoes', label: 'Recomendações', icon: Sparkles },
] as const

type Tab = typeof TABS[number]['id']
const STORE = 'admin-cuidado-tab'

export default function AdminAreaCuidado({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem(STORE) ?? 'diario'
      return (TABS.find(t => t.id === saved)?.id ?? 'diario') as Tab
    } catch { return 'diario' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem(STORE, id) } catch { /* noop */ }
  }

  return (
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero">
        <p className="admin-kicker">Cuidado</p>
        <h1 className="font-serif text-3xl text-forest-900">Cuidado</h1>
        <p className="admin-subtitle mt-1">
          Diário, mapa emocional, questionários, relatórios, planos de autocuidado, orientações e recomendações — tudo o que sustenta a jornada de cuidado do usuário, com revisão humana antes de qualquer entrega.
        </p>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Abas de Cuidado">
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
        {tab === 'diario' && <AdminDiaryConfig />}
        {tab === 'questionarios' && <AdminQuestionnaires />}
        {tab === 'relatorios' && <AdminPDF />}
        {tab === 'autocuidado' && <AdminMonthlyCarePlans />}
        {tab === 'orientacoes' && <AdminGuidanceRequests />}
        {tab === 'recomendacoes' && <AdminPersonalization />}
      </section>
    </div>
  )
}
