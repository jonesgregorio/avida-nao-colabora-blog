import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/MyEvolutionPage.tsx', import.meta.url), 'utf8')
const legacy = readFileSync(new URL('../src/components/MyEvolutionPageLegacy.tsx', import.meta.url), 'utf8')

test('22.4 coloca a leitura visual antes da interpretação detalhada', () => {
  assert.match(page, /Seu mês/)
  assert.match(page, /Quando isso aconteceu\?/)
  assert.match(page, /Algo chama atenção/)
  assert.match(page, /Explorar detalhes/)
  assert.match(page, /LegacyMyEvolutionPage/)
})

test('22.4 preserva o mapa completo atrás de aprofundamento voluntário', () => {
  assert.match(page, /setShowDetails\(true\)/)
  assert.match(page, /initialTab === 'graficos'/)
  assert.match(page, /Voltar ao resumo do mês/)
  assert.match(legacy, /EmotionalDrilldownPanel/)
  assert.match(legacy, /Entender melhor meu mapa/)
})

test('resumo novo usa somente dados estruturados e mantém regras de plano', () => {
  assert.match(page, /hasPlanAccess\(plan, 'essential'\)/)
  assert.match(page, /select\('mood_score,emotional_tags,context_tags,date,created_at'\)/)
  assert.doesNotMatch(page, /select\([^)]*(?:content|free_note|recurring_thoughts|answers)[^)]*\)/i)
  assert.match(page, /não o texto completo do seu Diário/)
  assert.match(page, /não é diagnóstico/i)
})

test('22.4 não transforma o resumo em gamificação ou diagnóstico causal', () => {
  assert.doesNotMatch(page, /\bXP\b|ranking|streak|pontos conquistados|aria-valuenow/i)
  assert.match(page, /Isso não indica causa; pode valer observar a relação/)
  assert.match(page, /Sem comparar desempenho/)
  assert.match(page, /Não existe meta de frequência|Não existe meta|não existe meta/i)
})
