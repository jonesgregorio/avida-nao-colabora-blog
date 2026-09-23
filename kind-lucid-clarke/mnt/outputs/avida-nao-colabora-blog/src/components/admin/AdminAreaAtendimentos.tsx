import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MessageSquare, CalendarCheck, Sparkles, FileText, HeartHandshake, AlertTriangle, Clock3 } from 'lucide-react'
import AdminGuidanceRequests from './AdminGuidanceRequests'
import AdminSelfCareHub from './AdminSelfCareHub'
import AdminPersonalization from './AdminPersonalization'
import AdminPDF from './AdminPDF'

const TABS = [
  { id: 'orientacoes', label: 'Orientações Mensais', icon: MessageSquare },
  { id: 'autocuidado', label: 'Planos de Autocuidado', icon: CalendarCheck },
  { id: 'recomendacoes', label: 'Entregas de Conteúdo', icon: Sparkles },
  { id: 'relatorios', label: 'Relatórios para revisão', icon: FileText },
] as const
type Tab = typeof TABS[number]['id']
const STORE='admin-atendimentos-tab'
function valid(v:string):v is Tab{return TABS.some(t=>t.id===v)}
export default function AdminAreaAtendimentos({initialTab}:{initialTab?:string}){
 const [tab,setTab]=useState<Tab>(()=>{try{const v=initialTab??localStorage.getItem(STORE)??'orientacoes';return valid(v)?v:'orientacoes'}catch{return 'orientacoes'}})
 const change=(v:Tab)=>{setTab(v);try{localStorage.setItem(STORE,v)}catch{/* noop */}}
 const [guidance,setGuidance]=useState<{created_at:string;status:string}[]>([])
 const [care,setCare]=useState<{review_due_at:string|null;status:string}[]>([])
 const [tasks,setTasks]=useState<{due_at:string|null;status:string;task_key:string}[]>([])
 useEffect(()=>{void Promise.all([
  supabase.from('monthly_guidance_requests').select('created_at,status').eq('status','open'),
  supabase.from('monthly_care_plans').select('review_due_at,status').in('status',['ready','pending_review']),
  supabase.from('user_personalization_tasks').select('due_at,status,task_key').in('status',['pending','overdue','draft','generated']),
 ]).then(([g,c,t])=>{setGuidance((g.data??[]) as typeof guidance);setCare((c.data??[]) as typeof care);setTasks((t.data??[]) as typeof tasks)})},[])
 const actionSummary=useMemo(()=>{
  const now=Date.now(), day=86400000
  const canonical=new Set(['self_care_plan','monthly_plan_review','monthly_guidance','monthly_guidance_reply','advanced_monthly_report','monthly_summary','weekly_report_suggestion'])
  const dueDates=[...guidance.map(g=>new Date(g.created_at).getTime()+7*day),...care.map(c=>c.review_due_at?new Date(c.review_due_at).getTime():Infinity),...tasks.filter(t=>!canonical.has(t.task_key)).map(t=>t.due_at?new Date(t.due_at).getTime():Infinity)]
  return {total:dueDates.length,overdue:dueDates.filter(d=>d<now).length,soon:dueDates.filter(d=>d>=now&&d-now<=3*day).length}
 },[guidance,care,tasks])
 return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
  <section className="admin-page-hero">
   <p className="admin-kicker">Operação com usuários</p>
   <h1 className="font-serif text-3xl text-forest-900">Atendimentos & Entregas</h1>
   <p className="admin-subtitle mt-1">Tudo que exige análise, revisão, criação, aprovação ou envio individual ao usuário fica acessível aqui.</p>
  </section>
  <div className="grid grid-cols-3 gap-3">
   <button onClick={()=>change('recomendacoes')} className="rounded-2xl border border-line bg-white p-4 text-left"><HeartHandshake className="w-4 h-4 text-forest-600"/><p className="font-serif text-2xl text-forest-900 mt-2">{actionSummary.total}</p><p className="text-xs text-ink-soft">Itens que exigem acompanhamento</p></button>
   <button onClick={()=>change('recomendacoes')} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left"><Clock3 className="w-4 h-4 text-amber-700"/><p className="font-serif text-2xl text-amber-800 mt-2">{actionSummary.soon}</p><p className="text-xs text-amber-800">Vencem em até 3 dias</p></button>
   <button onClick={()=>change('recomendacoes')} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left"><AlertTriangle className="w-4 h-4 text-red-700"/><p className="font-serif text-2xl text-red-800 mt-2">{actionSummary.overdue}</p><p className="text-xs text-red-800">Atrasados</p></button>
  </div>
  <div className="admin-tabs-wrap sticky top-20 z-10"><nav className="admin-tabs" aria-label="Atendimentos e entregas">
   {TABS.map(t=>{const Icon=t.icon;return <button key={t.id} onClick={()=>change(t.id)} className={`admin-tab ${tab===t.id?'is-active':''}`}><Icon className="w-4 h-4"/>{t.label}</button>})}
  </nav></div>
  <div className="rounded-2xl border border-forest-100 bg-mint/25 px-4 py-3 text-xs text-forest-700 flex items-center gap-2"><HeartHandshake className="w-4 h-4"/>Use esta central para acompanhar o que depende da sua ação. Cada área preserva seus próprios prazos, filtros, dias até o vencimento e histórico; Entregas de Conteúdo concentra apenas recomendações, práticas, exercícios e reflexões.</div>
  <section className="admin-card overflow-hidden flex-1 min-h-0">
   {tab==='orientacoes'&&<AdminGuidanceRequests/>}
   {tab==='autocuidado'&&<AdminSelfCareHub/>}
   {tab==='recomendacoes'&&<AdminPersonalization/>}
   {tab==='relatorios'&&<AdminPDF/>}
  </section>
 </div>
}