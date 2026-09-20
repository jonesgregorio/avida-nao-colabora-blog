import { useState } from 'react'
import { LayoutTemplate, Star } from 'lucide-react'
import AdminSiteContent from './AdminSiteContent'
import AdminSocialProof from './AdminSocialProof'

type Tab='paginas'|'depoimentos'
export default function AdminAreaSite(){
 const [tab,setTab]=useState<Tab>(()=>{try{return localStorage.getItem('admin-site-tab')==='depoimentos'?'depoimentos':'paginas'}catch{return'paginas'}})
 const go=(id:Tab)=>{setTab(id);try{localStorage.setItem('admin-site-tab',id)}catch{/* noop */}}
 return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
  <section className="admin-page-hero"><p className="admin-kicker">Experiência pública</p><h1 className="font-serif text-3xl text-forest-900">Site</h1><p className="admin-subtitle mt-1">Administre a apresentação institucional do AVNC separadamente da biblioteca editorial.</p></section>
  <div className="admin-tabs-wrap"><nav className="admin-tabs" aria-label="Site"><button onClick={()=>go('paginas')} className={`admin-tab ${tab==='paginas'?'is-active':''}`}><LayoutTemplate className="w-4 h-4"/>Home &amp; páginas</button><button onClick={()=>go('depoimentos')} className={`admin-tab ${tab==='depoimentos'?'is-active':''}`}><Star className="w-4 h-4"/>Depoimentos</button></nav></div>
  <section className="admin-card overflow-hidden flex-1 min-h-0">{tab==='paginas'?<div className="p-5 sm:p-6"><AdminSiteContent/></div>:<AdminSocialProof/>}</section>
 </div>
}
