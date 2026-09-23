import AdminGardenManagement from './AdminGardenManagement'
export default function AdminAreaJardins(){
 return <div className="admin-page-pad flex flex-col min-h-0 gap-4">
  <section className="admin-page-hero"><p className="admin-kicker">Experiência & engajamento</p><h1 className="font-serif text-3xl text-forest-900">Jardins</h1><p className="admin-subtitle mt-1">Acompanhe os jardins dos usuários, organize a experiência, a fila e as campanhas de jardins em uma área própria.</p></section>
  <section className="admin-card overflow-hidden flex-1 min-h-0"><AdminGardenManagement/></section>
 </div>
}