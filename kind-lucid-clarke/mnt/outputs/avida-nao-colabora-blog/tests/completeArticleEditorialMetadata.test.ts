import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeArticlePackage, parseArticlePackages, buildArticleGenerationPrompt } from '../supabase/functions/_shared/articleGenerationContract.ts'

test('full article package retains SEO and specific editorial classification', () => {
  const raw = { title: 'Pausas na rotina', content: 'Texto do artigo', seo_title: 'Pausas de autocuidado', seo_description: 'Como organizar pausas na rotina.', journey_stage: 'consideracao', intent: 'orientar a aplicação', audience: 'Adultos com rotina intensa' }
  const [p] = parseArticlePackages(JSON.stringify(raw))
  assert.equal(p.title, raw.title)
  assert.equal(p.seo_title, raw.seo_title)
  assert.equal(p.journey_stage, 'consideracao')
  assert.equal(p.intent, raw.intent)
  assert.equal(p.audience, raw.audience)
})

test('legacy packages remain compatible and cannot supply invalid journey stages', () => {
  const p = normalizeArticlePackage({ title: 'Tema', journey_stage: 'inventada' })
  assert.equal(p.journey_stage, 'descoberta')
  assert.ok(p.intent)
  assert.ok(p.audience)
})

test('complete article prompt requests editorial metadata along with paid deliverables', () => {
  const prompt = buildArticleGenerationPrompt({ themes: ['Pausas'], plan: 'plus' })
  for (const key of ['seo_title', 'seo_description', 'journey_stage', 'intent', 'audience']) assert.ok(prompt.includes(key))
  assert.ok(prompt.includes('Revisão do mês'))
})
