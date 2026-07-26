-- ============================================================================
-- 108 — Aba Cancelamentos: agendar cancelamento no Stripe (cancel_at_period_end)
-- ============================================================================
-- Adiciona o RASTREIO da sincronização com o Stripe no registro de cancelamento
-- (subscription_change_feedback). O cancelamento em si continua sendo cancel_at
-- _period_end = true (nunca imediato) e o acesso é mantido até current_period_end.
--
-- Não mexemos no CHECK de subscription_change_feedback.status (scheduled/completed
-- /reverted) — usamos colunas SEPARADAS para o estado do envio ao Stripe.
-- Tudo aditivo/idempotente.
-- ============================================================================

ALTER TABLE subscription_change_feedback ADD COLUMN IF NOT EXISTS stripe_sent_at     TIMESTAMPTZ;
ALTER TABLE subscription_change_feedback ADD COLUMN IF NOT EXISTS stripe_sync_status TEXT;  -- null | 'success' | 'failed'
ALTER TABLE subscription_change_feedback ADD COLUMN IF NOT EXISTS stripe_error       TEXT;

COMMENT ON COLUMN subscription_change_feedback.stripe_sync_status IS
  'Estado do envio ao Stripe pela aba Cancelamentos: null=não enviado, success=agendado, failed=erro (108).';

-- subscription_events: novo tipo de evento p/ o agendamento feito pelo admin.
-- O CHECK foi criado inline (nome auto-gerado); descobrimos o nome real e o
-- recriamos como superconjunto — seguro pois todas as linhas existentes já usam
-- valores permitidos.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'subscription_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%event_type%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE subscription_events DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE subscription_events ADD CONSTRAINT subscription_events_event_type_check
    CHECK (event_type IN (
      'subscription_created','checkout_completed','payment_confirmed','payment_failed',
      'subscription_renewed','upgrade_confirmed','downgrade_requested','downgrade_completed',
      'cancellation_requested','cancellation_completed','subscription_deleted','plan_changed',
      'cancellation_scheduled_in_stripe'
    ));
END $$;
