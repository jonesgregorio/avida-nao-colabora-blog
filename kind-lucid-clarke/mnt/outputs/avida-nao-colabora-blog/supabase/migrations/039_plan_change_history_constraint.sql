-- ============================================================
-- Migration 039: ampliar CHECK constraint em plan_change_history
-- ============================================================
-- Inclui upgrade_intent e downgrade_intent usados pelo frontend
-- quando o usuário inicia um upgrade/downgrade que ainda aguarda
-- confirmação de pagamento via webhook Stripe.

ALTER TABLE plan_change_history
  DROP CONSTRAINT IF EXISTS plan_change_history_change_type_check;

ALTER TABLE plan_change_history
  ADD CONSTRAINT plan_change_history_change_type_check
  CHECK (change_type IN (
    'upgrade',
    'upgrade_intent',
    'downgrade',
    'downgrade_intent',
    'cancel',
    'reactivate',
    'admin_change'
  ));
