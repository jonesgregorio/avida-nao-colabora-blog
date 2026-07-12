-- ============================================================================
-- Migration 081: remove o check legado "Sessões" do auto-reparo geral.
--
-- O produto não tem mais sessões/agendamento (user_sessions é legado). A Saúde
-- do Sistema deixou de testar/mostrar esse item no front; aqui alinhamos o
-- servidor: o "Corrigir todos" (admin_autofix_all_health) não recria mais a
-- tabela user_sessions. A função admin_autofix_health_check continua igual
-- (idempotente) — apenas não é mais chamada para 'db_sessions'.
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_autofix_all_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys text[] := ARRAY[
    'db_profiles', 'db_notifications', 'db_diary', 'db_questionnaires',
    'db_articles', 'db_trails', 'db_pers_tasks', 'db_pers_deliveries',
    'db_guidance', 'db_reports', 'db_support', 'db_saved'
  ];
  k       text;
  r       jsonb;
  v_all   jsonb := '[]'::jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  FOREACH k IN ARRAY v_keys LOOP
    r := admin_autofix_health_check(k);
    v_all := v_all || jsonb_build_array(r);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', array_length(v_keys, 1),
    'results', v_all
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_autofix_all_health() TO authenticated;
