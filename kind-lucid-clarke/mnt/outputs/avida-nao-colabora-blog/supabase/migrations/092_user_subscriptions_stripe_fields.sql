-- ============================================================================
-- 092 — Campos de rastreabilidade da assinatura Stripe em user_subscriptions
-- ============================================================================
-- Melhoria da auditoria Stripe: guarda mais dados vindos do Stripe para
-- rastreabilidade/suporte (nada disso muda a lógica de plano — só registra).
-- Aditivo e idempotente; não quebra dados existentes.
-- ============================================================================

ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS price_id       TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS product_id     TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS canceled_at    TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS trial_end      TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS payment_status TEXT;

COMMENT ON COLUMN user_subscriptions.price_id IS 'Stripe price ID atual da assinatura (092)';
COMMENT ON COLUMN user_subscriptions.product_id IS 'Stripe product ID atual da assinatura (092)';
COMMENT ON COLUMN user_subscriptions.payment_status IS 'Status bruto da subscription no Stripe: active/trialing/past_due/... (092)';
