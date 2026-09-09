import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const garden=readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const engine=readFileSync(new URL('../supabase/migrations/20260909030000_garden_ecosystem_state.sql',import.meta.url),'utf8')
const layout=readFileSync(new URL('../src/components/user/UserLayout.tsx',import.meta.url),'utf8')

test('Meu Jardim prioriza progressão visual sem streak ou XP visível',()=>{
 assert.match(garden,/Meu Jardim/)
 assert.match(garden,/Seu jardim cresce sem pressa/)
 assert.match(garden,/nada aqui murcha/)
 assert.match(garden,/Evolução do seu jardim/)
 assert.doesNotMatch(garden,/\+\d+ XP|Nível \{/)
})

test('jardim explica a jornada sem transformar o motor em placar',()=>{
 assert.match(garden,/dias de cuidado/)
 assert.match(garden,/formas de cuidado/)
 assert.match(garden,/elementos no jardim/)
 assert.match(garden,/Não há sequência para manter nem pontos para conquistar/)
 assert.doesNotMatch(garden,/score\}/)
})

test('progressão evolui o mesmo espaço por capítulos e exige cuidado significativo',()=>{
 assert.match(garden,/O jardim ganha forma/)
 assert.match(garden,/O jardim recebe vida/)
 assert.match(garden,/Novos cantos/)
 assert.match(garden,/Jardim de luz/)
 assert.match(engine,/active_days < 3 OR diversity < 2 OR score < 6 THEN 0/)
 assert.doesNotMatch(garden,/CYCLE_SIZE|buildCycleItems/)
})

test('Meu Jardim está acessível pelo menu',()=>{
 assert.match(layout,/id: 'my-garden'/)
 assert.match(layout,/label: 'Meu Jardim'/)
})
