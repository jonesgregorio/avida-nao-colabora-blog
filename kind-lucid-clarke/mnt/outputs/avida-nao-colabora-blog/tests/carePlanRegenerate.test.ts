import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const comp = readFileSync(new URL('../src/components/admin/AdminMonthlyCarePlans.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('"Regerar e trocar" existe e funciona inclusive num plano já enviado', () => {
  assert.match(comp, /async function regenerateAndReplace\(\)/)
  assert.match(comp, /const wasSent = status === 'sent'/)
  // Confirmação específica quando já foi enviado (usuário perde acesso até re-revisão).
  assert.match(comp, /Ele já foi enviado\. Vai voltar para "em revisão"/)
  // Plano já enviado é persistido de volta para rascunho, limpando os carimbos.
  assert.match(comp, /if \(wasSent\) \{\s*\n\s*await persist\('draft', \{ clearSent: true/)
})

test('regerar um plano enviado limpa os carimbos de envio (volta para revisão de verdade)', () => {
  assert.match(comp, /if \(opts\.clearSent\) \{ base\.sent_at = null; base\.sent_by = null; base\.reviewed_at = null; base\.reviewed_by = null \}/)
  assert.match(comp, /async function persist\(next: 'draft' \| 'send' \| 'skip', opts: \{ clearSent\?: boolean; aiErrorText\?: string \| null \} = \{\}\)/)
})

test('regerar um rascunho/revisão não fecha o drawer sozinho — admin revisa e salva', () => {
  // Só o caminho wasSent persiste aqui; o resto deixa o conteúdo no formulário.
  assert.match(comp, /Regerado com IA\. Revise e clique em Salvar rascunho ou Enviar plano\./)
})

test('ação em lote regenera só os planos de rascunho de emergência ainda em revisão', () => {
  assert.match(comp, /const emergencyPlans = plans\.filter\(p =>/)
  assert.match(comp, /p\.fallback_used && \['draft', 'pending_review'\]\.includes\(p\.status\)/)
  assert.match(comp, /async function regenerateEmergencyBatch\(\)/)
  assert.match(comp, /from\('monthly_care_plans'\)\.delete\(\)\.in\('id', ids\)/)
  assert.match(comp, /supabase\.functions\.invoke\('run-emotional-automations', \{ body: \{ mode: 'monthly' \} \}\)/)
  // Não toca em enviados.
  assert.doesNotMatch(comp, /emergencyPlans[\s\S]{0,200}'sent'/)
})

test('o botão de lote só aparece quando há planos de emergência', () => {
  assert.match(comp, /\{emergencyPlans\.length > 0 && \(/)
  assert.match(comp, /Regerar \{emergencyPlans\.length\} de emergência/)
})
