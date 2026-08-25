import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Bug concreto apontado na MISSÃO GERAL: o e-mail de "relatório semanal
// disponível" linkava para /meu-plano (página de assinatura) em vez de
// /meu-relatorio (onde o relatório de fato é lido).
test('e-mail de relatório semanal disponível linka para /meu-relatorio, não /meu-plano', () => {
  const runner = read('supabase/functions/run-lifecycle-emails/index.ts')
  const line = runner.split('\n').find(l => l.includes("'weekly_report_available'")) ?? ''
  assert.notEqual(line, '', 'não encontrou a chamada send(...) de weekly_report_available')
  assert.match(line, /link_relatorio: `\$\{SITE\}\/meu-relatorio`/)
  assert.doesNotMatch(line, /\$\{SITE\}\/meu-plano/)
})

test('prévia de e-mail no Admin usa o mesmo link correto (/meu-relatorio)', () => {
  const admin = read('src/components/admin/AdminEmails.tsx')
  assert.match(admin, /link_relatorio: 'https:\/\/avidanaocolabora\.com\/meu-relatorio'/)
})

// Bug concreto: a persistência do Plano de Autocuidado gravava
// generated_by_ai:true de forma fixa, mesmo quando o admin nunca gerou por
// IA (texto todo manual) ou quando a IA caiu no fallback determinístico.
test('Plano de Autocuidado só marca generated_by_ai=true quando a IA de fato gerou (não fixo)', () => {
  const src = read('src/components/admin/AdminMonthlyCarePlans.tsx')
  assert.doesNotMatch(src, /generated_by_ai: true,/)
  assert.match(src, /generated_by_ai: generatedByAI,/)
  assert.match(src, /const \[generatedByAI, setGeneratedByAI\] = useState\(plan\?\.generated_by_ai \?\? false\)/)
  assert.match(src, /setGeneratedByAI\(result\.generatedByAI\)/)
})
