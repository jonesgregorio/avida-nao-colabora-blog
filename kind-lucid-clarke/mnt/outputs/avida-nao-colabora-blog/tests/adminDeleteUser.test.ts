import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const fn = read('supabase/functions/admin-delete-user/index.ts')
const card = read('src/components/admin/AdminDeleteUserCard.tsx')
const users = read('src/components/admin/AdminUsersImpl.tsx')

const at = (needle: string) => {
  const i = fn.indexOf(needle)
  assert.ok(i >= 0, `trecho ausente: ${needle}`)
  return i
}

test('só admin com MFA (AAL2) executa, e a autorização vem antes de qualquer leitura do corpo', () => {
  assert.match(fn, /import \{ requireAdminAal2 \} from '\.\.\/_shared\/adminAuth\.ts'/)
  assert.ok(at('await requireAdminAal2(req)') < at('await req.json()'))
  assert.match(fn, /if \(!auth\.ok\) return json\(\{ error: auth\.error \}, auth\.status, headers\)/)
})

test('proteções: não exclui a si mesmo, nem admin, e exige o e-mail digitado igual ao da conta', () => {
  assert.match(fn, /userId === auth\.user\.id/)
  assert.match(fn, /profile\?\.role === 'admin'/)
  assert.match(fn, /confirmEmail !== targetEmail/)
  assert.match(fn, /UUID\.test\(userId\)/)
})

test('contas com cobrança são recusadas e o Stripe nunca é tocado por esta função', () => {
  assert.match(fn, /stripe_customer_id \|\| profile\?\.stripe_subscription_id \|\| subscription\?\.provider_subscription_id/)
  assert.match(fn, /\}, 409, headers\)/)
  assert.doesNotMatch(fn, /npm:stripe|new Stripe|stripe\.(customers|subscriptions)/)
})

test('a auditoria é gravada antes de apagar e não guarda o e-mail inteiro', () => {
  assert.ok(at("from('admin_logs').insert") < at('auth.admin.deleteUser('))
  assert.match(fn, /function maskEmail/)
  assert.match(fn, /email: maskEmail\(targetEmail\)/)
  assert.doesNotMatch(fn, /details: JSON\.stringify\(\{ email: targetEmail/)
  // se a auditoria falhar, nada é apagado
  assert.match(fn, /Nada foi excluído/)
})

test('limpeza igual à do "excluir minha conta": tabelas SET NULL, avatar e hard delete do Auth', () => {
  assert.match(fn, /'ai_generation_logs', 'analytics_events', 'comments', 'questionnaire_responses', 'admin_activity_events'/)
  assert.match(fn, /storage\.from\('avatars'\)\.list\(userId/)
  assert.match(fn, /auth\.admin\.deleteUser\(userId, false\)/)
  const own = read('supabase/functions/delete-account/index.ts')
  for (const table of ['ai_generation_logs', 'analytics_events', 'comments', 'questionnaire_responses']) assert.ok(own.includes(`'${table}'`))
})

test('nenhuma credencial vai para o navegador: o cartão chama só a Edge Function', () => {
  assert.match(card, /supabase\.functions\.invoke\('admin-delete-user'/)
  assert.doesNotMatch(card, /service_role|SERVICE_ROLE|deleteUser/)
})

test('o cartão exige digitar o e-mail, bloqueia admin e atualiza a lista depois de excluir', () => {
  assert.match(card, /typed\.trim\(\)\.toLowerCase\(\) === email\.toLowerCase\(\)/)
  assert.match(card, /disabled=\{!matches \|\| busy\}/)
  assert.match(card, /Contas administrativas não podem ser excluídas por aqui/)
  assert.match(card, /Excluir definitivamente/)
  assert.match(users, /<AdminDeleteUserCard/)
  assert.match(users, /onDeleted=\{\(\) => \{ setSelectedUser\(null\); void loadUsers\(\); void loadStats\(\) \}\}/)
})
