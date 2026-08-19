-- Migration 096: impede que mensagens internas de suporte sejam expostas ao usuário
--
-- A migration 046_consolidate_schemas.sql criou a policy permissiva
-- "ticket_messages_own" sem filtrar is_internal. Como policies permissivas do
-- PostgreSQL são combinadas com OR, ela anulava na prática a proteção das
-- policies que já exigiam NOT is_internal.
--
-- Esta correção é idempotente e não altera o acesso administrativo.

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Remove a policy ampla que permite qualquer mensagem do próprio ticket.
DROP POLICY IF EXISTS "ticket_messages_own" ON public.ticket_messages;

-- Recria a policy do usuário explicitamente, garantindo a mesma regra tanto
-- para leitura/alteração/exclusão (USING) quanto para inserção/alteração
-- (WITH CHECK). Mensagens internas permanecem acessíveis pelas policies admin.
DROP POLICY IF EXISTS "users_own_messages" ON public.ticket_messages;
CREATE POLICY "users_own_messages"
  ON public.ticket_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = ticket_messages.ticket_id
        AND st.user_id = auth.uid()
    )
    AND NOT COALESCE(ticket_messages.is_internal, false)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = ticket_messages.ticket_id
        AND st.user_id = auth.uid()
    )
    AND NOT COALESCE(ticket_messages.is_internal, false)
  );
