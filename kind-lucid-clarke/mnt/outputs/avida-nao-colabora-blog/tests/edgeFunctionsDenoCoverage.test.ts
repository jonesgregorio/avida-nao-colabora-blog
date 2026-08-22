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

test('função legada com import remoto antigo é sinalizada, não escondida', () => {
  const legacy = readFileSync(new URL('send-automated-emails/index.ts', functionsDir), 'utf8')
  // Registro consciente: esta função ainda usa deno.land/esm.sh em vez de npm:.
  // Não é bloqueador de deno check, mas fica registrado para não surpreender.
  assert.match(legacy, /from 'https:\/\/(deno\.land|esm\.sh)\//)
})
