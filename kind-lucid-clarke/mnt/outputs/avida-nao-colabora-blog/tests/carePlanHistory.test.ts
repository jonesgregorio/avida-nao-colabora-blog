import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SEARCH_THRESHOLD, countRealPlans, filterPlans, groupPlansByYear, monthName, monthYearLabel, type CarePlanHistoryItem } from '../src/lib/carePlanHistory.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const plan = (month: string, title: string, empty = false): CarePlanHistoryItem => ({ id: `p-${month}`, month_reference: month, title, empty })

// 2 anos, fora de ordem de propósito
const ITEMS = [
  plan('2026-03', 'Dormir com mais calma'),
  plan('2025-11', 'Pausas curtas no trabalho'),
  plan('2026-09', 'Voltar a caminhar um pouco'),
  plan('2025-12', 'Ciclo sem plano gerado', true),
  plan('2026-01', 'Organizar a rotina da manhã'),
]

test('agrupa por ano (mais recente primeiro) e ordena os meses do mais novo ao mais antigo', () => {
  const groups = groupPlansByYear(ITEMS)
  assert.deepEqual(groups.map((g) => g.year), ['2026', '2025'])
  assert.deepEqual(groups[0].items.map((i) => i.month_reference), ['2026-09', '2026-03', '2026-01'])
  assert.deepEqual(groups[1].items.map((i) => i.month_reference), ['2025-12', '2025-11'])
  assert.deepEqual(groupPlansByYear([]), [])
})

test('nomes de mês em português e rótulo com ano', () => {
  assert.equal(monthName('2026-03'), 'Março')
  assert.equal(monthName('2026-09'), 'Setembro')
  assert.equal(monthYearLabel('2025-12'), 'Dezembro de 2025')
  assert.equal(monthName('lixo'), 'lixo')
})

test('busca por mês, ano ou palavra do foco, sem acento e sem diferenciar maiúsculas', () => {
  assert.deepEqual(filterPlans(ITEMS, 'março').map((i) => i.id), ['p-2026-03'])
  assert.deepEqual(filterPlans(ITEMS, 'MARCO').map((i) => i.id), ['p-2026-03'])
  assert.deepEqual(filterPlans(ITEMS, '2025').map((i) => i.id), ['p-2025-12', 'p-2025-11'])
  assert.deepEqual(filterPlans(ITEMS, 'caminhar').map((i) => i.id), ['p-2026-09'])
  assert.deepEqual(filterPlans(ITEMS, 'rotina manha').map((i) => i.id), ['p-2026-01'])
  assert.deepEqual(filterPlans(ITEMS, 'inexistente'), [])
  // sem busca, devolve tudo do mais novo ao mais antigo
  assert.equal(filterPlans(ITEMS, '   ').length, ITEMS.length)
  assert.equal(filterPlans(ITEMS, '')[0].id, 'p-2026-09')
})

test('ciclos sem plano não contam como planos no resumo', () => {
  assert.equal(countRealPlans(ITEMS), 4)
  assert.equal(countRealPlans([]), 0)
})

test('modal do histórico: só o ano mais recente (ou o do plano aberto) começa aberto; busca só com muitos ciclos', () => {
  const comp = read('src/components/CarePlanHistory.tsx')
  assert.match(comp, /index === 0 \|\| y === currentYear/)
  assert.match(comp, /items\.length > SEARCH_THRESHOLD/)
  assert.ok(SEARCH_THRESHOLD >= 4)
  assert.match(comp, /aria-expanded=\{isOpen\}/)
  assert.match(comp, /aria-current=\{current \? 'true' : undefined\}/)
  assert.match(comp, /e\.key === 'Escape'/)
  assert.match(comp, /max-h-\[85vh\]/)
  assert.match(comp, /overflow-y-auto/)
})

test('a página do plano usa o histórico novo, passa o plano aberto e continua reabrindo qualquer mês', () => {
  const page = read('src/components/SelfCarePlanPage.tsx')
  assert.match(page, /import CarePlanHistory from '\.\/CarePlanHistory'/)
  assert.match(page, /<CarePlanHistory items=\{plans\.map/)
  assert.match(page, /currentId=\{current\.id\} onOpen=\{openPlan\} onClose=\{\(\)=>setHistoryOpen\(false\)\}/)
  assert.match(page, /'Ciclo sem plano gerado'/)
  // a lista longa e plana antiga saiu
  assert.doesNotMatch(page, /\{plans\.map\(p=><button key=\{p\.id\} onClick=\{\(\)=>openPlan\(p\.id\)\}/)
})
