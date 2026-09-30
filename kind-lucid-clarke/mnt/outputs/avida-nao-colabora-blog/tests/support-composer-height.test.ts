import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/components/admin/admin-theme.css', import.meta.url), 'utf8')

test('campo de resposta do suporte é alto o bastante para revisar templates longos', () => {
  assert.match(css, /textarea\[placeholder\^="Digite sua resposta"\]/)
  assert.match(css, /textarea\[placeholder\^="Escreva uma nota interna"\]/)
  assert.match(css, /min-height:180px!important/)
  assert.match(css, /max-height:42vh/)
  assert.match(css, /resize:vertical!important/)
})

test('composer mantém altura confortável também no mobile', () => {
  assert.match(css, /@media\(max-width:640px\)[\s\S]*min-height:150px!important/)
  assert.match(css, /max-height:38vh/)
})
