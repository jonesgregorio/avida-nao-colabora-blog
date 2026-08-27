import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('AdminPlans não expõe mais um campo de texto livre para o preço comercial', () => {
  const admin = read('src/components/admin/AdminPlans.tsx')
  // Não deve existir input editável ligado a `price` (o campo que gerava
  // divergência entre o preço mostrado e o realmente cobrado no Stripe).
  assert.doesNotMatch(admin, /updatePlan\(plan\.key, 'price'/, 'preço não deve mais ser editável por texto livre em AdminPlans')
  assert.match(admin, /Preço exibido/)
  assert.match(admin, /Somente leitura/)
})

test('savePlans não sobrescreve plan_configs.price com valor em cache do formulário', () => {
  const admin = read('src/components/admin/AdminPlans.tsx')
  const saveFn = admin.slice(admin.indexOf('async function savePlans'), admin.indexOf('async function toggleOwnFeature'))
  assert.doesNotMatch(saveFn, /price:\s*pl\.price/, 'savePlans não deve enviar price para o upsert')
})
