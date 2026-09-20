import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const layout=read('src/components/admin/AdminLayout.tsx')
const index=read('src/components/admin/index.tsx')
const content=read('src/components/admin/AdminAreaConteudo.tsx')

test('admin separa Conteúdo, Estúdio IA, SEO & Performance e Site',()=>{
 for(const label of ['Conteúdo','Estúdio IA','SEO & Performance','Site']) assert.match(layout,new RegExp(label.replace('&','&')))
 assert.match(index,/case 'estudio-ia'/)
 assert.match(index,/case 'seo-performance'/)
 assert.match(index,/case 'site'/)
})

test('Conteúdo fica focado na biblioteca editorial',()=>{
 for(const label of ['Artigos','Calendário','Programados','Categorias','Mídia']) assert.match(content,new RegExp(label))
 for(const removed of ['AdminFabricaIA','AdminTemplatesIA','AdminAutomacoesBlog','AdminSEOCockpit','AdminRedirects','AdminSiteContent','AdminSocialProof']) assert.doesNotMatch(content,new RegExp(removed))
})

test('aliases antigos continuam levando ao destino reorganizado',()=>{
 assert.match(index,/seo: \{ area: 'seo-performance'/)
 assert.match(index,/'fabrica-ia': \{ area: 'estudio-ia'/)
 assert.match(index,/'automacoes-blog': \{ area: 'estudio-ia'/)
 assert.match(index,/'site-content': \{ area: 'site'/)
 assert.match(index,/'social-proof': \{ area: 'site'/)
})
