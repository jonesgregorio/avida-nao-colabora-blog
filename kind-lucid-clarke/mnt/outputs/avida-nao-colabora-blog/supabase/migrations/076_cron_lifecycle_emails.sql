-- ============================================================================
-- 076 — Agendador dos e-mails de ciclo de vida (pg_cron + pg_net)
-- ============================================================================
-- Roda 1x por dia (12:00 UTC ≈ 09:00 BRT) e chama a Edge Function
-- run-lifecycle-emails, que dispara automaticamente, por regra e com dedup:
--   • reengagement_inactive (sem diário há 30+ dias)
--   • checkin_reminder (sem diário entre 7 e 29 dias)
--   • weekly_report_available (segundas, Essencial+)
--   • trial_ending (teste terminando em ≤3 dias)
--   • new_content_published (conteúdo novo nas últimas 24h, respeitando plano)
-- Autentica pelo token interno (private.cron_config, migration 070). Tolerante.
-- ============================================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  PERFORM cron.schedule(
    'run-lifecycle-emails',
    '0 12 * * *',
    $cron$
      select net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-lifecycle-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 40000
      );
    $cron$
  );
  RAISE NOTICE 'cron run-lifecycle-emails agendado (diário 12:00 UTC).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net indisponível (%): agendamento ignorado.', SQLERRM;
END;
$$;
