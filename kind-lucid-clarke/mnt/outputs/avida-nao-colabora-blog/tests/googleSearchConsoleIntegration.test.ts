import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (file: string) => readFileSync(resolve(root, file), 'utf8')

test('SEO Control Center mantém Search Console no servidor e exige admin AAL2 ou token interno do cron', () => {
  const fn = read('supabase/functions/google-search-console/index.ts')
  assert.match(fn, /requireAdminAal2/)
  assert.match(fn, /get_automation_token/)
  assert.match(fn, /GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON/)
  assert.match(fn, /webmasters\.readonly/)
  assert.match(fn, /searchAnalytics\/query/)
  assert.match(fn, /urlInspection\/index:inspect/)
  assert.match(fn, /webmasters\/v3\/sites\/\$\{encodeURIComponent\(siteUrl\)\}\/sitemaps/)
  assert.doesNotMatch(fn, /VITE_GOOGLE_SEARCH/)
})

test('SEO Control Center persiste histórico, inspeções, sitemap, execuções e alertas em tabelas server-only', () => {
  const migration = read('supabase/migrations/20260913225500_seo_control_center.sql')
  for (const table of ['seo_sync_runs', 'seo_search_performance_daily', 'seo_url_inspections', 'seo_sitemaps', 'seo_alerts']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`))
    assert.match(migration, new RegExp(`grant all on table public\\.${table} to service_role`))
  }
  assert.match(migration, /seo-control-center-daily/)
  assert.match(migration, /automation_token/)
  assert.match(migration, /google-search-console/)
})

test('cockpit organiza as áreas completas e preserva a auditoria técnica existente', () => {
  const cockpit = read('src/components/admin/AdminSEOCockpit.tsx')
  for (const label of ['Visão Geral', 'Indexação', 'Performance', 'Palavras-chave', 'Páginas', 'Oportunidades', 'Sitemap', 'Alertas', 'Auditoria técnica', 'Configurações']) {
    assert.match(cockpit, new RegExp(label))
  }
  assert.match(cockpit, /google-search-console/)
  assert.match(cockpit, /SEO Health Score/)
  assert.match(cockpit, /Sincronizar agora/)
  assert.match(cockpit, /Gerar SEO/)
  assert.doesNotMatch(cockpit, /SERVICE_ACCOUNT_JSON/)
})

test('o painel de status só expõe presença das credenciais Google, nunca seus valores', () => {
  const status = read('supabase/functions/admin-config-status/index.ts')
  assert.match(status, /GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON/)
  assert.match(status, /GOOGLE_SEARCH_CONSOLE_SITE_URL/)
  assert.match(status, /secrets\[k\] = !!/)
})
