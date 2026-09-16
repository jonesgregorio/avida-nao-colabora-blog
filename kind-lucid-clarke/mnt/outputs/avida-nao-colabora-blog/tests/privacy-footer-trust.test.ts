import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8')
const privacy = readFileSync(new URL('../src/components/PrivacyPage.tsx', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/20260916033000_clarify_privacy_emotional_records.sql', import.meta.url),
  'utf8',
)

test('rodapé público não anuncia o Mapa Emocional, que depende de plano', () => {
  assert.doesNotMatch(footer, /label: 'Mapa emocional'/)
  assert.match(footer, /label: 'Planos'/)
})

test('privacidade explica confidencialidade sem esconder o tratamento técnico', () => {
  for (const source of [privacy, migration]) {
    assert.match(source, /não são publicados/)
    assert.match(source, /não se tornam conteúdo público/)
    assert.match(source, /Registros emocionais — confidencialidade/)
    assert.match(source, /processados automaticamente/)
  }
})
