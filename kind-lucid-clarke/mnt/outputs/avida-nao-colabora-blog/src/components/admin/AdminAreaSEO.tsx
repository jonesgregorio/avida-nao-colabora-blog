import { useState } from 'react'
import { Search, ArrowRightLeft } from 'lucide-react'
import AdminSEOCockpitWithSelfTest from './AdminSEOCockpitWithSelfTest'
import AdminRedirects from './AdminRedirects'

type Tab = 'performance' | 'redirects'
export default function AdminAreaSEO({ onEditArticle }: { onEditArticle: (id?: string) => void }) {
  const [tab, setTab] = useState<Tab>(() => { try { return localStorage.getItem('admin-seo-tab') === 'redirects' ? 'redirects' : 'performance' } catch { return 'performance' } })
  const go=(id:Tab)=>{setTab(id);try{localStorage.setItem('admin-seo-tab',id)}catch{/* noop */}}
  return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
    <section className="admin-page-hero"><p className="admin-kicker">Crescimento orgânico</p><h1 className="font-serif text-3xl text-forest-900">SEO &amp; Performance</h1><p className="admin-subtitle mt-1">Monitore descoberta, indexação, tráfego orgânico, oportunidades e correções em uma área independente da produção editorial.</p></section>
    <div className="admin-tabs-wrap"><nav className="admin-tabs" aria-label="SEO e Performance"><button onClick={()=>go('performance')} className={`admin-tab ${tab==='performance'?'is-active':''}`}><Search className="w-4 h-4"/>Control Center</button><button onClick={()=>go('redirects')} className={`admin-tab ${tab==='redirects'?'is-active':''}`}><ArrowRightLeft className="w-4 h-4"/>Redirecionamentos</button></nav></div>
    <section className="admin-card overflow-hidden flex-1 min-h-0">{tab==='performance'?<AdminSEOCockpitWithSelfTest onEditArticle={onEditArticle}/>:<AdminRedirects/>}</section>
  </div>
}
