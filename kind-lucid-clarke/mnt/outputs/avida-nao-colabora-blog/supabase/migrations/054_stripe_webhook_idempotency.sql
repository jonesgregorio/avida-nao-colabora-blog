-- ============================================================
-- Migration 054: Idempotência do webhook Stripe
--   Registra cada stripe_event_id processado. O webhook insere
--   o event.id ANTES de processar; se o índice único acusar
--   duplicado, o evento é ignorado (o Stripe reenvia em timeout/erro).
--   Evita duplicar: payment_events, plan_change_history, plano,
--   notificações. (Idempotente.)
-- ============================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL,
  event_type      TEXT,
  status          TEXT DEFAULT 'processing',
  error_message   TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stripe_webhook_event_id
  ON stripe_webhook_events(stripe_event_id);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Só admin lê/gerencia. O webhook usa service role, que ignora RLS.
DROP POLICY IF EXISTS "swe_admin" ON stripe_webhook_events;
CREATE POLICY "swe_admin" ON stripe_webhook_events
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
