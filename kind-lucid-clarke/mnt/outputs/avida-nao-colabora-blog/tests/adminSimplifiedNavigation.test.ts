import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')

test('menu principal fica reduzido sem apagar recursos',()=>{
 const layout=read('src/components/admin/AdminLayout.tsx')
 for(const label of ['Dashboard','Usuários','Assinaturas','Conteúdo','SEO & Performance','Marketing','Comunicação','Atendimentos & Entregas','Suporte','Jardins','Analytics','Sistema']) assert.match(layout,new RegExp(`label: '${label.replace('&','&')}'`))
 const nav=layout.slice(layout.indexOf('const NAV_GROUPS'),layout.indexOf('const SEARCH_ITEMS'))
 for(const hidden of ["label: 'Segmentação'","label: 'Engajamento'","label: 'Financeiro'","label: 'Estúdio IA'","label: 'Site'"]) assert.doesNotMatch(nav,new RegExp(hidden))
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

test('conteúdo mantém IA e Site como ferramentas contextuais e expõe questionários',()=>{
 const area=read('src/components/admin/AdminAreaConteudo.tsx')
 assert.match(area,/Criar com IA/)
 assert.match(area,/>Site</)
 assert.match(area,/Calendário editorial/)
 assert.match(area,/AdminQuestionnaires/)
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

test('trabalho individual fica explícito em Atendimentos & Entregas',()=>{
 const area=read('src/components/admin/AdminAreaAtendimentos.tsx')
 for(const label of ['Orientações Mensais','Planos de Autocuidado','Entregas de Conteúdo','Relatórios para revisão']) assert.match(area,new RegExp(label))
 for(const component of ['AdminGuidanceRequests','AdminSelfCareHub','AdminPersonalization','AdminPDF']) assert.match(area,new RegExp(component))
 const index=read('src/components/admin/index.tsx')
 assert.match(index,/'guidance-requests': \{ area: 'atendimentos'/)
 assert.match(index,/'self-care-plans': \{ area: 'atendimentos'/)
 assert.match(index,/personalization: \{ area: 'atendimentos'/)
})
test('Suporte e Jardins permanecem áreas principais e visíveis',()=>{
 const layout=read('src/components/admin/AdminLayout.tsx')
 const nav=layout.slice(layout.indexOf('const NAV_GROUPS'),layout.indexOf('const SEARCH_ITEMS'))
 assert.match(nav,/label: 'Suporte'/)
 assert.match(nav,/label: 'Jardins'/)
 assert.match(read('src/components/admin/AdminAreaJardins.tsx'),/AdminGardenManagement/)
})
