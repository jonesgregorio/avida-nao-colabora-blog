import { supabase } from './supabase'

interface SendUserMessageOptions {
  userId: string
  title: string
  message: string
  type?: string
  relatedTicketId?: string | null
  createTicket?: boolean
  priority?: string
  category?: string
  source?: string
  adminId?: string
}

interface SendUserMessageResult {
  notification?: { id: string } | null
  ticket?: { id: string; ticket_number: number } | null
  error?: string
}

export async function sendUserMessage({
  userId,
  title,
  message,
  type = 'admin_message',
  relatedTicketId = null,
  createTicket = false,
  priority = 'medium',
  category,
  source = 'admin_user_page',
  adminId,
}: SendUserMessageOptions): Promise<SendUserMessageResult> {
  let ticketId = relatedTicketId
  let ticketObj: { id: string; ticket_number: number } | null = null

  // Get profile plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()

  if (createTicket && !ticketId) {
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        subject: title,
        description: message,
        priority,
        status: 'awaiting_user',
        source,
        category: category ?? null,
        plan_at_creation: profile?.plan ?? 'free',
        unread_for_user: true,
        last_message_at: new Date().toISOString(),
        last_admin_message_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (ticketError || !ticket) return { error: ticketError?.message ?? 'Erro ao criar ticket' }
    ticketId = ticket.id
    ticketObj = { id: ticket.id, ticket_number: ticket.ticket_number }

    // Insert first message from admin
    if (adminId) {
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: adminId,
        sender_role: 'admin',
        content: message,
        is_internal: false,
      })
    }
  }

  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body: message,
      type,
      related_ticket_id: ticketId ?? null,
      action_view: ticketId ? 'support-ticket' : null,
      action_label: ticketId ? 'Ver mensagem' : null,
      is_read: false,
      created_by: adminId ?? null,
    })
    .select()
    .single()

  if (notifError) return { error: notifError.message, ticket: ticketObj }

  return { notification, ticket: ticketObj }
}
