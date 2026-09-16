import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import guideHandler from '../api/guide.js'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const shell=read('index.html')
function res(){return{statusCode:200,headers:new Map<string,string>(),body:'',setHeader(k:string,v:string){this.headers.set(k.toLowerCase(),v)},status(c:number){this.statusCode=c;return this},end(v=''){this.body=String(v);return this}}}
test('seis páginas-pilar possuem rotas canônicas e sitemap',()=>{const vercel=read('vercel.json'),sitemap=read('api/sitemap.js'),guides=read('src/components/GuidesPage.tsx');assert.match(vercel,/\/guias\/:slug/);for(const key of ['diario-emocional','emocoes-autoconhecimento','sobrecarga-emocional','autocuidado-emocional','sono-descanso-energia','relacoes-limites']){assert.match(sitemap,new RegExp(`/guias/${key}`));assert.match(guides,new RegExp(`'${key}'`))}})
test('renderer de página-pilar entrega H1, canonical, breadcrumb e schema sem JavaScript',async()=>{const old=globalThis.fetch;globalThis.fetch=async()=>({ok:true,text:async()=>shell})as Response;try{const response=res();await guideHandler({method:'GET',query:{slug:'diario-emocional'},headers:{host:'localhost:3000'}},response);assert.equal(response.statusCode,200);assert.match(response.body,/<h1>Diário emocional:/);assert.match(response.body,/rel="canonical" href="https:\/\/www\.avidanaocolabora\.com\/guias\/diario-emocional"/);assert.match(response.body,/BreadcrumbList/);assert.match(response.body,/ItemList/)}finally{globalThis.fetch=old}})
test('página-pilar desconhecida retorna 404',async()=>{const response=res();await guideHandler({method:'GET',query:{slug:'inexistente'},headers:{host:'localhost:3000'}},response);assert.equal(response.statusCode,404)})
test('clusters conectam artigos a ferramentas reais e leituras de apoio',()=>{const config=read('src/lib/seoGuides.ts');assert.match(config,/tool\?: 'diary' \| 'checkin' \| 'map' \| 'self-care'/);assert.match(config,/supportingSlugs/);assert.match(config,/getCuratedRelatedSlugs/)})
