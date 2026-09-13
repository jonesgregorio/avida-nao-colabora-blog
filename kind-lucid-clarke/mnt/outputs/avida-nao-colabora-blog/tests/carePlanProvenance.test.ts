import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const admin = read('src/components/admin/AdminLivingCarePlanWorkspace.tsx')
const runner = read('supabase/functions/run-emotional-automations/runner.ts')
const migration = read('supabase/migrations/20260826001500_care_plan_provenance.sql')

test('geração automática distingue IA de fallback determinístico', () => {
  assert.match(runner, /generated_by_ai:\s*!fallback/)
  assert.match(runner, /fallback_used:\s*fallback/)
})

test('admin persiste a origem real da geração sem reescrever generated_at ao salvar', () => {
  assert.match(admin, /const \[fallbackUsed, setFallbackUsed\] = useState\(plan\?\.fallback_used \?\? false\)/)
  assert.match(admin, /const \[generatedAt, setGeneratedAt\] = useState\(plan\?\.generated_at \?\? null\)/)
  assert.match(admin, /setGeneratedByAI\(result\.generatedByAI\)/)
  assert.match(admin, /setFallbackUsed\(!result\.generatedByAI\)/)
  assert.match(admin, /generated_at:\s*generatedAt/)
  assert.match(admin, /fallback_used:\s*next === 'skip' \? false : fallbackUsed/)
})

test('edição humana é detectada pelo conteúdo e não por notas internas', () => {
  assert.match(admin, /baselineRef = useRef\(JSON\.stringify\(\{ summary, care \}\)\)/)
  assert.match(admin, /currentSnapshot = JSON\.stringify\(\{ summary, care \}\)/)
  assert.match(admin, /const edited = currentSnapshot !== baselineRef\.current/)
  assert.match(admin, /edited_by_human:\s*next === 'skip' \? false : \(\(plan\?\.edited_by_human \?\? false\) \|\| edited\)/)
  assert.match(admin, /edited_at:\s*edited \? now : \(plan\?\.edited_at \?\? null\)/)
  assert.doesNotMatch(admin, /currentSnapshot[^\n]*notes/)
})

test('envio exige revisão humana identificada', () => {
  assert.match(admin, /if \(next === 'send' && !adminId\) throw new Error/)
  assert.match(admin, /Object\.assign\(base, \{ reviewed_by: adminId, reviewed_at: now, sent_by: adminId, sent_at: now \}\)/)
})

test('migration completa a proveniência e protege combinações inválidas', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS edited_by_human boolean NOT NULL DEFAULT false/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS edited_at timestamptz/)
  assert.match(migration, /monthly_care_plans_generation_origin_check/)
  assert.match(migration, /COALESCE\(generated_by_ai, false\).*COALESCE\(fallback_used, false\)/s)
  assert.match(migration, /monthly_care_plans_sent_requires_review_check/)
  assert.match(migration, /status <> 'sent' OR \(reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL\)/)
  assert.match(migration, /monthly_care_plans_edit_timestamp_check/)
  assert.match(migration, /NOT edited_by_human OR edited_at IS NOT NULL/)
})
