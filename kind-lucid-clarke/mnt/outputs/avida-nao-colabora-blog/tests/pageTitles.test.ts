import test from 'node:test'
import assert from 'node:assert/strict'

// Stub mínimo de DOM para exercitar applyRouteMetadata sem jsdom.
type El = { getAttribute(k: string): string | null; setAttribute(k: string, v: string): void }
function makeDoc() {
  const el = (): El => {
    const store = new Map<string, string>()
    return {
      getAttribute: (k) => store.get(k) ?? null,
      setAttribute: (k, v) => { store.set(k, v) },
    }
  }
  const metas: Record<string, El> = {
    'meta[name="description"]': el(),
    'meta[property="og:title"]': el(),
    'meta[property="og:description"]': el(),
    'meta[property="og:url"]': el(),
    'meta[name="twitter:title"]': el(),
    'meta[name="twitter:description"]': el(),
    'link[rel="canonical"]': el(),
  }
  return {
    title: '',
    head: { querySelector: (sel: string) => metas[sel] ?? null },
    _metas: metas,
  }
}

const g = globalThis as unknown as { document: unknown; window: unknown }
g.document = makeDoc()
g.window = { location: { pathname: '/' } }

const { titleForView, applyRouteMetadata, HOME_TITLE, ARTICLE_FALLBACK_TITLE } = await import('../src/lib/pageTitles.ts')

test('titleForView: rotas conhecidas ganham "— A Vida Não Colabora"; desconhecida cai no título do site', () => {
  assert.equal(titleForView('home'), HOME_TITLE)
  assert.equal(titleForView('diary'), 'Diário — A Vida Não Colabora')
  assert.equal(titleForView('descobertas'), 'Descobertas — A Vida Não Colabora')
  assert.equal(titleForView('my-evolution'), 'Mapa Emocional — A Vida Não Colabora')
  assert.equal(titleForView('my-report'), 'Relatórios — A Vida Não Colabora')
  assert.equal(titleForView('rota-desconhecida'), HOME_TITLE)
})

test('applyRouteMetadata atualiza <title> e metadados da rota', () => {
  g.document = makeDoc()
  ;(g.window as { location: { pathname: string } }).location.pathname = '/mapa-emocional'
  applyRouteMetadata('my-evolution')
  const doc = g.document as ReturnType<typeof makeDoc>
  assert.equal(doc.title, 'Mapa Emocional — A Vida Não Colabora')
  assert.equal(doc._metas['meta[property="og:title"]'].getAttribute('content'), 'Mapa Emocional — A Vida Não Colabora')
  assert.equal(doc._metas['meta[property="og:url"]'].getAttribute('content'), 'https://www.avidanaocolabora.com/mapa-emocional')
  assert.equal(doc._metas['link[rel="canonical"]'].getAttribute('href'), 'https://www.avidanaocolabora.com/mapa-emocional')
})

test('applyRouteMetadata NÃO toca em nada quando a view é "article" (dono é o ArticleView)', () => {
  const doc = makeDoc()
  doc.title = 'Título específico do artigo'
  g.document = doc
  applyRouteMetadata('article')
  assert.equal(doc.title, 'Título específico do artigo')
  assert.equal(doc._metas['meta[property="og:title"]'].getAttribute('content'), null)
})

test('ARTICLE_FALLBACK_TITLE é o título seguro de carregamento de artigo', () => {
  assert.equal(ARTICLE_FALLBACK_TITLE, 'Conteúdos Guiados — A Vida Não Colabora')
})
