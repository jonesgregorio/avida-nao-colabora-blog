import { useState } from 'react'
import { Sparkles, HeadphonesIcon, MessageSquare, Video, Star, Leaf, Briefcase } from 'lucide-react'
import AdminPersonalization from './AdminPersonalization'
import AdminSupport from './AdminSupport'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminEvolutionSessions from './AdminEvolutionSessions'
import AdminProfessionalComments from './AdminProfessionalComments'
import AdminSelfCarePlans from './AdminSelfCarePlans'
import AdminProfessionals from './AdminProfessionals'

const TABS = [
  { id: 'fila',        label: 'Fila de Pendências',       icon: Sparkles },
  { id: 'suporte',     label: 'Suporte',                  icon: HeadphonesIcon },
  { id: 'orientacoes', label: 'Orientações',              icon: MessageSquare },
  { id: 'sessoes',     label: 'Sessões Plus',             icon: Video },
  { id: 'comentarios', label: 'Comentários Profissionais',icon: Star },
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
      <div className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Atendimento">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
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
        {tab === 'sessoes'     && <AdminEvolutionSessions />}
        {tab === 'comentarios' && <AdminProfessionalComments />}
        {tab === 'autocuidado' && <AdminSelfCarePlans />}
        {tab === 'equipe'      && <AdminProfessionals />}
      </div>
    </div>
  )
}
