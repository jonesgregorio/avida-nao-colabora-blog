// Conteúdo real dos e-mails de automação (run-lifecycle-emails): confirma
// que o motor de gatilhos (resolverGatilho) escolhe o lembrete certo pra
// quem está inativo, NÃO manda nada pra quem está ativo, e que as
// variáveis do template (nome, plano, corpo, CTA) são as certas.
//
// Sem RESEND_API_KEY local o envio real não sai, mas o e-mail_logs.metadata
// grava as variáveis ANTES dessa checagem — dá pra confirmar o conteúdo
// resolvido de verdade, não só que a função não quebrou.

import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const required = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_ANON_KEY', 'E2E_SUPABASE_SERVICE_ROLE_KEY', 'E2E_DOCKER_BIN', 'LOCAL_FUNCTIONS_URL']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = `LifecycleEmail-${randomUUID()}-Aa1!`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function psql(sql) {
  return execFileSync(process.env.E2E_DOCKER_BIN, [
    'exec', 'supabase_db_local-e2e', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-c', sql,
  ], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
}

async function makeUser(label, { plan, lastSeenDaysAgo, fullName }) {
  const email = `lifecycle-${label}-${randomUUID().slice(0, 8)}@local.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(error?.message ?? `Could not create ${label}`)
  const id = data.user.id
  const lastSeenAt = new Date(Date.now() - lastSeenDaysAgo * 86400000).toISOString()
  // created_at bem antigo pra não interferir no cálculo de "conta nova" do
  // gatilho (accountAgeDays só importa quando não há last_seen_at/registro).
  psql(`UPDATE public.profiles SET plan = '${plan}', subscription_status = 'active', full_name = '${fullName}', last_seen_at = '${lastSeenAt}'::timestamptz, created_at = now() - interval '120 days' WHERE user_id = '${id}'::uuid`)
  return { id, email }
}

const internalToken = psql(`SELECT value FROM private.cron_config WHERE key = 'automation_token'`)
assert(Boolean(internalToken), 'não encontrei o token interno do cron em private.cron_config')

const users = {}
try {
  users.inactive = await makeUser('inactive', { plan: 'free', lastSeenDaysAgo: 35, fullName: 'Usuária Inativa Teste' })
  users.active = await makeUser('active', { plan: 'essential', lastSeenDaysAgo: 0, fullName: 'Usuário Ativo Teste' })

  const res = await fetch(`${process.env.LOCAL_FUNCTIONS_URL}/run-lifecycle-emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${internalToken}` },
  })
  const body = await res.json()
  assert(res.status === 200, `run-lifecycle-emails deveria retornar 200, obteve ${res.status}: ${JSON.stringify(body)}`)
  console.log('Resumo do cron:', JSON.stringify(body.summary))

  // Filtra por "selfcare_%" especificamente: o ambiente pode ter artigos
  // publicados nas últimas 24h, o que dispara new_content_published pra
  // QUALQUER usuário (inativo ou não) — isso é comportamento correto e
  // independente do gatilho de inatividade que este teste verifica.
  const inactiveLog = psql(`SELECT template_key, metadata FROM public.email_logs WHERE user_id = '${users.inactive.id}'::uuid AND template_key LIKE 'selfcare_%' ORDER BY created_at DESC LIMIT 1`)
  assert(Boolean(inactiveLog), 'usuária inativa (35 dias) deveria ter recebido um lembrete de autocuidado, mas não há linha em email_logs')
  const separatorIdx = inactiveLog.indexOf('|')
  const templateKey = inactiveLog.slice(0, separatorIdx).trim()
  assert(templateKey === 'selfcare_inactive_30d', `template esperado=selfcare_inactive_30d, obtido=${templateKey}`)
  const metadata = JSON.parse(inactiveLog.slice(separatorIdx + 1))
  const vars = metadata.variables ?? {}
  assert(vars.nome === 'Usuária', `variável "nome" incorreta: esperado="Usuária", obtido="${vars.nome}"`)
  assert(vars.plano === 'Gratuito', `variável "plano" incorreta pro tier free: esperado="Gratuito", obtido="${vars.plano}"`)
  assert(typeof vars.corpo === 'string' && vars.corpo.length > 20, 'variável "corpo" ausente ou vazia')
  assert(typeof vars.cta_link === 'string' && vars.cta_link.includes('/diario'), `cta_link inesperado: ${vars.cta_link}`)
  console.log('PASS: usuária inativa há 35 dias recebeu selfcare_inactive_30d com nome/plano/corpo/CTA corretos.')

  const activeSelfcareLog = psql(`SELECT count(*) FROM public.email_logs WHERE user_id = '${users.active.id}'::uuid AND template_key LIKE 'selfcare_%'`)
  assert(Number(activeSelfcareLog) === 0, `usuário ativo (acessou hoje) não deveria receber lembrete de autocuidado/inatividade, mas há ${activeSelfcareLog} linha(s)`)
  console.log('PASS: usuário ativo (acessou hoje) não recebeu lembrete de autocuidado/inatividade.')

  // ---- Idempotência: rodar de novo no mesmo dia não duplica -----------------
  const res2 = await fetch(`${process.env.LOCAL_FUNCTIONS_URL}/run-lifecycle-emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${internalToken}` },
  })
  assert(res2.status === 200, `2ª chamada do cron deveria retornar 200, obteve ${res2.status}`)
  const countAfterSecondRun = psql(`SELECT count(*) FROM public.email_logs WHERE user_id = '${users.inactive.id}'::uuid AND template_key LIKE 'selfcare_%'`)
  assert(Number(countAfterSecondRun) === 1, `rodar o cron de novo no mesmo dia não deveria duplicar o lembrete (esperado=1, obtido=${countAfterSecondRun})`)
  console.log('PASS: rodar o cron de novo no mesmo dia não duplica o lembrete (limite de 1/dia respeitado).')

  console.log('\nOK: conteúdo dos e-mails de automação (run-lifecycle-emails) confirmado.')
} finally {
  for (const u of Object.values(users)) {
    psql(`DELETE FROM public.email_logs WHERE user_id = '${u.id}'::uuid`)
  }
  await Promise.all(Object.values(users).map((u) => admin.auth.admin.deleteUser(u.id)))
}
