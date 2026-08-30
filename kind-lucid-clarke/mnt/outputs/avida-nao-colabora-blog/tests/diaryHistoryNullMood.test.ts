import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const history = readFileSync(new URL('../src/components/DiaryHistorySection.tsx', import.meta.url), 'utf8')

test('histórico não inventa humor para Diário salvo sem marcador (Fase 19R.B)', () => {
  assert.match(history, /function hasMoodValue/)
  assert.match(history, /if \(!hasMoodValue\(row\.mood\)\) continue/)
  assert.match(history, /const meta = hasMood \? getMoodMeta\(entry\.mood\) : null/)
  assert.match(history, /Registro sem humor marcado/)
  assert.match(history, /return mood \? `Registro · \$\{mood\}` : 'Registro'/)
})
