import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const admin = read('src/components/admin/AdminMonthlyCarePlans.tsx')
const runner = read('supabase/functions/run-emotional-automations/runner.ts')
const migration = read('supabase/migrations/20260826001500_care_plan_provenance.sql')

test('geração automática distingue IA de fallback determinístico', () => {
  assert.match(runner, /generated_by_ai:\s*!fallback/)
  assert.match(runner, /fallback_used:\s*fallback/)
})

test('admin persiste a origem real da geração sem reescrever generated_at ao salvar', () => {
  assert.match(admin, /const \[fallbackUsed, setFallbackUsed\] = useState\(plan\?\.fallback_used \?\? false\)/)
  assert.match(admin, /const \[generatedAt, setGeneratedAt\] = useState<string \| null>\(plan\?\.generated_at \?\? null\)/)
  assert.match(admin, /setGeneratedByAI\(result\.generatedByAI\)/)
  assert.match(admin, /setFallbackUsed\(!result\.generatedByAI\)/)
  assert.match(admin, /setGeneratedAt\(generatedNow\)/)
  assert.match(admin, /generated_at:\s*generatedAt/)
  assert.match(admin, /fallback_used:\s*generatedByAI \? false : fallbackUsed/)
  assert.doesNotMatch(admin, /generated_at:\s*new Date\(\)\.toISOString\(\)/)
})

test('edição humana é detectada pelo conteúdo e não por notas internas', () => {
  assert.match(admin, /contentBaselineRef = useRef\(JSON\.stringify\(\{ summary, care \}\)\)/)
  assert.match(admin, /contentSnapshot = JSON\.stringify\(\{ summary, care \}\)/)
  assert.match(admin, /const editedNow = contentSnapshot !== contentBaselineRef\.current/)
  assert.match(admin, /edited_by_human:\s*editedByHuman/)
  assert.match(admin, /edited_at:\s*editedNow \? now : \(plan\?\.edited_at \?\? null\)/)
  assert.doesNotMatch(admin, /contentSnapshot[^\n]*adminNotes/)
})

test('envio exige revisão humana identificada', () => {
  assert.match(admin, /if \(next === 'send' && !adminId\) throw new Error/)
  assert.match(admin, /base\.reviewed_by = adminId; base\.reviewed_at = now/)
  assert.match(admin, /base\.sent_by = adminId; base\.sent_at = now/)
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
