-- Go-live: endurece o contrato de integridade do Suporte.
--
-- Defeito corrigido:
-- as policies legadas FOR ALL permitiam ao dono do ticket editar/excluir
-- mensagens não internas, inclusive respostas do suporte, ou inserir uma
-- mensagem declarando sender_role='admin'. O mesmo padrão permitia alterar
-- ou excluir diretamente o próprio ticket e seus campos administrativos.
--
-- Contrato final:
-- - usuário autenticado lê apenas seus tickets e mensagens públicas;
-- - abre ticket próprio somente no estado inicial esperado;
-- - responde apenas em ticket próprio ainda aberto, sempre como 'user';
-- - usuário não edita/exclui mensagens nem tickets;
-- - resposta do usuário atualiza estado/unread/timestamps por trigger;
-- - policies administrativas existentes permanecem intactas;
-- - formulário público do FAQ continua podendo criar ticket, esteja o
--   visitante deslogado ou já com sessão autenticada.

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Sincroniza o ticket após uma mensagem legítima do usuário sem exigir que o
-- cliente tenha UPDATE amplo em support_tickets.
CREATE OR REPLACE FUNCTION public.sync_support_ticket_user_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_role = 'user' AND COALESCE(NEW.is_internal, false) = false THEN
    UPDATE public.support_tickets
    SET
      unread_for_admin = true,
      unread_for_user = false,
      last_message_at = NEW.created_at,
      last_user_message_at = NEW.created_at,
      status = CASE
        WHEN status IN ('open', 'in_progress', 'awaiting_user') THEN 'awaiting_admin'
        ELSE status
      END
    WHERE id = NEW.ticket_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_support_ticket_user_reply ON public.ticket_messages;
CREATE TRIGGER trg_sync_support_ticket_user_reply
AFTER INSERT ON public.ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_support_ticket_user_reply();

-- Trigger function não é uma API pública.
REVOKE ALL ON FUNCTION public.sync_support_ticket_user_reply() FROM PUBLIC, anon, authenticated;

-- ── ticket_messages ──────────────────────────────────────────────────────────
-- Remove policies legadas amplas. Policies admin não são removidas.
DROP POLICY IF EXISTS "ticket_messages_own" ON public.ticket_messages;
DROP POLICY IF EXISTS "users_own_messages" ON public.ticket_messages;

CREATE POLICY "users_select_own_ticket_messages"
  ON public.ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = ticket_messages.ticket_id
        AND st.user_id = auth.uid()
    )
    AND NOT COALESCE(ticket_messages.is_internal, false)
  );

CREATE POLICY "users_insert_own_ticket_messages"
  ON public.ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ticket_messages.sender_id = auth.uid()
    AND ticket_messages.sender_role = 'user'
    AND NOT COALESCE(ticket_messages.is_internal, false)
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = ticket_messages.ticket_id
        AND st.user_id = auth.uid()
        AND st.status NOT IN ('resolved', 'closed')
    )
  );

-- ── support_tickets ──────────────────────────────────────────────────────────
-- Remove policies legadas FOR ALL do usuário. Policies admin permanecem.
DROP POLICY IF EXISTS "tickets_own" ON public.support_tickets;
DROP POLICY IF EXISTS "users_own_tickets" ON public.support_tickets;

CREATE POLICY "users_select_own_tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (support_tickets.user_id = auth.uid());

CREATE POLICY "users_insert_own_tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    support_tickets.user_id = auth.uid()
    AND support_tickets.assigned_to IS NULL
    AND support_tickets.status = 'open'
    AND support_tickets.resolved_at IS NULL
    AND support_tickets.closed_at IS NULL
    AND NOT COALESCE(support_tickets.unread_for_user, false)
    AND support_tickets.last_admin_message_at IS NULL
    AND support_tickets.last_message_at IS NULL
    AND support_tickets.last_user_message_at IS NULL
  );

-- Contato do FAQ: user_id permanece nulo e os campos administrativos ficam no
-- estado inicial seguro. TO anon, authenticated preserva o formulário também
-- quando uma sessão do usuário já está ativa.
DROP POLICY IF EXISTS "public_insert_contact_ticket" ON public.support_tickets;
CREATE POLICY "public_insert_contact_ticket"
  ON public.support_tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    support_tickets.user_id IS NULL
    AND support_tickets.contact_email IS NOT NULL
    AND char_length(support_tickets.contact_email) > 3
    AND support_tickets.assigned_to IS NULL
    AND support_tickets.status = 'open'
    AND support_tickets.resolved_at IS NULL
    AND support_tickets.closed_at IS NULL
    AND support_tickets.plan_at_creation IS NULL
    AND NOT COALESCE(support_tickets.unread_for_user, false)
    AND support_tickets.last_admin_message_at IS NULL
    AND support_tickets.last_message_at IS NULL
    AND support_tickets.last_user_message_at IS NULL
  );

-- ── Asserções de go-live ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ticket_messages'
      AND policyname IN ('users_own_messages', 'ticket_messages_own')
  ) THEN
    RAISE EXCEPTION 'legacy ticket_messages policies still active';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ticket_messages'
      AND policyname = 'users_insert_own_ticket_messages'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'strict ticket_messages INSERT policy missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname IN ('tickets_own', 'users_own_tickets')
  ) THEN
    RAISE EXCEPTION 'legacy support_tickets policies still active';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'users_select_own_tickets'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'support ticket SELECT policy missing';
  END IF;
END;
$$;
