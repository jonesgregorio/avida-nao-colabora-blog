import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcRoot = fileURLToPath(new URL('../src', import.meta.url))

test('nome público do recurso permanece Plano de Autocuidado',()=>{
 const garden=readFileSync(join(srcRoot,'components','MyGardenPage.tsx'),'utf8')
 const care=readFileSync(join(srcRoot,'components','SelfCarePlanPage.tsx'),'utf8')
 const layout=readFileSync(join(srcRoot,'components','user','UserLayout.tsx'),'utf8')
 assert.match(garden,/Plano de Autocuidado/)
 assert.match(care,/<h1[^>]*>Plano de Autocuidado<\/h1>|Plano de Autocuidado/)
 assert.match(care,/Histórico do Plano de Autocuidado/)
 assert.match(care,/Ajustes do Plano de Autocuidado/)
 assert.match(layout,/Plano de Autocuidado/)
})
