-- Go-live: protege a integridade da Central de Notificações.
--
-- Defeito corrigido:
-- policies legadas FOR ALL permitiam ao usuário criar, apagar ou alterar o
-- conteúdo das próprias notificações. A tela do usuário só precisa ler e
-- marcar como lida; criação é responsabilidade de triggers, Edge Functions e
-- fluxos administrativos.
--
-- A trigger abaixo também mantém o bloqueio caso o auto-reparo legado de
-- Saúde do Sistema volte a recriar uma policy notifications_own FOR ALL.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_notification_user_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Service role/processos internos não carregam auth.uid(). Admin autenticado
  -- mantém o fluxo normal pelas policies administrativas.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'users cannot create notifications';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'users cannot delete notifications';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS DISTINCT FROM auth.uid()
       OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'notification ownership cannot be changed';
    END IF;

    -- Para usuário comum, todos os campos são imutáveis exceto a leitura.
    -- O uso de to_jsonb cobre também colunas adicionadas futuramente.
    IF (to_jsonb(NEW) - ARRAY['is_read', 'read_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['is_read', 'read_at']) THEN
      RAISE EXCEPTION 'users may only update notification read state';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_notification_user_mutation ON public.notifications;
CREATE TRIGGER trg_enforce_notification_user_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notification_user_mutation();

-- Remove somente policies amplas do usuário. Broadcasts e Admin permanecem.
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
DROP POLICY IF EXISTS "users_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_own_read" ON public.notifications;
DROP POLICY IF EXISTS "notifications_own_update" ON public.notifications;

CREATE POLICY "notifications_own_read"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = notifications.user_id);

CREATE POLICY "notifications_own_update"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = notifications.user_id)
  WITH CHECK (auth.uid() = notifications.user_id);

-- Asserções de go-live.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname IN ('notifications_own', 'users_own_notifications')
  ) THEN
    RAISE EXCEPTION 'legacy broad notifications policies still active';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_own_read'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'notifications own read policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_own_update'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'notifications own update policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'notifications'
      AND t.tgname = 'trg_enforce_notification_user_mutation'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'notification mutation guard trigger missing';
  END IF;
END;
$$;
