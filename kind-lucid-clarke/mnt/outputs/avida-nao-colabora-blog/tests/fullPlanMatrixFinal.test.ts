import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getEffectivePlan, hasPlanAccess, type PlanKey } from '../src/lib/officialPlans.ts'

// PR5 — polimento final: valida a matriz comercial completa descrita na
// auditoria (Gratuito / Essencial / Plus / unlimited_access) e as rotas que
// a expõem, fechando o checklist de "testes obrigatórios" do pedido.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function access(feature: PlanKey, plan: PlanKey, unlimited = false): boolean {
  return hasPlanAccess(getEffectivePlan({ plan, unlimited_access: unlimited }), feature)
}

test('matriz de acesso por recurso: free/essential/plus batem com a especificação comercial', () => {
  // Descobertas, Mapa Emocional, Relatório Semanal, Meu Jardim: Essencial+
  for (const feature of ['essential'] as PlanKey[]) {
    assert.equal(access(feature, 'free'), false)
    assert.equal(access(feature, 'essential'), true)
    assert.equal(access(feature, 'plus'), true)
  }
  // Aprofundamentos, Relatório Mensal, Autocuidado, Orientação: Plus só
  for (const feature of ['plus'] as PlanKey[]) {
    assert.equal(access(feature, 'free'), false)
    assert.equal(access(feature, 'essential'), false)
    assert.equal(access(feature, 'plus'), true)
  }
})

test('unlimited_access equivale a Plus em toda a matriz, sem virar plano comercial exibido', () => {
  assert.equal(access('essential', 'free', true), true)
  assert.equal(access('plus', 'free', true), true)
  assert.equal(access('plus', 'essential', true), true)
  // Não deve existir 'unlimited_access' como PlanKey/rótulo comercial
  const officialPlans = read('src/lib/officialPlans.ts')
  assert.doesNotMatch(officialPlans, /PLAN_KEYS.*unlimited_access/)
  assert.doesNotMatch(officialPlans, /label:\s*'Ilimitado'/)
})

test('Diário: 5 dias/mês no Gratuito, sem limite no Essencial/Plus (DEFAULT_DIARY_CONFIGS)', () => {
  const config = read('src/lib/diaryConfig.ts')
  assert.match(config, /plan: 'free'.*entriesPerMonth: 5/)
  assert.match(config, /plan: 'essential'.*entriesPerMonth: null/)
  assert.match(config, /plan: 'plus'.*entriesPerMonth: null/)
})

test('Aprofundamentos do Diário: só o Plus vê o botão/mensagem ativa, com trava também no servidor', () => {
  const diary = read('src/components/DiaryExperience.tsx')
  assert.match(diary, /MAX_DEEPENINGS_PER_DAY = 3/)
  assert.match(diary, /if \(!isPlus\) \{ setError\('Aprofundamentos do Diário estão disponíveis a partir do plano Plus\.'\); return \}/)
  assert.match(diary, /isPlus && !todayDeepened && <button/)

  const trigger = read('supabase/migrations/20260904024500_checkin_unico_tres_aprofundamentos.sql')
  assert.match(trigger, /user_plan = 'essential' AND new_kind = 'advanced'/)
  assert.match(trigger, /user_plan = 'free' AND new_kind <> 'basic'/)
})

test('Meu Jardim não usa linguagem de nível/XP na interface', () => {
  const garden = read('src/components/MyGardenPage.tsx')
  assert.doesNotMatch(garden, /Nível \{/)
  assert.doesNotMatch(garden, /\bconst level=/)
  assert.match(garden, /theme\.name/)
})

test('rotas da matriz existem e exigem autenticação antes de checar o plano', () => {
  const nav = read('src/lib/navigation.ts')
  for (const [path, view] of [
    ["'/descobertas'", 'descobertas'],
    ["'/meu-jardim'", 'my-garden'],
    ["'/minha-historia'", 'my-history'],
    ["'/plano-de-autocuidado'", 'self-care'],
    ["'/guia-mensal'", 'monthly-guidance'],
  ] as const) {
    assert.match(nav, new RegExp(`${path}:\\s*'${view}'`), `rota ausente para ${view}`)
  }

  const app = read('src/App.tsx')
  for (const view of ['descobertas', 'my-garden', 'my-history', 'self-care', 'monthly-guidance']) {
    const re = new RegExp(`view === '${view}'\\) \\{\\s*if \\(!user\\) \\{ goAuth\\('${view}'\\)`)
    assert.match(app, re, `rota '${view}' deve exigir login antes de qualquer checagem de plano`)
  }
})

test('Comentário profissional segue fora de qualquer plano ativo (checagem final cruzada com PR2/PR3)', () => {
  const officialPlans = read('src/lib/officialPlans.ts')
  assert.doesNotMatch(officialPlans, /key: 'professional_comment_on_monthly_report'/)
  const personalization = read('src/lib/personalizationTasks.ts')
  assert.doesNotMatch(personalization, /key:\s*'professional_comment'/)
})
