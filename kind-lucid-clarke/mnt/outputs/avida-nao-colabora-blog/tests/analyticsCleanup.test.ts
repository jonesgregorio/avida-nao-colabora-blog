import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const legacy=read('src/components/admin/AnalyticsPageLegacy.tsx')
const page=read('src/components/admin/AnalyticsPage.tsx')

test('abas mortas do Analytics foram removidas',()=>{const tabs=legacy.match(/const TABS = \[([\s\S]*?)\] as const/)?.[1]??'';for(const dead of ["'events'","'ai'","'settings'","'seo'"])assert.doesNotMatch(tabs,new RegExp(`id: ${dead}`))})
test('Configurações ficam em Sistema e Redirecionamentos em SEO & Performance',()=>{
 const sistema=read('src/components/admin/AdminAreaSistema.tsx'),seo=read('src/components/admin/AdminAreaSEO.tsx'),index=read('src/components/admin/index.tsx')
 assert.match(sistema,/Component: AdminAnalyticsSettings/)
 assert.match(seo,/AdminRedirects/)
 assert.match(index,/'analytics-settings': \{ area: 'sistema'/)
 assert.match(index,/redirects: \{ area: 'seo-performance'/)
})
test('AnalyticsPage mantém áreas executivas',()=>{for(const n of ['AnalyticsOverview','AnalyticsAcquisition','AnalyticsContent','AnalyticsConversion','AnalyticsRetention'])assert.match(page,new RegExp(`function ${n}\\(`))})
test('nenhuma migration deletou tabelas de analytics',()=>{const dir=new URL('../supabase/migrations/',import.meta.url);for(const f of readdirSync(dir)){if(!f.endsWith('.sql'))continue;const sql=readFileSync(new URL(f,dir),'utf8').toLowerCase();assert.doesNotMatch(sql,/drop table[^;]*analytics_(events|settings|redirects|custom_events|ai_reports)/)}})
