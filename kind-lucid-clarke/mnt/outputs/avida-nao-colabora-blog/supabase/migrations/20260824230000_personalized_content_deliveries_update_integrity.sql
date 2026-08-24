-- Auditoria de segurança (Parte 10): a policy "users_mark_read" (migration 031)
-- só verifica USING/WITH CHECK por auth.uid()/status='sent' -- não restringe
-- QUAIS colunas mudam. Um usuário autenticado podia reescrever title, body,
-- content_type, target_area, professional_id e created_by da sua própria
-- entrega já enviada, não só marcar como lida. Como content_type/target_area
-- alimentam o gatilho que espelha comentários profissionais
-- (professional_comment_delivery_sent_update, migration
-- 20260820001000_go_live_personalization_consistency.sql), reescrever esses
-- campos é uma via de adulteração, mesmo quando não dispara o espelhamento.
--
-- Mesmo padrão já usado em notifications (20260820213000): trigger BEFORE
-- UPDATE torna todas as colunas imutáveis para o usuário comum, exceto o
-- estado de leitura (read_at). Service role e admin autenticado (revisão via
-- painel) seguem sem restrição.

CREATE OR REPLACE FUNCTION public.enforce_personalized_delivery_user_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Service role/processos internos não carregam auth.uid(). Admin autenticado
  -- mantém o fluxo normal pela policy administrativa.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid()
     OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'personalized content delivery ownership cannot be changed';
  END IF;

  -- Para usuário comum, todos os campos são imutáveis exceto a leitura.
  -- to_jsonb cobre também colunas adicionadas futuramente.
  IF (to_jsonb(NEW) - ARRAY['read_at', 'updated_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['read_at', 'updated_at']) THEN
    RAISE EXCEPTION 'users may only update read state for personalized content deliveries';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_personalized_delivery_user_mutation ON public.personalized_content_deliveries;
CREATE TRIGGER trg_enforce_personalized_delivery_user_mutation
BEFORE UPDATE ON public.personalized_content_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_personalized_delivery_user_mutation();

REVOKE ALL ON FUNCTION public.enforce_personalized_delivery_user_mutation() FROM public, anon, authenticated;
