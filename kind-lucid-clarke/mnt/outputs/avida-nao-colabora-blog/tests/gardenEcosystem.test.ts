import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const ui=fs.readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../supabase/migrations/20260909123000_garden_balanced_growth_v4.sql',import.meta.url),'utf8')

test('garden growth blocks a single checkin and uses balanced 60-step cycles',()=>{
 assert.match(sql,/raw_growth < 3 THEN 0/)
 assert.match(sql,/active_days < 2 AND diversity < 2 THEN 0/)
 assert.match(sql,/garden_progress < 3 THEN 0/)
 assert.match(sql,/garden_progress < 10 THEN 1/)
 assert.match(sql,/floor\(growth \/ 60\.0\)::int AS garden_index/)
 assert.match(sql,/\(growth % 60\)::int AS garden_progress/)
 assert.match(sql,/entry_type = 'checkin'/)
 assert.match(sql,/entry_type = 'diary'/)
 assert.match(sql,/questionnaire_responses/)
 assert.match(sql,/reading_history/)
 assert.match(sql,/care_plan_action_state/)
 assert.match(sql,/user_history_items/)
})

test('garden has no terminal cycle and creates a new garden automatically',()=>{
 assert.match(sql,/'completed_gardens', garden_index/)
 assert.match(sql,/'growth_model_version', 4/)
 assert.match(ui,/O jardim jamais termina/)
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

test('garden scene unlocks ecosystem layers only after their stages',()=>{
 assert.match(ui,/\{stage >= 1 &&[\s\S]*Primeiros brotos|stage >= 1 &&/)
 assert.match(ui,/\{stage >= 2 &&/)
 assert.match(ui,/\{stage >= 3 &&/)
 assert.match(ui,/\{stage >= 4 &&/)
 assert.match(ui,/\{stage >= 5 &&/)
 assert.match(ui,/\{stage >= 6 &&/)
 assert.match(ui,/Canteiro de flores/)
 assert.match(ui,/Árvore de cuidado/)
 assert.match(ui,/Visitantes/)
 assert.match(ui,/Recanto de água/)
 assert.match(ui,/Luz do jardim/)
})

test('garden initial state is intentionally incomplete',()=>{
 assert.match(ui,/stage === 0/)
 assert.match(ui,/O jardim está só começando/)
 assert.match(ui,/Seu espaço ainda está em preparação/)
 assert.match(ui,/const stage = Math\.max\(0, Math\.min\(6, state\.stage \|\| 0\)\)/)
 assert.doesNotMatch(ui,/const stage = 6/)
})

test('garden uses a detailed layered scene with visible fauna and depth',()=>{
 assert.match(ui,/function GardenScene/)
 assert.match(ui,/viewBox="0 0 1100 690"/)
 assert.match(ui,/garden-birds/)
 assert.match(ui,/garden-butterfly/)
 assert.match(ui,/garden-tree/)
 assert.match(ui,/garden-glow/)
 assert.match(ui,/radialGradient id="sun"/)
 assert.match(ui,/linearGradient id="water"/)
 assert.match(ui,/preserveAspectRatio="xMidYMid slice"/)
 assert.match(ui,/prefers-reduced-motion/)
})

test('garden avoids gamified pressure and uses official care-plan name',()=>{
 assert.match(ui,/não funciona como uma recompensa por cliques/i)
 assert.match(ui,/Um Check-in isolado não muda tudo/)
 assert.match(ui,/Plano de Autocuidado/)
 assert.doesNotMatch(ui,/Plano Vivo|Plano vivo|plano vivo/)
 assert.doesNotMatch(ui,/\+\d+ XP|Nível \{/)
})
