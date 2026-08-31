import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fn = readFileSync(new URL('../supabase/functions/estudio-generate-image/index.ts', import.meta.url), 'utf8')
const ai = readFileSync(new URL('../src/lib/estudioAi.ts', import.meta.url), 'utf8')

test('a Edge Function é admin-AAL2, usa a chave só no servidor e não toca generate-content', () => {
  assert.match(fn, /requireAdminAal2\(req\)/)
  assert.match(fn, /Deno\.env\.get\('GEMINI_API_KEY'\)/)
  assert.match(fn, /generativelanguage\.googleapis\.com/)
  assert.doesNotMatch(fn, /invoke\(['"]generate-content|functions\/generate-content/)
})

test('a Edge Function valida aspecto, tem timeout e degrada com { error }', () => {
  assert.match(fn, /const ASPECTS = new Set\(\['1:1', '9:16', '3:4', '4:3', '16:9'\]\)/)
  assert.match(fn, /AbortController/)
  assert.match(fn, /error: 'no_key'/)
  assert.match(fn, /res\.status === 429 \? 'quota'/)
})

test('estudioAi.generateImage chama a função isolada e mapeia formato -> aspecto', () => {
  assert.match(ai, /functions\.invoke\('estudio-generate-image'/)
  assert.match(ai, /'feed-45': '3:4'/)
  assert.match(ai, /'reel-capa': '9:16'/)
  assert.doesNotMatch(ai, /GEMINI_API_KEY/) // chave nunca no front
})
