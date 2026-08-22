import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'

const functionsDir = new URL('../supabase/functions/', import.meta.url)
const ciWorkflow = readFileSync(new URL('../../../../../.github/workflows/ci.yml', import.meta.url), 'utf8')

function realEdgeFunctions() {
  const dir = new URL(functionsDir)
  return readdirSync(dir)
    .filter((name) => name !== '_shared')
    .filter((name) => {
      const full = new URL(`${name}/`, dir)
      return statSync(full).isDirectory() && existsSync(new URL('index.ts', full))
    })
    .sort()
}

test('CI descobre Edge Functions automaticamente em vez de listar manualmente', () => {
  // Lista manual antiga: cobria só 4 das 21 funções e não crescia sozinha.
  assert.equal(
    /run-automations\/index\.ts.*run-emotional-automations\/index\.ts/s.test(ciWorkflow),
    false,
    'CI não pode voltar a hardcodar uma lista fixa de Edge Functions',
  )
  assert.match(ciWorkflow, /find supabase\/functions -mindepth 2 -maxdepth 2 -name index\.ts/)
})

test('CI continua chamando deno check para cada Edge Function descoberta', () => {
  assert.match(ciWorkflow, /deno check --node-modules-dir=auto "\$f"/)
})

test('CI falha explicitamente se nenhuma Edge Function for encontrada', () => {
  // Protege contra um find quebrado silenciar a checagem inteira.
  assert.match(ciWorkflow, /Nenhuma Edge Function encontrada/)
})

test('CI reporta todas as funções que falharam, não só a primeira', () => {
  assert.match(ciWorkflow, /failed\+=\("\$f"\)/)
  assert.match(ciWorkflow, /FALHOU em \$\{#failed\[@\]\}/)
})

test('toda Edge Function real em disco tem index.ts e nenhuma ficou fora da lista conhecida', () => {
  const found = realEdgeFunctions()
  assert.ok(found.length >= 21, `esperava pelo menos 21 Edge Functions, achou ${found.length}`)

  // Lista fechada das funções conhecidas nesta rodada. Uma função nova deve
  // aparecer aqui — o teste existe para forçar quem adicionar uma função a
  // também documentá-la, não para travar o merge por si só (deno check no CI
  // já cobre automaticamente qualquer index.ts novo independente desta lista).
  const known = [
    'admin-discount',
    'admin-plan-pricing',
    'admin-schedule-cancellation',
    'configure-stripe-webhook',
    'create-checkout',
    'delete-account',
    'export-user-data',
    'generate-content',
    'image-search',
    'manage-subscription',
    'resend-webhook',
    'run-automations',
    'run-emotional-automations',
    'run-lifecycle-emails',
    'send-automated-emails',
    'send-transactional-email',
    'stripe-audit',
    'stripe-selftest',
    'stripe-webhook',
    'unsubscribe',
    'youtube-search',
  ].sort()

  assert.deepEqual(found, known, 'Edge Function nova ou removida — atualize esta lista de conhecimento')
})

test('funções críticas de pagamento e dados sensíveis existem e serão checadas', () => {
  const found = new Set(realEdgeFunctions())
  for (const critical of [
    'create-checkout',
    'stripe-webhook',
    'manage-subscription',
    'send-transactional-email',
    'resend-webhook',
    'admin-discount',
    'export-user-data',
    'delete-account',
    'run-automations',
    'run-emotional-automations',
  ]) {
    assert.ok(found.has(critical), `função crítica ausente do disco: ${critical}`)
  }
})

const KNOWN_TYPE_DEBT = [
  'admin-discount',
  'admin-plan-pricing',
  'admin-schedule-cancellation',
  'configure-stripe-webhook',
  'create-checkout',
  'manage-subscription',
  'resend-webhook',
  'stripe-audit',
  'stripe-selftest',
  'stripe-webhook',
].sort()

test('CI trata a dívida de tipo conhecida como aviso, não bloqueio, e continua exigindo as demais', () => {
  assert.match(ciWorkflow, /known_broken=\(/)
  assert.match(ciWorkflow, /is_known_broken/)
  // A falha só derruba o job para o que NÃO está na lista de dívida conhecida.
  assert.match(ciWorkflow, /known_still_broken\+=\("\$f"\)/)
  assert.match(ciWorkflow, /failed\+=\("\$f"\)/)
})

test('CI avisa quando uma função da lista de dívida volta a passar, para não deixá-la esquecida', () => {
  assert.match(ciWorkflow, /known_now_fixed/)
  assert.match(ciWorkflow, /agora PASSAM/)
})

test('lista de dívida no workflow bate exatamente com docs/EDGE_FUNCTIONS_TYPE_DEBT.md', () => {
  const workflowList = [...ciWorkflow.matchAll(/"supabase\/functions\/([a-z0-9-]+)\/index\.ts"/g)]
    .map((m) => m[1])
    .filter((name) => KNOWN_TYPE_DEBT.includes(name))
    .sort()

  assert.deepEqual(
    [...new Set(workflowList)],
    KNOWN_TYPE_DEBT,
    'known_broken no ci.yml deve listar exatamente as 10 funções documentadas',
  )

  const doc = readFileSync(
    new URL('../docs/EDGE_FUNCTIONS_TYPE_DEBT.md', import.meta.url),
    'utf8',
  )
  for (const fn of KNOWN_TYPE_DEBT) {
    assert.ok(doc.includes(`\`${fn}\``), `docs/EDGE_FUNCTIONS_TYPE_DEBT.md deve documentar ${fn}`)
  }
  assert.match(doc, /apiVersion/)
  assert.match(doc, /2023-10-16/)
  assert.match(doc, /2024-06-20/)
})

test('nenhuma das 11 funções saudáveis está na lista de dívida conhecida', () => {
  const found = realEdgeFunctions()
  const healthy = found.filter((f) => !KNOWN_TYPE_DEBT.includes(f))
  assert.equal(healthy.length, 11, `esperava 11 funções saudáveis, achou ${healthy.length}`)
  for (const fn of healthy) {
    assert.equal(
      ciWorkflow.includes(`"supabase/functions/${fn}/index.ts"`),
      false,
      `${fn} está saudável e não deve entrar na lista de dívida conhecida`,
    )
  }
})

test('função legada com import remoto antigo é sinalizada, não escondida', () => {
  const legacy = readFileSync(new URL('send-automated-emails/index.ts', functionsDir), 'utf8')
  // Registro consciente: esta função ainda usa deno.land/esm.sh em vez de npm:.
  // Não é bloqueador de deno check, mas fica registrado para não surpreender.
  assert.match(legacy, /from 'https:\/\/(deno\.land|esm\.sh)\//)
})
