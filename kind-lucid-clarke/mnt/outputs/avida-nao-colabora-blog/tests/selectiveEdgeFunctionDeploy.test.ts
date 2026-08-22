import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectEdgeFunctions } from '../../../../../.github/scripts/select-edge-functions-to-deploy.mjs'

const allFunctions = ['create-checkout', 'resend-webhook', 'send-transactional-email', 'stripe-webhook']
const appPrefix = 'kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/'

test('deploy seletivo publica apenas a Edge Function alterada', () => {
  assert.deepEqual(
    selectEdgeFunctions([
      `${appPrefix}supabase/functions/send-transactional-email/index.ts`,
    ], allFunctions),
    ['send-transactional-email'],
  )
})

test('mudança em código compartilhado publica todas as Edge Functions', () => {
  assert.deepEqual(
    selectEdgeFunctions([
      `${appPrefix}supabase/functions/_shared/adminAuth.ts`,
    ], allFunctions),
    allFunctions,
  )
})

test('mudança no config do Supabase publica todas as Edge Functions', () => {
  assert.deepEqual(
    selectEdgeFunctions([
      `${appPrefix}supabase/config.toml`,
    ], allFunctions),
    allFunctions,
  )
})

test('alteração somente no workflow não republica Edge Function', () => {
  assert.deepEqual(
    selectEdgeFunctions(['.github/workflows/deploy-supabase-functions.yml'], allFunctions),
    [],
  )
})

test('workflow usa o seletor e não contém mais deploy global', () => {
  const workflow = readFileSync(
    new URL('../../../../../.github/workflows/deploy-supabase-functions.yml', import.meta.url),
    'utf8',
  )
  assert.match(workflow, /select-edge-functions-to-deploy\.mjs/)
  assert.match(workflow, /supabase functions deploy "\$function_name"/)
  assert.match(workflow, /GITHUB_EVENT_NAME.*workflow_dispatch/)
  assert.doesNotMatch(workflow, /supabase functions deploy --project-ref/)
})
