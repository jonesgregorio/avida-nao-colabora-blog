import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// careePlanAI.ts importa aiContent/contentRecommendation (cadeia que chega em supabase.ts,
// precisa de env do Vite) — não dá pra importar direto num teste Node puro, como o resto da
// suíte de relatórios/orientação. Validamos via leitura do código-fonte.
const lib = readFileSync(new URL('../src/lib/careePlanAI.ts', import.meta.url), 'utf8')
const prompt = readFileSync(new URL('../src/lib/aiPrompts/emotionalPrompts.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')

test('rascunho determinístico já vem com frequência, dificuldade e duração nas 3 frentes (nunca fica vazio pra quem cai no fallback)', () => {
  const priorityBlocks = lib.split(/\{\s*\n\s*priority: '/).slice(1, 4)
  assert.equal(priorityBlocks.length, 3, 'esperava as 3 frentes do rascunho determinístico')
  for (const block of priorityBlocks) {
    assert.match(block, /action_plan: \[/)
    assert.match(block, /frequency: '[^']+'/)
    assert.match(block, /difficulty: '(leve|moderado|dificil)'/)
    assert.match(block, /duration_minutes: \d+/)
  }
})

test('parser aceita action_plan da IA como estimativa, nunca cobrança, e ignora dificuldade fora do vocabulário permitido', () => {
  assert.match(lib, /const DIFFICULTIES = new Set\(\['leve', 'moderado', 'dificil'\]\)/)
  assert.match(lib, /function asActionDetails\(v: unknown\): CareActionDetail\[\]/)
  assert.match(lib, /DIFFICULTIES\.has\(difficulty\) \? difficulty as CareActionDetail\['difficulty'\] : undefined/)
})

test('action_plan é opcional e paralelo a small_actions — plano antigo sem esse campo não quebra nem é preenchido com dado inventado', () => {
  assert.match(lib, /action_plan\?: CareActionDetail\[\]/)
  assert.match(lib, /action_plan: actionPlan\.length \? actionPlan : undefined/)
})

test('prompt pede frequência/dificuldade/duração como estimativas, nunca meta rígida', () => {
  assert.match(prompt, /"action_plan": \[/)
  assert.match(prompt, /sempre como estimativas possíveis para ajudar a pessoa a se organizar, nunca como uma cobrança ou meta rígida/)
})

test('tela mostra a metadata da ação (frequência · dificuldade · duração) só quando existe, sem quebrar planos sem action_plan', () => {
  assert.match(page, /function actionDetailFor\(action:string,p:CarePlanContent\|null\)/)
  assert.match(page, /function ActionMeta\(\{action,p\}:\{action:string;p:CarePlanContent\|null\}\)\{const d=actionDetailFor\(action,p\);if\(!d\)return null/)
  assert.match(page, /<ActionMeta action={a} p={current\.care_plan}\/>/)
})
