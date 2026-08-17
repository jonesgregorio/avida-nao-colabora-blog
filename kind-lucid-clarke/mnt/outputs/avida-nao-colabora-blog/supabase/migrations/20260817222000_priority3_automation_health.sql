-- ==========================================================================
-- Prioridade 3 — robustez de automações.
-- 1) Resumo mensal simples do Essencial fica em Resumo/Evolução, não Relatórios.
-- 2) Expõe healthcheck seguro para admins, sem retornar token/segredo.
-- 3) A própria migration falha se o cron emocional ou o trigger de notificação
--    pós-persistência não estiverem ativos no ambiente em que foi aplicada.
-- ==========================================================================

UPDATE public.user_personalization_tasks
SET target_area = 'resumo'
WHERE task_key = 'monthly_summary'
  AND target_area = 'reports';

CREATE OR REPLACE FUNCTION public.sync_monthly_personalization()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := to_char(now(), 'YYYY-MM');
  v_count int := 0;
BEGIN
  INSERT INTO user_personalization_tasks
    (user_id, plan_key, task_key, task_title, task_description, content_type, target_area, period_key, status, due_at, expires_at)
  SELECT p.user_id,
         public.effective_plan_for_user(p.user_id),
         'monthly_summary',
         'Resumo mensal simples',
         'Resumo personalizado do mês com base nos registros da pessoa.',
         'monthly_summary',
         'resumo',
         v_period,
         'pending',
         (date_trunc('month', now()) + interval '1 month' - interval '1 second')::timestamptz,
         (date_trunc('month', now()) + interval '1 month' + interval '10 days')::timestamptz
  FROM public.profiles p
  WHERE public.effective_plan_for_user(p.user_id) IN ('essential', 'plus')
    AND (
      public.has_active_unlimited_access(p.user_id)
      OR COALESCE(p.subscription_status, 'active') IN ('active', 'trialing')
    )
  ON CONFLICT (user_id, task_key, period_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_monthly_personalization() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_monthly_personalization() TO service_role;

CREATE OR REPLACE FUNCTION public.get_emotional_automation_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_cron_active boolean := false;
  v_schedule text := null;
  v_notify_trigger boolean := false;
  v_last_status text := null;
  v_last_started timestamptz := null;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  SELECT COALESCE(active, false), schedule
  INTO v_cron_active, v_schedule
  FROM cron.job
  WHERE jobname = 'run-emotional-automations'
  ORDER BY jobid DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'reports'
      AND t.tgname = 'reports_notify_after_persist'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) INTO v_notify_trigger;

  SELECT d.status, d.start_time
  INTO v_last_status, v_last_started
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = 'run-emotional-automations'
  ORDER BY d.start_time DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'cron_active', COALESCE(v_cron_active, false),
    'cron_schedule', v_schedule,
    'notification_trigger_active', v_notify_trigger,
    'last_run_status', v_last_status,
    'last_run_started_at', v_last_started,
    'checked_at', now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_emotional_automation_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_emotional_automation_health() TO authenticated, service_role;

DO $$
DECLARE
  v_cron_ok boolean;
  v_trigger_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'run-emotional-automations' AND active = true
  ) INTO v_cron_ok;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'reports'
      AND t.tgname = 'reports_notify_after_persist'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) INTO v_trigger_ok;

  IF NOT v_cron_ok THEN
    RAISE EXCEPTION 'Priority 3 validation failed: run-emotional-automations cron is not active';
  END IF;
  IF NOT v_trigger_ok THEN
    RAISE EXCEPTION 'Priority 3 validation failed: reports_notify_after_persist trigger is not active';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_emotional_automation_health() IS
  'Healthcheck administrativo do cron emocional e do trigger de notificação; não expõe token nem outros segredos.';
