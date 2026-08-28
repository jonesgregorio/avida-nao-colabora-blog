import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('respostas prontas usam placeholders e resolvem preço canônico no uso', () => {
  const admin = read('src/components/admin/AdminSupport.tsx')
  const resolver = read('src/lib/supportTemplateVariables.ts')

  assert.match(admin, /\{\{preco_essential\}\}/)
  assert.match(admin, /\{\{preco_plus\}\}/)
  assert.doesNotMatch(admin, /Essencial \(R\$ 19,90\/mês\)/)
  assert.doesNotMatch(admin, /Plus \(R\$ 39,90\/mês\)/)
  assert.doesNotMatch(admin, /Essencial custa R\$ 19,90/)
  assert.doesNotMatch(admin, /Plus custa R\$ 39,90/)
  assert.match(admin, /usePlanPricing\(\)/)
  assert.match(admin, /resolveSupportTemplateVariables\(.*\.body, planPricing\)/s)

  assert.match(resolver, /pricing\.essential\.display/)
  assert.match(resolver, /pricing\.plus\.display/)
})
