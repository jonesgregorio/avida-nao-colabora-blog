import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const garden=readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const engine=readFileSync(new URL('../supabase/migrations/20260909033000_garden_infinite_cycles.sql',import.meta.url),'utf8')
const layout=readFileSync(new URL('../src/components/user/UserLayout.tsx',import.meta.url),'utf8')

test('Meu Jardim prioriza progressão visual sem streak ou XP visível',()=>{
 assert.match(garden,/Meu Jardim/)
 assert.match(garden,/Mudanças mais próximas/)
 assert.match(garden,/Sem streak/)
 assert.match(garden,/Crescimento contínuo/)
 assert.doesNotMatch(garden,/\+\d+ XP|Nível \{/)
})

test('jardim explica a jornada sem transformar o motor em placar',()=>{
 assert.match(garden,/dias de cuidado/)
 assert.match(garden,/formas de cuidado/)
 assert.match(garden,/mudanças neste jardim/)
 assert.match(garden,/não mede produtividade/i)
 assert.doesNotMatch(garden,/garden_progress\}/)
 assert.doesNotMatch(garden,/total_growth\}/)
})

test('progressão é infinita, preserva jardins anteriores e alterna visuais',()=>{
 assert.match(garden,/THEMES/)
 assert.match(garden,/Memórias do Jardim/)
 assert.match(garden,/Jardim atual/)
 assert.match(garden,/Não existe último jardim/)
 assert.match(engine,/floor\(growth \/ 18\.0\)::int AS garden_index/)
 assert.match(engine,/\(growth % 18\)::int AS garden_progress/)
 assert.doesNotMatch(engine,/ELSE 6 END AS stage[\s\S]*FROM signals/)
})

test('primeira mudança é mais acessível sem premiar um único check-in',()=>{
 assert.match(engine,/raw_growth < 2 THEN 0/)
 assert.match(engine,/active_days < 2 AND diversity < 2 THEN 0/)
 assert.match(engine,/garden_progress < 2 THEN 0/)
 assert.match(garden,/alguns momentos de cuidado|poucas interações significativas/i)
})

test('Meu Jardim está acessível pelo menu',()=>{
 assert.match(layout,/id: 'my-garden'/)
 assert.match(layout,/label: 'Meu Jardim'/)
})
