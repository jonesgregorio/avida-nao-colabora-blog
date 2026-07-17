-- ============================================================================
-- 093 — Vincula o desconto administrativo ao cupom real do Stripe
-- ============================================================================
-- Até aqui, as colunas discount_* (016) eram só registro: NENHUM código lia elas,
-- então o desconto nunca chegava na cobrança — o usuário pagava o valor cheio.
-- A Edge Function `admin-discount` passa a criar um Coupon no Stripe e aplicá-lo
-- na assinatura/cliente. Guardamos o ID do cupom para conseguir REMOVER depois.
--
-- Aditivo e idempotente; não altera dados existentes.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discount_stripe_coupon_id TEXT;

COMMENT ON COLUMN profiles.discount_stripe_coupon_id IS
  'ID do Coupon no Stripe que materializa o desconto administrativo (093). NULL = desconto não aplicado na cobrança.';
