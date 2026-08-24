import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Normaliza CRLF: em checkout Windows o arquivo chega com \r\n e os recortes por
// bloco (/\n\}\n/) falhariam localmente mesmo com o código correto.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const runnerSource = read('supabase/functions/run-emotional-automations/runner.ts')

// Contexto: a auditoria de observabilidade (Parte 7) mediu 75% de fallback nos
// relatórios semanais em produção, mas ai_generation_logs.error_msg só dizia
// "Nenhum provedor de IA emocional respondeu" — sem indicar se a causa foi 404
// de modelo, 429 de cota, 5xx, timeout ou chave ausente. Cada provedor era
// envolvido por um catch vazio que descartava o motivo real.

test('generate() registra o motivo de falha de cada provedor de IA', () => {
  const generateFn = runnerSource.match(
    /async function generate\(promptText: string\)[\s\S]*?\n\}\n/,
  )?.[0] ?? ''

  assert.notEqual(generateFn, '', 'não encontrou a função generate() no runner')

  // Coletor de motivos técnicos existe e é usado pelos três provedores.
  assert.match(generateFn, /const failures: string\[\] = \[\]/)
  assert.match(generateFn, /note\(`gemini\/\$\{model\}`/)
  assert.match(generateFn, /note\('groq'/)
  assert.match(generateFn, /note\('openai'/)

  // Diferencia as causas: status HTTP, resposta vazia e chave ausente.
  assert.match(generateFn, /HTTP \$\{res\.status\}/)
  assert.match(generateFn, /'resposta vazia'/)
  assert.match(generateFn, /GEMINI_API_KEY ausente/)
  assert.match(generateFn, /GROQ_API_KEY ausente/)
  assert.match(generateFn, /OPENAI_API_KEY ausente/)

  // Nenhum catch pode voltar a engolir a falha sem registrar o motivo.
  assert.doesNotMatch(generateFn, /\} catch \{/)
})

test('erro final propaga os motivos por provedor para ai_generation_logs', () => {
  assert.match(
    runnerSource,
    /Nenhum provedor de IA emocional respondeu; fallback determinístico aplicado\. Motivos — \$\{failures\.join\(' \| '\)\}/,
  )
  // Limite de tamanho: error_msg é auditoria, não depósito de texto livre.
  assert.match(runnerSource, /\.slice\(0, 480\)/)
})

test('diagnóstico não expõe prompt, conteúdo emocional nem chaves', () => {
  const noteFn = runnerSource.match(/const note = \(provider: string, reason: unknown\) => \{[\s\S]*?\n {2}\}/)?.[0] ?? ''
  assert.notEqual(noteFn, '', 'não encontrou o helper note()')

  // Só a mensagem do erro entra, truncada — nunca o prompt nem a resposta.
  assert.match(noteFn, /reason instanceof Error \? reason\.message : reason/)
  assert.match(noteFn, /\.slice\(0, 120\)/)
  assert.doesNotMatch(noteFn, /promptText/)
})
