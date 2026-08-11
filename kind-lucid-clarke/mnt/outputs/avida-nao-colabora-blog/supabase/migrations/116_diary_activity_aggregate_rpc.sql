-- Migration 116: RPC que agrega atividade de diary_entries por usuário no banco.
-- run-lifecycle-emails carregava até 30.000 linhas cruas (user_id, created_at)
-- para o runtime da Edge Function e agregava em JavaScript (mapas de contagem
-- semanal/mensal/7-dias). Move a agregação para o Postgres via GROUP BY —
-- a função retorna 1 linha por usuário já com os totais prontos.
--
-- Semântica idêntica à função isoWeek()/monthStamp() em TypeScript (UTC,
-- semana ISO 8601): to_char com 'IYYY-IW' é o equivalente exato em SQL.

CREATE OR REPLACE FUNCTION get_diary_activity_since(p_since timestamptz)
RETURNS TABLE (
  user_id uuid,
  last_entry_at timestamptz,
  week_count integer,
  month_count integer,
  recent7_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.user_id,
    max(d.created_at) AS last_entry_at,
    count(*) FILTER (
      WHERE to_char(d.created_at AT TIME ZONE 'UTC', 'IYYY-IW') = to_char(now() AT TIME ZONE 'UTC', 'IYYY-IW')
    )::int AS week_count,
    count(*) FILTER (
      WHERE to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM') = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')
    )::int AS month_count,
    count(*) FILTER (WHERE d.created_at >= now() - interval '7 days')::int AS recent7_count
  FROM diary_entries d
  WHERE d.created_at >= p_since
  GROUP BY d.user_id;
$$;

GRANT EXECUTE ON FUNCTION get_diary_activity_since(timestamptz) TO service_role;
