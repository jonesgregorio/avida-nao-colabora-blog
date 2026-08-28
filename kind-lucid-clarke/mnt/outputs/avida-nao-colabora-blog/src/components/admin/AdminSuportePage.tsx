import { useState } from 'react'
import AdminSupport from './AdminSupport'
import AdminReplyTemplates from './AdminReplyTemplates'
import AdminSupportAttachmentsPanel from './AdminSupportAttachmentsPanel'

export default function AdminSuportePage({ onViewUser }: { onViewUser?: (userId: string) => void }) {
  const [managingTemplates, setManagingTemplates] = useState(false)

  if (managingTemplates) return <AdminReplyTemplates onBack={() => setManagingTemplates(false)} />

  return (
    <div className="relative h-[calc(100vh-4rem)]">
      <AdminSupport onManageTemplates={() => setManagingTemplates(true)} onViewUser={onViewUser} />
      <AdminSupportAttachmentsPanel />
    </div>
  )
}
