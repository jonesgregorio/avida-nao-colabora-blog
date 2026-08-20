-- Item 3 — preço de cobrança canônico + histórico de Prices Stripe.
-- Mantém assinaturas existentes no Price antigo; apenas novas assinaturas e futuras
-- trocas passam a usar o Price marcado como atual em plan_configs.

ALTER TABLE public.plan_configs
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'brl',
  ADD COLUMN IF NOT EXISTS price_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS public.stripe_plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL CHECK (plan_key IN ('essential','plus')),
  stripe_price_id text NOT NULL UNIQUE,
  stripe_product_id text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'brl',
  active_for_new boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_plan_prices_one_active_per_plan
  ON public.stripe_plan_prices(plan_key)
  WHERE active_for_new;

ALTER TABLE public.stripe_plan_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_plan_prices FROM anon, authenticated;
GRANT ALL ON public.stripe_plan_prices TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_plan_pricing()
RETURNS TABLE(plan_key text, label text, display_price text, price_cents integer, currency text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pc.plan_key, pc.label, pc.price, pc.price_cents, coalesce(pc.price_currency, 'brl')
  FROM public.plan_configs pc
  WHERE pc.plan_key IN ('free','essential','plus') AND pc.active = true
  ORDER BY CASE pc.plan_key WHEN 'free' THEN 1 WHEN 'essential' THEN 2 WHEN 'plus' THEN 3 ELSE 9 END;
$$;

REVOKE ALL ON FUNCTION public.get_public_plan_pricing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_plan_pricing() TO anon, authenticated, service_role;

COMMENT ON COLUMN public.plan_configs.price IS
  'Texto de exibição. Para planos pagos é sincronizado automaticamente ao alterar o Price real via admin-plan-pricing.';
COMMENT ON COLUMN public.plan_configs.stripe_price_id IS
  'Price Stripe atual usado em novas assinaturas e futuras trocas de plano.';
COMMENT ON TABLE public.stripe_plan_prices IS
  'Histórico de Price IDs Stripe por plano. Mantém o webhook capaz de reconhecer assinaturas legadas após reajustes.';
