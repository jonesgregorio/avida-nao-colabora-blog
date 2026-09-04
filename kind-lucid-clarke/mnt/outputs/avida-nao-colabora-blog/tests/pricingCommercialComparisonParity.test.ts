import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Achado do usuário: um recurso comercial criado pelo Admin (aba "Catálogo
// de funcionalidades") aparecia na tabela comparativa de Meu Plano (logado)
// mas não na tabela do Pricing (site público) — porque Pricing montava a
// tabela só a partir de COMPARISON_ROWS (uma lista fixa de recursos
// técnicos), nunca somando os itens comerciais do catálogo.

test('Pricing soma os itens comerciais do catálogo à tabela de comparação, igual a Meu Plano', () => {
  const pricing = read('src/components/Pricing.tsx')
  assert.match(pricing, /const commercialComparisonRows = useMemo\(\(\) => catalog\.items/)
  assert.match(pricing, /item\.kind === 'commercial' && item\.isActive && item\.showOnComparison/)
  assert.match(pricing, /item\.key !== 'professional_comment_on_monthly_report'/)
  assert.match(pricing, /\.\.\.commercialComparisonRows,/)
})

test('linhas comerciais renderizam sem quebrar (sem FEATURES[row.id], sem InfoButton obrigatório)', () => {
  const pricing = read('src/components/Pricing.tsx')
  assert.match(pricing, /const feature: PlanFeature \| undefined = FEATURES\[row\.id as FeatureId\]/)
  assert.match(pricing, /\{feature && <InfoButton feature=\{\{ \.\.\.feature, label: rowLabel \}\} onOpen=\{setInfoFeature\} \/>\}/)
})
