-- Meu Jardim v2: crescimento por cuidado significativo, sem pontos visíveis.
-- Um gesto isolado nunca desbloqueia elemento: o motor exige dias distintos + diversidade.
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
    count(DISTINCT date) FILTER (WHERE entry_type='checkin')::int checkin_days,
    count(DISTINCT date) FILTER (WHERE entry_type='diary')::int diary_days,
    count(DISTINCT date)::int diary_active_days
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
), signals AS (
  SELECT COALESCE(di.checkin_days,0) checkin_days, COALESCE(di.diary_days,0) diary_days,
    COALESCE(qr.days,0) questionnaire_days, COALESCE(rh.days,0) content_days,
    COALESCE(cp.days,0) care_days, COALESCE(cp.helped,0) helped,
    COALESCE(hi.milestones,0) milestones, COALESCE(re.reports,0) reports,
    (CASE WHEN COALESCE(di.checkin_days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(di.diary_days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(qr.days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(rh.days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(cp.days,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(hi.milestones,0)>0 THEN 1 ELSE 0 END +
     CASE WHEN COALESCE(re.reports,0)>0 THEN 1 ELSE 0 END)::int diversity,
    GREATEST(COALESCE(di.diary_active_days,0), COALESCE(qr.days,0), COALESCE(rh.days,0), COALESCE(cp.days,0))::int active_days,
    (LEAST(COALESCE(di.checkin_days,0),30) + LEAST(COALESCE(di.diary_days,0),20)*2 +
     LEAST(COALESCE(qr.days,0),10)*2 + LEAST(COALESCE(rh.days,0),20) +
     LEAST(COALESCE(cp.days,0),15)*3 + LEAST(COALESCE(cp.helped,0),10)*2 +
     LEAST(COALESCE(hi.milestones,0),10)*4 + LEAST(COALESCE(re.reports,0),12)*2)::int score
  FROM di,qr,rh,cp,hi,re
), gated AS (
  SELECT *, CASE
    WHEN active_days < 3 OR diversity < 2 OR score < 6 THEN 0
    WHEN active_days < 5 OR diversity < 2 OR score < 14 THEN 1
    WHEN active_days < 8 OR diversity < 3 OR score < 24 THEN 2
    WHEN active_days < 12 OR diversity < 3 OR score < 38 THEN 3
    WHEN active_days < 18 OR diversity < 4 OR score < 56 THEN 4
    WHEN active_days < 25 OR diversity < 4 OR score < 78 THEN 5
    ELSE 6 END AS stage
  FROM signals
)
SELECT jsonb_build_object(
  'stage',stage,
  'active_days',active_days,
  'diversity',diversity,
  'signals',jsonb_build_object('checkin_days',checkin_days,'diary_days',diary_days,'questionnaire_days',questionnaire_days,'content_days',content_days,'care_days',care_days,'helped',helped,'milestones',milestones,'reports',reports),
  'principle','O jardim reconhece constância, variedade e cuidado ao longo do tempo; um gesto isolado nunca gera um desbloqueio.'
) FROM gated;
$$;
REVOKE ALL ON FUNCTION public.get_my_garden_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_garden_state() TO authenticated;
