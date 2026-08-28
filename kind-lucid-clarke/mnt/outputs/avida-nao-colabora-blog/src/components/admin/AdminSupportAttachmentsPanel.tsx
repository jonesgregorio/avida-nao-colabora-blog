import { useEffect, useState } from 'react'
import { Paperclip, RefreshCw, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SupportAttachmentList from '../support/SupportAttachmentList'
import { normalizeSupportAttachments, type SupportAttachment } from '../../lib/supportAttachments'

interface AttachmentMessage {
  id: string
  ticket_id: string
  created_at: string
  sender_role: 'user' | 'admin'
  attachments: SupportAttachment[]
  ticket_number?: number | null
  subject?: string | null
}

export default function AdminSupportAttachmentsPanel() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<AttachmentMessage[]>([])

  async function loadAttachments() {
    setLoading(true)
    setError(null)

    const { data, error: messageError } = await supabase
      .from('ticket_messages')
      .select('id,ticket_id,created_at,sender_role,attachments')
      .not('attachments', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (messageError) {
      setError('Não foi possível carregar os anexos dos chamados.')
      setLoading(false)
      return
    }

    const rows = (data || []).flatMap(row => {
      const attachments = normalizeSupportAttachments(row.attachments)
      return attachments.length ? [{ ...row, attachments } as AttachmentMessage] : []
    })
    const ticketIds = [...new Set(rows.map(row => row.ticket_id))]
    const { data: tickets } = ticketIds.length
      ? await supabase.from('support_tickets').select('id,ticket_number,subject').in('id', ticketIds)
      : { data: [] }
    const ticketMap = new Map((tickets || []).map(ticket => [ticket.id, ticket]))

    setMessages(rows.map(row => ({
      ...row,
      ticket_number: ticketMap.get(row.ticket_id)?.ticket_number ?? null,
      subject: ticketMap.get(row.ticket_id)?.subject ?? null,
    })))
    setLoading(false)
  }

  useEffect(() => {
    if (open && messages.length === 0) void loadAttachments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-2xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-forest-800"
      >
        <Paperclip className="h-4 w-4" /> Anexos dos chamados
      </button>

      {open && (
        <div className="absolute inset-0 z-40 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-label="Anexos dos chamados">
          <div className="flex h-full w-full max-w-md flex-col border-l border-line bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <div className="flex-1">
                <h2 className="font-serif text-xl text-forest-900">Anexos dos chamados</h2>
                <p className="mt-0.5 text-xs text-stone-500">Arquivos privados enviados nas conversas de suporte.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadAttachments()}
                disabled={loading}
                aria-label="Atualizar anexos"
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {loading && messages.length === 0 ? (
                <div className="space-y-2">{[1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-xl bg-stone-100" />)}</div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-sm text-stone-400">
                  <Paperclip className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  Nenhum anexo enviado ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map(message => (
                    <article key={message.id} className="rounded-2xl border border-line bg-stone-50 p-3.5">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-forest-900">
                            {message.ticket_number ? `Chamado #${message.ticket_number}` : 'Chamado'}
                          </p>
                          {message.subject && <p className="mt-0.5 truncate text-xs text-stone-500">{message.subject}</p>}
                        </div>
                        <span className="whitespace-nowrap text-[10px] text-stone-400">
                          {new Date(message.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <SupportAttachmentList attachments={message.attachments} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
