-- ============================================================================
-- 085 — Aviso automático (in-app) quando o relatório do ciclo fica disponível.
--
-- Regra de negócio: o relatório semanal fecha no sábado e fica disponível no
-- domingo; o mensal fecha no último dia e fica disponível no dia 1º. Quando o
-- ciclo fecha, o usuário elegível recebe uma NOTIFICAÇÃO dentro do login
-- (sem e-mail) apontando para Relatórios (token de navegação 'my-report').
--
-- O CONTEÚDO do relatório continua sendo materializado no 1º acesso à página
-- (ensureClosedReport, client-side) — a notificação é o gatilho que leva o
-- usuário a abrir e gerar. Deduplicado por (tipo, período): não avisa 2x.
--
-- Idempotente e tolerante se pg_cron não existir.
-- ============================================================================

-- ── Semanal (Essencial e Plus) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_weekly_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE := current_date - EXTRACT(dow FROM current_date)::int; -- domingo da semana atual
  v_start      DATE := (current_date - EXTRACT(dow FROM current_date)::int) - 7; -- domingo da semana anterior
  v_end        DATE := (current_date - EXTRACT(dow FROM current_date)::int) - 1; -- sábado da semana anterior
  v_count      int := 0;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, action_url, action_data)
  SELECT p.user_id,
         'Seu relatório semanal já está disponível',
         'A síntese da sua última semana está pronta em Relatórios.',
         'report', 'my-report',
         jsonb_build_object('report_type', 'weekly', 'period_end', v_end::text)
  FROM profiles p
  WHERE p.plan IN ('essential', 'plus', 'therapeutic', 'therapeutic-plus')
    AND COALESCE(p.subscription_status, 'active') IN ('active', 'trialing')
    -- só quem registrou algo na semana (evita relatório vazio / spam)
    AND EXISTS (
      SELECT 1 FROM diary_entries d
      WHERE d.user_id = p.user_id
        AND d.created_at >= v_start::timestamptz
        AND d.created_at <  (v_end + 1)::timestamptz
    )
    -- dedupe: não avisar de novo para o mesmo período
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.user_id
        AND n.type = 'report'
        AND n.action_data->>'report_type' = 'weekly'
        AND n.action_data->>'period_end' = v_end::text
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Mensal (apenas Plus) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_monthly_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := date_trunc('month', current_date - interval '1 month')::date; -- 1º do mês anterior
  v_end   DATE := (date_trunc('month', current_date) - interval '1 day')::date; -- último dia do mês anterior
  v_count int := 0;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, action_url, action_data)
  SELECT p.user_id,
         'Seu relatório mensal aprofundado já está disponível',
         'A leitura aprofundada do seu mês está pronta em Relatórios.',
         'report', 'my-report',
         jsonb_build_object('report_type', 'monthly', 'period_end', v_end::text)
  FROM profiles p
  WHERE p.plan IN ('plus', 'therapeutic', 'therapeutic-plus')
    AND COALESCE(p.subscription_status, 'active') IN ('active', 'trialing')
    AND EXISTS (
      SELECT 1 FROM diary_entries d
      WHERE d.user_id = p.user_id
        AND d.created_at >= v_start::timestamptz
        AND d.created_at <  (v_end + 1)::timestamptz
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.user_id
        AND n.type = 'report'
        AND n.action_data->>'report_type' = 'monthly'
        AND n.action_data->>'period_end' = v_end::text
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_weekly_reports()  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_monthly_reports() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_weekly_reports()  TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_monthly_reports() TO service_role;

-- Backfill do ciclo já fechado (avisa quem ficou elegível até agora; deduplicado).
SELECT public.notify_weekly_reports();
SELECT public.notify_monthly_reports();

-- Agendamento (fuso do banco = UTC): domingo 11:00 UTC (~08:00 BRT) e dia 1 11:00 UTC.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule('notify-weekly-reports');
  PERFORM cron.unschedule('notify-monthly-reports');
EXCEPTION WHEN OTHERS THEN NULL;
END; $$;

DO $$
BEGIN
  PERFORM cron.schedule('notify-weekly-reports',  '0 11 * * 0', 'SELECT public.notify_weekly_reports();');
  PERFORM cron.schedule('notify-monthly-reports', '0 11 1 * *', 'SELECT public.notify_monthly_reports();');
  RAISE NOTICE 'crons de aviso de relatório agendados.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível (%): agendamento ignorado.', SQLERRM;
END; $$;
