import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vercelConfig = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
) as {
  headers?: Array<{
    headers?: Array<{ key?: string; value?: string }>
  }>
}

function contentSecurityPolicy() {
  for (const rule of vercelConfig.headers ?? []) {
    const header = rule.headers?.find((item) => item.key?.toLowerCase() === 'content-security-policy')
    if (header?.value) return header.value
  }
  return ''
}

test('CSP não permite execução dinâmica via unsafe-eval', () => {
  const csp = contentSecurityPolicy()
  assert.ok(csp, 'Content-Security-Policy deve existir no vercel.json')
  assert.equal(csp.includes("'unsafe-eval'"), false)
})

test('CSP mantém barreiras defensivas essenciais', () => {
  const csp = contentSecurityPolicy()
  for (const directive of [
    "script-src-attr 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]) {
    assert.ok(csp.includes(directive), `CSP deve conter: ${directive}`)
  }
})

test('CSP preserva embeds e integrações já aprovadas', () => {
  const csp = contentSecurityPolicy()
  assert.ok(csp.includes('https://js.stripe.com'))
  assert.ok(csp.includes('https://www.youtube.com'))
  assert.ok(csp.includes('https://www.youtube-nocookie.com'))
  assert.ok(csp.includes('https://*.supabase.co'))
})

test('CSP permite somente os endpoints necessários para o monitoramento Sentry', () => {
  const csp = contentSecurityPolicy()
  assert.ok(csp.includes('https://js.sentry-cdn.com'))
  assert.ok(csp.includes('https://*.ingest.sentry.io'))
})
