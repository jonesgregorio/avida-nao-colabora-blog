import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Normaliza CRLF: em checkout Windows o arquivo chega com \r\n e os recortes por
// bloco (/\n\}\n/) falhariam localmente mesmo com o código correto.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const runnerSource = read('supabase/functions/run-emotional-automations/runner.ts')

test('generate() registra o motivo de falha de cada provedor de IA', () => {
  const generateFn = runnerSource.match(
    /async function generate\(promptText: string\)[\s\S]*?\n\}\n/,
  )?.[0] ?? ''

  assert.notEqual(generateFn, '', 'não encontrou a função generate() no runner')
  assert.match(generateFn, /const failures: string\[\] = \[\]/)
  assert.match(generateFn, /note\(`gemini\/\$\{model\}`/)
  assert.match(generateFn, /note\('groq'/)
  assert.match(generateFn, /note\('openai'/)
  assert.match(generateFn, /HTTP \$\{res\.status\}/)
  assert.match(generateFn, /'resposta vazia'/)
  assert.match(generateFn, /GEMINI_API_KEY ausente/)
  assert.match(generateFn, /GROQ_API_KEY ausente/)
  assert.match(generateFn, /OPENAI_API_KEY ausente/)
  assert.doesNotMatch(generateFn, /\} catch \{/)
})

test('erro final propaga os motivos por provedor para ai_generation_logs', () => {
  assert.match(
    runnerSource,
    /Nenhum provedor de IA emocional respondeu; fallback determinístico aplicado\. Motivos — \$\{failures\.join\(' \| '\)\}/,
  )
  assert.match(runnerSource, /\.slice\(0, 480\)/)
})

test('diagnóstico não expõe prompt, conteúdo emocional nem chaves', () => {
  const noteFn = runnerSource.match(/const note = \(provider: string, reason: unknown\) => \{[\s\S]*?\n {2}\}/)?.[0] ?? ''
  assert.notEqual(noteFn, '', 'não encontrou o helper note()')
  assert.match(noteFn, /reason instanceof Error \? reason\.message : reason/)
  assert.match(noteFn, /\.slice\(0, 120\)/)
  assert.doesNotMatch(noteFn, /promptText/)
})

test('run-emotional-automations grava o provider real (nunca fica preso em "gemini" por omissão)', () => {
  assert.match(runnerSource, /function providerFromModel\(model: string\): string/)
  assert.match(runnerSource, /if \(model === 'deterministic-fallback'\) return 'fallback'/)
  assert.match(runnerSource, /if \(model\.startsWith\('groq:'\)\) return 'groq'/)
  assert.match(runnerSource, /if \(model\.startsWith\('openai:'\)\) return 'openai'/)

  const logCalls = runnerSource.match(/await log\(admin, \{[^}]*\}\)/g) ?? []
  assert.ok(logCalls.length >= 2, 'esperava as chamadas de log() de relatório/plano')
  for (const call of logCalls) {
    assert.match(call, /provider: providerFromModel\(model\)/, `chamada de log() sem provider real: ${call}`)
  }
})

test('explain-emotional-map grava provider e model reais, inclusive fallback explícito', () => {
  const fn = read('supabase/functions/explain-emotional-map/index.ts')
  assert.match(fn, /type Generated = \{ raw: string; model: string; provider: 'gemini' \| 'groq' \| 'openai' \}/)
  assert.match(fn, /const provider = aiUsed && ai \? ai\.provider : 'fallback'/)
  assert.match(fn, /const model = aiUsed && ai \? ai\.model : null/)
  assert.match(fn, /provider,\s*\n\s*model_used: model/)
  assert.match(fn, /provider,\s*\n\s*model,\s*\n\s*generated_at: generatedAt/)
})
