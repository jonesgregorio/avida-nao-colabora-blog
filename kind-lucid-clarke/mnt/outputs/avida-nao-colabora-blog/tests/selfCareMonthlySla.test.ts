import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
test('página informa SLA e requisitos do Plano de Autocuidado',()=>{
 const page=read('src/components/SelfCarePlanPage.tsx')
 assert.match(page,/liberado até o dia 5/)
 assert.match(page,/12 registros distribuídos em 8 dias ativos/)
 assert.match(page,/Registros no ciclo/)
 assert.match(page,/Dias ativos/)
 assert.match(page,/nenhum plano genérico foi criado/)
})
test('banco registra SLA no dia 5 e expõe estados seguros ao próprio usuário',()=>{
 const migration=read('supabase/migrations/20260922222000_self_care_monthly_sla.sql')
 assert.match(migration,/review_due_at/)
 assert.match(migration,/interval '1 month 4 days'/)
 assert.match(migration,/p\.user_id = \(select auth\.uid\(\)\)/)
 assert.match(migration,/pending_review/)
 assert.match(migration,/overdue_review/)
})
test('admin destaca revisões fora do SLA',()=>{
 const hub=read('src/components/admin/AdminSelfCareHub.tsx')
 const workspace=read('src/components/admin/AdminLivingCarePlanWorkspace.tsx')
 assert.match(hub,/Revisões atrasadas/)
 assert.match(hub,/fora do SLA de revisão/)
 assert.match(workspace,/SLA atrasado/)
 assert.match(workspace,/Revisar até/)
})
