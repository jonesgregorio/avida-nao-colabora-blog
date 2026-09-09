import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const ui=fs.readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../supabase/migrations/20260909033000_garden_infinite_cycles.sql',import.meta.url),'utf8')

test('garden growth blocks a single checkin but allows small changes after few meaningful moments',()=>{
 assert.match(sql,/raw_growth < 2 THEN 0/)
 assert.match(sql,/active_days < 2 AND diversity < 2 THEN 0/)
 assert.match(sql,/garden_progress < 2 THEN 0/)
 assert.match(sql,/garden_progress < 5 THEN 1/)
 assert.match(sql,/entry_type='checkin'/)
 assert.match(sql,/entry_type='diary'/)
 assert.match(sql,/questionnaire_responses/)
 assert.match(sql,/reading_history/)
 assert.match(sql,/care_plan_action_state/)
 assert.match(sql,/user_history_items/)
})

test('garden has no terminal cycle and creates a new garden automatically',()=>{
 assert.match(sql,/floor\(growth \/ 18\.0\)::int AS garden_index/)
 assert.match(sql,/\(growth % 18\)::int AS garden_progress/)
 assert.match(sql,/'completed_gardens', garden_index/)
 assert.doesNotMatch(sql,/LEAST\(COALESCE\(di\.checkin_days/)
 assert.match(ui,/O jardim nunca termina/)
 assert.match(ui,/outro surgirá automaticamente/)
 assert.match(ui,/Memórias do Jardim/)
 assert.match(ui,/themeFor\(gardenIndex\)/)
})

test('garden RPC is private to authenticated owner context',()=>{
 assert.match(sql,/auth\.uid\(\)/)
 assert.match(sql,/SECURITY DEFINER/)
 assert.match(sql,/REVOKE ALL[\s\S]*PUBLIC, anon/)
 assert.match(sql,/GRANT EXECUTE[\s\S]*authenticated/)
})

test('garden scene has ecosystem dependencies and grounded composition',()=>{
 assert.match(ui,/stage>=2.*Canteiro de flores/s)
 assert.match(ui,/stage>=3.*Árvore de cuidado/s)
 assert.match(ui,/stage>=4.*Borboleta entre os canteiros/s)
 assert.match(ui,/stage>=5.*Recanto de água/s)
 assert.match(ui,/stage>=5.*Banco junto ao caminho/s)
})

test('garden explicitly avoids gamified pressure and uses official care-plan name',()=>{
 assert.match(ui,/Sem streak/)
 assert.match(ui,/Sem punição/)
 assert.match(ui,/Um Check-in isolado não cria sozinho/i)
 assert.match(ui,/Plano de Autocuidado/)
 assert.doesNotMatch(ui,/Plano Vivo|Plano vivo|plano vivo/)
 assert.doesNotMatch(ui,/\+\d+ XP|Nível \{/)
})
