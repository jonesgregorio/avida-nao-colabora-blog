import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const root=new URL('../',import.meta.url)
const read=(p:string)=>fs.readFileSync(new URL(p,root),'utf8')

test('fluxos canônicos não nascem na fila genérica',()=>{
 const tasks=read('src/lib/personalizationTasks.ts')
 for(const key of ['self_care_plan','monthly_plan_review','monthly_guidance','monthly_guidance_reply','advanced_monthly_report','monthly_summary','weekly_report_suggestion']) assert.match(tasks,new RegExp(`CANONICAL_WORKFLOW_TASK_KEYS[\\s\\S]*${key}`))
 assert.match(tasks,/DELIVERY_TASK_DEFS\.filter\(d => !CANONICAL_WORKFLOW_TASK_KEYS\.has\(d\.key\)\)/)
})

test('Entregas preserva gestão operacional de prazos e filtros',()=>{
 const admin=read('src/components/admin/AdminPersonalization.tsx')
 for(const text of ['Fila de trabalho','Rascunhos','Atrasadas','Vence hoje','Vence amanhã','Vence em até 7 dias','Atrasado há mais de 7 dias','Todos os planos','Todos os tipos','Todas as prioridades']) assert.match(admin,new RegExp(text))
 assert.match(admin,/CANONICAL_WORKFLOW_TASK_KEYS/)
 assert.match(admin,/Entregas de Conteúdo/)
})

test('Atendimentos mostra visão agregada de ação',()=>{
 const area=read('src/components/admin/AdminAreaAtendimentos.tsx')
 for(const text of ['Itens que exigem acompanhamento','Vencem em até 3 dias','Atrasados','Entregas de Conteúdo']) assert.match(area,new RegExp(text))
 // as três fontes agora vêm da MESMA RPC da lateral (admin_action_center_snapshot), não de consultas próprias
 assert.match(area,/supabase\.rpc\('admin_action_center_snapshot'\)/)
 const sql=read('supabase/migrations/20260930200000_action_center_reports_only_failed.sql')
 for(const source of ['monthly_guidance_requests','monthly_care_plans','user_personalization_tasks']) assert.match(sql,new RegExp(source))
})

test('Atendimentos indica EM QUAL aba está cada pendência (abas com contador + faixa "Onde estão as pendências")',()=>{
 const area=read('src/components/admin/AdminAreaAtendimentos.tsx')
 // cada aba aponta para uma área da RPC
 assert.match(area,/orientacoes:'guidance',autocuidado:'care',recomendacoes:'deliveries',relatorios:'reports'/)
 // contador na aba, com cor por urgência (atrasado / vence em 3 dias)
 assert.match(area,/const c=countOf\(t\.id\)/)
 assert.match(area,/c\.total>0&&<span title=/)
 assert.match(area,/c\.overdue>0\?'bg-red-100 text-red-700'/)
 // faixa que lista só as áreas com pendência, clicável, e mensagem quando está tudo em dia
 assert.match(area,/Onde estão as pendências/)
 assert.match(area,/withPending\.map\(t=>/)
 assert.match(area,/Nenhuma pendência em Atendimentos & Entregas\. Tudo em dia\./)
 // os cartões do topo levam à aba certa, não sempre a Entregas de Conteúdo
 assert.match(area,/change\(firstPending\)/)
 assert.doesNotMatch(area,/onClick=\{\(\)=>change\('recomendacoes'\)\} className="rounded-2xl border border-line bg-white p-4/)
})
