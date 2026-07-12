-- ============================================================================
-- 073 — Sincronização mensal automática das tarefas de personalização
-- ============================================================================
-- Decide sozinho QUEM recebe conteúdo personalizado no mês: cria 1 tarefa
-- 'monthly_summary' (pendente) por usuário PAGO ativo, sem o admin abrir a
-- página. O robô run-automations depois gera o rascunho (fila de revisão);
-- o ENVIO continua manual. Idempotente via UNIQUE(user_id,task_key,period_key).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_monthly_personalization()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := to_char(now(), 'YYYY-MM');
  v_count  int := 0;
BEGIN
  INSERT INTO user_personalization_tasks
    (user_id, plan_key, task_key, task_title, task_description, content_type, target_area, period_key, status, due_at, expires_at)
  SELECT p.user_id, p.plan, 'monthly_summary', 'Resumo mensal simples',
         'Resumo personalizado do mês com base nos registros da pessoa.',
         'monthly_summary', 'reports', v_period, 'pending',
         (date_trunc('month', now()) + interval '1 month' - interval '1 second')::timestamptz,
         (date_trunc('month', now()) + interval '1 month' + interval '10 days')::timestamptz
  FROM profiles p
  WHERE p.plan IN ('essential', 'plus', 'therapeutic', 'therapeutic-plus')
    AND COALESCE(p.subscription_status, 'active') IN ('active', 'trialing')
  ON CONFLICT (user_id, task_key, period_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_monthly_personalization() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_monthly_personalization() TO service_role;

-- Roda uma vez agora, para já criar as pendências do mês atual.
SELECT public.sync_monthly_personalization();

-- Agenda todo dia 1 às 03:00 (tolerante se pg_cron não existir).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('sync-monthly-personalization', '0 3 1 * *', 'SELECT public.sync_monthly_personalization();');
  RAISE NOTICE 'cron sync-monthly-personalization agendado (dia 1, 03:00).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível (%): agendamento ignorado.', SQLERRM;
END;
$$;
