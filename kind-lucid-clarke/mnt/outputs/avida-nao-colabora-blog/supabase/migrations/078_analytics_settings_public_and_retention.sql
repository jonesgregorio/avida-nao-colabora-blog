-- ============================================================================
-- 078 — Analytics: flags legíveis pelo site + expurgo por retenção
-- ============================================================================
-- Fase 3: faz os toggles de Configurações valerem de verdade.
--  1) O site público (anon) precisa LER as flags de rastreamento para respeitar
--     o que o admin ligou/desligou. Só o objeto `config` (booleans + retenção)
--     fica legível — nada sensível. Escrita continua restrita a admin.
--  2) Expurgo diário dos eventos antigos conforme retention_days (LGPD).
-- ============================================================================

-- 1) Leitura pública das configurações de Analytics (apenas leitura) ----------
DO $$
BEGIN
  DROP POLICY IF EXISTS analytics_settings_public_read ON analytics_settings;
  CREATE POLICY analytics_settings_public_read ON analytics_settings
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'analytics_settings public read: %', SQLERRM;
END $$;

-- 2) Função de expurgo por retenção ------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_analytics_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep_days integer;
BEGIN
  SELECT COALESCE((config->>'retention_days')::int, 365) INTO keep_days
    FROM analytics_settings WHERE id = 1;
  IF keep_days IS NULL OR keep_days < 30 THEN keep_days := 365; END IF;

  DELETE FROM analytics_events WHERE created_at < now() - (keep_days || ' days')::interval;
  -- Relatórios de IA e redirecionamentos NÃO são expurgados (registros de gestão).
END $$;

-- 3) Agenda diária às 03:30 (se pg_cron estiver disponível) ------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-analytics-events')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-analytics-events');
    PERFORM cron.schedule('purge-analytics-events', '30 3 * * *', 'SELECT purge_old_analytics_events()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'purge cron: %', SQLERRM;
END $$;
