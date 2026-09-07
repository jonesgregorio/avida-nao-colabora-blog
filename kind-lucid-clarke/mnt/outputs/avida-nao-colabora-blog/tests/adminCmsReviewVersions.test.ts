import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907250000_cms_review_and_versions.sql')
const editor = read('src/components/admin/AdminArticleEditor.tsx')
const list = read('src/components/admin/AdminArticles.tsx')

test('content_versions vira somente-anexar (não exclui versões silenciosamente)', () => {
  assert.match(migration, /before update or delete on public\.content_versions/i)
  assert.match(migration, /raise exception 'content_versions é somente-anexar/i)
})

test('restaurar versão é 1 clique, server-side, e registra a volta como nova versão', () => {
  assert.match(migration, /create or replace function public\.admin_restore_article_version\(/i)
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /insert into public\.content_versions[\s\S]*?'rollback'/i)
  assert.match(migration, /revoke all on function public\.admin_restore_article_version\(uuid, integer\) from public, anon/i)
  // A restauração NÃO publica o artigo.
  assert.doesNotMatch(migration, /update public\.articles a set[\s\S]*?status\s*=/i)
})

test('fluxo de revisão: colunas novas e status "review" no editor e na lista', () => {
  assert.match(migration, /add column if not exists reviewed_by/i)
  assert.match(migration, /add column if not exists reviewed_at/i)
  assert.match(migration, /add column if not exists related_slugs text\[\]/i)
  assert.match(editor, /save\('review'\)/)
  assert.match(editor, /<option value="review">Em revisão<\/option>/)
  assert.match(editor, /reviewed_by: user\?\.id/)
  assert.match(list, /review: 'Em revisão'/)
})

test('o editor restaura via RPC com confirmação e degrada para o modo antigo', () => {
  assert.match(editor, /supabase\.rpc\('admin_restore_article_version'/)
  assert.match(editor, /window\.confirm\(/)
  assert.match(editor, /admin_restore_article_version\|does not exist\|schema cache/)
  assert.match(editor, /logAdminAction\('update', 'article_version_restore'/)
})

test('artigos relacionados são editáveis e gravados como array', () => {
  assert.match(editor, /related_slugs: toArray\(data\.related_slugs\)/)
  assert.match(editor, /Artigos relacionados \(slugs/)
})
