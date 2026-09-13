import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseNavLocation, urlForView, canonicalPathForLocation, restoreNavFrom } from '../src/lib/navigation.ts'
import { titleForView } from '../src/lib/pageTitles.ts'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// ─────────────────────────────────────────────────────────────────────────────
// 1. /guia-mensal "Voltar ao plano" deve ir para /plano-de-autocuidado
// ─────────────────────────────────────────────────────────────────────────────
test('MonthlyGuidancePage: "Voltar ao plano" navega para o Plano de Autocuidado', () => {
  const app = read('src/App.tsx')
  const page = read('src/components/MonthlyGuidancePage.tsx')
  // App liga o botão do plano ao self-care (rota /plano-de-autocuidado).
  assert.match(app, /onBackToPlan=\{\(\) => navigate\('self-care'\)\}/)
  assert.equal(urlForView('self-care'), '/plano-de-autocuidado')
  // O botão "Voltar ao plano" usa onBackToPlan, não o onBack genérico.
  assert.match(page, /onClick=\{onBackToPlan\}[\s\S]{0,220}Voltar ao plano/)
  assert.match(page, /onBackToPlan: \(\) => void/)
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. /questionarios/:slug — rota própria e persistente
// ─────────────────────────────────────────────────────────────────────────────
test('rota /questionarios/:slug resolve para a tela do questionário', () => {
  assert.deepEqual(parseNavLocation('/questionarios/gatilhos-emocionais-e-padroes'), {
    view: 'questionnaire',
    articleSlug: null,
    ticketId: null,
    questionnaireId: 'gatilhos-emocionais-e-padroes',
  })
  // Sem slug ainda é a lista.
  assert.equal(parseNavLocation('/questionarios')?.view, 'questionarios')
})

test('urlForView monta /questionarios/:slug', () => {
  assert.equal(urlForView('questionnaire', 'gatilhos-emocionais-e-padroes'), '/questionarios/gatilhos-emocionais-e-padroes')
  // Sem slug não deve virar "/" silenciosamente com um slug perdido — cai na lista.
  assert.equal(urlForView('questionnaire'), '/')
})

test('a tela do questionário sobrevive a reload / link direto / histórico', () => {
  // reload direto na URL
  const restored = restoreNavFrom('/questionarios/gatilhos-emocionais-e-padroes', '', { getItem: () => null })
  assert.equal(restored?.view, 'questionnaire')
  assert.equal(restored?.questionnaireId, 'gatilhos-emocionais-e-padroes')
  // não é redirecionada para "/"
  assert.equal(canonicalPathForLocation('/questionarios/gatilhos-emocionais-e-padroes'), null)
})

test('App e o Player estão preparados para slug (e ainda aceitam UUID)', () => {
  const app = read('src/App.tsx')
  const player = read('src/components/QuestionnairePlayer.tsx')
  const list = read('src/components/QuestionnairesPage.tsx')
  const legacy = read('src/components/QuestionnairesPageLegacy.tsx')
  assert.match(app, /if \(section === 'questionnaire' && ref\) setActiveQuestionnaireId\(ref\)/)
  assert.match(app, /navigate\('questionnaire', ref\)/)
  assert.match(player, /isUuid \? 'id' : 'slug'/)
  assert.match(list, /const ref = item\.slug \|\| item\.id/)
  assert.match(legacy, /const ref = item\.slug \|\| item\.id/)
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. document.title centralizado por rota
// ─────────────────────────────────────────────────────────────────────────────
test('titleForView cobre as rotas principais e não repete o site duas vezes', () => {
  assert.equal(titleForView('home'), 'A Vida Não Colabora — Diário emocional e autocuidado')
  assert.equal(titleForView('my-history'), 'Minha História — A Vida Não Colabora')
  assert.equal(titleForView('responsibility'), 'Aviso de Responsabilidade — A Vida Não Colabora')
  assert.equal(titleForView('questionnaire'), 'Questionário — A Vida Não Colabora')
  // rota desconhecida cai no título do site
  assert.equal(titleForView('rota-que-nao-existe'), 'A Vida Não Colabora — Diário emocional e autocuidado')
})

test('App reaplica os metadados a cada troca de view (não fica preso no artigo)', () => {
  const app = read('src/App.tsx')
  assert.match(app, /import \{ applyRouteMetadata \} from '\.\/lib\/pageTitles'/)
  assert.match(app, /useEffect\(\(\) => \{\s*applyRouteMetadata\(view\)\s*\}, \[view, selectedArticleSlug, activeQuestionnaireId\]\)/)
})

test('applyRouteMetadata deixa o <title> específico do artigo para o ArticleView', () => {
  const titles = read('src/lib/pageTitles.ts')
  assert.match(titles, /if \(view === 'article'\) return/)
})
