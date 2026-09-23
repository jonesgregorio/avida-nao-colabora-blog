import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const root=new URL('../',import.meta.url)
const read=(p:string)=>fs.readFileSync(new URL(p,root),'utf8')

test('dashboard exposes action center and deep links',()=>{
 const s=read('src/components/admin/AdminOperationalDashboard.tsx')
 assert.match(s,/admin_action_center_snapshot/)
 for(const x of ['O que precisa da sua atenção','vencem em até 3 dias','Suporte','Orientações','Autocuidado','Entregas','Relatórios']) assert.match(s,new RegExp(x))
})
test('sidebar shows operational badges',()=>{
 const s=read('src/components/admin/AdminLayout.tsx')
 assert.match(s,/navBadges/); assert.match(s,/admin_action_center_snapshot/); assert.match(s,/atendimentos:/); assert.match(s,/suporte:/)
})
test('support SLA follows latest user message and pauses awaiting user',()=>{
 const s=read('src/components/admin/AdminSupport.tsx')
 assert.match(s,/last_user_message_at \?\? ticket\.created_at/)
 assert.match(s,/\['open','in_progress','awaiting_admin'\]/)
 for(const x of ['Depende de mim','Perto de vencer','Atrasados']) assert.match(s,new RegExp(x))
})
test('care-plan eligibility caps passive suggestions and ignores unsent drafts',()=>{
 const s=read('supabase/migrations/20260923160000_admin_action_center_and_care_evidence.sql')
 assert.match(s,/where rn<=2/)
 assert.match(s,/coalesce\(p\.read_at,p\.sent_at\)::date/)
 assert.match(s,/eligibility_source_counts/)
 assert.match(s,/source_counts/)
})
