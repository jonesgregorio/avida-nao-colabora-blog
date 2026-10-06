import test from 'node:test'
import assert from 'node:assert/strict'
import { articleTierSections, articleTierBrief, validateTierDeliverables, buildArticleGenerationPrompt, selectRelatedArticles, buildTierCompletionPrompt, normalizeArticlePackage, validateArticlePackage } from '../supabase/functions/_shared/articleGenerationContract.ts'

const body = (plan: string) => articleTierSections(plan).map(section => `## ${section}\n${'Um exemplo fictício e uma instrução concreta para preencher o registro. '.repeat(3)}\n`).join('\n')

test('Público e Gratuito não herdam entregas pagas e continuam completos', () => {
  assert.deepEqual(articleTierSections('free'), [])
  assert.deepEqual(articleTierSections('account'), [])
  assert.deepEqual(validateTierDeliverables('Texto introdutório útil', 'free'), [])
  assert.match(articleTierBrief('free'), /sem cadastro|sem conta/)
  assert.match(articleTierBrief('account'), /limite de registros/)
})
test('Essencial exige aplicação preenchida e não apenas cabeçalhos', () => {
  assert.equal(articleTierSections('essential').length, 5)
  assert.equal(validateTierDeliverables('Texto genérico', 'essential').length, 5)
  assert.equal(validateTierDeliverables(articleTierSections('essential').map(s => `## ${s}\n`).join('\n'), 'essential').length, 5)
  assert.deepEqual(validateTierDeliverables(body('essential'), 'essential'), [])
})
test('Plus herda o roteiro e exige decisões, cenários e revisão mensal', () => {
  const missing = validateTierDeliverables(body('essential'), 'plus')
  assert.equal(missing.length, 4)
  assert.ok(missing.some(error => error.endsWith('Revisão do mês')))
  assert.deepEqual(validateTierDeliverables(body('plus'), 'plus'), [])
})
test('seções vazias não aproveitam texto de outra seção e CRLF é aceito', () => {
  const incomplete = body('plus').replace(/## Modelo para copiar\n[\s\S]*?(?=##)/, '## Modelo para copiar\n\n')
  assert.ok(validateTierDeliverables(incomplete, 'plus').some(error => error.endsWith('Modelo para copiar')))
  assert.deepEqual(validateTierDeliverables(body('plus').replaceAll('\n', '\r\n'), 'plus'), [])
})
test('briefing gerado corresponde ao plano e limita alegações de personalização', () => {
  const prompt = buildArticleGenerationPrompt({ themes: ['rotina'], plan: 'plus' })
  assert.match(prompt, /Plano editorial: Plus/)
  assert.match(prompt, /## Plano de acompanhamento/)
  assert.match(prompt, /Não invente personalização/)
  assert.match(prompt, /quando disponível/)
  assert.doesNotMatch(buildArticleGenerationPrompt({ themes: ['rotina'], plan: 'essential' }), /## Revisão do mês/)
})
test('links relacionados respeitam a hierarquia de acesso', () => {
  const catalog = ['free', 'account', 'essential', 'plus'].map(plan => ({ title: 'Rotina emocional', slug: plan, plan_required: plan }))
  assert.deepEqual(selectRelatedArticles('rotina', catalog, '', 'free').map(row => row.slug), ['free'])
  assert.deepEqual(selectRelatedArticles('rotina', catalog, '', 'account').map(row => row.slug), ['account', 'free'])
  assert.ok(!selectRelatedArticles('rotina', catalog, '', 'essential').some(row => row.slug === 'plus'))
  assert.ok(selectRelatedArticles('rotina', catalog, '', 'plus').some(row => row.slug === 'essential'))
})
test('complementação automática usa pendências concretas sem prometer revisão clínica', () => {
  const prompt = buildTierCompletionPrompt(body('essential'), 'plus')
  assert.match(prompt, /Pendências:.*Cenários e alternativas/)
  assert.match(prompt, /não invente estudos, URLs, autoria ou revisão profissional/)
  assert.match(prompt, /Artigo:/)
})

test('publicação e geração usam as entregas do plano; links superiores são bloqueados', () => {
  const article = normalizeArticlePackage({ title: 'Uma revisão aplicada', content: body('essential') + '\n[Fonte](https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health)', excerpt: 'Uma explicação útil e completa para organizar o registro com um modelo preenchido e caminhos adaptáveis à rotina.', seo_title: 'Revisão aplicada: roteiro e modelo para copiar', seo_description: 'Veja um roteiro de revisão aplicada com exemplo fictício preenchido, modelo copiável e adaptação para pouca energia, respeitando seu contexto.', keyword: 'revisão aplicada', secondary_keywords: ['modelo', 'roteiro'], image_query: 'notebook', image_alt: 'Caderno sobre mesa.', diary_question: 'O que adaptar?', cta_text: 'Registre seu momento.' })
  const base = { plan: 'essential', imageUrl: 'https://example.com/capa.jpg' }
  assert.deepEqual(validateArticlePackage(article, base), [])
  assert.equal(validateArticlePackage(article, { ...base, plan: 'plus' }).filter(error => error.startsWith('entrega Plus')).length, 4)
  const errors = validateArticlePackage(article, { ...base, publication: true, reviewed: true, author: 'AVNC', relatedSlugs: ['exclusivo-plus'], catalog: [{ slug: 'exclusivo-plus', title: 'Outro assunto', plan_required: 'plus' }] })
  assert.ok(errors.includes('link para conteúdo de acesso superior ao plano'))
})
