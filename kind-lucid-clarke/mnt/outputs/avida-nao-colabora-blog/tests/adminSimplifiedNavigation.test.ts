import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')

test('menu principal fica reduzido sem apagar recursos',()=>{
 const layout=read('src/components/admin/AdminLayout.tsx')
 for(const label of ['Dashboard','Usuários','Assinaturas','Conteúdo','SEO & Performance','Marketing','Comunicação','Cuidado','Suporte','Analytics','Sistema']) assert.match(layout,new RegExp(`label: '${label.replace('&','&')}'`))
 for(const hidden of ["label: 'Segmentação'","label: 'Engajamento'","label: 'Financeiro'","label: 'Estúdio IA'","label: 'Site'"]) assert.doesNotMatch(layout,new RegExp(hidden))
})

test('usuários reúne contas segmentos e engajamento',()=>{
 const area=read('src/components/admin/AdminAreaUsuarios.tsx')
 for(const component of ['AdminUsers','AdminSegments','AdminEngagement']) assert.match(area,new RegExp(component))
})

test('assinaturas incorpora financeiro sem remover a implementação',()=>{
 const area=read('src/components/admin/AdminAreaAssinaturas.tsx')
 assert.match(area,/AdminFinanceiro/)
 assert.match(area,/Receita & pagamentos/)
})

test('conteúdo mantém IA e Site como ferramentas contextuais',()=>{
 const area=read('src/components/admin/AdminAreaConteudo.tsx')
 assert.match(area,/Criar com IA/)
 assert.match(area,/>Site</)
 assert.match(area,/Calendário editorial/)
})

test('Cuidado usa três domínios simples e preserva Diário',()=>{
 const area=read('src/components/admin/AdminAreaCuidado.tsx')
 for(const label of ['Experiência do usuário','Entregas','Inteligência']) assert.match(area,new RegExp(label))
 assert.match(area,/AdminDiaryConfig/)
 assert.match(area,/AdminGardenManagement/)
})

test('Sistema concentra governança e esconde técnicos em Avançado',()=>{
 const area=read('src/components/admin/AdminAreaSistema.tsx')
 assert.match(area,/label: 'Governança'/)
 assert.match(area,/label: 'Avançado'/)
 assert.match(area,/Feature flags/)
 assert.match(area,/AdminLogs/)
 assert.match(area,/AdminPermissions/)
})
