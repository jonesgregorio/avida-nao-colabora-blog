import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/components/admin/AdminAreaConteudo.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Conteúdo & IA usa exatamente os cinco grupos funcionais da Etapa 6', () => {
  for (const label of ['Produção', 'Planejamento', 'Automação', 'Biblioteca', 'Inteligência']) {
    assert.match(src, new RegExp(`label: '${label}'`))
  }
  const groupsBody = src.match(/const GROUPS = \[([\s\S]*?)\] as const/)?.[1] ?? ''
  assert.equal((groupsBody.match(/\{ id:/g) ?? []).length, 5)
})

test('navegação tem somente grupo e opção, sem voltar às dez abas planas', () => {
  assert.match(src, /aria-label="Grupos de Conteúdo & IA"/)
  assert.match(src, /aria-label=\{`Opções de /)
  assert.doesNotMatch(src, /aria-label="Abas de Conteúdo & IA"/)
  assert.match(src, /const groupTabs = TABS\.filter\(item => item\.group === activeGroup\)/)
})

test('telas existentes e IDs antigos permanecem acessíveis', () => {
  const ids = ['artigos', 'gerar-ia', 'templates', 'automacoes', 'calendario', 'programados', 'categorias', 'imagens', 'seo', 'depoimentos']
  for (const id of ids) assert.match(src, new RegExp(`id: '${id}'`))

  for (const component of [
    'AdminArticles', 'AdminFabricaIA', 'AdminTemplatesIA', 'AdminAutomacoesBlog',
    'AdminCalendarioEditorial', 'AdminScheduled', 'AdminCategories',
    'AdminMediaLibrary', 'AdminSEOCockpit', 'AdminSocialProof',
  ]) {
    assert.match(src, new RegExp(`<${component}`))
  }
})

test('Central de IA continua única e aparece como atalho de Inteligência', () => {
  assert.doesNotMatch(src, /AdminAIUsage/)
  assert.match(src, /activeGroup === 'inteligencia' && onOpenCentralIA/)
  assert.match(src, />\s*Central de IA\s*</)
})

test('initialTab e localStorage continuam compatíveis com os IDs antigos', () => {
  assert.match(src, /const saved = initialTab \?\? localStorage\.getItem\('admin-conteudo-tab'\)/)
  assert.match(src, /return isTab\(saved\) \? saved : DEFAULT_TAB/)
  assert.match(src, /localStorage\.setItem\('admin-conteudo-tab', id\)/)
})
