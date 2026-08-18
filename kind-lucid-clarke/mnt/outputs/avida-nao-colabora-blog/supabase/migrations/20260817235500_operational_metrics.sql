-- ==========================================================================
-- Indicadores operacionais administrativos.
-- Agrega somente contagens; não retorna texto de diário, conteúdo sensível ou
-- identificadores de usuários.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_operational_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reports_generated_30d integer := 0;
  v_reports_fallback_30d integer := 0;
  v_care_pending_review integer := 0;
  v_guidance_pending integer := 0;
  v_editorial_rules_with_error integer := 0;
  v_articles_blocked_30d integer := 0;
  v_ai_errors_30d integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  SELECT count(*)::int,
         count(*) FILTER (WHERE fallback_used = true)::int
  INTO v_reports_generated_30d, v_reports_fallback_30d
  FROM public.reports
  WHERE status = 'generated'
    AND COALESCE(generated_at, created_at) >= now() - interval '30 days';

  SELECT count(*)::int INTO v_care_pending_review
  FROM public.monthly_care_plans
  WHERE status = 'pending_review';

  SELECT count(*)::int INTO v_guidance_pending
  FROM public.monthly_guidance_requests
  WHERE COALESCE(status, 'open') NOT IN ('answered', 'sent', 'closed', 'resolved');

  SELECT count(*)::int INTO v_editorial_rules_with_error
  FROM public.content_automations
  WHERE status = 'active' AND nullif(trim(last_error), '') IS NOT NULL;

  SELECT count(*)::int INTO v_articles_blocked_30d
  FROM public.articles
  WHERE created_at >= now() - interval '30 days'
    AND status = 'draft'
    AND internal_notes ILIKE 'Auto-publicação bloqueada%';

  SELECT count(*)::int INTO v_ai_errors_30d
  FROM public.ai_generation_logs
  WHERE created_at >= now() - interval '30 days'
    AND (
      lower(COALESCE(status, '')) IN ('error', 'failed')
      OR lower(COALESCE(generation_status, '')) IN ('error', 'failed')
    );

  RETURN jsonb_build_object(
    'reports_generated_30d', v_reports_generated_30d,
    'reports_fallback_30d', v_reports_fallback_30d,
    'care_plans_pending_review', v_care_pending_review,
    'guidance_pending_review', v_guidance_pending,
    'editorial_rules_with_error', v_editorial_rules_with_error,
    'articles_auto_publish_blocked_30d', v_articles_blocked_30d,
    'ai_generation_errors_30d', v_ai_errors_30d,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_operational_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operational_metrics() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_operational_metrics() IS
  'Contagens operacionais administrativas sem conteúdo sensível ou identificadores de usuários.';
