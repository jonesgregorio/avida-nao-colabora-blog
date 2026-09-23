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
 for(const source of ['monthly_guidance_requests','monthly_care_plans','user_personalization_tasks']) assert.match(area,new RegExp(source))
})
