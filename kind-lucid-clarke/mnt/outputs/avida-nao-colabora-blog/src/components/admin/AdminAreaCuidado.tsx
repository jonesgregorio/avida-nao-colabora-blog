import { useState } from 'react'
import { NotebookPen, ClipboardList, FileText, CalendarCheck, MessageSquare, Sparkles, Database, HeartHandshake, Sprout } from 'lucide-react'
import AdminDiaryConfig from './AdminDiaryConfig'
import AdminQuestionnaires from './AdminQuestionnaires'
import AdminPDF from './AdminPDF'
import AdminSelfCareHub from './AdminSelfCareHub'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminPersonalization from './AdminPersonalization'
import AdminGardenManagement from './AdminGardenManagement'

// CUIDADO — reúne a jornada de cuidado e a gestão do ecossistema de jardins.
// Navegação em 2 níveis (grupo → aba) para reduzir fragmentação sem esconder
// funções operacionais importantes do admin.
const GROUPS = [
  { id: 'experiencia', label: 'Experiência do usuário', icon: Database },
  { id: 'entregas', label: 'Entregas', icon: HeartHandshake },
  { id: 'inteligencia', label: 'Inteligência', icon: Sparkles },
] as const
type Group = typeof GROUPS[number]['id']

const TABS = [
  { id: 'diario', label: 'Diário & Check-ins', icon: NotebookPen, group: 'experiencia' },
  { id: 'questionarios', label: 'Questionários', icon: ClipboardList, group: 'experiencia' },
  { id: 'relatorios', label: 'Relatórios', icon: FileText, group: 'entregas' },
  { id: 'autocuidado', label: 'Autocuidado', icon: CalendarCheck, group: 'entregas' },
  { id: 'orientacoes', label: 'Orientações', icon: MessageSquare, group: 'entregas' },
  { id: 'recomendacoes', label: 'Recomendações', icon: Sparkles, group: 'inteligencia' },
  { id: 'jardins', label: 'Jardins', icon: Sprout, group: 'experiencia' },
] as const

type Tab = typeof TABS[number]['id']
const STORE = 'admin-cuidado-tab'
const DEFAULT_TAB: Tab = 'diario'

function isTab(v: string): v is Tab { return TABS.some(t => t.id === v) }
function groupForTab(tab: Tab): Group { return TABS.find(t => t.id === tab)?.group ?? 'experiencia' }
function firstTabOfGroup(group: Group): Tab { return TABS.find(t => t.group === group)?.id ?? DEFAULT_TAB }

export default function AdminAreaCuidado({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem(STORE) ?? DEFAULT_TAB
      return isTab(saved) ? saved : DEFAULT_TAB
    } catch { return DEFAULT_TAB }
  })

  const activeGroup = groupForTab(tab)
  const activeGroupLabel = GROUPS.find(g => g.id === activeGroup)?.label ?? 'Cuidado'
  const groupTabs = TABS.filter(t => t.group === activeGroup)

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem(STORE, id) } catch { /* noop */ }
  }
  function switchGroup(group: Group) {
    if (group === activeGroup) return
    switchTab(firstTabOfGroup(group))
  }

  return (
    <div className="admin-page-pad flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero">
        <p className="admin-kicker">Cuidado</p>
        <h1 className="font-serif text-3xl text-forest-900">Cuidado</h1>
        <p className="admin-subtitle mt-1">
          Acompanhe a experiência do usuário, as entregas de cuidado e a inteligência de personalização em três blocos claros.
        </p>
      </section>

      <div className="admin-tabs-wrap sticky top-20 z-10">
        <nav className="admin-tabs" aria-label="Grupos de Cuidado">
          {GROUPS.map(g => {
            const Icon = g.icon
            const selected = activeGroup === g.id
            return (
              <button key={g.id} type="button" aria-pressed={selected} onClick={() => switchGroup(g.id)} className={`admin-tab ${selected ? 'is-active' : ''}`}>
                <Icon className="w-4 h-4" />
                {g.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="admin-toolbar" role="navigation" aria-label={`Opções de ${activeGroupLabel}`}>
        {groupTabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`admin-btn-secondary ${tab === t.id ? '!bg-[#123528] !text-white !border-[#123528]' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <section className="admin-card overflow-hidden flex-1 min-h-0">
        {tab === 'diario' && <AdminDiaryConfig />}
        {tab === 'questionarios' && <AdminQuestionnaires />}
        {tab === 'relatorios' && <AdminPDF />}
        {tab === 'autocuidado' && <AdminSelfCareHub />}
        {tab === 'orientacoes' && <AdminGuidanceRequests />}
        {tab === 'recomendacoes' && <AdminPersonalization />}
        {tab === 'jardins' && <AdminGardenManagement />}
      </section>
    </div>
  )
}
