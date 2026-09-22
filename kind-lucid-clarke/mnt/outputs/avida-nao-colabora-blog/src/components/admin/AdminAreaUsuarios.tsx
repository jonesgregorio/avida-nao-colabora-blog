import { useState } from 'react'
import { Users, ListFilter, Activity } from 'lucide-react'
import AdminUsers from './AdminUsers'
import AdminSegments from './AdminSegments'
import AdminEngagement from './AdminEngagement'
type Tab='usuarios'|'segmentacao'|'engajamento'
const TABS=[{id:'usuarios',label:'Usuários',icon:Users},{id:'segmentacao',label:'Segmentos',icon:ListFilter},{id:'engajamento',label:'Engajamento',icon:Activity}] as const
export default function AdminAreaUsuarios({initialTab,initialUserId}:{initialTab?:string;initialUserId?:string|null}){
 const [tab,setTab]=useState<Tab>(()=>{try{const v=(initialTab??localStorage.getItem('admin-usuarios-tab')??'usuarios') as Tab;return TABS.some(x=>x.id===v)?v:'usuarios'}catch{return'usuarios'}})
 const go=(id:Tab)=>{setTab(id);try{localStorage.setItem('admin-usuarios-tab',id)}catch{/* storage indisponível */}}
 return <div className="admin-page-pad flex flex-col min-h-0 gap-4"><section className="admin-page-hero"><p className="admin-kicker">Gestão</p><h1 className="font-serif text-3xl text-forest-900">Usuários</h1><p className="admin-subtitle mt-1">Contas, segmentos e engajamento em uma única área.</p></section><div className="admin-tabs-wrap"><nav className="admin-tabs" aria-label="Usuários">{TABS.map(x=>{const Icon=x.icon;return <button key={x.id} onClick={()=>go(x.id)} className={`admin-tab ${tab===x.id?'is-active':''}`}><Icon className="w-4 h-4"/>{x.label}</button>})}</nav></div><section className="admin-card overflow-hidden flex-1 min-h-0">{tab==='usuarios'&&<AdminUsers initialUserId={initialUserId}/>} {tab==='segmentacao'&&<AdminSegments/>} {tab==='engajamento'&&<AdminEngagement/>}</section></div>
}