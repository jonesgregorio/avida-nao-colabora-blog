import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getEffectivePlan,
  isContentLocked,
} from '../src/lib/officialPlans.ts'
import {
  clearPendingAction,
  getPendingAction,
  setPendingAction,
} from '../src/lib/pendingAction.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const articleView = read('src/components/ArticleView.tsx')
const app = read('src/App.tsx')
const paywallMigration = read('supabase/migrations/060_articles_paywall_3plans.sql')

test('matriz completa do paywall preserva acesso público, conta, Essencial e Plus', () => {
  const cases = [
    ['free deslogado lê conteúdo público', 'free', 'free', false, false],
    ['free logado lê conteúdo público', 'free', 'free', true, false],
    ['visitante não recebe conteúdo account', 'account', 'free', false, true],
    ['usuário Gratuito lê conteúdo account', 'account', 'free', true, false],
    ['Gratuito não lê Essencial', 'essential', 'free', true, true],
    ['Essencial lê Essencial', 'essential', 'essential', true, false],
    ['Plus herda Essencial', 'essential', 'plus', true, false],
    ['Gratuito não lê Plus', 'plus', 'free', true, true],
    ['Essencial não lê Plus', 'plus', 'essential', true, true],
    ['Plus lê Plus', 'plus', 'plus', true, false],
  ] as const

  for (const [label, required, plan, loggedIn, locked] of cases) {
    assert.equal(isContentLocked(required, plan, loggedIn), locked, label)
  }
})

test('acesso ilimitado ativo recebe a regra efetiva de Plus, e o expirado não', () => {
  const now = new Date('2026-08-23T12:00:00-03:00')
  const active = getEffectivePlan({ plan: 'free', unlimited_access: true, unlimited_access_until: '2026-08-24T00:00:00-03:00' }, now)
  const expired = getEffectivePlan({ plan: 'free', unlimited_access: true, unlimited_access_until: '2026-08-22T23:59:59-03:00' }, now)
  assert.equal(active, 'plus')
  assert.equal(isContentLocked('plus', active, true), false)
  assert.equal(expired, 'free')
  assert.equal(isContentLocked('plus', expired, true), true)
})

test('visitante de artigo protegido guarda o slug e o App retorna ao mesmo artigo após login', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const memory = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
  })
  try {
    setPendingAction({ view: 'article', articleSlug: 'conteudo-restrito' })
    assert.deepEqual(getPendingAction(), { view: 'article', articleSlug: 'conteudo-restrito' })
    clearPendingAction()
    assert.equal(getPendingAction(), null)
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
    else delete (globalThis as { sessionStorage?: unknown }).sessionStorage
  }

  assert.match(articleView, /setPendingAction\(\{ view: 'article', articleSlug: currentSlug \}\)/)
  assert.match(articleView, /navigate\('auth'\)/)
  assert.match(app, /pending\.view === 'article' && pending\.articleSlug/)
  assert.match(app, /pushURL\('article', pending\.articleSlug\)/)
})

test('teaser de artigo protegido não projeta o corpo e slug inexistente continua 404', () => {
  const teaserFunction = paywallMigration.slice(paywallMigration.indexOf('CREATE OR REPLACE FUNCTION public.get_article_teaser'))
  assert.match(teaserFunction, /RETURNS TABLE \(\s*title text, summary text, excerpt text, category text,/)
  assert.doesNotMatch(teaserFunction, /a\.content\b/)
  assert.match(articleView, /supabase\.rpc\('get_article_teaser', \{ p_slug: s \}\)/)
  assert.match(articleView, /if \(row && row\.plan_required && row\.plan_required !== 'free'\) \{ setLocked\(row\); return \}/)
  assert.match(articleView, /if \(!article\) \{[\s\S]*Artigo não encontrado\./)
})

test('paywall apresenta teaser e CTA corretos sem expor o corpo do artigo', () => {
  assert.match(articleView, /locked\.summary \|\| locked\.excerpt/)
  assert.match(articleView, /Conteúdo gratuito — requer conta/)
  assert.match(articleView, /Conteúdo exclusivo do plano \$\{planLabel\}/)
  assert.match(articleView, /data-cta="artigo-ver-planos"/)
  assert.match(articleView, /Assine o plano <strong>\{planLabel\}<\/strong>/)
})
