-- Migration 113: Permite o formulário de contato do FAQ (usuário deslogado)
-- criar um ticket de suporte sem estar autenticado.
--
-- Problema: user_id era NOT NULL e a única policy de INSERT exigia
-- user_id = auth.uid(), então visitantes sem sessão nunca conseguiam enviar
-- o formulário — a tela mostrava "Enviado!" mas o INSERT sempre falhava.

ALTER TABLE support_tickets ALTER COLUMN user_id DROP NOT NULL;

-- Ticket de usuário logado: mantém a exigência de user_id = auth.uid()
-- (a policy "users_own_tickets" já cobre FOR ALL, incluindo INSERT).

-- Ticket público (FAQ, sem login): sem user_id, mas com e-mail de contato.
CREATE POLICY "public_insert_contact_ticket" ON support_tickets
  FOR INSERT
  WITH CHECK (user_id IS NULL AND contact_email IS NOT NULL AND char_length(contact_email) > 3);
