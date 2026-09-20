import { useState } from 'react'
import { FileText, CalendarDays, Clock, Tag, Image, Plus } from 'lucide-react'
import AdminArticles from './AdminArticles'
import AdminCategories from './AdminCategories'
import AdminMediaLibrary from './AdminMediaLibrary'
import AdminCalendarioEditorial from './AdminCalendarioEditorial'
import AdminScheduled from './AdminScheduled'

const TABS = [
  { id: 'artigos', label: 'Artigos', icon: FileText },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  { id: 'programados', label: 'Programados', icon: Clock },
  { id: 'categorias', label: 'Categorias', icon: Tag },
  { id: 'imagens', label: 'Mídia', icon: Image },
] as const
type Tab = typeof TABS[number]['id']
const isTab=(v:string):v is Tab=>TABS.some(x=>x.id===v)

export default function AdminAreaConteudo({ onEditArticle, initialTab }: { onEditArticle:(id?:string)=>void; initialTab?:string }) {
 const [tab,setTab]=useState<Tab>(()=>{try{const v=initialTab??localStorage.getItem('admin-conteudo-tab')??'artigos';return isTab(v)?v:'artigos'}catch{return'artigos'}})
 const go=(id:Tab)=>{setTab(id);try{localStorage.setItem('admin-conteudo-tab',id)}catch{/* noop */}}
 return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
  <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4"><div><p className="admin-kicker">Biblioteca editorial</p><h1 className="font-serif text-3xl text-forest-900">Conteúdo</h1><p className="admin-subtitle mt-1">Crie, organize e programe os conteúdos publicados no AVNC. IA, SEO e páginas institucionais agora têm áreas próprias.</p></div><div className="admin-actions"><button onClick={()=>onEditArticle()} className="admin-btn-primary"><Plus className="w-4 h-4"/>Novo artigo</button><button onClick={()=>go('calendario')} className="admin-btn-secondary"><CalendarDays className="w-4 h-4"/>Calendário</button></div></section>
  <div className="admin-tabs-wrap"><nav className="admin-tabs" aria-label="Conteúdo">{TABS.map(x=>{const Icon=x.icon;return <button key={x.id} onClick={()=>go(x.id)} className={`admin-tab ${tab===x.id?'is-active':''}`}><Icon className="w-4 h-4"/>{x.label}</button>})}</nav></div>
  <section className="admin-card overflow-hidden flex-1 min-h-0">
   {tab==='artigos'&&<AdminArticles contentType="article" onEdit={onEditArticle} onNew={()=>onEditArticle()}/>}
   {tab==='calendario'&&<AdminCalendarioEditorial onEditArticle={onEditArticle}/>}
   {tab==='programados'&&<AdminScheduled/>}
   {tab==='categorias'&&<AdminCategories/>}
   {tab==='imagens'&&<AdminMediaLibrary/>}
  </section>
 </div>
}
