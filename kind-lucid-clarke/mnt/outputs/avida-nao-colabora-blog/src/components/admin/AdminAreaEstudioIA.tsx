import { useState } from 'react'
import { Sparkles, FileCode, Zap } from 'lucide-react'
import AdminFabricaIA from './AdminFabricaIA'
import AdminTemplatesIA from './AdminTemplatesIA'
import AdminAutomacoesBlog from './AdminAutomacoesBlog'

const TABS = [
  { id: 'criar', label: 'Criar com IA', icon: Sparkles },
  { id: 'templates', label: 'Templates', icon: FileCode },
  { id: 'automacoes', label: 'Automações editoriais', icon: Zap },
] as const
type Tab = typeof TABS[number]['id']

export default function AdminAreaEstudioIA() {
  const [tab, setTab] = useState<Tab>(() => {
    try { const v = localStorage.getItem('admin-estudio-ia-tab') as Tab | null; return TABS.some(x => x.id === v) ? v! : 'criar' } catch { return 'criar' }
  })
  const go = (id: Tab) => { setTab(id); try { localStorage.setItem('admin-estudio-ia-tab', id) } catch { /* noop */ } }
  return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
    <section className="admin-page-hero"><p className="admin-kicker">Produção assistida</p><h1 className="font-serif text-3xl text-forest-900">Estúdio IA</h1><p className="admin-subtitle mt-1">Crie, padronize e automatize conteúdo editorial. A IA auxilia a produção; publicação continua sob controle humano.</p></section>
    <div className="admin-tabs-wrap"><nav className="admin-tabs" aria-label="Estúdio IA">{TABS.map(x => { const Icon=x.icon; return <button key={x.id} onClick={() => go(x.id)} className={`admin-tab ${tab===x.id?'is-active':''}`}><Icon className="w-4 h-4"/>{x.label}</button> })}</nav></div>
    <section className="admin-card overflow-hidden flex-1 min-h-0">{tab==='criar'&&<AdminFabricaIA/>}{tab==='templates'&&<AdminTemplatesIA/>}{tab==='automacoes'&&<AdminAutomacoesBlog/>}</section>
  </div>
}
