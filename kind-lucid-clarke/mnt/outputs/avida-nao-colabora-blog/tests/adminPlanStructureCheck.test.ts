import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('verificação estrutural cria somente ausências e nunca sobrescreve configuração existente', () => {
  const helper = read('src/lib/planStructureCheck.ts')
  assert.match(helper, /verifyPlanStructure/)
  assert.match(helper, /\.insert\(missingFeatures\)/)
  assert.match(helper, /\.insert\(missingAccess\)/)
  assert.doesNotMatch(helper, /\.upsert\(/)
  assert.match(helper, /accessDivergences \+= 1/)
})

test('Admin troca sincronização por verificação estrutural e informa que divergências são preservadas', () => {
  const admin = read('src/components/admin/AdminPlans.tsx')
  assert.match(admin, /Verificar estrutura/)
  assert.doesNotMatch(admin, />\s*Sincronizar com Supabase\s*</)
  assert.match(admin, /Nenhuma configuração existente foi sobrescrita/)
  assert.match(admin, /divergência\(s\) existente\(s\) preservada\(s\) para revisão/)
  assert.match(admin, /verifyPlanStructure\(\)/)
})
