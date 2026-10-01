import { useCallback, useEffect, useMemo, useState } from 'react'
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
// Cada aba corresponde a uma área de admin_action_center_snapshot (mesma fonte do número na lateral).
const AREA_OF:Record<Tab,'guidance'|'care'|'deliveries'|'reports'>={orientacoes:'guidance',autocuidado:'care',recomendacoes:'deliveries',relatorios:'reports'}
type AreaCount={total:number;overdue:number;due_3d:number}
const NO_COUNT:AreaCount={total:0,overdue:0,due_3d:0}
const STORE='admin-atendimentos-tab'
function valid(v:string):v is Tab{return TABS.some(t=>t.id===v)}
export default function AdminAreaAtendimentos({initialTab}:{initialTab?:string}){
 const [tab,setTab]=useState<Tab>(()=>{try{const v=initialTab??localStorage.getItem(STORE)??'orientacoes';return valid(v)?v:'orientacoes'}catch{return 'orientacoes'}})
 const change=(v:Tab)=>{setTab(v);try{localStorage.setItem(STORE,v)}catch{/* noop */}}
 const [areas,setAreas]=useState<Partial<Record<'guidance'|'care'|'deliveries'|'reports',AreaCount>>>({})
 const [loaded,setLoaded]=useState(false)
 const loadCounts=useCallback(async()=>{
  const {data,error}=await supabase.rpc('admin_action_center_snapshot')
  if(!error&&data)setAreas(((data as {areas?:typeof areas}).areas)??{})
  setLoaded(true)
 },[])
 // recarrega ao entrar e a cada troca de aba (o admin acabou de resolver algo, os números acompanham)
 useEffect(()=>{void loadCounts()},[loadCounts,tab])
 const countOf=(t:Tab):AreaCount=>areas[AREA_OF[t]]??NO_COUNT
 const actionSummary=useMemo(()=>{
  const all=TABS.map(t=>areas[AREA_OF[t.id]]??NO_COUNT)
  return {total:all.reduce((n,a)=>n+a.total,0),overdue:all.reduce((n,a)=>n+a.overdue,0),soon:all.reduce((n,a)=>n+a.due_3d,0)}
 },[areas])
 const withPending=TABS.filter(t=>countOf(t.id).total>0)
 const firstPending=withPending[0]?.id??tab
 return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
  <section className="admin-page-hero">
   <p className="admin-kicker">Operação com usuários</p>
   <h1 className="font-serif text-3xl text-forest-900">Atendimentos & Entregas</h1>
   <p className="admin-subtitle mt-1">Tudo que exige análise, revisão, criação, aprovação ou envio individual ao usuário fica acessível aqui.</p>
  </section>
  <div className="grid grid-cols-3 gap-3">
   <button onClick={()=>change(firstPending)} className="rounded-2xl border border-line bg-white p-4 text-left"><HeartHandshake className="w-4 h-4 text-forest-600"/><p className="font-serif text-2xl text-forest-900 mt-2">{actionSummary.total}</p><p className="text-xs text-ink-soft">Itens que exigem acompanhamento</p></button>
   <button onClick={()=>change(TABS.find(t=>countOf(t.id).due_3d>0)?.id??firstPending)} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left"><Clock3 className="w-4 h-4 text-amber-700"/><p className="font-serif text-2xl text-amber-800 mt-2">{actionSummary.soon}</p><p className="text-xs text-amber-800">Vencem em até 3 dias</p></button>
   <button onClick={()=>change(TABS.find(t=>countOf(t.id).overdue>0)?.id??firstPending)} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left"><AlertTriangle className="w-4 h-4 text-red-700"/><p className="font-serif text-2xl text-red-800 mt-2">{actionSummary.overdue}</p><p className="text-xs text-red-800">Atrasados</p></button>
  </div>
  {loaded&&<div className="rounded-2xl border border-line bg-white px-4 py-3" aria-label="Onde estão as pendências">
   <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">Onde estão as pendências</p>
   {withPending.length===0
    ?<p className="mt-1.5 text-sm text-forest-700">Nenhuma pendência em Atendimentos & Entregas. Tudo em dia.</p>
    :<div className="mt-2 flex flex-wrap gap-2">{withPending.map(t=>{const c=countOf(t.id);const Icon=t.icon;return <button key={t.id} onClick={()=>change(t.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${c.overdue>0?'border-red-200 bg-red-50 text-red-800 hover:bg-red-100':c.due_3d>0?'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100':'border-forest-100 bg-mint/40 text-forest-800 hover:bg-mint/70'}`}><Icon className="w-3.5 h-3.5"/>{t.label}<span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold">{c.total}</span>{c.overdue>0&&<span className="text-[11px]">{c.overdue} {c.overdue===1?'atrasado':'atrasados'}</span>}{c.overdue===0&&c.due_3d>0&&<span className="text-[11px]">{c.due_3d} vence{c.due_3d===1?'':'m'} em até 3 dias</span>}</button>})}</div>}
  </div>}
  <div className="admin-tabs-wrap sticky top-20 z-10"><nav className="admin-tabs" aria-label="Atendimentos e entregas">
   {TABS.map(t=>{const Icon=t.icon;const c=countOf(t.id);const tone=c.overdue>0?'bg-red-100 text-red-700':c.due_3d>0?'bg-amber-100 text-amber-800':'bg-mint text-forest-700';return <button key={t.id} onClick={()=>change(t.id)} className={`admin-tab ${tab===t.id?'is-active':''}`}><Icon className="w-4 h-4"/>{t.label}{c.total>0&&<span title={`${c.total} pendente(s)${c.overdue?` · ${c.overdue} atrasado(s)`:''}${c.due_3d?` · ${c.due_3d} vence(m) em até 3 dias`:''}`} className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>{c.total}</span>}</button>})}
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