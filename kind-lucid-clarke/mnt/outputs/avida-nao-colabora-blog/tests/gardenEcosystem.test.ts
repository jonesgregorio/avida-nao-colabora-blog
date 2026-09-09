import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const ui=fs.readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../supabase/migrations/20260909030000_garden_ecosystem_state.sql',import.meta.url),'utf8')

test('garden growth requires continuity and diversity instead of a single checkin',()=>{
 assert.match(sql,/active_days < 3 OR diversity < 2 OR score < 6 THEN 0/)
 assert.match(sql,/entry_type='checkin'/)
 assert.match(sql,/entry_type='diary'/)
 assert.match(sql,/questionnaire_responses/)
 assert.match(sql,/reading_history/)
 assert.match(sql,/care_plan_action_state/)
 assert.match(sql,/user_history_items/)
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

test('garden explicitly avoids gamified pressure',()=>{
 assert.match(ui,/Sem streak/)
 assert.match(ui,/Sem punição/)
 assert.match(ui,/uma ação sozinha nunca cria um elemento/i)
 assert.match(ui,/nada aqui murcha/i)
 assert.doesNotMatch(ui,/CYCLE_SIZE|UNLOCK_STEPS/)
})
