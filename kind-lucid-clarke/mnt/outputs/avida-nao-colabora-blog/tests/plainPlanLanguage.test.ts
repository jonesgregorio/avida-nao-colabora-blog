import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const plain = fs.readFileSync(new URL('src/lib/plainPlanLanguage.ts', root), 'utf8')
const page = fs.readFileSync(new URL('src/components/MyPlanPage.tsx', root), 'utf8')
const statuses = fs.readFileSync(new URL('src/lib/subscriptionStatus.ts', root), 'utf8')

test('Meu Plano aplica linguagem simples sem alterar as ações técnicas internas', () => {
  assert.match(page, /applyPlainPlanLanguage/)
  assert.match(page, /MutationObserver/)
  assert.match(page, /languageRootRef/)
  assert.match(plain, /Mudar de plano/)
  assert.match(plain, /Confirmar mudança de plano/)
  assert.match(plain, /Desfazer mudança de plano/)
  assert.match(plain, /Mudança para \$1 em processamento/)
  assert.match(plain, /Mudança para \$1 agendada/)
})

test('status e linha do tempo exibem mudança de plano em português simples', () => {
  assert.match(statuses, /pendingPlan\) return \{ label: 'Mudança de plano agendada'/)
  assert.match(statuses, /upgrade_confirmed: 'Mudança de plano concluída'/)
  assert.match(statuses, /downgrade_requested: 'Mudança de plano solicitada'/)
  assert.match(statuses, /downgrade_completed: 'Mudança de plano concluída'/)
  assert.doesNotMatch(statuses, /label: 'Upgrade/)
  assert.doesNotMatch(statuses, /label: 'Downgrade/)
})
