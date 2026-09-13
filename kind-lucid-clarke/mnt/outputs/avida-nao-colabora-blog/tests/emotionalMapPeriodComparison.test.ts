import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/components/MyEvolutionPage.tsx', import.meta.url), 'utf8')

// Contrato: Mapa Emocional precisa comparar períodos — só números, sem narrativa (a leitura de
// padrões continua sendo papel de Descobertas).

test('busca o mês anterior em paralelo ao mês em foco, só pra comparação', () => {
  assert.match(page, /const \[previousEntries, setPreviousEntries\] = useState<MapEntry\[\]>\(\[\]\)/)
  assert.match(page, /const prevKey = shiftMonth\(periodKey, -1\)/)
  assert.match(page, /Promise\.all\(\[/)
})

test('comparação é só números (humor médio, dias com registro, emoção mais registrada) — sem texto narrativo', () => {
  assert.match(page, /Comparado ao mês anterior/)
  assert.match(page, /Humor médio/)
  assert.match(page, /Dias com registro/)
  assert.match(page, /Emoção mais registrada/)
  assert.match(page, /a leitura de possíveis padrões fica em Descobertas/)
})

test('sem dados no mês anterior, mostra aviso claro em vez de inventar uma comparação', () => {
  assert.match(page, /Ainda não há registros no mês anterior para comparar/)
  assert.match(page, /comparison\.hasPrevious \? \(/)
})

test('reaproveita a mesma lógica de "média por dia" do calendário e do gráfico (uma única fonte de verdade)', () => {
  assert.match(page, /function computeDailyMoods\(entries: MapEntry\[\]\): DayMood\[\]/)
  assert.match(page, /const dailyMoods = useMemo<DayMood\[\]>\(\(\) => computeDailyMoods\(entries\), \[entries\]\)/)
  assert.match(page, /const previousDailyMoods = useMemo<DayMood\[\]>\(\(\) => computeDailyMoods\(previousEntries\), \[previousEntries\]\)/)
})
