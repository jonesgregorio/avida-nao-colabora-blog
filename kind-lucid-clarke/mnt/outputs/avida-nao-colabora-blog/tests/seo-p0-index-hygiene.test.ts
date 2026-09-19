import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const vercel=read('vercel.json')
const gone=read('api/gone.js')
const sitemap=read('api/sitemap.js')
const guides=read('src/lib/seoGuides.ts')

test('legacy WordPress paths return 410 instead of the SPA/home shell',()=>{
  assert.match(vercel,/"source": "\/author\/:path\*".*"destination": "\/api\/gone"/)
  assert.match(vercel,/"source": "\/wp-content\/:path\*".*"destination": "\/api\/gone"/)
  assert.match(gone,/res\.status\(410\)/)
  assert.match(gone,/X-Robots-Tag.*noindex, nofollow, noarchive/s)
})

test('sitemap is generated only from current public article slugs',()=>{
  assert.match(sitemap,/list_public_article_sitemap/)
  assert.doesNotMatch(sitemap,/como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito/)
})

test('current internal SEO guide uses the canonical relações e limites slug',()=>{
  assert.match(guides,/como-conversar-sobre-os-seus-limites-sem-transformar-tudo-em/)
  assert.doesNotMatch(guides,/como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito/)
})
