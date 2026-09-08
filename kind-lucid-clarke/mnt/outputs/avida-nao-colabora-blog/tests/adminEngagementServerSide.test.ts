import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260908200000_user_engagement_paged.sql')
const comp = read('src/components/admin/AdminEngagement.tsx')

test('RPCs de engajamento paginado: admin-only, thresholds documentados', () => {
  assert.match(migration, /create or replace function public\.get_user_engagement_page\(/i)
  assert.match(migration, /create or replace function public\.get_user_engagement_summary\(/i)
  assert.match(migration, /if not public\.is_admin\(\) then\s*\n\s*raise exception/gi)
  // Buckets iguais aos históricos.
  assert.match(migration, /when b\.last_activity > now\(\) - interval '4 days'\s+then 'ativo'/)
  assert.match(migration, /when b\.last_activity > now\(\) - interval '14 days' then 'esfriando'/)
  // base helper não é chamável por authenticated diretamente.
  assert.match(migration, /revoke all on function public\.admin_engagement_base\(\) from public, anon, authenticated/i)
  // ordenação vem de uma allow-list, não interpolação livre.
  assert.match(migration, /if v_sort not in \('last_activity','created_at','full_name'/)
  assert.match(migration, /grant execute on function public\.get_user_engagement_page[\s\S]*to authenticated/i)
})

test('AdminEngagement é server-side (sem filtrar/paginar tudo no navegador)', () => {
  assert.match(comp, /get_user_engagement_page/)
  assert.match(comp, /get_user_engagement_summary/)
  assert.doesNotMatch(comp, /rpc\('get_user_engagement'\)/)
  // paginação, busca com debounce, ordenação server-side
  assert.match(comp, /p_offset: page \* PAGE_SIZE/)
  assert.match(comp, /setTimeout\(\(\) => \{ setAppliedSearch\(search\)/)
  assert.match(comp, /p_sort: sort, p_dir: dir/)
  // conceitos preservados
  for (const b of ['ativo', 'esfriando', 'inativo', 'nunca']) {
    assert.match(comp, new RegExp(`'${b}'`))
  }
  // não carrega o array inteiro em memória para contar
  assert.doesNotMatch(comp, /base\.filter\(r => r\.bucket/)
})
