import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const content=read('src/components/admin/AdminAreaConteudo.tsx')
const ai=read('src/components/admin/AdminAreaEstudioIA.tsx')
const seo=read('src/components/admin/AdminAreaSEO.tsx')
const site=read('src/components/admin/AdminAreaSite.tsx')

test('Conteúdo é biblioteca editorial focada',()=>{
 for(const id of ['artigos','calendario','programados','categorias','imagens']) assert.match(content,new RegExp(`id: '${id}'`))
 for(const moved of ['AdminFabricaIA','AdminTemplatesIA','AdminAutomacoesBlog','AdminSEOCockpit','AdminRedirects','AdminSiteContent','AdminSocialProof']) assert.doesNotMatch(content,new RegExp(moved))
})

test('funções movidas permanecem acessíveis em áreas próprias',()=>{
 for(const name of ['AdminFabricaIA','AdminTemplatesIA','AdminAutomacoesBlog']) assert.match(ai,new RegExp(name))
 assert.match(seo,/AdminSEOCockpitWithSelfTest/)
 assert.match(seo,/AdminRedirects/)
 assert.match(site,/AdminSiteContent/)
 assert.match(site,/AdminSocialProof/)
})

test('localStorage é independente por domínio administrativo',()=>{
 assert.match(content,/admin-conteudo-tab/)
 assert.match(ai,/admin-estudio-ia-tab/)
 assert.match(seo,/admin-seo-tab/)
 assert.match(site,/admin-site-tab/)
})
