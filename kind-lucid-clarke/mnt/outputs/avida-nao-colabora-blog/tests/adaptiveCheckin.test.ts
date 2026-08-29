import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildAdaptiveCheckinPrompt } from '../src/lib/adaptiveCheckin.ts'
import type { ContinuityPrompt } from '../src/lib/todayContinuity.ts'

function continuity(kind: ContinuityPrompt['kind']): ContinuityPrompt {
  return {
    id: `${kind}:2026-08-28`,
    kind,
    eyebrow: 'Contexto',
    title: 'Título',
    description: 'Descrição',
    action: 'Continuar',
    sourceDay: '2026-08-28',
  }
}

test('check-in adaptativo compara ansiedade sem inventar escala numérica', () => {
  const prompt = buildAdaptiveCheckinPrompt(continuity('yesterday_anxiety'))
  assert.ok(prompt)
  assert.deepEqual(prompt.choices.map(choice => choice.id), ['better', 'same', 'worse'])
  assert.match(prompt.description, /não.*inventar uma nota/i)
  assert.match(prompt.guidance.better, /não precisamos transformar.*melhor.*nota automática/i)
})

test('retorno após ausência acolhe sem exigir recuperação', () => {
  const prompt = buildAdaptiveCheckinPrompt(continuity('return'))
  assert.ok(prompt)
  assert.match(prompt.title, /sem precisar recuperar/i)
  assert.equal(prompt.choices[0]?.id, 'continue_now')
})

test('recorrências usam pergunta observacional e não causal', () => {
  const prompt = buildAdaptiveCheckinPrompt(continuity('repeated_context'))
  assert.ok(prompt)
  assert.match(prompt.description, /não estamos dizendo que existe uma causa/i)
  assert.deepEqual(prompt.choices.map(choice => choice.id), ['yes', 'a_little', 'not_today'])
})

test('rota do Diário integra a retomada adaptativa antes da experiência normal', () => {
  const page = readFileSync(new URL('../src/components/DiaryPage.tsx', import.meta.url), 'utf8')
  assert.match(page, /<AdaptiveCheckinIntro user=\{props\.user\} \/>/)
  assert.match(page, /<DiaryExperience \{\.\.\.props\} \/>/)
})

test('retomada do check-in consulta somente dados estruturados e não texto livre', () => {
  const intro = readFileSync(new URL('../src/components/AdaptiveCheckinIntro.tsx', import.meta.url), 'utf8')
  assert.match(intro, /created_at,date,mood,energy,anxiety_level,sleep_quality,context_tags,trigger_tags/)
  assert.doesNotMatch(intro, /select\([^)]*text/)
  assert.doesNotMatch(intro, /free_note/)
  assert.match(intro, /não vira nota automática/)
  assert.match(intro, /Prefiro começar do zero/)
})

test('retomada do check-in respeita o mesmo descarte diário usado na Home', () => {
  const intro = readFileSync(new URL('../src/components/AdaptiveCheckinIntro.tsx', import.meta.url), 'utf8')
  assert.match(intro, /avnc:continuity-dismissed:/)
  assert.match(intro, /localStorage\.setItem/)
})
