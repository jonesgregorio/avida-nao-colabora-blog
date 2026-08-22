import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const endpoint = read('supabase/functions/submit-contact-ticket/index.ts')
const migration = read('supabase/migrations/20260822235231_contact_ticket_antispam.sql')
const faq = read('src/components/FAQPage.tsx')
const contact = read('src/components/ContactPage.tsx')

test('contato legítimo e visitante anônimo passam por um endpoint server-side único', () => {
  for (const source of [faq, contact]) {
    assert.match(source, /functions\.invoke\('submit-contact-ticket'/)
    assert.doesNotMatch(source, /from\('support_tickets'\)\.insert/)
  }
  assert.match(endpoint, /user_id: user\?\.id \?\? null/)
  assert.match(endpoint, /contact_email: user \?/) 
})

test('honeypot, token inválido e spam repetitivo são bloqueados no servidor', () => {
  assert.match(endpoint, /if \(text\(body\.website, 200\)\) return json\(\{ ok: true \}/)
  assert.match(endpoint, /TURNSTILE_SECRET_KEY/)
  assert.match(endpoint, /if \(!await verifyTurnstile/)
  assert.match(endpoint, /consume_contact_ticket_rate_limit/)
  assert.match(endpoint, /MAX_ATTEMPTS = 5/)
  assert.match(endpoint, /status: 'open'/)
})

test('Data API não mantém inserção direta de tickets públicos', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "public_insert_contact_ticket" ON public\.support_tickets/)
  assert.match(migration, /DROP POLICY IF EXISTS "users_insert_own_tickets" ON public\.support_tickets/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /GRANT EXECUTE[\s\S]*TO service_role/)
  assert.doesNotMatch(migration, /GRANT EXECUTE[\s\S]*TO anon/)
})
