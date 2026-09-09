-- Meu Jardim v4: restaura um ritmo próximo ao modelo histórico de 60 passos,
-- sem perder os sinais adicionais do ecossistema AVNC.
--
-- Princípios:
-- - um Check-in isolado nunca gera uma mudança visual;
-- - dias de presença continuam sendo a base principal, como no modelo original;
-- - relatórios e marcos mantêm pesos próximos à lógica histórica;
-- - outros recursos contribuem de forma limitada para não acelerar demais o ciclo;
-- - o jardim permanece infinito: a cada 60 unidades um novo jardim começa.
CREATE OR REPLACE FUNCTION public.get_my_garden_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (
  SELECT auth.uid() AS uid
),
di AS (
  SELECT
    count(DISTINCT COALESCE(date, created_at::date))::int AS active_days,
    count(DISTINCT COALESCE(date, created_at::date)) FILTER (WHERE entry_type = 'checkin')::int AS checkin_days,
    count(DISTINCT COALESCE(date, created_at::date)) FILTER (WHERE entry_type = 'diary')::int AS diary_days
  FROM diary_entries, me
  WHERE user_id = uid
),
qr AS (
  SELECT count(*)::int AS responses,
         count(DISTINCT created_at::date)::int AS days
  FROM questionnaire_responses, me
  WHERE user_id = uid
),
rh AS (
  SELECT count(*)::int AS reads,
         count(DISTINCT created_at::date)::int AS days
  FROM reading_history, me
  WHERE user_id = uid
),
cp AS (
  SELECT count(DISTINCT updated_at::date)::int AS days,
         count(*) FILTER (WHERE outcome = 'helped')::int AS helped
  FROM care_plan_action_state, me
  WHERE user_id = uid AND outcome IS NOT NULL
),
hi AS (
  SELECT count(*) FILTER (WHERE item_type = 'milestone')::int AS milestones
  FROM user_history_items, me
  WHERE user_id = uid
),
re AS (
  SELECT count(*)::int AS reports
  FROM reports, me
  WHERE user_id = uid
),
signals AS (
  SELECT
    COALESCE(di.active_days, 0) AS active_days,
    COALESCE(di.checkin_days, 0) AS checkin_days,
    COALESCE(di.diary_days, 0) AS diary_days,
    COALESCE(qr.responses, 0) AS questionnaire_responses,
    COALESCE(qr.days, 0) AS questionnaire_days,
    COALESCE(rh.reads, 0) AS content_reads,
    COALESCE(rh.days, 0) AS content_days,
    COALESCE(cp.days, 0) AS care_days,
    COALESCE(cp.helped, 0) AS helped,
    COALESCE(hi.milestones, 0) AS milestones,
    COALESCE(re.reports, 0) AS reports,
    (
      CASE WHEN COALESCE(di.checkin_days, 0) > 0 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(di.diary_days, 0) > 0 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(qr.responses, 0) > 0 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(rh.reads, 0) > 0 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(cp.days, 0) > 0 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(hi.milestones, 0) > 0 THEN 1 ELSE 0 END +
      CASE WHEN COALESCE(re.reports, 0) > 0 THEN 1 ELSE 0 END
    )::int AS diversity,
    (
      -- Base histórica: dias com Diário/Check-in.
      COALESCE(di.active_days, 0) +
      -- Mantém o peso histórico de relatórios e marcos.
      COALESCE(re.reports, 0) * 2 +
      COALESCE(hi.milestones, 0) * 3 +
      -- Questionários ajudam, mas têm contribuição limitada por jardim acumulado.
      LEAST(COALESCE(qr.responses, 0), 3) +
      -- Conteúdo contribui por constância, sem transformar cada leitura em ponto.
      CASE
        WHEN COALESCE(rh.days, 0) >= 3 THEN 2
        WHEN COALESCE(rh.days, 0) >= 1 THEN 1
        ELSE 0
      END +
      -- Plano de Autocuidado contribui de forma moderada.
      CASE
        WHEN COALESCE(cp.days, 0) >= 2 THEN 2
        WHEN COALESCE(cp.days, 0) >= 1 THEN 1
        ELSE 0
      END +
      LEAST(COALESCE(cp.helped, 0), 5)
    )::int AS raw_growth
  FROM di, qr, rh, cp, hi, re
),
qualified AS (
  SELECT *,
    CASE
      WHEN raw_growth < 3 THEN 0
      WHEN active_days < 2 AND diversity < 2 THEN 0
      ELSE raw_growth
    END::int AS growth
  FROM signals
),
cycle AS (
  SELECT *,
    floor(growth / 60.0)::int AS garden_index,
    (growth % 60)::int AS garden_progress
  FROM qualified
),
staged AS (
  SELECT *,
    CASE
      WHEN garden_progress < 3 THEN 0
      WHEN garden_progress < 10 THEN 1
      WHEN garden_progress < 18 THEN 2
      WHEN garden_progress < 28 THEN 3
      WHEN garden_progress < 39 THEN 4
      WHEN garden_progress < 50 THEN 5
      ELSE 6
    END::int AS stage
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
  'growth_model_version', 4,
  'signals', jsonb_build_object(
    'checkin_days', checkin_days,
    'diary_days', diary_days,
    'questionnaire_responses', questionnaire_responses,
    'questionnaire_days', questionnaire_days,
    'content_reads', content_reads,
    'content_days', content_days,
    'care_days', care_days,
    'helped', helped,
    'milestones', milestones,
    'reports', reports
  ),
  'principle', 'O jardim cresce em um ritmo equilibrado, próximo ao modelo histórico de 60 passos, e nunca termina.'
)
FROM staged;
$$;

REVOKE ALL ON FUNCTION public.get_my_garden_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_garden_state() TO authenticated;