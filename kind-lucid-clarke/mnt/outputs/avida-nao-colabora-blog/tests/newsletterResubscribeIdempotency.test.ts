import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const fn = read('supabase/functions/newsletter-subscribe/index.ts')

// Achado ao vivo: cancelar a newsletter e se inscrever de novo NO MESMO DIA não
// disparava o e-mail de confirmação. Causa: a chave de idempotência era
// `newsletter_confirmation:<email>:<data (AAAA-MM-DD)>` — a segunda inscrição do
// dia colidia com a chave da PRIMEIRA (índice único em email_logs.idempotency_key),
// send-transactional-email tratava como duplicata (23505) e respondia 200 "ok"
// sem enviar nada. A pessoa nunca recebia a confirmação, mas o Admin mostrava a
// inscrição normalmente (a gravação em newsletter_subscribers não tem relação
// com o envio do e-mail).
test('a chave de idempotência do e-mail de confirmação é única por evento de inscrição, não por dia', () => {
  assert.doesNotMatch(
    fn,
    /idempotency_key:\s*`newsletter_confirmation:\$\{email\}:\$\{new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)\}`/,
    'a chave não pode voltar a ser escopada só por email+dia (colide entre cancelar e reinscrever no mesmo dia)',
  )
  assert.match(fn, /idempotency_key:\s*`newsletter_confirmation:\$\{email\}:\$\{subscribedAt\}`/)
  // subscribedAt precisa ser o instante exato desta inscrição (não uma data truncada),
  // e o mesmo valor usado no upsert — evita nova gravação/nova chamada de Date.now()
  // divergentes entre o registro salvo e a chave de idempotência do e-mail.
  assert.match(fn, /const subscribedAt = new Date\(\)\.toISOString\(\)/)
  const subscribedAtUses = fn.match(/subscribedAt/g) ?? []
  assert.ok(subscribedAtUses.length >= 4, `esperava subscribedAt reaproveitado (upsert + idempotency_key), achei ${subscribedAtUses.length} usos`)
})
