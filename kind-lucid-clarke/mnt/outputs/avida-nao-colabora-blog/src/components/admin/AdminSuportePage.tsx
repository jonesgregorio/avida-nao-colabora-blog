import { useState } from 'react'
import AdminSupport from './AdminSupport'
import AdminReplyTemplates from './AdminReplyTemplates'

// A área "Suporte" abre DIRETO na central de atendimento (lista + painel de
// detalhes). O editor de modelos de resposta continua acessível pelo botão
// "Modelos de resposta" dentro da central.
export default function AdminSuportePage() {
  const [managingTemplates, setManagingTemplates] = useState(false)

  if (managingTemplates) return <AdminReplyTemplates onBack={() => setManagingTemplates(false)} />

  return (
    <div className="h-[calc(100vh-4rem)]">
      <AdminSupport onManageTemplates={() => setManagingTemplates(true)} />
    </div>
  )
}
