-- ============================================================================
-- Go-live — permitir nova tentativa após falha real de envio de e-mail
-- ============================================================================
-- A idempotência continua bloqueando duplicidade enquanto o envio está pendente,
-- foi aceito/enviado ou terminou em bounce. Somente um log explicitamente `failed`
-- deixa de reservar a chave, permitindo uma nova tentativa com a mesma operação.
-- ============================================================================

DROP INDEX IF EXISTS public.email_logs_idempotency_key_idx;

CREATE UNIQUE INDEX email_logs_idempotency_key_idx
  ON public.email_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status IS DISTINCT FROM 'failed';

DO $$
DECLARE
  v_predicate text;
BEGIN
  SELECT pg_get_expr(i.indpred, i.indrelid)
    INTO v_predicate
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'email_logs_idempotency_key_idx';

  IF v_predicate IS NULL OR v_predicate NOT ILIKE '%failed%' THEN
    RAISE EXCEPTION 'go-live: índice de idempotência de e-mail não permite retry de failed';
  END IF;
END $$;
