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
