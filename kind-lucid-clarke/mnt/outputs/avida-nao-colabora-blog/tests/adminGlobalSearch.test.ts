import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const layout = readFileSync(new URL('../src/components/admin/AdminLayout.tsx', import.meta.url), 'utf8')
const index = readFileSync(new URL('../src/components/admin/index.tsx', import.meta.url), 'utf8')

test('busca global procura usuários, artigos, tickets e campanhas — com debounce e RBAC', () => {
  // debounce
  assert.match(layout, /setTimeout\(async \(\) => \{[\s\S]*?\}, 300\)/)
  // não dispara para 1 caractere
  assert.match(layout, /if \(q\.length < 2\) \{ setEntityResults\(null\)/)
  // fontes por entidade
  assert.match(layout, /from\('profiles'\)\.select\('user_id, full_name, email'\)/)
  assert.match(layout, /from\('articles'\)\.select\('id, title, status'\)/)
  assert.match(layout, /from\('support_tickets'\)\.select\('id, subject, status'\)/)
  assert.match(layout, /from\('admin_communications'\)\.select\('id, title, status'\)/)
  // RBAC: cada grupo só consulta se o módulo é permitido
  assert.match(layout, /const can = \(mod: string\) => !allowed \|\| allowed\.has\(mod\)/)
  assert.match(layout, /can\('users'\)\s*\n\s*\? supabase\.from\('profiles'\)/)
  assert.match(layout, /can\('content'\)\s*\n\s*\? supabase\.from\('articles'\)/)
  // navega para o registro
  assert.match(layout, /onOpenUser\?\.\(u\.user_id\)/)
  assert.match(layout, /navigateTo\('support'\)/)
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
