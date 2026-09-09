import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const layout = read('src/components/admin/AdminLayout.tsx')
const index = read('src/components/admin/index.tsx')

test('busca global procura usuários, artigos, tickets e campanhas — com debounce e RBAC', () => {
  // debounce
  assert.match(layout, /setTimeout\(async \(\) => \{[\s\S]*?\}, 300\)/)
  // não dispara para 1 caractere E limpa o spinner na saída antecipada
  assert.match(layout, /if \(q\.length < 2\) \{[\s\S]{0,120}setEntitySearching\(false\)/)
  // fontes por entidade
  assert.match(layout, /from\('profiles'\)\.select\('user_id, full_name, email'\)/)
  assert.match(layout, /from\('articles'\)\.select\('id, title, status'\)/)
  assert.match(layout, /from\('support_tickets'\)\.select\('id, subject, status'\)/)
  assert.match(layout, /from\('admin_communications'\)\.select\('id, title, status'\)/)
  // RBAC: cada grupo só consulta se o módulo é permitido
  assert.match(layout, /const can = \(mod: string\) => !allowed \|\| allowed\.has\(mod\)/)
  assert.match(layout, /can\('users'\) && like \? supabase\.from\('profiles'\)/)
  assert.match(layout, /can\('content'\) && like \? supabase\.from\('articles'\)/)
  // erro de um grupo não derruba os outros
  assert.match(layout, /Promise\.allSettled\(/)
  assert.match(layout, /errors: \{ users: u\.error, articles: a\.error, tickets: t\.error, campaigns: c\.error \}/)
  // sanitização do termo
  assert.match(layout, /import \{ ilikePattern, sanitizePgSearchTerm \} from '\.\.\/\.\.\/lib\/adminSearch'/)
  // navega para o registro (deep-link)
  assert.match(layout, /onOpenUser\?\.\(u\.user_id\)/)
  assert.match(layout, /if \(onOpenTicket\) onOpenTicket\(t\.id\); else navigateTo\('support'\)/)
  assert.match(layout, /if \(onOpenCampaign\) onOpenCampaign\(c\.id\); else navigateTo\('notifications'\)/)
})

test('helper de busca neutraliza sintaxe do PostgREST', () => {
  const helper = read('src/lib/adminSearch.ts')
  assert.match(helper, /export function sanitizePgSearchTerm/)
  assert.match(helper, /export function ilikePattern/)
  // remove os caracteres de sintaxe do PostgREST e escapa curingas de LIKE
  assert.ok(helper.includes("replace(/[(),.*\"'\\\\:]/g, ' ')"), 'deve remover , ( ) . * : e aspas')
  assert.ok(helper.includes("replace(/([%_])/g, '\\\\$1')"), 'deve escapar % e _')
})

test('a navegação estática (áreas) foi preservada', () => {
  assert.match(layout, /const searchResults = useMemo/)
  assert.match(layout, /SEARCH_ITEMS/)
  assert.match(layout, /Enter abre o primeiro resultado · Esc fecha/)
})

test('index.tsx liga onOpenUser/onOpenArticle da busca global', () => {
  assert.match(index, /onOpenUser=\{uid => \{ setPendingUserId\(uid\); navigate\('usuarios'\) \}\}/)
  assert.match(index, /onOpenArticle=\{id => handleEditArticle\(id\)\}/)
})
