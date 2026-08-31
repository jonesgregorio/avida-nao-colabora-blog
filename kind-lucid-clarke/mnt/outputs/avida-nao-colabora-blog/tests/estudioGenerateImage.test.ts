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

test('tenta uma cadeia de modelos (Imagen :predict e Gemini :generateContent) até funcionar', () => {
  assert.match(fn, /const FALLBACK_MODELS = \[/)
  assert.match(fn, /'imagen-3\.0-generate-002'/)
  assert.match(fn, /'gemini-2\.0-flash-preview-image-generation'/)
  assert.match(fn, /model\.startsWith\('imagen'\) \? tryImagen : tryGeminiImage/)
  assert.match(fn, /:predict\?key=/)
  assert.match(fn, /:generateContent\?key=/)
  // o modelo do secret vai na frente
  assert.match(fn, /\[configured, \.\.\.FALLBACK_MODELS\]/)
})

test('classifica quota / permissão e devolve o detalhe do erro', () => {
  assert.match(fn, /RESOURCE_EXHAUSTED|quota/)
  assert.match(fn, /PERMISSION_DENIED/)
  assert.match(fn, /const detail = tried\.join/)
  assert.match(fn, /return json\(\{ error: quota \? 'quota' : permission \? 'permission' : 'gemini_error', detail \}\)/)
})

test('estudioAi.generateImage mapeia formato -> aspecto e mostra o detalhe do erro', () => {
  assert.match(ai, /functions\.invoke\('estudio-generate-image'/)
  assert.match(ai, /'feed-45': '3:4'/)
  assert.match(ai, /'reel-capa': '9:16'/)
  assert.match(ai, /d\.detail/)
  assert.doesNotMatch(ai, /GEMINI_API_KEY/)
})
