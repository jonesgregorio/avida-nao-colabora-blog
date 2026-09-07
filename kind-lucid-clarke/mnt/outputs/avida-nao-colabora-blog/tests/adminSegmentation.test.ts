import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907210000_admin_user_segmentation.sql')
const comp = read('src/components/admin/AdminSegments.tsx')
const index = read('src/components/admin/index.tsx')
const layout = read('src/components/admin/AdminLayout.tsx')

test('as RPCs de segmentação são admin-only e não expostas a anon', () => {
  for (const fn of ['admin_segment_match', 'admin_segment_preview', 'admin_segment_list', 'admin_segment_apply_tag', 'admin_segment_notify']) {
    assert.match(migration, new RegExp(`create or replace function public\\.${fn}\\(`, 'i'), `${fn} ausente`)
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\(`, 'i'), `${fn} sem revoke`)
  }
  assert.match(migration, /if not public\.is_admin\(\) then\s*\n\s*raise exception 'not authorized'/i)
})

test('uma única função de filtro alimenta preview, lista e ações em massa', () => {
  const uses = migration.match(/public\.admin_segment_match\(p_filter\)/g) ?? []
  assert.ok(uses.length >= 4, 'admin_segment_match deveria ser reutilizada por todas as RPCs')
})

test('a prévia devolve contagem antes de qualquer ação', () => {
  assert.match(migration, /jsonb_build_object\('count', array_length\(v_ids, 1\), 'sample'/i)
  assert.match(comp, /supabase\.rpc\('admin_segment_preview'/)
  assert.match(comp, /usuário\(s\) no segmento/)
})

test('etiqueta em massa é idempotente e notificação evita duplicar em 24h', () => {
  assert.match(migration, /not \(coalesce\(p\.admin_tags, '\{\}'::text\[\]\) @> array\[v_tag\]\)/i)
  assert.match(migration, /n\.title = v_title\s*\n\s*and n\.created_at > now\(\) - interval '24 hours'/i)
})

test('as ações em massa pedem confirmação forte e são auditadas', () => {
  assert.match(comp, /function confirmMass/)
  assert.match(comp, /window\.prompt\(/)
  assert.match(comp, /typed\?\.trim\(\) === String\(n\)/)
  assert.match(comp, /logAdminAction\('config', 'segment_tag'/)
  assert.match(comp, /logAdminAction\('config', 'segment_notify'/)
})

test('a tela degrada quando a RPC ainda não existe e permite exportar CSV', () => {
  assert.match(comp, /admin_segment_preview\|does not exist\|schema cache/)
  assert.match(comp, /disponível após o deploy desta etapa/i)
  assert.match(comp, /Exportar CSV/)
})

test('a área Segmentação está registrada no admin e no menu', () => {
  assert.match(index, /'usuarios', 'segmentacao', 'engajamento'/)
  assert.match(index, /case 'segmentacao': return <AdminSegments \/>/)
  assert.match(layout, /\{ id: 'segmentacao', label: 'Segmentação'/)
})
