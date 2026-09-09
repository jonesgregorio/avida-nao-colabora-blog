import { useState } from 'react'
import { LifeBuoy, MessageSquareText } from 'lucide-react'
import AdminSupport from './AdminSupport'
import AdminReplyTemplates from './AdminReplyTemplates'

export default function AdminSuportePage({ onViewUser, initialTicketId }: { onViewUser?: (userId: string) => void; initialTicketId?: string | null }) {
  const [managingTemplates, setManagingTemplates] = useState(false)

  if (managingTemplates) {
    return (
      <div className="admin-page-pad max-w-[1600px] mx-auto w-full">
        <AdminReplyTemplates onBack={() => setManagingTemplates(false)} />
      </div>
    )
  }

  return (
    <div className="admin-page-pad max-w-[1600px] mx-auto w-full space-y-5">
      <section className="admin-page-hero">
        <div>
          <span className="admin-eyebrow">Atendimento</span>
          <h1>Suporte</h1>
          <p>Centralize tickets, orientações e respostas para acompanhar cada atendimento com clareza.</p>
        </div>
        <div className="admin-hero-icon" aria-hidden="true">
          <LifeBuoy className="w-5 h-5" />
        </div>
      </section>

      <section className="admin-section-frame overflow-hidden min-h-[calc(100vh-13rem)]">
        <div className="admin-section-labelbar">
          <div>
            <span className="admin-eyebrow">Fila de atendimento</span>
            <p className="text-sm text-ink-soft">Tickets, prioridades, responsáveis e histórico em um único espaço.</p>
          </div>
          <MessageSquareText className="w-5 h-5 text-forest-600" />
        </div>
        <div className="relative min-h-[calc(100vh-18rem)]">
          <AdminSupport onManageTemplates={() => setManagingTemplates(true)} onViewUser={onViewUser} initialTicketId={initialTicketId} />
        </div>
      </section>
    </div>
  )
}
