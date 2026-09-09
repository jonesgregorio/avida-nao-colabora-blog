import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const hub = readFileSync(new URL('../src/components/admin/AdminSelfCareHub.tsx', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/components/admin/AdminLivingCarePlanWorkspace.tsx', import.meta.url), 'utf8')

test('Admin usa o workspace visual do Plano Vivo em vez do formulário mensal legado', () => {
  assert.match(hub, /AdminLivingCarePlanWorkspace/)
  assert.doesNotMatch(hub, /AdminMonthlyCarePlans/)
  assert.match(workspace, /Revisão do Plano Vivo/)
  assert.match(workspace, /Da leitura estruturada ao plano que o usuário verá/)
  assert.match(workspace, /Prévia do usuário/)
})

test('Admin mostra a mesma estrutura funcional do Plano Vivo', () => {
  assert.match(workspace, /Foco atual/)
  assert.match(workspace, /Por que este foco/)
  assert.match(workspace, /Frente \{i \+ 1\}/)
  assert.match(workspace, /Pequenas ações/)
  assert.match(workspace, /Sem meta ou sequência/)
  assert.match(workspace, /Ver prévia/)
})

test('IA só é chamada quando há contexto suficiente segundo a regra oficial 12 registros e 8 dias', () => {
  assert.match(workspace, /total >= 12 && days >= 8/)
  assert.match(workspace, /if \(!readiness\.ready\)/)
  assert.match(workspace, /A IA não será chamada para criar um plano genérico/)
  assert.match(workspace, /Contexto insuficiente/)
})

test('revisão exibe feedback estruturado do ciclo anterior e não texto íntimo', () => {
  assert.match(workspace, /admin_care_plan_insights/)
  assert.match(workspace, /Aprendizado do ciclo anterior/)
  assert.match(workspace, /Ajudaram/)
  assert.match(workspace, /Adaptações/)
  assert.match(workspace, /Não combinaram/)
  assert.match(workspace, /Nenhum texto íntimo do Diário/)
})

test('envio continua exigindo revisão humana e usa os canais canônicos', () => {
  assert.match(workspace, /reviewed_by/)
  assert.match(workspace, /reviewed_at/)
  assert.match(workspace, /sent_by/)
  assert.match(workspace, /sent_at/)
  assert.match(workspace, /createUserNotification/)
  assert.match(workspace, /emailSelfCarePlanForUser/)
  assert.match(workspace, /Revisar e enviar/)
})
