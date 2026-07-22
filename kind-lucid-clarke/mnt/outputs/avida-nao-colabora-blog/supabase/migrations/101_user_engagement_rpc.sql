-- ============================================================================
-- 101 — Engajamento por usuário (para o Admin → Engajamento)
-- ============================================================================
-- RPC admin-only que retorna, POR USUÁRIO, a última atividade em cada frente
-- (check-in, diário, questionário, conteúdo lido, acesso ao site) + contagens
-- dos últimos 30 dias. Assim o admin vê quem está ativo, onde cada um interage,
-- e quem está inativo (a UI calcula "dias sem interagir" a partir de last_activity).
--
-- Fonte dos sinais:
--   • check-in / diário → diary_entries.entry_type ('checkin' | 'diary')
--   • questionário      → questionnaire_responses
--   • conteúdo lido     → reading_history (gravação ainda parcial no app)
--   • acesso ao site    → profiles.last_seen_at (RPC touch_last_seen no boot)
-- SECURITY DEFINER + guarda is_admin() (a função expõe e-mails de todos).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_engagement()
RETURNS TABLE (
  user_id            uuid,
  full_name          text,
  email              text,
  plan               text,
  role               text,
  created_at         timestamptz,
  last_seen_at       timestamptz,
  last_checkin       timestamptz,
  last_diary         timestamptz,
  last_questionnaire timestamptz,
  last_content       timestamptz,
  last_activity      timestamptz,
  checkins_30d       integer,
  diaries_30d        integer,
  questionnaires_30d integer,
  contents_30d       integer,
  checkins_total     integer,
  diaries_total      integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  WITH di AS (
    SELECT d.user_id,
      max(d.created_at) FILTER (WHERE d.entry_type = 'checkin')          AS last_checkin,
      max(d.created_at) FILTER (WHERE d.entry_type = 'diary')            AS last_diary,
      max(d.created_at)                                                  AS last_any,
      count(*) FILTER (WHERE d.entry_type = 'checkin' AND d.created_at > now() - interval '30 days') AS checkins_30d,
      count(*) FILTER (WHERE d.entry_type = 'diary'   AND d.created_at > now() - interval '30 days') AS diaries_30d,
      count(*) FILTER (WHERE d.entry_type = 'checkin')                   AS checkins_total,
      count(*) FILTER (WHERE d.entry_type = 'diary')                     AS diaries_total
    FROM diary_entries d
    GROUP BY d.user_id
  ),
  qr AS (
    SELECT q.user_id,
      max(q.created_at) AS last_questionnaire,
      count(*) FILTER (WHERE q.created_at > now() - interval '30 days') AS questionnaires_30d
    FROM questionnaire_responses q
    WHERE q.user_id IS NOT NULL
    GROUP BY q.user_id
  ),
  rh AS (
    SELECT r.user_id,
      max(r.created_at) AS last_content,
      count(*) FILTER (WHERE r.created_at > now() - interval '30 days') AS contents_30d
    FROM reading_history r
    GROUP BY r.user_id
  )
  SELECT
    p.user_id,
    p.full_name,
    p.email,
    p.plan,
    COALESCE(p.role, 'user') AS role,
    p.created_at,
    p.last_seen_at,
    di.last_checkin,
    di.last_diary,
    qr.last_questionnaire,
    rh.last_content,
    GREATEST(p.last_seen_at, di.last_any, qr.last_questionnaire, rh.last_content) AS last_activity,
    COALESCE(di.checkins_30d, 0)::int,
    COALESCE(di.diaries_30d, 0)::int,
    COALESCE(qr.questionnaires_30d, 0)::int,
    COALESCE(rh.contents_30d, 0)::int,
    COALESCE(di.checkins_total, 0)::int,
    COALESCE(di.diaries_total, 0)::int
  FROM profiles p
  LEFT JOIN di ON di.user_id = p.user_id
  LEFT JOIN qr ON qr.user_id = p.user_id
  LEFT JOIN rh ON rh.user_id = p.user_id
  ORDER BY last_activity DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_engagement() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_engagement() TO authenticated;
