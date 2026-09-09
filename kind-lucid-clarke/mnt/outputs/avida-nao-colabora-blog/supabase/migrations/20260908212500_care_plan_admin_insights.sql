CREATE OR REPLACE FUNCTION public.admin_care_plan_insights(p_plan uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'active_actions', count(*) FILTER (WHERE state='active'),
    'paused_actions', count(*) FILTER (WHERE state='paused'),
    'removed_actions', count(*) FILTER (WHERE state='removed'),
    'helped', count(*) FILTER (WHERE outcome='helped'),
    'neutral', count(*) FILTER (WHERE outcome='neutral'),
    'could_not', count(*) FILTER (WHERE outcome='could_not'),
    'adapt_requests', count(*) FILTER (WHERE outcome='adapt'),
    'not_for_me', count(*) FILTER (WHERE outcome='not_for_me'),
    'last_interaction_at', max(updated_at)
  ) INTO v
  FROM public.care_plan_action_state
  WHERE care_plan_id=p_plan;
  RETURN COALESCE(v, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_care_plan_insights(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_care_plan_insights(uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_care_plan_insights(uuid) IS 'Resumo operacional das escolhas do plano vivo para revisão admin; não expõe diário ou texto íntimo.';
NOTIFY pgrst, 'reload schema';