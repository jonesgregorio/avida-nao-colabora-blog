import { useState } from 'react'
import { Sparkles, HeadphonesIcon, MessageSquare, Star, Leaf, Briefcase } from 'lucide-react'
import AdminPersonalization from './AdminPersonalization'
import AdminSupport from './AdminSupport'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminProfessionalComments from './AdminProfessionalComments'
import AdminSelfCarePlans from './AdminSelfCarePlans'
import AdminProfessionals from './AdminProfessionals'

const TABS = [
  { id: 'fila',        label: 'Fila de Pendências',       icon: Sparkles },
  { id: 'suporte',     label: 'Suporte',                  icon: HeadphonesIcon },
  { id: 'orientacoes', label: 'Orientação profissional',  icon: MessageSquare },
  { id: 'comentarios', label: 'Comentário profissional',  icon: Star },
  { id: 'autocuidado', label: 'Planos de Autocuidado',    icon: Leaf },
  { id: 'equipe',      label: 'Equipe Profissional',      icon: Briefcase },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  initialTab?: string
}

export default function AdminAreaAtendimento({ initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-atendimento-tab') ?? 'fila'
      return (TABS.find(t => t.id === saved)?.id ?? 'fila') as Tab
    } catch { return 'fila' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-atendimento-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Atendimento">
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
        {tab === 'fila'        && <AdminPersonalization />}
        {tab === 'suporte'     && <AdminSupport />}
        {tab === 'orientacoes' && <AdminGuidanceRequests />}
        {tab === 'comentarios' && <AdminProfessionalComments />}
        {tab === 'autocuidado' && <AdminSelfCarePlans />}
        {tab === 'equipe'      && <AdminProfessionals />}
      </div>
    </div>
  )
}
