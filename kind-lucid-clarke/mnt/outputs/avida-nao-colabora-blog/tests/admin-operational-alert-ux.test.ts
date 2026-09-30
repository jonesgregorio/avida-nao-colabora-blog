import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helper = readFileSync(new URL('../src/lib/adminOperationalAlertUX.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('central de alertas guarda estado de leitura e atualiza o contador do sino', () => {
  assert.match(helper, /avnc-admin-operational-alerts-read-v1/)
  assert.match(helper, /Marcar todos como lidos/)
  assert.match(helper, /dataset\.alertRead/)
  assert.match(helper, /currentUnreadCount/)
  assert.match(helper, /button\[aria-label="Alertas administrativos"\]/)
})

test('clicar no alerta marca como lido e abre a sub-aba relacionada', () => {
  assert.match(helper, /nextRead\.add\(latest\.signature\)/)
  assert.match(helper, /openRelatedDestination\(latest\.label\)/)
  assert.match(helper, /Relatórios aguardando revisão': \['Relatórios'\]/)
  assert.match(helper, /Falhas ativas de e-mail': \['Histórico', 'E-mails'\]/)
  assert.match(helper, /Orientações aguardando resposta': \['Orientações'\]/)
})

test('uma mudança na quantidade cria uma nova assinatura e volta a ser novidade', () => {
  assert.match(helper, /return `\$\{label\}::\$\{count\}`/)
})

test('melhoria da central de alertas é inicializada antes do React', () => {
  assert.match(main, /initAdminOperationalAlertUX/)
  assert.match(main, /initAdminOperationalAlertUX\(\)/)
})
