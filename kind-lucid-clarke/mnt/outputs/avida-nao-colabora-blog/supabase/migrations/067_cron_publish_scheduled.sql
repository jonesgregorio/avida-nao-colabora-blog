-- ============================================================================
-- 063 — Publicação AUTOMÁTICA de conteúdos agendados (pg_cron)
-- ============================================================================
-- Executa dentro do Postgres (sem dashboard, sem segredo externo). A função
-- publica artigos 'scheduled' cujo horário já venceu e registra a execução nas
-- automações ativas do tipo 'publish_scheduled'. Agendada via pg_cron a cada
-- 10 minutos. Se pg_cron não estiver disponível, a migration NÃO falha — o
-- botão manual "Publicar agendados vencidos" continua como alternativa.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_due_scheduled()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE articles
    SET status = 'published',
        published_at = COALESCE(published_at, now()),
        updated_at = now()
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO n FROM upd;

  -- Marca execução nas automações ativas de publicação (se a tabela existir).
  BEGIN
    UPDATE content_automations
      SET last_run_at = now(),
          last_result = 'Publicados: ' || n,
          next_run_at = now() + interval '10 minutes'
      WHERE type = 'publish_scheduled' AND status = 'active';
  EXCEPTION WHEN undefined_table THEN
    NULL; -- content_automations ainda não migrou; ignora.
  END;

  RETURN n;
END;
$$;

-- Só o postgres/serviço executa a função (cron roda como owner).
REVOKE ALL ON FUNCTION public.publish_due_scheduled() FROM public;

-- Agendamento via pg_cron — tolerante se a extensão/permissão não existir.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'publish-due-scheduled',
    '*/10 * * * *',
    'SELECT public.publish_due_scheduled();'
  );
  RAISE NOTICE 'pg_cron: job publish-due-scheduled agendado (a cada 10 min).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível (%): agendamento ignorado; use o botão manual.', SQLERRM;
END;
$$;
