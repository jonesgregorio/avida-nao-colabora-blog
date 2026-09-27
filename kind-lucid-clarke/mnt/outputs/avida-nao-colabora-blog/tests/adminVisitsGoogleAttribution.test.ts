import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AdminVisitsSourceCard.tsx'), 'utf8')

test('AdminVisitsSourceCard separa busca orgânica, anúncio e Google sem evidência suficiente', () => {
  assert.ok(source.includes("'Google — Busca orgânica'"))
  assert.ok(source.includes("'Google — Anúncio'"))
  assert.ok(source.includes("'Google — outra origem'"))
  assert.ok(source.includes("clickId === 'gclid'"))
  assert.ok(source.includes("method === 'referrer'"))
})

test('AdminVisitsSourceCard não apresenta Google genérico como prova automática de busca orgânica', () => {
  assert.ok(source.includes("return 'Google — outra origem'"))
  assert.ok(source.includes('os dados disponíveis não permitem afirmar qual tipo'))
})
