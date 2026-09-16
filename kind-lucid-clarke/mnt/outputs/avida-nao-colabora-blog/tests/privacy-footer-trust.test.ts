import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8')
const privacy = readFileSync(new URL('../src/components/PrivacyPage.tsx', import.meta.url), 'utf8')
const migration = readFileSync(
  new URL('../supabase/migrations/20260916033000_clarify_privacy_emotional_records.sql', import.meta.url),
  'utf8',
)

describe('public trust surfaces', () => {
  it('does not advertise the plan-gated emotional map in the public footer', () => {
    expect(footer).not.toContain("{ label: 'Mapa emocional', id: 'my-evolution' }")
    expect(footer).toContain("{ label: 'Planos', id: 'pricing' }")
  })

  it('explains that emotional records are private without hiding data treatment', () => {
    for (const source of [privacy, migration]) {
      expect(source).toContain('não são publicados')
      expect(source).toContain('não se tornam conteúdo público')
      expect(source).toContain('Registros emocionais — confidencialidade')
      expect(source).toContain('processados automaticamente')
    }
  })
})
