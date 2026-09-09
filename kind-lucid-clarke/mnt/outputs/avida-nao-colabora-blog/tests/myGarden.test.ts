import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const garden=readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const engine=readFileSync(new URL('../supabase/migrations/20260909123000_garden_balanced_growth_v4.sql',import.meta.url),'utf8')
const layout=readFileSync(new URL('../src/components/user/UserLayout.tsx',import.meta.url),'utf8')

test('Meu Jardim segue o mockup editorial sem streak ou XP visível',()=>{
 assert.match(garden,/Meu Jardim/)
 assert.match(garden,/Um espaço[\s\S]{0,80}que cresce com você/)
 assert.match(garden,/Todo progresso, por menor que pareça, também floresce/)
 assert.match(garden,/Ações que fazem seu jardim crescer/)
 assert.doesNotMatch(garden,/\+\d+ XP|Nível \{/)
})

test('jardim comunica progressão sem transformar uso em recompensa por clique',()=>{
 assert.match(garden,/não funciona como uma recompensa por cliques/i)
 assert.match(garden,/momentos de cuidado ao longo do tempo/i)
 assert.match(garden,/Um Check-in isolado não muda tudo/)
 assert.match(garden,/Nenhuma ação simples, sozinha, completa uma transformação/)
 assert.doesNotMatch(garden,/\+\d+ XP|streak de/i)
})

test('progressão é infinita, preserva jardins anteriores e usa ciclo histórico de 60 unidades',()=>{
 assert.match(garden,/THEMES/)
 assert.match(garden,/Memórias do Jardim/)
 assert.match(garden,/Jardim atual/)
 assert.match(garden,/Não existe último jardim/)
 assert.match(garden,/O jardim jamais termina/)
 assert.match(engine,/floor\(growth \/ 60\.0\)::int AS garden_index/)
 assert.match(engine,/\(growth % 60\)::int AS garden_progress/)
 assert.match(engine,/'completed_gardens', garden_index/)
})

test('primeira mudança exige alguns momentos e um checkin isolado continua bloqueado',()=>{
 assert.match(engine,/raw_growth < 3 THEN 0/)
 assert.match(engine,/active_days < 2 AND diversity < 2 THEN 0/)
 assert.match(engine,/garden_progress < 3 THEN 0/)
 assert.match(engine,/garden_progress < 10 THEN 1/)
 assert.match(garden,/Um Check-in isolado não muda tudo/)
})

test('jardim nunca nasce completo e cada camada visual respeita o stage real',()=>{
 assert.match(garden,/stage === 0/)
 assert.match(garden,/stage >= 1/)
 assert.match(garden,/stage >= 2/)
 assert.match(garden,/stage >= 3/)
 assert.match(garden,/stage >= 4/)
 assert.match(garden,/stage >= 5/)
 assert.match(garden,/stage >= 6/)
 assert.match(garden,/const stage = Math\.max\(0, Math\.min\(6, state\.stage \|\| 0\)\)/)
})

test('fórmula mantém a base histórica e limita sinais novos para não acelerar o jardim',()=>{
 assert.match(engine,/COALESCE\(di\.active_days, 0\)/)
 assert.match(engine,/COALESCE\(re\.reports, 0\) \* 2/)
 assert.match(engine,/COALESCE\(hi\.milestones, 0\) \* 3/)
 assert.match(engine,/LEAST\(COALESCE\(qr\.responses, 0\), 3\)/)
 assert.match(engine,/LEAST\(COALESCE\(cp\.helped, 0\), 5\)/)
})

test('Meu Jardim está acessível pelo menu',()=>{
 assert.match(layout,/id: 'my-garden'/)
 assert.match(layout,/label: 'Meu Jardim'/)
})
