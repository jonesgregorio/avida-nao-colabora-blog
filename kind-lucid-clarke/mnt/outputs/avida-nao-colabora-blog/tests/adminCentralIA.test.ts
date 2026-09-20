import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('Central de IA operacional permanece única em Sistema',()=>{
 const ia=read('src/components/admin/AdminAIUsage.tsx')
 const sistema=read('src/components/admin/AdminAreaSistema.tsx')
 const estudio=read('src/components/admin/AdminAreaEstudioIA.tsx')
 assert.match(sistema,/import AdminAIUsage/)
 assert.match(sistema,/id: 'ia', label: 'IA — uso e falhas', Component: AdminAIUsage/)
 assert.doesNotMatch(estudio,/AdminAIUsage/)
 assert.match(ia,/Central de IA/)
 assert.match(ia,/admin_ai_usage_page/)
})

test('Estúdio IA concentra apenas produção editorial assistida',()=>{
 const estudio=read('src/components/admin/AdminAreaEstudioIA.tsx')
 for(const component of ['AdminFabricaIA','AdminTemplatesIA','AdminAutomacoesBlog']) assert.match(estudio,new RegExp(component))
 for(const label of ['Criar com IA','Templates','Automações editoriais']) assert.match(estudio,new RegExp(label))
})
