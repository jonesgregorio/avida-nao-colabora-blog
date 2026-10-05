import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeArticlePackage, validateArticlePackage, hasTopicOverlap, selectRelatedArticles, hasEditorialSource, withEditorialDisclosure } from '../supabase/functions/_shared/articleGenerationContract.ts'

const catalog = [
  { slug: 'sono', title: 'Como organizar o sono', keyword: 'organizar o sono', plan_required: 'free' },
  { slug: 'diario', title: 'Primeiro registro no diário', keyword: 'diário emocional', plan_required: 'free' },
  { slug: 'reservado', title: 'Sono e ansiedade', plan_required: 'plus' },
]
const article = normalizeArticlePackage({
  title: 'Uma pausa na hora de dormir', content: 'Uma explicação útil sobre uma pausa. '.repeat(12) + '\n## Fontes\n[NIMH](https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health)\n[Organizar o sono](/blog/sono)',
  excerpt: 'Uma explicação sobre como experimentar uma pausa antes de dormir, respeitando seu contexto e os limites de um exercício educativo.',
  seo_title: 'Uma pausa antes de dormir: roteiro possível',
  seo_description: 'Veja um roteiro adaptável para uma pausa antes de dormir e entenda os limites da prática, sem cobrar sono ou alívio imediato.',
  keyword: 'pausa antes de dormir', secondary_keywords: ['transição noturna', 'pausa'], image_alt: 'Caderno sobre uma mesa.', diary_question: 'O que pode esperar?', cta_text: 'Registre seu momento.',
})
const context = { publication: true, reviewed: true, author: 'Equipe AVNC', imageUrl: 'https://example.com/capa.jpg', relatedSlugs: ['sono'], catalog }

test('texto útil menor que mil palavras pode publicar com revisão e metadados', () => {
  assert.deepEqual(validateArticlePackage(article, context), [])
})
test('publicação exige confirmação editorial verdadeira e autoria', () => {
  const errors = validateArticlePackage(article, { ...context, reviewed: false, author: '' })
  assert.ok(errors.includes('revisão editorial e capa não confirmadas'))
  assert.ok(errors.includes('autoria ausente'))
})
test('publicação rejeita referências falsas e links internos inexistentes', () => {
  assert.equal(hasEditorialSource('[falso](https://www.nimh.nih.gov.evil.test/health)'), false)
  assert.equal(hasEditorialSource('[falso](javascript:alert(1))'), false)
  const errors = validateArticlePackage({ ...article, content: article.content + '\n[Destino](/blog/inexistente)' }, { ...context, relatedSlugs: ['inexistente'] })
  assert.ok(errors.includes('link interno no texto indisponível'))
  assert.ok(errors.includes('artigo relacionado indisponível'))
})
test('H1 no corpo e ausência de fonte oficial bloqueiam publicação', () => {
  const errors = validateArticlePackage({ ...article, content: '# Título repetido\n' + 'texto '.repeat(90) }, context)
  assert.ok(errors.includes('H1 dentro do corpo'))
  assert.ok(errors.includes('fonte oficial com link HTTPS ausente'))
})
test('seleção contextual exclui conteúdo pago, autorreferência e assunto sem relação', () => {
  assert.deepEqual(selectRelatedArticles('sono antes de dormir', catalog).map(row => row.slug), ['sono'])
  assert.deepEqual(selectRelatedArticles('sono', catalog, 'sono'), [])
  assert.deepEqual(selectRelatedArticles('finanças', catalog), [])
})
test('sobreposição detecta intenção repetida e tolera título distinto', () => {
  assert.equal(hasTopicOverlap('Como organizar o sono', 'novo termo', catalog), true)
  assert.equal(hasTopicOverlap('Outra pergunta', 'diário emocional', catalog), true)
  assert.equal(hasTopicOverlap(article.title, article.keyword, catalog), false)
})


test('transparência de IA só registra revisão efetivamente confirmada e não duplica nota', () => {
  assert.equal(withEditorialDisclosure('Texto', 'ia', false), 'Texto')
  assert.equal(withEditorialDisclosure('Texto', 'manual', true), 'Texto')
  const reviewed = withEditorialDisclosure('Texto', 'ia', true)
  assert.match(reviewed, /apoio de inteligência artificial/)
  assert.match(reviewed, /não equivale a revisão clínica/)
  assert.equal(withEditorialDisclosure(reviewed, 'ia', true), reviewed)
})
