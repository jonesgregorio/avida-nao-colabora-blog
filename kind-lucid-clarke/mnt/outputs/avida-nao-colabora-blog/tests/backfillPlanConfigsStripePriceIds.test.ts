import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// "Verificar Planos" apontava plan_configs.stripe_price_id vazio para
// Essencial e Plus como crítico. create-checkout já funcionava via fallback
// de variável de ambiente; esta migration só sincroniza o banco com o Price
// que já está em uso, sem criar Price novo nem mudar valor cobrado.

const migration = readFileSync(
  new URL('../supabase/migrations/20260905010000_backfill_plan_configs_stripe_price_ids.sql', import.meta.url),
  'utf8',
)

test('migration preenche stripe_price_id de essential e plus só quando estiver vazio', () => {
  assert.match(migration, /stripe_price_id = 'price_1Tta9bGEalchHzoSUYDGagMk'/)
  assert.match(migration, /stripe_price_id = 'price_1Tta9gGEalchHzoSSyKT8Nst'/)
  assert.match(migration, /where plan_key = 'essential'\s*\n\s*and \(stripe_price_id is null or stripe_price_id = ''\)/)
  assert.match(migration, /where plan_key = 'plus'\s*\n\s*and \(stripe_price_id is null or stripe_price_id = ''\)/)
})

test('migration não cria Price novo no Stripe (só grava no banco os IDs já existentes)', () => {
  assert.doesNotMatch(migration, /stripe\.prices\.create|stripe\.prices\.update/)
})

test('migration registra o histórico em stripe_plan_prices de forma idempotente', () => {
  assert.match(migration, /insert into public\.stripe_plan_prices/)
  assert.match(migration, /on conflict \(stripe_price_id\) do nothing/)
})
