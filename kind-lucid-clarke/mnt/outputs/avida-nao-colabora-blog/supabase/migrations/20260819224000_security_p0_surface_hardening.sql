-- Segurança P0.1: fecha superfícies públicas privilegiadas e limita uploads.
-- Não altera regras comerciais, conteúdo do usuário ou cobrança.

-- Triggers de Auth são SECURITY DEFINER: fixe search_path para impedir shadowing.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.profiles
     SET email = NEW.email,
         updated_at = now()
   WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- PRIVACIDADE: esta RPC agrega atividade POR USUÁRIO e é consumida somente pelo
-- cron server-side run-lifecycle-emails. A migration original concedeu service_role
-- mas não revogou o EXECUTE padrão de PUBLIC, deixando anon/authenticated chamarem.
REVOKE ALL ON FUNCTION public.get_diary_activity_since(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_diary_activity_since(timestamptz) TO service_role;

-- RPCs que dependem de uma sessão autenticada não precisam ficar expostas a anon.
REVOKE ALL ON FUNCTION public.mark_password_recovery_required() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_recovery_required() TO authenticated;
REVOKE ALL ON FUNCTION public.current_user_has_plan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_plan(text) TO authenticated;
REVOKE ALL ON FUNCTION public.can_access_questionnaire(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_questionnaire(uuid) TO authenticated;

-- Limites no servidor: validação do React não é controle de segurança.
UPDATE storage.buckets
   SET file_size_limit = 2097152,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
 WHERE id = 'avatars';

UPDATE storage.buckets
   SET file_size_limit = 10485760,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
 WHERE id IN ('media','article-images');

-- Guardas: a própria migration aborta se qualquer invariante P0 falhar.
DO $$
DECLARE
  v_cfg text;
  v_bad integer;
BEGIN
  SELECT COALESCE(array_to_string(p.proconfig, ', '), '') INTO v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='handle_new_user';
  IF position('search_path=public' IN replace(v_cfg,' ','')) = 0 THEN
    RAISE EXCEPTION 'Segurança P0: handle_new_user sem search_path seguro';
  END IF;

  SELECT COALESCE(array_to_string(p.proconfig, ', '), '') INTO v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='sync_profile_email';
  IF position('search_path=public' IN replace(v_cfg,' ','')) = 0 THEN
    RAISE EXCEPTION 'Segurança P0: sync_profile_email sem search_path seguro';
  END IF;

  IF has_function_privilege('anon', 'public.get_diary_activity_since(timestamptz)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_diary_activity_since(timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Segurança P0: atividade do diário ainda executável por cliente';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.get_diary_activity_since(timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Segurança P0: lifecycle perdeu acesso à atividade do diário';
  END IF;

  IF has_function_privilege('anon', 'public.mark_password_recovery_required()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.current_user_has_plan(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.can_access_questionnaire(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Segurança P0: RPC autenticada segue executável por anon';
  END IF;

  SELECT count(*) INTO v_bad
    FROM storage.buckets
   WHERE (id='avatars' AND (file_size_limit <> 2097152 OR allowed_mime_types IS NULL))
      OR (id IN ('media','article-images') AND (file_size_limit <> 10485760 OR allowed_mime_types IS NULL));
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'Segurança P0: limites de Storage não ficaram canônicos';
  END IF;
END $$;
