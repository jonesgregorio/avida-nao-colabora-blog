-- Rede de segurança do e-mail de boas-vindas (pg_cron + pg_net)
-- O envio principal ocorre no navegador ao confirmar o e-mail; se a pessoa fecha a aba
-- ou abre o link num navegador interno, o e-mail se perdia. A cada 15 min chamamos a
-- run-lifecycle-emails em modo {"only":"welcome"}, que envia as boas-vindas pendentes
-- de confirmações das últimas 24h. Idempotente (welcome:<user_id>). Mesma autenticação
-- do cron diário (private.cron_config.automation_token). Tolerante se pg_cron faltar.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  PERFORM cron.unschedule('run-welcome-emails-safety-net')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-welcome-emails-safety-net');
  PERFORM cron.schedule(
    'run-welcome-emails-safety-net',
    '*/15 * * * *',
    $cron$
      select net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-lifecycle-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{"only":"welcome"}'::jsonb,
        timeout_milliseconds := 30000
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net indisponível (%): agendamento ignorado.', SQLERRM;
END;
$$;
