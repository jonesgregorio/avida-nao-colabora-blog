import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const garden=readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const more=readFileSync(new URL('../src/components/MaisPage.tsx',import.meta.url),'utf8')
test('Meu Jardim prioriza progressão visual sem streak ou XP visível',()=>{
  assert.match(garden,/Meu Jardim/)
  assert.match(garden,/Cada cuidado deixa uma marca/)
  assert.match(garden,/nunca murcha nem perde progresso/)
  assert.match(garden,/Ver coleção/)
  assert.match(garden,/Plantas/)
  assert.match(garden,/Visitantes/)
  assert.match(garden,/Detalhes/)
  assert.match(garden,/growth=counts\.activeDays\+counts\.reports\*2\+counts\.milestones\*3/)
  assert.doesNotMatch(garden,/\+\d+ XP/)
})
test('Meu Jardim está acessível pela área Mais',()=>{
  assert.match(more,/title:'Meu Jardim'/)
  assert.match(more,/MyGardenPage userId=\{profile\.user_id\}/)
})