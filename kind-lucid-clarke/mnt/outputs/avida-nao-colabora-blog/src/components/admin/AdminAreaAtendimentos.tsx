import { useState } from 'react'
import { MessageSquare, CalendarCheck, Sparkles, FileText, HeartHandshake } from 'lucide-react'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminSelfCareHub from './AdminSelfCareHub'
import AdminPersonalization from './AdminPersonalization'
import AdminPDF from './AdminPDF'

const TABS = [
  { id: 'orientacoes', label: 'Orientações Mensais', icon: MessageSquare },
  { id: 'autocuidado', label: 'Planos de Autocuidado', icon: CalendarCheck },
  { id: 'recomendacoes', label: 'Recomendações personalizadas', icon: Sparkles },
  { id: 'relatorios', label: 'Relatórios para revisão', icon: FileText },
] as const
type Tab = typeof TABS[number]['id']
const STORE='admin-atendimentos-tab'
function valid(v:string):v is Tab{return TABS.some(t=>t.id===v)}
export default function AdminAreaAtendimentos({initialTab}:{initialTab?:string}){
 const [tab,setTab]=useState<Tab>(()=>{try{const v=initialTab??localStorage.getItem(STORE)??'orientacoes';return valid(v)?v:'orientacoes'}catch{return 'orientacoes'}})
 const change=(v:Tab)=>{setTab(v);try{localStorage.setItem(STORE,v)}catch{/* noop */}}
 return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
  <section className="admin-page-hero">
   <p className="admin-kicker">Operação com usuários</p>
   <h1 className="font-serif text-3xl text-forest-900">Atendimentos & Entregas</h1>
   <p className="admin-subtitle mt-1">Tudo que exige análise, revisão, criação, aprovação ou envio individual ao usuário fica acessível aqui.</p>
  </section>
  <div className="admin-tabs-wrap sticky top-20 z-10"><nav className="admin-tabs" aria-label="Atendimentos e entregas">
   {TABS.map(t=>{const Icon=t.icon;return <button key={t.id} onClick={()=>change(t.id)} className={`admin-tab ${tab===t.id?'is-active':''}`}><Icon className="w-4 h-4"/>{t.label}</button>})}
  </nav></div>
  <div className="rounded-2xl border border-forest-100 bg-mint/25 px-4 py-3 text-xs text-forest-700 flex items-center gap-2"><HeartHandshake className="w-4 h-4"/>Use as abas acima como sua fila operacional. As telas mantêm seus fluxos atuais de revisão e envio.</div>
  <section className="admin-card overflow-hidden flex-1 min-h-0">
   {tab==='orientacoes'&&<AdminGuidanceRequests/>}
   {tab==='autocuidado'&&<AdminSelfCareHub/>}
   {tab==='recomendacoes'&&<AdminPersonalization/>}
   {tab==='relatorios'&&<AdminPDF/>}
  </section>
 </div>
}