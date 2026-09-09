-- Meu Jardim v3: crescimento contínuo, mudanças mais frequentes e ciclos infinitos.
-- Um único check-in não altera sozinho o jardim, mas poucos momentos significativos já podem gerar uma pequena transformação.
CREATE OR REPLACE FUNCTION public.get_my_garden_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (SELECT auth.uid() AS uid),
di AS (
  SELECT
    count(DISTINCT COALESCE(date, created_at::date)) FILTER (WHERE entry_type='checkin')::int checkin_days,
    count(DISTINCT COALESCE(date, created_at::date)) FILTER (WHERE entry_type='diary')::int diary_days
  FROM diary_entries, me WHERE user_id=uid
), qr AS (
  SELECT count(DISTINCT created_at::date)::int days FROM questionnaire_responses, me WHERE user_id=uid
), rh AS (
  SELECT count(DISTINCT created_at::date)::int days FROM reading_history, me WHERE user_id=uid
), cp AS (
  SELECT count(DISTINCT updated_at::date)::int days,
         count(*) FILTER (WHERE outcome='helped')::int helped
  FROM care_plan_action_state, me WHERE user_id=uid AND outcome IS NOT NULL
), hi AS (
  SELECT count(*)::int milestones FROM user_history_items, me WHERE user_id=uid AND item_type='milestone'
), re AS (
  SELECT count(*)::int reports FROM reports, me WHERE user_id=uid
), active_days_source AS (
  SELECT COALESCE(date, created_at::date)::date AS day FROM diary_entries, me WHERE user_id=uid
  UNION SELECT created_at::date FROM questionnaire_responses, me WHERE user_id=uid
  UNION SELECT created_at::date FROM reading_history, me WHERE user_id=uid
  UNION SELECT updated_at::date FROM care_plan_action_state, me WHERE user_id=uid AND outcome IS NOT NULL
  UNION SELECT created_at::date FROM user_history_items, me WHERE user_id=uid AND item_type='milestone'
  UNION SELECT created_at::date FROM reports, me WHERE user_id=uid
), active AS (
  SELECT count(DISTINCT day)::int active_days FROM active_days_source WHERE day IS NOT NULL
), signals AS (
  SELECT
    COALESCE(di.checkin_days,0) checkin_days,
    COALESCE(di.diary_days,0) diary_days,
    COALESCE(qr.days,0) questionnaire_days,
    COALESCE(rh.days,0) content_days,
    COALESCE(cp.days,0) care_days,
    COALESCE(cp.helped,0) helped,
    COALESCE(hi.milestones,0) milestones,
    COALESCE(re.reports,0) reports,
    COALESCE(active.active_days,0) active_days,
    (CASE WHEN COALESCE(di.checkin_days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(di.diary_days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(qr.days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(rh.days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(cp.days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(hi.milestones,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(re.reports,0)>0 THEN 1 ELSE 0 END)::int diversity,
    (COALESCE(di.checkin_days,0) +
     COALESCE(di.diary_days,0)*2 +
     COALESCE(qr.days,0)*2 +
     COALESCE(rh.days,0) +
     COALESCE(cp.days,0)*2 +
     COALESCE(cp.helped,0) +
     COALESCE(hi.milestones,0)*3 +
     COALESCE(re.reports,0)*2)::int raw_growth
  FROM di, qr, rh, cp, hi, re, active
), qualified AS (
  SELECT *, CASE
    WHEN raw_growth < 2 THEN 0
    WHEN active_days < 2 AND diversity < 2 THEN 0
    ELSE raw_growth
  END::int AS growth
  FROM signals
), cycle AS (
  SELECT *,
    floor(growth / 18.0)::int AS garden_index,
    (growth % 18)::int AS garden_progress
  FROM qualified
), staged AS (
  SELECT *, CASE
    WHEN garden_progress < 2 THEN 0
    WHEN garden_progress < 5 THEN 1
    WHEN garden_progress < 8 THEN 2
    WHEN garden_progress < 11 THEN 3
    WHEN garden_progress < 14 THEN 4
    WHEN garden_progress < 17 THEN 5
    ELSE 6
  END AS stage
  FROM cycle
)
SELECT jsonb_build_object(
  'stage', stage,
  'active_days', active_days,
  'diversity', diversity,
  'garden_index', garden_index,
  'garden_progress', garden_progress,
  'completed_gardens', garden_index,
  'total_growth', growth,
  'signals', jsonb_build_object(
    'checkin_days',checkin_days,
    'diary_days',diary_days,
    'questionnaire_days',questionnaire_days,
    'content_days',content_days,
    'care_days',care_days,
    'helped',helped,
    'milestones',milestones,
    'reports',reports
  ),
  'principle','O jardim nunca termina: poucos momentos significativos geram pequenas mudanças; ao amadurecer, um jardim é preservado e outro começa automaticamente.'
) FROM staged;
$$;

REVOKE ALL ON FUNCTION public.get_my_garden_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_garden_state() TO authenticated;
