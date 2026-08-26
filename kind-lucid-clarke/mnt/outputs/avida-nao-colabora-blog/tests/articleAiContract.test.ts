import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MIN_ARTICLE_WORDS,
  articleWordCount,
  buildArticleGenerationPrompt,
  parseArticlePackages,
  validateArticlePackage,
  type ArticleAIContract,
} from '../supabase/functions/_shared/articleGenerationContract.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const factory = read('src/components/admin/AdminFabricaIA.tsx')
const automation = read('supabase/functions/run-automations/index.ts')
const contract = read('supabase/functions/_shared/articleGenerationContract.ts')

const FIELDS = [
  'title', 'content', 'excerpt', 'seo_title', 'seo_description', 'keyword',
  'secondary_keywords', 'tags', 'emotional_themes', 'category', 'image_query',
  'image_alt', 'diary_question', 'cta_text',
] as const

test('contrato editorial contém exatamente os 14 campos exigidos para artigo', () => {
  const interfaceBody = contract.match(/export interface ArticleAIContract \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.notEqual(interfaceBody, '')
  const names = [...interfaceBody.matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1])
  assert.deepEqual(names, [...FIELDS])

  const prompt = buildArticleGenerationPrompt({ quantity: 1, themes: ['limites'] })
  for (const field of FIELDS) assert.ok(prompt.includes(field), `campo ausente no prompt: ${field}`)
})

test('parser único aceita artigo individual e pacote sem mudar o contrato', () => {
  const sample = Object.fromEntries(FIELDS.map(field => [field, ['secondary_keywords', 'tags', 'emotional_themes'].includes(field) ? ['a', 'b'] : `${field} valor`]))
  const single = parseArticlePackages(JSON.stringify(sample), ['tema'])
  const batch = parseArticlePackages(JSON.stringify({ articles: [sample, sample] }), ['tema'])
  assert.equal(single.length, 1)
  assert.equal(batch.length, 2)
  assert.deepEqual(Object.keys(single[0]), [...FIELDS])
  assert.deepEqual(Object.keys(batch[0]), [...FIELDS])
})

test('regra editorial exige mínimo de 1000 palavras e valida metadados essenciais', () => {
  assert.equal(MIN_ARTICLE_WORDS, 1000)
  assert.equal(articleWordCount(Array.from({ length: 1000 }, () => 'palavra').join(' ')), 1000)

  const valid: ArticleAIContract = {
    title: 'Como reconhecer seus limites',
    content: Array.from({ length: 1000 }, () => 'palavra').join(' '),
    excerpt: 'Um texto acolhedor que ajuda a observar limites pessoais com mais clareza e cuidado no cotidiano.',
    seo_title: 'Como reconhecer limites com mais clareza',
    seo_description: 'Entenda como observar seus limites no cotidiano, perceber sinais de sobrecarga e criar formas mais possíveis de cuidado pessoal.',
    keyword: 'limites pessoais',
    secondary_keywords: ['autocuidado', 'sobrecarga emocional'],
    tags: ['limites', 'autocuidado', 'rotina'],
    emotional_themes: ['sobrecarga'],
    category: 'Relações e Limites',
    image_query: 'person setting healthy boundaries realistic',
    image_alt: 'Pessoa refletindo sobre seus limites em um ambiente cotidiano',
    diary_question: 'Em que situação seus limites têm pedido mais atenção?',
    cta_text: 'Registre o que percebeu no seu diário.',
  }
  assert.deepEqual(validateArticlePackage(valid, { imageUrl: 'https://example.test/capa.jpg', duplicate: false }), [])

  const invalid = { ...valid, content: 'curto', secondary_keywords: [], image_query: '', image_alt: '' }
  const errors = validateArticlePackage(invalid, { imageUrl: null, duplicate: true })
  assert.ok(errors.some(e => e.includes('menos de 1000 palavras')))
  assert.ok(errors.includes('palavras-chave insuficientes'))
  assert.ok(errors.includes('busca de imagem ausente'))
  assert.ok(errors.includes('imagem de capa ausente'))
  assert.ok(errors.includes('texto alternativo da imagem ausente'))
  assert.ok(errors.includes('artigo duplicado'))
})

test('Fábrica IA e automação reutilizam o mesmo construtor, parser e validador', () => {
  for (const symbol of ['buildArticleGenerationPrompt', 'parseArticlePackages', 'validateArticlePackage', 'buildArticleExpansionPrompt']) {
    assert.ok(factory.includes(symbol), `Fábrica não usa ${symbol}`)
    assert.ok(automation.includes(symbol), `automação não usa ${symbol}`)
  }
  assert.match(factory, /from '\.\.\/\.\.\/lib\/articleGenerationContract'/)
  assert.match(automation, /from '\.\.\/_shared\/articleGenerationContract\.ts'/)
})

test('artigo curto recebe no máximo uma tentativa explícita de expansão em cada fluxo', () => {
  const factoryGeneration = factory.match(/async function generateArticleContract\([\s\S]*?\n\}/)?.[0] ?? ''
  const automationPersist = automation.match(/async function persistArticle\([\s\S]*?\n\}/)?.[0] ?? ''
  assert.notEqual(factoryGeneration, '')
  assert.notEqual(automationPersist, '')
  assert.equal((factoryGeneration.match(/buildArticleExpansionPrompt\(/g) ?? []).length, 1)
  assert.equal((automationPersist.match(/buildArticleExpansionPrompt\(/g) ?? []).length, 1)
  assert.doesNotMatch(factoryGeneration, /\bwhile\s*\(/)
  assert.doesNotMatch(automationPersist, /\bwhile\s*\(/)
})

test('Fábrica não cria novos drafts com summary/excerpt vazios e registra motivos de validação', () => {
  assert.doesNotMatch(factory, /summary:\s*['"]['"]\s*,\s*excerpt:\s*['"]['"]/)
  assert.match(factory, /summary:\s*pkg\.excerpt \|\| fallbackExcerpt/)
  assert.match(factory, /excerpt:\s*pkg\.excerpt \|\| fallbackExcerpt/)
  assert.match(factory, /Rascunho mantido por validação:/)
  assert.match(factory, /\.ilike\('title', pkg\.title\)/)
})

test('automação só auto-publica após validação e mantém falhas como rascunho com motivo', () => {
  assert.match(automation, /const publish = wantsAutoPublish && validationErrors\.length === 0/)
  assert.match(automation, /status: publish \? 'published' : 'draft'/)
  assert.match(automation, /Rascunho mantido/)
  assert.match(automation, /título idêntico já publicado\/gerado nas últimas 24h/)
  assert.match(automation, /internal_notes: internalNotes/)
})
