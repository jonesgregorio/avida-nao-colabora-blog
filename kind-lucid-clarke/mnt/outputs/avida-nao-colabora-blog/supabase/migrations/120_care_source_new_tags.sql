-- ============================================================================
-- Migration 120: admin_monthly_care_source passa a devolver as novas tags
-- (context_tags, need_tags, care_action_tags, trigger_tags) — sem isso, o
-- Plano de Autocuidado (careePlanAI.ts) nunca recebe esses dados, mesmo já
-- sabendo usá-los (§16).
--
-- Mantém a mesma regra de privacidade da 087: NUNCA devolve texto livre do
-- diário, só campos analíticos/tags.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_monthly_care_source(p_user UUID, p_start DATE, p_end DATE)
RETURNS TABLE (
  mood TEXT, mood_score INT, energy INT, anxiety_level INT,
  sleep_quality INT, self_esteem INT, stress_level INT,
  emotional_tags TEXT[], context_tags TEXT[], need_tags TEXT[], care_action_tags TEXT[], trigger_tags TEXT[],
  entry_type TEXT, created_at TIMESTAMPTZ, entry_date DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT
      d.mood::text,
      d.mood_score::int,
      d.energy::int,
      d.anxiety_level::int,
      d.sleep_quality::int,
      d.self_esteem::int,
      d.stress_level::int,
      COALESCE(d.emotional_tags, '{}'::text[]),
      COALESCE(d.context_tags, '{}'::text[]),
      COALESCE(d.need_tags, '{}'::text[]),
      COALESCE(d.care_action_tags, '{}'::text[]),
      COALESCE(d.trigger_tags, '{}'::text[]),
      d.entry_type::text,
      d.created_at,
      COALESCE(d.date, d.created_at::date)
    FROM diary_entries d
    WHERE d.user_id = p_user
      AND COALESCE(d.date, d.created_at::date) BETWEEN p_start AND p_end;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_monthly_care_source(UUID, DATE, DATE) TO authenticated;
