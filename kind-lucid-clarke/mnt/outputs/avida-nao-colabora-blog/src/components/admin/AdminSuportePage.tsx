import { useState } from 'react'
import AdminSupport from './AdminSupport'
import AdminReplyTemplates from './AdminReplyTemplates'

export default function AdminSuportePage({ onViewUser }: { onViewUser?: (userId: string) => void }) {
  const [managingTemplates, setManagingTemplates] = useState(false)

  if (managingTemplates) return <AdminReplyTemplates onBack={() => setManagingTemplates(false)} />

  return (
    <div className="h-[calc(100vh-4rem)]">
      <AdminSupport onManageTemplates={() => setManagingTemplates(true)} onViewUser={onViewUser} />
    </div>
  )
}
