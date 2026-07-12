-- ============================================================================
-- 071 — Aumenta o tempo de espera do agendador (5s → 30s)
-- ============================================================================
-- A geração por IA leva mais de 5s (timeout padrão do pg_net), então o monitor
-- (net._http_response) gravava status NULL mesmo tendo funcionado. Reagenda o
-- cron pedindo timeout de 30s, para capturar o 200 e evitar qualquer corte.
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.schedule(
    'run-content-automations',
    '0 * * * *',
    $cron$
      select net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $cron$
  );
  RAISE NOTICE 'cron run-content-automations reagendado com timeout de 30s.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível (%): reagendamento ignorado.', SQLERRM;
END;
$$;
