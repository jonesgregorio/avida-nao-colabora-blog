import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const app=read('src/App.tsx'),titles=read('src/lib/pageTitles.ts'),article=read('src/components/ArticleView.tsx'),garden=read('src/components/MyGardenPage.tsx')
test('o título é atualizado de forma SÍNCRONA em toda navegação SPA (pushURL)',()=>{assert.match(app,/function pushURL[\s\S]{0,400}applyRouteMetadata\(targetView, url\)/)})
test('voltar/avançar no histórico também atualiza o título',()=>{const p=app.match(/function handlePopState\(\)[\s\S]*?\n {4}\}/)?.[0]??'';assert.match(p,/applyRouteMetadata\(fromURL\.view\)/);assert.match(p,/applyRouteMetadata\('home'\)/)})
test('o efeito de rota continua como rede de segurança no carregamento inicial',()=>{assert.match(app,/useEffect\(\(\) => \{\s*applyRouteMetadata\(view\)\s*\}, \[view, selectedArticleSlug, activeQuestionnaireId\]\)/)})
test('artigos: o ArticleView é o dono do <title> e usa um fallback seguro enquanto carrega',()=>{assert.match(titles,/if \(view === 'article'\) return\s*\n\s*const title = titleForView/);assert.match(article,/ARTICLE_FALLBACK_TITLE/);assert.match(article,/const title = \(article\.seo_title \|\| article\.title \|\| 'Artigo'\)\.trim\(\)/)})
test('Meu Jardim não expõe jargão de implementação na interface',()=>{assert.doesNotMatch(garden,/Cada ciclo usa CYCLE_SIZE pontos internos|combinação determinística|perda de nível ou XP visível/);assert.doesNotMatch(garden,/CYCLE_SIZE|UNLOCK_STEPS/)})
test('Meu Jardim traz explicação editorial simples no lugar',()=>{assert.match(garden,/Sua trajetória ganha forma aos poucos/);assert.match(garden,/Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente/);assert.match(garden,/Não existe último jardim por aqui/)})