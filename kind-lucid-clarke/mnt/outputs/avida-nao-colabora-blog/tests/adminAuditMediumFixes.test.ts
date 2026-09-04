import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('os 4 modais de Meu Plano têm aria-label no botão de fechar', () => {
  const src = read('src/components/MyPlanPageCore.tsx')
  assert.match(src, /aria-label="Fechar confirmação de upgrade"/)
  assert.match(src, /aria-label="Fechar confirmação de downgrade"/)
  assert.match(src, /aria-label="Fechar solicitação de cancelamento"/)
  assert.match(src, /aria-label=\{`Fechar: \$\{hasPendingDowngrade/)
})

test('dropdown de notificação não rotula Orientação Mensal como "Orientação profissional"', () => {
  const src = read('src/components/admin/AdminNotifications.tsx')
  assert.doesNotMatch(src, /Orientação profissional/)
  assert.match(src, /<option value="monthly-guidance">Orientação mensal<\/option>/)
})
