import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const runner = read('supabase/functions/run-automations/index.ts')
const contract = read('supabase/functions/_shared/articleGenerationContract.ts')
const aiContent = read('src/lib/aiContent.ts')

// §9.3 da MISSÃO GERAL: evitar título genérico, introdução repetida, "tom de
// ChatGPT" (frases como "em conclusão", "é importante ressaltar"), promessa
// médica. A instrução no prompt sozinha não é confiável — precisa de uma
// checagem determinística que bloqueie a auto-publicação quando a IA ignorar
// a instrução. O prompt editorial agora é a fonte única compartilhada pela
// automação e pela Fábrica IA.

test('prompt compartilhado de artigos instrui a evitar clichês de "tom de ChatGPT"', () => {
  assert.match(contract, /Evite clichês de texto gerado por IA/)
  assert.match(contract, /em conclusão/)
  assert.match(contract, /é importante ressaltar/)
  assert.match(contract, /não abuse de listas/i)
  assert.match(runner, /buildArticleGenerationPrompt/)
})

test('run-automations bloqueia auto-publicação quando detecta clichê determinístico, não só confia no prompt', () => {
  assert.match(runner, /const AI_CLICHE_PHRASES = \[/)
  assert.match(runner, /function detectAiCliches\(content: string\): string\[\]/)

  const persistFn = runner.slice(
    runner.indexOf('async function persistArticle('),
    runner.indexOf('async function executeArticleAutomation('),
  )
  assert.ok(persistFn.length > 0, 'não encontrou persistArticle()')
  assert.match(persistFn, /const cliches = detectAiCliches\(content\)/)
  assert.match(persistFn, /if \(cliches\.length > 0\) validationErrors\.push/)

  // Invariante existente: só publica sozinho se não houver NENHUM erro de validação.
  assert.match(persistFn, /const publish = wantsAutoPublish && validationErrors\.length === 0/)
})

test('gate de tamanho mínimo (1000 palavras) continua ativo antes de auto-publicar', () => {
  assert.match(contract, /export const MIN_ARTICLE_WORDS = 1000/)
  assert.match(contract, /articleWordCount\(article\.content\) < MIN_ARTICLE_WORDS/)
  assert.match(runner, /validateArticlePackage\(validatedPackage/)
  assert.match(runner, /const publish = wantsAutoPublish && validationErrors\.length === 0/)
})

test('geração manual (Fábrica IA / assistente) também evita clichês de IA no prompt', () => {
  assert.match(aiContent, /Evite clichês de texto gerado por IA/)
  assert.match(contract, /Evite clichês de texto gerado por IA/)
})