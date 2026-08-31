import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const reports = read('src/components/MyReportPageContent.tsx')
const adaptive = read('src/lib/adaptiveCheckin.ts')
const emotionalRunner = read('supabase/functions/run-emotional-automations/runner.ts')

test('Fase 20.9 remove metas de frequência e chamadas de continuidade obrigatória', () => {
  assert.doesNotMatch(reports, /Continue registrando|Complete seus check-ins|checkinCount \?\? 0}\/7|de 7 dias/)
  assert.doesNotMatch(adaptive, /Certo\. Continue registrando como você está agora/)
  assert.doesNotMatch(emotionalRunner, /Continuar registrando ajuda a perceber conexões mais claras/)

  assert.match(reports, /sem meta de frequência ou obrigação de completar a semana/)
  assert.match(reports, /você não precisa completar uma quantidade de dias/)
  assert.match(reports, /sem obrigação de manter uma sequência/)
  assert.match(adaptive, /Se fizer sentido para você registrar este momento/)
  assert.match(emotionalRunner, /Se fizer sentido para você, novos registros podem ajudar a contextualizar mudanças/)
})

test('QA final não introduz mecânicas de pontuação ou streak nas superfícies auditadas', () => {
  const userFacing = [reports, adaptive].join('\n')
  assert.doesNotMatch(userFacing, /\bXP\b|\bstreak\b|ranking de usuário|pontuação de continuidade|meta de 7\/7/i)
})

test('automação emocional mantém a fronteira explícita de privacidade', () => {
  assert.match(emotionalRunner, /nunca recebe texto livre do diário: somente colunas analíticas agregadas/)
  assert.doesNotMatch(emotionalRunner, /select\([^)]*(?:text|content|body)[^)]*\).*diary_entries/i)
})
