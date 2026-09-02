import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeCarePlanBasis, describeCarePlanBasis } from '../src/lib/carePlanBasis.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('normaliza records_summary no formato snake_case da automação (cron)', () => {
  const basis = normalizeCarePlanBasis({
    active_days: 18, total_checkins: 21, total_main_diaries: 11,
    emotional_markers: [{ tag: 'ansiedade', count: 4 }],
    contexts: [{ tag: 'trabalho', count: 3 }],
    needs: [{ tag: 'descanso', count: 2 }],
    care_actions: [{ tag: 'respiração', count: 5 }],
    real_triggers: [{ tag: 'prazo apertado', count: 2 }],
    data_quality: { message: 'Há registros suficientes para uma leitura cuidadosa do período.' },
  })
  assert.deepEqual(basis, {
    activeDays: 18, checkinCount: 21, diaryCount: 11,
    emotionalMarkers: ['ansiedade'], contexts: ['trabalho'], needs: ['descanso'],
    careActions: ['respiração'], realTriggers: ['prazo apertado'],
    dataQualityMessage: 'Há registros suficientes para uma leitura cuidadosa do período.',
  })
})

test('normaliza records_summary no formato camelCase da geração manual (Admin)', () => {
  const basis = normalizeCarePlanBasis({
    activeDays: 9, checkinCount: 5, diaryCount: 4,
    emotionalMarkers: [{ tag: 'cansaço', count: 2 }],
    contexts: [], needs: [], careActions: [], realTriggers: [],
  })
  assert.equal(basis?.activeDays, 9)
  assert.equal(basis?.checkinCount, 5)
  assert.equal(basis?.diaryCount, 4)
  assert.deepEqual(basis?.emotionalMarkers, ['cansaço'])
})

test('sem records_summary retorna null', () => {
  assert.equal(normalizeCarePlanBasis(null), null)
  assert.equal(normalizeCarePlanBasis(undefined), null)
})

test('frase resumida para o usuário não menciona IA', () => {
  const basis = normalizeCarePlanBasis({ active_days: 18, total_checkins: 21, total_main_diaries: 11 })!
  const text = describeCarePlanBasis(basis, 'julho de 2026')
  assert.equal(text, 'Este plano considera seus registros de julho de 2026, incluindo 21 check-ins e 11 registros de diário.')
  assert.doesNotMatch(text, /\bIA\b/)
})

test('Admin mostra "Base deste plano" e usuário mostra frase resumida sem termos de IA', () => {
  const admin = read('src/components/admin/AdminMonthlyCarePlans.tsx')
  assert.match(admin, /Base deste plano/)
  assert.match(admin, /normalizeCarePlanBasis/)

  const user = read('src/components/SelfCarePlanPageLegacy.tsx')
  assert.match(user, /describeCarePlanBasis/)
})
