import { useState } from 'react'
import { Users, CreditCard, DollarSign, FileOutput, Shield, ClipboardList, Box } from 'lucide-react'
import AdminUsers from './AdminUsers'
import AdminPlans from './AdminPlans'
import AdminFinancial from './AdminFinancial'
import AdminPDF from './AdminPDF'
import AdminPermissions from './AdminPermissions'
import AdminDiaryConfig from './AdminDiaryConfig'
import AdminSavedItems from './AdminSavedItems'

const TABS = [
  { id: 'usuarios',    label: 'Usuários',        icon: Users },
  { id: 'planos',      label: 'Planos',          icon: CreditCard },
  { id: 'financeiro',  label: 'Financeiro',      icon: DollarSign },
  { id: 'relatorios',  label: 'Relatórios/PDF',  icon: FileOutput },
  { id: 'permissoes',  label: 'Permissões',      icon: Shield },
  { id: 'diario',      label: 'Regras do Diário',icon: ClipboardList },
  { id: 'itens-salvos',label: 'Itens Salvos',    icon: Box },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  initialTab?: string
}

export default function AdminAreaUsuariosPlanos({ initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-usuarios-tab') ?? 'usuarios'
      return (TABS.find(t => t.id === saved)?.id ?? 'usuarios') as Tab
    } catch { return 'usuarios' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-usuarios-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Usuários e Planos">
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
        {tab === 'usuarios'     && <AdminUsers />}
        {tab === 'planos'       && <AdminPlans />}
        {tab === 'financeiro'   && <AdminFinancial />}
        {tab === 'relatorios'   && <AdminPDF />}
        {tab === 'permissoes'   && <AdminPermissions />}
        {tab === 'diario'       && <AdminDiaryConfig />}
        {tab === 'itens-salvos' && <AdminSavedItems />}
      </div>
    </div>
  )
}
