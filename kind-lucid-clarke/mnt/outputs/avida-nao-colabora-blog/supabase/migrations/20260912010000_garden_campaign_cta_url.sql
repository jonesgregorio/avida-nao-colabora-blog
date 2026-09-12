-- O botão de campanha (cta_label) nunca teve um destino: era sempre um selo visual, não
-- clicável, porque não existia nenhum campo de link no cadastro. Adiciona cta_url (opcional) —
-- quando vazio, o frontend continua mostrando o selo como hoje (sem fingir que é clicável).
ALTER TABLE public.garden_campaigns ADD COLUMN IF NOT EXISTS cta_url text;

-- get_my_garden_campaign() (20260912000000_garden_admin_operational_fixes.sql) precisa devolver
-- o novo campo também.
CREATE OR REPLACE FUNCTION public.get_my_garden_campaign()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
  v_last_activity timestamptz;
  v_campaign jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  v_state := public.get_my_garden_state();
  IF v_state IS NULL THEN RETURN NULL; END IF;

  SELECT GREATEST(
    (SELECT max(created_at) FROM diary_entries WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM questionnaire_responses WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM reading_history WHERE user_id = auth.uid()),
    (SELECT max(updated_at) FROM care_plan_action_state WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM user_history_items WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM reports WHERE user_id = auth.uid())
  ) INTO v_last_activity;

  SELECT jsonb_build_object(
    'id', c.id, 'name', c.name, 'headline', c.headline, 'body', c.body, 'cta_label', c.cta_label,
    'cta_url', c.cta_url,
    'garden_slug', c.garden_slug, 'campaign_type', c.campaign_type,
    'temporary_unlock', c.temporary_unlock
  ) INTO v_campaign
  FROM garden_campaigns c
  WHERE c.status = 'active'
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.ends_at IS NULL OR c.ends_at >= now())
    AND (
      c.audience = 'all'
      OR (c.audience = 'completed_one' AND (v_state->>'completed_gardens')::int >= 1)
      OR (c.audience = 'at_100' AND (v_state->>'garden_progress')::int >= 59)
      OR (c.audience = 'inactive' AND (v_last_activity IS NULL OR v_last_activity < now() - interval '7 days'))
      OR (c.audience = 'new_users' AND (v_state->>'completed_gardens')::int = 0 AND (v_state->>'total_growth')::int < 10)
      OR (c.audience = 'garden_users' AND c.garden_slug IS NOT NULL AND c.garden_slug = (v_state->>'garden_slug'))
    )
  ORDER BY c.starts_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  RETURN v_campaign;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_garden_campaign() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_garden_campaign() TO authenticated;
