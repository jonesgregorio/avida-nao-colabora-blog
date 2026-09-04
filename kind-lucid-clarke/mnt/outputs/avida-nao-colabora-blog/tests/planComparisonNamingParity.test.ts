import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { OFFICIAL_FEATURES, OFFICIAL_PLAN_COMPARISON } from '../src/lib/officialPlans.ts'

// Pedido do usuário: os nomes das funcionalidades no Admin devem ser
// idênticos aos exibidos no site (tabela "Compare todos os recursos"), e o
// Admin deve conseguir editar nome/valor de cada linha, refletindo tanto no
// Pricing (público) quanto em Meu Plano (logado).

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// Rótulos exatos hoje visíveis no site (Pricing.tsx), usados como verdade.
const SITE_LABELS: Record<string, string> = {
  checkin_daily: 'Check-in diário',
  articles_free: 'Artigos e conteúdos',
  wellbeing_diary_5_month: 'Diário emocional',
  diary_voice: 'Diário por voz',
  basic_self_assessment: 'Questionários de autoconhecimento',
  biweekly_auto_challenges: 'Conteúdos Guiados',
  diary_unlimited: 'Diário emocional',
  diary_mood_symptoms_summary: 'Mapa Emocional',
  discoveries: 'Descobertas',
  full_history: 'Minha História',
  emotional_exercise_library: 'Conteúdos Guiados',
  weekly_assessments: 'Relatório Semanal',
  my_garden: 'Meu Jardim',
  diary_deepenings: 'Aprofundamentos do Diário',
  personalized_self_care_plan: 'Plano de Autocuidado Mensal',
  advanced_monthly_report: 'Relatório Mensal Aprofundado',
  monthly_message_guidance: 'Orientação Mensal',
}

test('nomes do catálogo oficial (Admin) são 100% idênticos aos exibidos no Pricing', () => {
  for (const feature of OFFICIAL_FEATURES) {
    const expected = SITE_LABELS[feature.key]
    assert.ok(expected, `feature "${feature.key}" não está mapeada em SITE_LABELS — atualize este teste também`)
    assert.equal(feature.name, expected, `OFFICIAL_FEATURES["${feature.key}"].name deveria ser "${expected}"`)
  }
})

test('OFFICIAL_PLAN_COMPARISON tem catalogKey em toda linha e labels idênticos ao Pricing', () => {
  const pricing = read('src/components/Pricing.tsx')
  for (const row of OFFICIAL_PLAN_COMPARISON) {
    assert.ok(row.catalogKey, `linha "${row.key}" sem catalogKey — Admin não conseguiria renomeá-la`)
    // A label da linha de comparação deve aparecer literalmente no Pricing.
    assert.ok(pricing.includes(`label: '${row.label}'`), `label "${row.label}" (linha ${row.key}) não encontrada em Pricing.tsx`)
  }
})

test('Pricing aplica o nome/valor do catálogo do Admin na tabela de comparação (não só esconde)', () => {
  const pricing = read('src/components/Pricing.tsx')
  assert.match(pricing, /const rowLabel = catalogItem\?\.name\?\.trim\(\) \|\| row\.label/)
  assert.match(pricing, /catalogItem\?\.plans\.free\.label\?\.trim\(\) \|\| row\.values\.free/)
  assert.match(pricing, /catalogItem\?\.plans\.essential\.label\?\.trim\(\) \|\| row\.values\.essential/)
  assert.match(pricing, /catalogItem\?\.plans\.plus\.label\?\.trim\(\) \|\| row\.values\.plus/)
})

test('Meu Plano (buildCatalogComparisonRows) aplica o mesmo nome/valor do catálogo do Admin', () => {
  const presentation = read('src/lib/planCatalogPresentation.ts')
  assert.match(presentation, /const item = row\.catalogKey \? byKey\.get\(row\.catalogKey\) : null/)
  assert.match(presentation, /label: item\.name\.trim\(\) \|\| row\.label/)
  assert.match(presentation, /free: item\.plans\.free\.label\?\.trim\(\) \|\| row\.values\.free/)
  // Toda linha do sistema em Meu Plano carrega catalogKey, igual ao Pricing
  // (algumas features compartilham a mesma linha visual — ex.: diário básico
  // do Gratuito e diário ilimitado do Essencial/Plus são a mesma linha
  // "Diário emocional" — por isso checamos as chaves usadas nas LINHAS, não
  // em cada feature do catálogo).
  for (const row of OFFICIAL_PLAN_COMPARISON) {
    assert.match(presentation, new RegExp(`catalogKey: '${row.catalogKey}'`), `CURRENT_COMPARISON_ROWS não tem catalogKey '${row.catalogKey}' (linha ${row.key})`)
  }
})
