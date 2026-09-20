import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const cockpit = read('src/components/admin/AdminSEOCockpit.tsx')
const corrector = read('src/lib/seoSmartCorrector.ts')

test('SEO Admin oferece ação específica por tipo de oportunidade', () => {
  assert.match(corrector, /'ctr' \| 'position'/)
  assert.match(corrector, /issue === 'position'/)
  assert.match(corrector, /await fixLinks\(article, allArticles, changed\)/)
  assert.match(cockpit, /Corrigir título e descrição/)
  assert.match(cockpit, /Fortalecer conteúdo e links/)
})

test('indexação e canonical podem ser verificados novamente sem fingir indexação', () => {
  assert.match(cockpit, /function inspectGoogleUrl/)
  assert.match(cockpit, /Verificar novamente/)
  assert.match(cockpit, /Verificar canonical novamente/)
  assert.match(cockpit, /Nenhuma ferramenta pode obrigar o Google a indexar uma página/)
})

test('sobreposição recebe correção conservadora e não destrutiva', () => {
  assert.match(cockpit, /Fortalecer \{article\.title\}/)
  assert.match(cockpit, /não exclui, funde nem redireciona automaticamente páginas em sobreposição/)
})
