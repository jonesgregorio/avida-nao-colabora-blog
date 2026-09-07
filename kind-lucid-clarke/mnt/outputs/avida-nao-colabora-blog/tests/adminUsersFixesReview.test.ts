import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const app = read('src/App.tsx')
const gate = read('src/components/AccountBlockedGate.tsx')
const impl = read('src/components/admin/AdminUsersImpl.tsx')

test('conta bloqueada/suspensa é barrada antes de qualquer área logada', () => {
  assert.match(app, /import AccountBlockedGate from '\.\/components\/AccountBlockedGate'/)
  assert.match(app, /account_status === 'blocked' \|\| profile\.account_status === 'suspended'/)
  assert.match(app, /<AccountBlockedGate/)
  // Fica logo após o gate de troca de senha obrigatória, antes das rotas.
  assert.ok(
    app.indexOf('profile?.must_change_password') < app.indexOf("profile.account_status === 'blocked'"),
    'o gate de bloqueio deve vir depois do must_change_password',
  )
  assert.ok(
    app.indexOf("profile.account_status === 'blocked'") < app.indexOf("view === 'auth'"),
    'o gate de bloqueio deve vir antes do roteamento de views',
  )
  assert.match(gate, /Conta bloqueada/)
  assert.match(gate, /Conta temporariamente suspensa/)
  assert.match(gate, /onSignOut/)
})

test('alteração de plano não está mais duplicada na aba "Plano"', () => {
  // A aba Plano vira só leitura (badge + histórico) e aponta para a aba certa.
  assert.doesNotMatch(impl, /async function handlePlanChange/)
  assert.doesNotMatch(impl, /setChangingPlan/)
  assert.match(impl, /use a aba <strong>Assinatura e Pagamentos<\/strong>/)
  // O único fluxo de alteração de plano é o adminChangePlan (aba Assinatura),
  // que mantém profiles + user_subscriptions + os DOIS históricos + notificação.
  assert.match(impl, /async function adminChangePlan/)
  assert.match(impl, /from\('plan_change_history'\)\.insert/)
  assert.match(impl, /from\('user_plan_history'\)\.insert/)
  assert.match(impl, /adminSubPlanReason/)
})

test('não há mais cancelamento/reativação fake (sem Stripe) na gaveta de Usuários', () => {
  assert.doesNotMatch(impl, /async function adminCancelSub/)
  assert.doesNotMatch(impl, /async function adminReactivateSub/)
  assert.doesNotMatch(impl, /Agendar cancelamento/)
  assert.doesNotMatch(impl, /Cancelamento agendado com sucesso/)
  // Aponta para o fluxo real.
  assert.match(impl, /para cancelar uma assinatura paga, use a aba <strong>Cancelamentos<\/strong>/)
})

test('copy de pagamento desatualizada removida', () => {
  assert.doesNotMatch(impl, /Mercado Pago/)
})

const model = read('src/components/admin/adminUsersModel.ts')

test('aba "Mapa emocional" da gaveta foi removida (número duplicava a aba Uso)', () => {
  assert.doesNotMatch(model, /key: 'mapa'/)
  assert.doesNotMatch(model, /\|\s*'mapa'/)
  assert.doesNotMatch(impl, /drawerTab === 'mapa'/)
  // "Último registro no diário" passou para a aba Uso.
  assert.match(impl, /drawerTab === 'uso'/)
  assert.match(impl, /Último registro no diário/)
})

test('status da conta aparece em português', () => {
  assert.match(model, /ACCOUNT_STATUS_LABELS/)
  assert.match(model, /blocked: 'Bloqueada'/)
  assert.match(model, /suspended: 'Suspensa'/)
  assert.match(impl, /accountStatusLabel\(selectedUser\.account_status\)/)
})

test('remover o próprio acesso de admin dá um aviso diferente', () => {
  assert.match(impl, /const isSelf = !!adminUser\?\.id && userId === adminUser\.id/)
  assert.match(impl, /SEU PRÓPRIO acesso de administrador/)
})
