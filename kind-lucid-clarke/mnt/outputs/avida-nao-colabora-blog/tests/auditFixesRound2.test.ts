import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const exists = (path: string) => existsSync(new URL(`../${path}`, import.meta.url))

// Item 🟢 — SelfCarePlanPageLegacy.tsx era código morto confirmado (nenhuma rota/import em
// código de aplicação apontava pra ele) — mesma categoria do AdminMonthlyCarePlans.tsx já
// removido antes. lib/carePlanBasis.ts só era usado por ele, então também saiu.
test('SelfCarePlanPageLegacy.tsx e lib/carePlanBasis.ts (código morto) foram removidos', () => {
  assert.equal(exists('src/components/SelfCarePlanPageLegacy.tsx'), false)
  assert.equal(exists('src/lib/carePlanBasis.ts'), false)
})

test('nenhum arquivo de aplicação ainda referencia SelfCarePlanPageLegacy ou lib/carePlanBasis', () => {
  const app = read('src/App.tsx')
  assert.doesNotMatch(app, /SelfCarePlanPageLegacy/)
  const carePage = read('src/components/SelfCarePlanPage.tsx')
  assert.doesNotMatch(carePage, /carePlanBasis/)
})

const questionnairePlayer = read('src/components/QuestionnairePlayer.tsx')

// Item 🟡 — auditoria: a barra de progresso (Voltar / Pergunta X de Y / Salvar e sair) e a
// escala de 1 a 5 não tinham flex-wrap, podendo estourar a largura em telas bem estreitas
// (a escala de 1 a 10, ao lado, já tinha esse cuidado).
test('cabeçalho de progresso do questionário permite quebrar linha em telas estreitas', () => {
  assert.match(questionnairePlayer, /<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 mb-2">/)
})

test('escala de 1 a 5 tem flex-wrap e botões um pouco menores no mobile, como a escala de 1 a 10 já tinha', () => {
  assert.match(questionnairePlayer, /<div className="flex flex-wrap justify-center gap-3 mb-2">/)
  assert.match(questionnairePlayer, /w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2/)
})

const gardenAdmin = read('src/components/admin/AdminGardenManagement.tsx')

// Item 🟡 — auditoria: criar campanha do Jardim sem nome só fazia um "return" silencioso,
// sem dizer ao admin por que nada aconteceu.
test('formulário de campanha do Jardim avisa quando falta um campo obrigatório, em vez de falhar em silêncio', () => {
  assert.match(gardenAdmin, /const \[formError,setFormError\]=useState\(''\)/)
  assert.match(gardenAdmin, /if\(!form\.name\.trim\(\)\)\{setFormError\('Preencha o nome da campanha\.'\);return\}/)
  assert.match(gardenAdmin, /if\(!form\.headline\.trim\(\)\)\{setFormError\('Preencha o título — é o que aparece pro usuário\.'\);return\}/)
  assert.match(gardenAdmin, /\{formError&&<p className="mt-3 text-xs text-red-700">\{formError\}<\/p>\}/)
})

const segments = read('src/components/admin/AdminSegments.tsx')

// Item 🟡 — auditoria: salvar um público com nome vazio no prompt não dizia nada; cancelar
// e "confirmar vazio" tinham o mesmo resultado silencioso, sem distinguir os dois casos.
test('salvar público segmentado distingue cancelar (sem aviso) de confirmar vazio (avisa)', () => {
  assert.match(segments, /const raw = window\.prompt\('Nome do público salvo:'\)/)
  assert.match(segments, /if \(raw === null\) return \/\/ cancelado — sem mensagem, é a ação esperada/)
  assert.match(segments, /if \(!name\) \{ setMsg\(\{ ok: false, text: 'Preencha um nome para salvar o público\.' \}\); return \}/)
})

// Item 🟡 — auditoria: botão "Criar" de feature flag usava bg-forest-700 (tom diferente do
// admin-btn-primary padrão, que usa a cor forest principal do tema).
test('botão de criar feature flag usa o padrão admin-btn-primary, não uma cor avulsa', () => {
  const flags = read('src/components/admin/AdminFeatureFlags.tsx')
  assert.doesNotMatch(flags, /bg-forest-700 text-white rounded-lg/)
  assert.match(flags, /<button onClick=\{\(\) => void createFlag\(\)\} className="admin-btn-primary">/)
})
