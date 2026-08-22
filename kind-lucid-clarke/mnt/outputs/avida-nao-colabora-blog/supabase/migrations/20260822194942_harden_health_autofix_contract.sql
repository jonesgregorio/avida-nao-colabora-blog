-- Saúde do Sistema: o auto-reparo não pode mais provisionar schema ou RLS.
--
-- A rotina histórica 047 foi escrita antes do contrato atual de RLS. Ela
-- reconstruía tabelas, policies FOR ALL e módulos já descontinuados. Migrations
-- são o único caminho autorizado para alterações de schema; esta RPC passa a
-- ser explicitamente fail-closed e apenas orienta a correção segura.

CREATE OR REPLACE FUNCTION public.admin_autofix_health_check(p_check_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar o auto-reparo.';
  END IF;

  CASE p_check_key
    WHEN 'db_support', 'db_guidance', 'db_notifications' THEN
      v_message := 'Este domínio possui RLS sensível e não é reparado automaticamente. Use a migration canônica e o workflow oficial.';
    WHEN 'db_trails', 'db_sessions', 'db_saved', 'db_reports' THEN
      v_message := 'Este check pertence a uma estrutura legada ou substituída e não será recriado automaticamente.';
    ELSE
      v_message := 'A Saúde do Sistema não executa mais DDL nem recria policies. Corrija a estrutura pela migration canônica e pelo workflow oficial.';
  END CASE;

  RETURN jsonb_build_object(
    'success', false,
    'fixable', false,
    'check_key', p_check_key,
    'message', v_message
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_autofix_all_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', 0,
    'results', '[]'::jsonb,
    'message', 'Nenhuma alteração foi aplicada. Alterações de schema e RLS são feitas somente por migrations revisadas.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_autofix_health_check(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_autofix_all_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_autofix_health_check(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_autofix_all_health() TO authenticated;
