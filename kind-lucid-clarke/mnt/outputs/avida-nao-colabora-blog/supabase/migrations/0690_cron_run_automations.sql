-- ============================================================================
-- 069 — Agendador das automações de geração por IA (pg_cron + pg_net)
-- ============================================================================
-- De hora em hora, chama a Edge Function run-automations, que gera 1 rascunho
-- por automação ativa e vencida (pela frequência). A função é autenticada pelo
-- SERVICE ROLE, lido do Vault do Supabase. Tolerante: se pg_cron/pg_net/Vault
-- não estiverem prontos, a migration NÃO falha (o job só não roda).
--
-- >>> PASSO ÚNICO DE CREDENCIAL (uma vez, no SQL Editor do Supabase) <<<
--     select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--     (pegue a service_role key em Project Settings → API. Sem isso, o cron
--      dispara mas recebe 401 e não faz nada — nada quebra.)
-- ============================================================================

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
          'Authorization', 'Bearer ' || coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'), ''
          )
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
  RAISE NOTICE 'cron run-content-automations agendado (de hora em hora).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net/Vault indisponível (%): agendamento ignorado.', SQLERRM;
END;
$$;
