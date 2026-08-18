-- ==========================================================================
-- Saúde das automações editoriais + timeout compatível com pacotes de artigos.
-- Não expõe automation_token, service_role ou qualquer segredo.
-- ========================================================================== 

-- O pacote semanal pode gerar vários artigos em uma única chamada de IA. O
-- pg_net precisa aguardar tempo suficiente pela Edge Function sem depender do
-- timeout histórico de 30 segundos.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'run-content-automations' ORDER BY jobid DESC LIMIT 1;
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'run-content-automations',
    '0 * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM private.cron_config WHERE key = 'automation_token' LIMIT 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_editorial_automation_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_cron_active boolean := false;
  v_schedule text := null;
  v_last_cron_status text := null;
  v_last_cron_started timestamptz := null;
  v_active_rules integer := 0;
  v_rules_with_error integer := 0;
  v_latest_rule_run timestamptz := null;
  v_latest_rule_result text := null;
  v_latest_rule_error text := null;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  SELECT COALESCE(active, false), schedule
  INTO v_cron_active, v_schedule
  FROM cron.job
  WHERE jobname = 'run-content-automations'
  ORDER BY jobid DESC
  LIMIT 1;

  SELECT d.status, d.start_time
  INTO v_last_cron_status, v_last_cron_started
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = 'run-content-automations'
  ORDER BY d.start_time DESC
  LIMIT 1;

  SELECT count(*)::int,
         count(*) FILTER (WHERE nullif(trim(last_error), '') IS NOT NULL)::int
  INTO v_active_rules, v_rules_with_error
  FROM public.content_automations
  WHERE status = 'active'
    AND type IN ('generate_daily','generate_weekly_package','generate_pauta','monthly_pauta');

  SELECT last_run_at, last_result, last_error
  INTO v_latest_rule_run, v_latest_rule_result, v_latest_rule_error
  FROM public.content_automations
  WHERE type IN ('generate_daily','generate_weekly_package','generate_pauta','monthly_pauta')
    AND last_run_at IS NOT NULL
  ORDER BY last_run_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'cron_active', COALESCE(v_cron_active, false),
    'cron_schedule', v_schedule,
    'last_cron_status', v_last_cron_status,
    'last_cron_started_at', v_last_cron_started,
    'active_rules', v_active_rules,
    'rules_with_error', v_rules_with_error,
    'latest_rule_run_at', v_latest_rule_run,
    'latest_rule_result', v_latest_rule_result,
    'latest_rule_error', v_latest_rule_error,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_editorial_automation_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_editorial_automation_health() TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'run-content-automations' AND active = true
  ) THEN
    RAISE EXCEPTION 'Editorial automation validation failed: run-content-automations cron is not active';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_editorial_automation_health() IS
  'Healthcheck administrativo do cron editorial e das regras de conteúdo, sem expor segredos.';
