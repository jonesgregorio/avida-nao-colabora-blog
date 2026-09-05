import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const scriptUrl = new URL('../scripts/production-smoke-users.mjs', import.meta.url)

test('smoke de produção prefere secret key moderna e só usa service_role legado se estiver ativo', () => {
  const source = fs.readFileSync(scriptUrl, 'utf8')

  assert.match(source, /api-keys\?reveal=true/)
  assert.match(source, /key\.type === 'secret'/)
  assert.match(source, /key\.name === 'service_role'/)
  assert.match(source, /key\.disabled !== true/)
  assert.ok(
    source.indexOf("key.type === 'secret'") < source.indexOf("key.name === 'service_role'"),
    'secret key moderna deve ter precedência sobre service_role legado',
  )
})
