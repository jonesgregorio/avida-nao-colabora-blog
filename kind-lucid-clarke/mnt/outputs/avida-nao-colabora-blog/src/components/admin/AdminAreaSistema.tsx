import { useState } from 'react'
import { Activity, ClipboardList, Plug, Cpu, Shield } from 'lucide-react'
import AdminSystemHealth from './AdminSystemHealth'
import AdminLogs from './AdminLogs'
import AdminPermissions from './AdminPermissions'

// Sistema — abas do mockup: Saúde / Logs / Integrações / IA / Permissões
const TABS = [
  { id: 'saude', label: 'Saúde do sistema', icon: Activity },
  { id: 'logs', label: 'Logs de auditoria', icon: ClipboardList },
  { id: 'integracoes', label: 'Integrações', icon: Plug },
  { id: 'ia', label: 'IA', icon: Cpu },
  { id: 'permissoes', label: 'Permissões', icon: Shield },
] as const

type Tab = typeof TABS[number]['id']

function Integracoes() {
  const items = [
    { name: 'Stripe', desc: 'Webhook configurado. Pagamentos em modo de teste até o go-live.' },
    { name: 'Supabase', desc: 'Banco de dados e autenticação operacionais.' },
    { name: 'Provedor de e-mail', desc: 'Envio transacional operacional.' },
    { name: 'IA (rascunhos)', desc: 'Gera sugestões. Revisão humana obrigatória antes de publicar ou enviar.' },
    { name: 'Vercel', desc: 'Deploy do frontend automático a cada publicação.' },
  ]
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h2 className="font-serif text-2xl text-forest-900 mb-4">Integrações</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(i => (
          <div key={i.name} className="bg-white border border-line rounded-2xl p-5 flex gap-3">
            <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-700 font-semibold flex-shrink-0">{i.name[0]}</span>
            <div>
              <p className="font-medium text-forest-900">{i.name}</p>
              <p className="text-sm text-ink-soft mt-0.5">{i.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IAPanel() {
  const usos = [
    'Recomendações de conteúdo', 'Resumo semanal', 'Relatório mensal',
    'Plano de autocuidado', 'Sugestão de resposta profissional', 'Análise de padrões do mapa emocional',
  ]
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h2 className="font-serif text-2xl text-forest-900 mb-2">IA</h2>
      <p className="text-sm text-ink-soft mb-5 max-w-2xl">
        A IA atua em conteúdos guiados, mapa emocional, relatórios, plano de autocuidado e orientação
        profissional — sempre gerando <strong>rascunhos que exigem revisão humana</strong> antes de publicar ou enviar.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {usos.map(x => (
          <div key={x} className="bg-white border border-line rounded-2xl p-4 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-forest-500" />
            <span className="text-sm text-ink">{x}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminAreaSistema({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-sistema-tab') ?? 'saude'
      return (TABS.find(t => t.id === saved)?.id ?? 'saude') as Tab
    } catch { return 'saude' }
  })
  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-sistema-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas do Sistema">
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
        {tab === 'saude' && <AdminSystemHealth />}
        {tab === 'logs' && <AdminLogs />}
        {tab === 'integracoes' && <Integracoes />}
        {tab === 'ia' && <IAPanel />}
        {tab === 'permissoes' && <AdminPermissions />}
      </div>
    </div>
  )
}
