import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// §21 da MISSÃO GERAL (performance): o Admin lazy-carrega corretamente
// (App.tsx usa React.lazy para o painel inteiro), mas AdminArticles.tsx
// buscava a tabela `articles` inteira sem `.limit()` — cresce sem limite
// junto com o catálogo.

test('App.tsx carrega o AdminPanel sob demanda (React.lazy), não no bundle principal', () => {
  const app = read('src/App.tsx')
  assert.match(app, /const AdminPanel = lazy\(\(\) => import\('\.\/components\/admin'\)\)/)
})

test('AdminArticles busca a lista de artigos com um limite, não a tabela inteira sem teto', () => {
  const src = read('src/components/admin/AdminArticles.tsx')
  const loadFn = src.match(/async function load\(\)[\s\S]*?\n {2}\}/)?.[0] ?? ''
  assert.notEqual(loadFn, '', 'não encontrou load()')
  assert.match(loadFn, /\.limit\(2000\)/)
})
