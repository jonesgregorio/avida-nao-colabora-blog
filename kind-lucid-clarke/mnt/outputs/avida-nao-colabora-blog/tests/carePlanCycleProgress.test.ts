import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')

// Contrato: Plano de Autocuidado precisa mostrar progresso do ciclo e uma revisão de fim de
// ciclo — mas sem virar meta, streak ou nota de desempenho (isso já é regra do produto, ver
// selfCareLivingPlan.test.ts / selfCareNoPressure.test.ts). O progresso conta só o que já
// aconteceu de verdade (uma ação ativa ganhou um resultado registrado), nunca inventa uma meta.

test('progresso do ciclo conta ações ativas com resultado registrado, não uma meta/streak', () => {
  assert.match(page, /const withOutcome=active\.filter\(x=>x\.s\?\.outcome\)\.length/)
  assert.match(page, /withOutcome\} de \{active\.length\} com retorno/)
  assert.match(page, /Sem meta ou sequência/) // já existe — confirma que o texto de "sem cobrança" segue intacto
})

test('barra de progresso é proporcional (0-100%) e some quando não há ações ativas', () => {
  assert.match(page, /width:`\$\{active\.length\?Math\.round\(withOutcome\/active\.length\*100\):0\}%`/)
  assert.match(page, /\{active\.length>0&&<section/)
})

test('revisão de fim de ciclo tabula os resultados já registrados neste plano específico, sem nota de desempenho', () => {
  assert.match(page, /const cycleReview=outcomes\.map/)
  assert.match(page, /Revisão deste ciclo/)
  assert.match(page, /não uma nota de desempenho/)
  // só aparece quando existe pelo menos um resultado registrado neste ciclo (current.id) —
  // `states` é sempre recarregado por plano (loadCarePlanActionStates(user.id,current.id)).
  assert.match(page, /\{trackedTotal>0&&<section/)
  assert.match(page, /loadCarePlanActionStates\(user\.id,current\.id\)/)
})
