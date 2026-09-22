import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
test('self-care eligibility aggregates all approved evidence sources',()=>{
 const migration=read('supabase/migrations/20260922231000_self_care_multisource_activity.sql')
 for(const source of ['diary_entries','questionnaire_responses','content_recommendations','reading_history','guided_content_progress','personalized_content_deliveries','care_plan_action_state']) assert.match(migration,new RegExp(source))
 assert.match(migration,/source_counts/)
 assert.match(migration,/content_signals/)
})
test('automation uses multisource totals instead of diary-only totals for care plan',()=>{
 const runner=read('supabase/functions/run-emotional-automations/runner.ts')
 assert.match(runner,/loadCarePlanActivity/)
 assert.match(runner,/source_activity: activity\.source_counts/)
 assert.match(runner,/content_signals: activity\.content_signals/)
 assert.match(runner,/activity\.total_entries >= 12/)
})
test('admin and user expose the same multisource rule',()=>{
 const admin=read('src/components/admin/AdminLivingCarePlanWorkspace.tsx')
 const user=read('src/components/SelfCarePlanPage.tsx')
 assert.match(admin,/Conteúdos sugeridos/)
 assert.match(admin,/Conteúdos vistos/)
 assert.match(admin,/Questionários/)
 assert.match(user,/check-ins, Diário, questionários, conteúdos sugeridos e vistos/)
})

test('admin and automation share one canonical multisource counter',()=>{
 const migration=read('supabase/migrations/20260922235500_self_care_canonical_multisource.sql')
 const runner=read('supabase/functions/run-emotional-automations/runner.ts')
 const admin=read('src/components/admin/AdminLivingCarePlanWorkspace.tsx')
 assert.match(migration,/care_plan_activity_summary/)
 assert.match(runner,/rpc\('care_plan_activity_summary'/)
 assert.match(admin,/rpc\('care_plan_activity_summary'/)
 for(const source of ['checkins','diaries','questionnaires','suggested_content','viewed_content','guided_content','personalized_content','care_plan_feedback']) assert.match(migration,new RegExp(source))
})
test('automatic plan generation stops before AI when multisource context is insufficient',()=>{
 const runner=read('supabase/functions/run-emotional-automations/runner.ts')
 const gate=runner.indexOf('if (!s.data_quality.has_enough_data)')
 const generate=runner.indexOf("generate(prompt('self_care_plan'",gate)
 assert.ok(gate >= 0)
 assert.ok(generate > gate)
 assert.match(runner.slice(gate,generate),/status: 'skipped'/)
})
test('admin fails closed when canonical multisource evidence is unavailable',()=>{
 const admin=read('src/components/admin/AdminLivingCarePlanWorkspace.tsx')
 assert.match(admin,/const total = activity\?\.total_entries \?\? 0/)
 assert.match(admin,/Erro ao carregar a contagem multifuente do plano/)
})

test('admin generation receives questionnaire and content evidence, not only counts',()=>{
 const migration=read('supabase/migrations/20260922235500_self_care_canonical_multisource.sql')
 const admin=read('src/components/admin/AdminLivingCarePlanWorkspace.tsx')
 const care=read('src/lib/careePlanAI.ts')
 assert.match(migration,/questionnaire_signals/)
 assert.match(migration,/result_title/)
 assert.match(migration,/generated_tags/)
 assert.match(admin,/questionnaireSignals: activity\.questionnaire_signals/)
 assert.match(care,/sinais_de_questionarios/)
 assert.match(care,/sinais_de_conteudo/)
})
