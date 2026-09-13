import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// get_my_garden_state()/admin_garden_users() são funções SQL/plpgsql rodando dentro do Postgres
// do Supabase — não dá pra importar/executar num teste Node puro. Igual ao resto da suíte de
// migrations deste projeto, validamos via leitura do arquivo da migration.
const migration = readFileSync(
  new URL('../supabase/migrations/20260913120000_garden_daily_growth_cap.sql', import.meta.url),
  'utf8',
)

test('cria a tabela de ledger diário do jardim, sem policy direta (só acesso via SECURITY DEFINER)', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.garden_growth_ledger/)
  assert.match(migration, /user_id uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/)
  assert.match(migration, /ALTER TABLE public\.garden_growth_ledger ENABLE ROW LEVEL SECURITY/)
})

test('get_my_garden_state() lê daily_growth_cap de garden_settings e nunca deixa o teto viajar sem limite quando ele existe', () => {
  assert.match(migration, /COALESCE\(points_per_cycle,60\)::int ppc,COALESCE\(stage_thresholds,'\[3,10,18,28,39,50\]'::jsonb\) thresholds,daily_growth_cap/)
  // sem override e sem cap configurado, comportamento é idêntico ao anterior (target_growth passa direto)
  assert.match(migration, /WHEN q\.daily_growth_cap IS NULL OR q\.daily_growth_cap<=0 THEN q\.target_growth/)
  // com override do admin, o cap é ignorado — o ajuste manual sempre vale
  assert.match(migration, /WHEN q\.forced_total_growth IS NOT NULL THEN q\.target_growth/)
})

test('o crescimento aplicado nunca regride (GREATEST contra o valor já salvo no ledger)', () => {
  const upsertBlock = migration.split('ledger_upsert AS (')[1]?.split('cycle_raw AS (')[0] ?? ''
  assert.match(upsertBlock, /GREATEST\(\s*COALESCE\(lc\.applied_growth,0\),/)
})

test('excesso do dia não é descartado: dia seguinte reabre a partir do que já foi aplicado (day_start_growth = applied_growth anterior)', () => {
  assert.match(
    migration,
    /CASE WHEN lc\.ledger_date IS NULL OR lc\.ledger_date < current_date THEN COALESCE\(lc\.applied_growth,0\) ELSE COALESCE\(lc\.day_start_growth,0\) END/,
  )
})

test('admin_garden_users() usa o mesmo ledger (read-only, sem INSERT) para mostrar o crescimento já limitado, sem duplicar a fórmula de cap', () => {
  const adminFn = migration.split('CREATE OR REPLACE FUNCTION public.admin_garden_users()')[1] ?? ''
  assert.doesNotMatch(adminFn, /INSERT INTO garden_growth_ledger/)
  assert.match(adminFn, /LEFT JOIN garden_growth_ledger gl ON gl\.user_id=q\.user_id/)
  // usuário que nunca abriu o Jardim (sem linha no ledger) não é penalizado com teto zerado
  assert.match(adminFn, /WHEN gl\.user_id IS NULL THEN q\.target_growth/)
})

test('as duas funções continuam restritas a authenticated (nunca PUBLIC/anon)', () => {
  const grants = migration.match(/GRANT EXECUTE ON FUNCTION public\.\w+\([^)]*\) TO authenticated;/g) ?? []
  assert.ok(grants.length >= 2)
  const revokes = migration.match(/REVOKE ALL ON FUNCTION public\.\w+\([^)]*\) FROM PUBLIC,anon;/g) ?? []
  assert.ok(revokes.length >= 2)
})
