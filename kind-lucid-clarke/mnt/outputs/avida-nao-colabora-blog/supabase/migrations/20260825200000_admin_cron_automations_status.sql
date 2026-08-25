-- ============================================================================
-- MISSÃO GERAL final (Parte 12 — Automações): "Auditar TODOS os crons. Criar
-- tabela no Admin: Automação / Última execução / Status / Duração / Erro."
--
-- Já existiam get_editorial_automation_health()/get_emotional_automation_health()
-- (migrations 20260817222000 e 20260817234000), mas cobrem só 2 dos 8 cron
-- jobs reais e nenhuma tela do Admin as chama — infraestrutura morta. Em vez
-- de uma terceira função estreita, expõe TODOS os jobs de cron.job
-- genericamente (não depende de uma lista fixa de nomes; um cron novo já
-- aparece sozinho).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_cron_automations_status()
RETURNS TABLE (
  jobname text,
  active boolean,
  schedule text,
  last_status text,
  last_started_at timestamptz,
  last_duration_seconds numeric,
  last_error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  RETURN QUERY
  SELECT
    j.jobname,
    j.active,
    j.schedule,
    d.status,
    d.start_time,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time))::numeric,
    -- Só o motivo técnico de erro (RAISE EXCEPTION/mensagem de retorno do
    -- pg_cron) — nunca prompt, texto de diário ou dado íntimo passa por aqui.
    CASE WHEN d.status = 'failed' THEN d.return_message ELSE NULL END
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT drd.status, drd.start_time, drd.end_time, drd.return_message
    FROM cron.job_run_details drd
    WHERE drd.jobid = j.jobid
    ORDER BY drd.start_time DESC
    LIMIT 1
  ) d ON true
  ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_automations_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cron_automations_status() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_cron_automations_status() IS
  'Status ao vivo de todos os cron jobs (nome/agendamento/última execução/erro) para o Admin. Sem segredos, sem dado íntimo — só metadados de execução.';
