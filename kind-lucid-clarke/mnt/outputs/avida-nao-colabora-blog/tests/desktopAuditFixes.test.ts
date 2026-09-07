import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const app = read('src/App.tsx')
const titles = read('src/lib/pageTitles.ts')
const article = read('src/components/ArticleView.tsx')
const garden = read('src/components/MyGardenPage.tsx')

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMA 1 — título da aba durante navegação SPA
// ─────────────────────────────────────────────────────────────────────────────
test('o título é atualizado de forma SÍNCRONA em toda navegação SPA (pushURL)', () => {
  // pushURL é o único ponto de troca de URL — atualiza o título junto, sem
  // depender do timing de useEffect (que era o furo em /diario, /descobertas,
  // /mapa-emocional).
  assert.match(app, /function pushURL[\s\S]{0,400}applyRouteMetadata\(targetView, url\)/)
})

test('voltar/avançar no histórico também atualiza o título', () => {
  const popstate = app.match(/function handlePopState\(\)[\s\S]*?\n {4}\}/)?.[0] ?? ''
  assert.match(popstate, /applyRouteMetadata\(fromURL\.view\)/)
  assert.match(popstate, /applyRouteMetadata\('home'\)/)
})

test('o efeito de rota continua como rede de segurança no carregamento inicial', () => {
  assert.match(app, /useEffect\(\(\) => \{\s*applyRouteMetadata\(view\)\s*\}, \[view, selectedArticleSlug, activeQuestionnaireId\]\)/)
})

test('artigos: o ArticleView é o dono do <title> e usa um fallback seguro enquanto carrega', () => {
  // App não mexe no título de artigo.
  assert.match(titles, /if \(view === 'article'\) return\s*\n\s*const title = titleForView/)
  // ArticleView usa o título real do artigo e, enquanto !article, o fallback.
  assert.match(article, /import \{ ARTICLE_FALLBACK_TITLE \} from '\.\.\/lib\/pageTitles'/)
  assert.match(article, /if \(!article\) \{\s*\n\s*[^\n]*\n\s*document\.title = ARTICLE_FALLBACK_TITLE/)
  assert.match(article, /const title = \(article\.seo_title \|\| article\.title \|\| 'Artigo'\)\.trim\(\)/)
})

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMA 2 — texto técnico no Meu Jardim
// ─────────────────────────────────────────────────────────────────────────────
test('Meu Jardim não expõe jargão de implementação na interface', () => {
  // A lógica interna pode continuar usando a constante; o que não pode é texto
  // de especificação visível/anunciado a leitores de tela.
  assert.doesNotMatch(garden, /Cada ciclo usa CYCLE_SIZE pontos internos/)
  assert.doesNotMatch(garden, /combinação determinística/)
  assert.doesNotMatch(garden, /perda de nível ou XP visível/)
  assert.doesNotMatch(garden, /respeita prefers-reduced-motion e não usa streak/)
})

test('Meu Jardim traz a explicação editorial simples no lugar', () => {
  assert.match(garden, /Seu jardim evolui aos poucos conforme você registra momentos de cuidado\. Se você passar alguns dias longe, nada será perdido\./)
})
