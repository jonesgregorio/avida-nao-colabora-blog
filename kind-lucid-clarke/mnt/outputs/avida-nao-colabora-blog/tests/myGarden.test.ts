import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const garden=readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const layout=readFileSync(new URL('../src/components/user/UserLayout.tsx',import.meta.url),'utf8')

test('Meu Jardim prioriza progressão visual sem streak ou XP visível',()=>{
  assert.match(garden,/Meu Jardim/)
  assert.match(garden,/Cada cuidado deixa uma marca/)
  assert.match(garden,/nada morre, diminui ou é perdido/)
  assert.match(garden,/Ver coleção/)
  assert.match(garden,/Plantas/)
  assert.match(garden,/Visitantes/)
  assert.match(garden,/Detalhes/)
  assert.match(garden,/growth=counts\.activeDays\+counts\.reports\*2\+counts\.milestones\*3/)
  assert.doesNotMatch(garden,/\+\d+ XP/)
})

test('cards explicam claramente quantos elementos foram descobertos no jardim atual',()=>{
  assert.match(garden,/\{n\} de \{total\} descobertos/)
  assert.match(garden,/Neste jardim · toque para ver/)
  assert.match(garden,/Novos elementos surgem conforme sua história cresce/)
  assert.match(garden,/sem sequência obrigatória e sem pontos visíveis/)
})

test('progressão não tem ciclo final e mantém jardins anteriores navegáveis',()=>{
  assert.match(garden,/const CYCLE_SIZE=60/)
  assert.match(garden,/Math\.floor\(growth\/CYCLE_SIZE\)/)
  assert.match(garden,/buildCycleItems\(currentCycle\)/)
  assert.match(garden,/Jardins anteriores/)
  assert.match(garden,/novos jardins continuam sendo criados/)
  assert.match(garden,/O sistema não termina/)
  assert.doesNotMatch(garden,/Math\.min\(currentCycle,THEMES\.length-1\)/)
})

test('Meu Jardim está acessível pelo menu (nav do shell logado)',()=>{
  // Saiu da página "Mais"; agora é item de navegação (folha "Mais" do mobile
  // e grupo "Entender" do desktop). O acesso por plano é defendido na própria
  // MyGardenPage (ver planAccessDescobertasGarden.test.ts).
  assert.match(layout,/id: 'my-garden'/)
  assert.match(layout,/label: 'Meu Jardim'/)
})
