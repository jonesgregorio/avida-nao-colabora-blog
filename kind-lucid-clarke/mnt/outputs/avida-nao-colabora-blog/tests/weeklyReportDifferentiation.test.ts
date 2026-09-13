import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// reportGeneration.ts importa o cliente Supabase (precisa de env do Vite) — não dá pra importar
// direto num teste Node puro, então (como o restante da suíte de relatórios) validamos a lógica
// via leitura do código-fonte.
const mockup = readFileSync(new URL('../src/components/WeeklyReportMockup.tsx', import.meta.url), 'utf8')
const generation = readFileSync(new URL('../src/lib/reportGeneration.ts', import.meta.url), 'utf8')

// O Relatório Semanal precisa ser um fechamento curto e escaneável de UMA semana — não um
// "mini Relatório Mensal" (necessidades, ações de cuidado, gráfico dia-a-dia multi-métrica já
// existem no Mapa Emocional e no Relatório Mensal) nem um plano de ações (isso é o Plano de
// Autocuidado). Ver diary_tag_outro_fix/garden_v3_redesign para o padrão de "descoberta simples,
// motor puro" — aqui o princípio equivalente é "contrato de saída próprio por funcionalidade".

test('Relatório Semanal não repete o gráfico dia-a-dia nem os blocos de necessidades/ações de cuidado do Relatório Mensal', () => {
  assert.doesNotMatch(mockup, /LineChart|recharts/)
  assert.doesNotMatch(mockup, /Necessidades percebidas|Ações de cuidado/)
  assert.doesNotMatch(mockup, /main_needs|care_actions_used/)
})

test('Relatório Semanal não vira plano de ações — isso é papel do Plano de Autocuidado', () => {
  assert.doesNotMatch(mockup, /Próximos passos leves|gentle_next_steps/)
  assert.match(mockup, /papel do Plano de Autocuidado/)
})

test('Relatório Semanal mostra comparação com a semana anterior e uma pergunta de reflexão (não uma lista de tarefas)', () => {
  assert.match(mockup, /Em relação à semana passada/)
  assert.match(mockup, /comparison/)
  assert.match(mockup, /Uma pergunta para esta semana/)
  assert.match(mockup, /reflectionQuestion/)
})

test('Relatório Semanal limita destaques a 3 e ponto de atenção a 1 (fechamento curto, não outra Descobertas)', () => {
  assert.match(mockup, /const highlights = \(c\.observed_patterns \?\? c\.patterns \?\? \[\]\)\.slice\(0, 3\)/)
  assert.match(mockup, /const attention = \(c\.attention_points \?\? c\.attentionPoints \?\? \[\]\)\.slice\(0, 1\)/)
})

test('buildWeeklyContent gera uma pergunta de reflexão própria, distinta do resumo/interpretação, e zera nextSteps (não é mais lista de ações)', () => {
  assert.match(generation, /const reflectionQuestion = hasInterpretationData/)
  assert.match(generation, /reflectionQuestion,\s*\n\s*topEmotions: a\.topEmotions\.slice\(0, 5\)/)
  assert.match(generation, /nextSteps: \[\],/)
  assert.doesNotMatch(generation, /nextSteps: \['Fazer um check-in/)
})

test('relatórios semanais salvos antes da pergunta de reflexão existir ganham uma pergunta genérica ao normalizar, não ficam vazios', () => {
  assert.match(generation, /reflectionQuestion: normalized\.reflectionQuestion\?\.trim\(\)/)
})
