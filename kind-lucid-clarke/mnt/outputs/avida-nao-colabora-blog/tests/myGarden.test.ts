import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const garden=readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const engine=readFileSync(new URL('../supabase/migrations/20260909123000_garden_balanced_growth_v4.sql',import.meta.url),'utf8')
const layout=readFileSync(new URL('../src/components/user/UserLayout.tsx',import.meta.url),'utf8')

test('Meu Jardim prioriza progressão visual sem streak ou XP visível',()=>{
 assert.match(garden,/Meu Jardim/)
 assert.match(garden,/Um ritmo mais equilibrado/)
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

test('progressão é infinita, preserva jardins anteriores e usa ciclo histórico próximo de 60 passos',()=>{
 assert.match(garden,/gardenThemeFor/)
 assert.match(garden,/Memórias do Jardim/)
 assert.match(garden,/Jardim atual/)
 assert.match(garden,/Não existe último jardim/)
 assert.match(engine,/floor\(growth \/ 60\.0\)::int AS garden_index/)
 assert.match(engine,/\(growth % 60\)::int AS garden_progress/)
 assert.match(engine,/'completed_gardens', garden_index/)
})

test('primeira mudança exige alguns momentos e um checkin isolado continua bloqueado',()=>{
 assert.match(engine,/raw_growth < 3 THEN 0/)
 assert.match(engine,/active_days < 2 AND diversity < 2 THEN 0/)
 assert.match(engine,/garden_progress < 3 THEN 0/)
 assert.match(engine,/garden_progress < 10 THEN 1/)
 assert.match(garden,/Um Check-in isolado não cria uma transformação/)
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
