-- ============================================================================
-- 070 — Token interno para o cron autenticar na função run-automations
-- ============================================================================
-- Remove a necessidade de o admin configurar qualquer segredo à mão. O banco
-- gera 1 token aleatório, guardado num schema privado (não exposto no PostgREST).
-- O agendador (pg_cron) manda esse token; a Edge Function lê o MESMO token via
-- RPC (get_automation_token). Batem por construção → sem 401, sem config manual.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.cron_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Gera o token uma única vez (não sobrescreve em re-execuções).
INSERT INTO private.cron_config (key, value)
VALUES ('automation_token', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (key) DO NOTHING;

-- RPC que a Edge Function usa para ler o token (somente service_role).
CREATE OR REPLACE FUNCTION public.get_automation_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$ SELECT value FROM private.cron_config WHERE key = 'automation_token' $$;

REVOKE ALL ON FUNCTION public.get_automation_token() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_automation_token() TO service_role;

-- Reagenda o cron para mandar o token interno como Bearer.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
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
        body := '{}'::jsonb
      );
    $cron$
  );
  RAISE NOTICE 'cron run-content-automations reagendado com token interno.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net indisponível (%): reagendamento ignorado.', SQLERRM;
END;
$$;
