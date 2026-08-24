// Rate limit do formulário público de contato (submit-contact-ticket):
// consume_contact_ticket_rate_limit (janela deslizante de 15min, 5
// tentativas por chave). Cobre: 5 primeiras passam, a 6ª é bloqueada (429);
// identidade diferente não é afetada; honeypot não cria ticket nem consome
// a cota.

import { randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const required = ['E2E_DOCKER_BIN', 'LOCAL_FUNCTIONS_URL', 'E2E_SUPABASE_ANON_KEY']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function psql(sql) {
  return execFileSync(process.env.E2E_DOCKER_BIN, [
    'exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-c', sql,
  ], { encoding: 'utf8' }).trim()
}

// Mesmo algoritmo de scripts/../supabase/functions/submit-contact-ticket/index.ts
// (rateKey): sha256 de "<ip>:<email>" (sem usuário autenticado, aqui) prefixado
// com "contact:". Serve só pra limpar a linha certa no cleanup.
function rateKeyFor(identity) {
  return 'contact:' + createHash('sha256').update(identity).digest('hex')
}

async function submit(email, extra = {}) {
  const res = await fetch(`${process.env.LOCAL_FUNCTIONS_URL}/submit-contact-ticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '203.0.113.10',
      // O client supabase-js sempre manda a anon key como Bearer quando não
      // há sessão (visitante anônimo de verdade) — o gateway (Kong) exige
      // isso mesmo em função pública; a função em si trata token=anon como
      // "sem usuário autenticado" normalmente.
      Authorization: `Bearer ${process.env.E2E_SUPABASE_ANON_KEY}`,
      apikey: process.env.E2E_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      description: 'Mensagem de teste do rate limit, com mais de dez caracteres.',
      subject: 'Teste E2E rate limit',
      contact_email: email,
      ...extra,
    }),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

const emailA = `rate-limit-a-${randomUUID().slice(0, 8)}@local.test`
const emailB = `rate-limit-b-${randomUUID().slice(0, 8)}@local.test`
const honeypotEmail = `rate-limit-honeypot-${randomUUID().slice(0, 8)}@local.test`
// clientIp é fixo (X-Forwarded-For acima); a chave real inclui IP+email, então
// cada e-mail já é uma identidade distinta mesmo com o mesmo IP simulado.

try {
  // ---- 5 tentativas dentro do limite devem passar --------------------------
  for (let i = 1; i <= 5; i++) {
    const { status, body } = await submit(emailA)
    assert(status === 201, `tentativa ${i}/5 deveria passar (200), obteve ${status}: ${JSON.stringify(body)}`)
  }
  console.log('PASS: as 5 primeiras tentativas da mesma identidade passaram.')

  // ---- 6ª tentativa deve ser bloqueada com 429 -----------------------------
  const sixth = await submit(emailA)
  assert(sixth.status === 429, `6ª tentativa deveria ser bloqueada (429), obteve ${sixth.status}`)
  assert(/aguarde 15 minutos/i.test(sixth.body?.error ?? ''), `mensagem de erro inesperada: ${sixth.body?.error}`)
  const ticketsAfterSixth = psql(`SELECT count(*) FROM public.support_tickets WHERE contact_email = '${emailA}'`)
  assert(Number(ticketsAfterSixth) === 5, `deveria haver exatamente 5 tickets criados pra ${emailA}, há ${ticketsAfterSixth}`)
  console.log('PASS: 6ª tentativa da mesma identidade foi bloqueada (429) e nenhum 6º ticket foi criado.')

  // ---- Identidade diferente não é afetada pelo limite da primeira ----------
  const otherIdentity = await submit(emailB)
  assert(otherIdentity.status === 201, `identidade diferente (${emailB}) não deveria ser afetada pelo limite de ${emailA}, obteve ${otherIdentity.status}`)
  console.log('PASS: uma identidade diferente (outro e-mail) não é afetada pelo limite da primeira.')

  // ---- Honeypot: não cria ticket nem consome a cota ------------------------
  const honeypot = await submit(honeypotEmail, { website: 'http://spam-bot.example' })
  assert(honeypot.status === 200 && honeypot.body?.ok === true, `honeypot deveria retornar {ok:true} silenciosamente, obteve ${honeypot.status}: ${JSON.stringify(honeypot.body)}`)
  const honeypotTickets = psql(`SELECT count(*) FROM public.support_tickets WHERE contact_email = '${honeypotEmail}'`)
  assert(Number(honeypotTickets) === 0, `honeypot não deveria criar nenhum ticket, criou ${honeypotTickets}`)
  // Confirma que também não consumiu a cota: a mesma identidade ainda deveria
  // poder enviar 5 vezes de verdade depois do honeypot.
  const afterHoneypot = await submit(honeypotEmail)
  assert(afterHoneypot.status === 201, `identidade do honeypot deveria continuar liberada após o probe, obteve ${afterHoneypot.status}`)
  console.log('PASS: honeypot não cria ticket nem consome a cota de rate limit.')

  console.log('\nOK: rate limit do formulário de contato (5/15min por identidade, honeypot) confirmado.')
} finally {
  psql(`DELETE FROM public.support_tickets WHERE contact_email LIKE 'rate-limit-%@local.test'`)
  for (const identity of [`203.0.113.10:${emailA}`, `203.0.113.10:${emailB}`, `203.0.113.10:${honeypotEmail}`]) {
    psql(`DELETE FROM public.contact_ticket_rate_limits WHERE rate_key = '${rateKeyFor(identity)}'`)
  }
}
