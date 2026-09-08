import { useState } from 'react'
import { ClipboardList, FileText, Settings2 } from 'lucide-react'
import AdminQuestionnaires from './AdminQuestionnaires'
import AdminDiaryConfig from './AdminDiaryConfig'
import AdminPDF from './AdminPDF'

const TABS = [
  { id: 'questionarios', label: 'Questionários', icon: ClipboardList },
  { id: 'relatorios', label: 'Relatórios e PDFs', icon: FileText },
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
    <div className="admin-page-pad max-w-[1600px] mx-auto w-full space-y-5">
      <section className="admin-page-hero">
        <div>
          <span className="admin-eyebrow">Cuidado</span>
          <h1>Diário e mapa emocional</h1>
          <p>Gerencie questionários, relatórios e configurações que sustentam a leitura da jornada emocional dos usuários.</p>
        </div>
      </section>

      <section className="admin-section-frame overflow-hidden">
        <div className="admin-tabs-wrap">
          <nav className="admin-pills" aria-label="Abas do Diário e mapa emocional">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`admin-pill ${tab === t.id ? 'is-active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="admin-tab-content">
          {tab === 'questionarios' && <AdminQuestionnaires />}
          {tab === 'relatorios' && <AdminPDF />}
          {tab === 'configuracoes' && <AdminDiaryConfig />}
        </div>
      </section>
    </div>
  )
}
