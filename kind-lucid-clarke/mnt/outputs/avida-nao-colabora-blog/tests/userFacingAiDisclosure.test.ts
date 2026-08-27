import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relative: string) {
  return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')
}

function withoutComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const userSurfaces = [
  'src/components/DiaryExperience.tsx',
  'src/components/DiarySavedReflection.tsx',
  'src/components/MyEvolutionPage.tsx',
  'src/components/MonthlyGuidancePage.tsx',
  'src/components/SelfCarePlanPage.tsx',
  'src/components/SupportPage.tsx',
  'src/components/MyReportPageContent.tsx',
  'src/components/QuestionnairesPage.tsx',
  'src/components/LoggedHome.tsx',
]

const clientHelpersThatCanSurfaceErrors = [
  'src/lib/diaryCompanion.ts',
  'src/lib/explainEmotionalMap.ts',
]

const forbiddenVisiblePhrases = [
  /\bIA\b/,
  /intelig[eê]ncia artificial/i,
  /análise de IA/i,
  /ajuda de IA/i,
  /leitura por IA/i,
  /enviado à IA/i,
  /A IA percebeu/i,
  /A IA analisa/i,
  /com IA/i,
]

test('telas do usuário não revelam IA como mecanismo por trás das funcionalidades', () => {
  for (const file of userSurfaces) {
    const source = withoutComments(read(file))
    for (const forbidden of forbiddenVisiblePhrases) {
      assert.doesNotMatch(source, forbidden, `${file} não deve expor ${forbidden}`)
    }
  }
})

test('mensagens de erro que chegam ao usuário também escondem detalhes de IA, provider e backend', () => {
  for (const file of clientHelpersThatCanSurfaceErrors) {
    const source = withoutComments(read(file))
    assert.doesNotMatch(source, /ajuda de IA|leitura por IA|intelig[eê]ncia artificial/i)
    assert.doesNotMatch(source, /throw new Error\(error\.message/)
    assert.doesNotMatch(source, /throw new Error\(data\?\.message/)
  }
  assert.match(read('src/lib/diaryCompanion.ts'), /DIARY_COMPANION_ERROR/)
  assert.match(read('src/lib/explainEmotionalMap.ts'), /EXPLAIN_MAP_ERROR/)
})

test('experiência usa linguagem de produto enquanto metadados técnicos permanecem internos', () => {
  const diary = read('src/components/DiaryExperience.tsx')
  const saved = read('src/components/DiarySavedReflection.tsx')
  const map = read('src/components/MyEvolutionPage.tsx')
  const guidance = read('src/components/MonthlyGuidancePage.tsx')

  assert.match(diary, /Salvar sem leitura complementar/)
  assert.match(saved, /Algumas marcações podem combinar com seu registro/)
  assert.match(map, /Entender melhor meu mapa/)
  assert.match(map, /Esta leitura considera apenas os dados resumidos deste mapa/)
  assert.match(guidance, /Análise cuidadosa antes da resposta/)
  assert.match(guidance, /Seu pedido está em análise/)

  // Compatibilidade/proveniência técnica não é removida: apenas fica fora da linguagem visível.
  assert.match(diary, /ai_disabled/)
  assert.match(guidance, /ai_draft_json/)
})
