import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcRoot = fileURLToPath(new URL('../src', import.meta.url))
function files(dir:string):string[]{return readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?files(p):/\.(ts|tsx)$/.test(name)?[p]:[]})}

test('nome público do recurso é sempre Plano de Autocuidado',()=>{
 const offenders=files(srcRoot).filter(path=>/Plano Vivo|Plano vivo|plano vivo/.test(readFileSync(path,'utf8')))
 assert.deepEqual(offenders,[])
 const garden=readFileSync(join(srcRoot,'components','MyGardenPage.tsx'),'utf8')
 const care=readFileSync(join(srcRoot,'components','SelfCarePlanPage.tsx'),'utf8')
 assert.match(garden,/Plano de Autocuidado/)
 assert.match(care,/Plano de Autocuidado/)
})
