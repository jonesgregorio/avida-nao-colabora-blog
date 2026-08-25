import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const runner = read('supabase/functions/run-automations/index.ts')
const aiContent = read('src/lib/aiContent.ts')

// §9.3 da MISSÃO GERAL: evitar título genérico, introdução repetida, "tom de
// ChatGPT" (frases como "em conclusão", "é importante ressaltar"), promessa
// médica. A instrução no prompt sozinha não é confiável — precisa de uma
// checagem determinística que bloqueie a auto-publicação quando a IA ignorar
// a instrução.

test('prompt de automação de artigos instrui a evitar clichês de "tom de ChatGPT"', () => {
  assert.match(runner, /Evite clichês de texto gerado por IA/)
  assert.match(runner, /em conclusão/)
  assert.match(runner, /é importante ressaltar/)
  assert.match(runner, /Não abuse de listas/)
})

test('run-automations bloqueia auto-publicação quando detecta clichê determinístico, não só confia no prompt', () => {
  assert.match(runner, /const AI_CLICHE_PHRASES = \[/)
  assert.match(runner, /function detectAiCliches\(content: string\): string\[\]/)

  const persistFn = runner.match(/async function persistArticle\([\s\S]*?\n\}\n/)?.[0] ?? ''
  assert.notEqual(persistFn, '', 'não encontrou persistArticle()')
  assert.match(persistFn, /const cliches = detectAiCliches\(content\)/)
  assert.match(persistFn, /if \(cliches\.length > 0\) validationErrors\.push/)

  // Invariante existente: só publica sozinho se não houver NENHUM erro de validação.
  assert.match(persistFn, /const publish = wantsAutoPublish && validationErrors\.length === 0/)
})

test('gate de tamanho mínimo (1000 palavras) continua ativo antes de auto-publicar', () => {
  assert.match(runner, /const MIN_AUTO_PUBLISH_WORDS = 1000/)
  assert.match(runner, /if \(wordCount\(content\) < MIN_AUTO_PUBLISH_WORDS\) validationErrors\.push/)
})

test('geração manual (Fábrica IA / assistente) também evita clichês de IA no prompt', () => {
  assert.match(aiContent, /Evite clichês de texto gerado por IA/)
})
