-- ============================================================================
-- Preenche plan_configs.stripe_price_id / stripe_product_id para Essencial e
-- Plus, que estavam vazios no banco. create-checkout já funcionava porque cai
-- para as variáveis de ambiente (STRIPE_PRICE_ESSENTIAL/STRIPE_PRICE_PLUS_3990)
-- quando esta coluna está vazia — isto só sincroniza o banco com o Price que
-- JÁ está em uso hoje, sem criar nenhum Price novo no Stripe nem mudar valor
-- cobrado. IDs confirmados pelo usuário direto no Dashboard do Stripe
-- (dashboard.stripe.com/prices) em 2026-09-05.
--
-- ADITIVO/IDEMPOTENTE: só atualiza se a coluna ainda estiver vazia — nunca
-- sobrescreve um stripe_price_id que já exista (preserva qualquer configuração
-- feita depois via admin-plan-pricing).
-- ============================================================================

update public.plan_configs
set
  stripe_price_id = 'price_1Tta9bGEalchHzoSUYDGagMk',
  stripe_product_id = 'prod_Une4ze8fy2s33I',
  price_cents = coalesce(price_cents, 1990),
  price_currency = coalesce(price_currency, 'brl'),
  price_synced_at = now(),
  updated_at = now()
where plan_key = 'essential'
  and (stripe_price_id is null or stripe_price_id = '');

update public.plan_configs
set
  stripe_price_id = 'price_1Tta9gGEalchHzoSSyKT8Nst',
  stripe_product_id = 'prod_Une4Q2C3G2EzAh',
  price_cents = coalesce(price_cents, 3990),
  price_currency = coalesce(price_currency, 'brl'),
  price_synced_at = now(),
  updated_at = now()
where plan_key = 'plus'
  and (stripe_price_id is null or stripe_price_id = '');

-- Também registra no histórico (stripe_plan_prices), se a tabela já existir
-- (migration 20260820023000) e o Price ainda não estiver lá.
insert into public.stripe_plan_prices (plan_key, stripe_price_id, stripe_product_id, amount_cents, currency, active_for_new)
select 'essential', 'price_1Tta9bGEalchHzoSUYDGagMk', 'prod_Une4ze8fy2s33I', 1990, 'brl', true
where not exists (
  select 1 from public.stripe_plan_prices where stripe_price_id = 'price_1Tta9bGEalchHzoSUYDGagMk'
)
on conflict (stripe_price_id) do nothing;

insert into public.stripe_plan_prices (plan_key, stripe_price_id, stripe_product_id, amount_cents, currency, active_for_new)
select 'plus', 'price_1Tta9gGEalchHzoSSyKT8Nst', 'prod_Une4Q2C3G2EzAh', 3990, 'brl', true
where not exists (
  select 1 from public.stripe_plan_prices where stripe_price_id = 'price_1Tta9gGEalchHzoSSyKT8Nst'
)
on conflict (stripe_price_id) do nothing;
