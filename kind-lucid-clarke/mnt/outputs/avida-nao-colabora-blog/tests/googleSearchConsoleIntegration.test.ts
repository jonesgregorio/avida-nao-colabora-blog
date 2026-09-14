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

test('gateway do Search Console não bloqueia o token interno do cron antes da autenticação própria', () => {
  const config = read('supabase/config.toml')
  assert.match(config, /\[functions\.google-search-console\]\s*verify_jwt\s*=\s*false/s)
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

test('cron diário do SEO Control Center aponta para o projeto Supabase oficial do AVNC', () => {
  const migration = read('supabase/migrations/20260913235000_fix_seo_control_center_cron_target.sql')
  assert.match(migration, /https:\/\/lejvvhzluggyxlfwfoxl\.supabase\.co\/functions\/v1\/google-search-console/)
  assert.match(migration, /seo-control-center-daily/)
  assert.match(migration, /automation_token/)
  assert.doesNotMatch(migration, /pdjzzkqrrffvxvpymcqn/)
})

test('cockpit mantém todas as áreas e usa linguagem simples', () => {
  const cockpit = read('src/components/admin/AdminSEOCockpit.tsx')
  for (const label of ['Visão Geral', 'Indexação', 'Performance', 'Palavras-chave', 'Páginas', 'Oportunidades', 'Sitemap', 'Alertas', 'Auditoria técnica', 'Configurações']) {
    assert.match(cockpit, new RegExp(label))
  }
  assert.match(cockpit, /Analisar tudo agora/)
  assert.match(cockpit, /Corrigir problemas automaticamente/)
  assert.match(cockpit, /O que isso significa:/)
  assert.match(cockpit, /O que fazer:/)
  assert.match(cockpit, /Nenhuma ferramenta pode obrigar o Google a indexar uma página/)
  assert.match(cockpit, /uma página pode estar indexada e ainda ter zero aparições/i)
  assert.doesNotMatch(cockpit, /private_key|client_email|Deno\.env/)
})

test('relatório sob demanda sincroniza dados frescos e diferencia indexação de aparições', () => {
  const cockpit = read('src/components/admin/AdminSEOCockpit.tsx')
  assert.match(cockpit, /analysis_report/)
  assert.match(cockpit, /buildInstantReport/)
  assert.match(cockpit, /Relatório instantâneo/)
  assert.match(cockpit, /“Indexada” quer dizer que o Google confirmou a página no índice/)
  assert.match(cockpit, /“Impressões” quer dizer quantas vezes ela apareceu em uma busca/)
})

test('corretor inteligente trata cada tipo de problema sem fingir revisão humana', () => {
  const corrector = read('src/lib/seoSmartCorrector.ts')
  assert.match(corrector, /generateSEO/)
  assert.match(corrector, /searchCoverImage/)
  assert.match(corrector, /related_slugs/)
  assert.match(corrector, /seo_content_expansion/)
  assert.match(corrector, /Equipe editorial A Vida Não Colabora/)
  assert.match(corrector, /analytics_redirects/)
  assert.match(corrector, /type:\s*301/)
  assert.match(corrector, /seo_editorial_prereview/)
  assert.match(corrector, /requer validação humana para marcar como revisado/)
  assert.doesNotMatch(corrector, /reviewed_at:\s*new Date/)
})

test('mudança automática de slug preserva a URL antiga com redirect público server-side', () => {
  const migration = read('supabase/migrations/20260914014000_public_article_redirect_rpc.sql')
  const renderer = read('api/article.js')
  assert.match(migration, /get_public_redirect/)
  assert.match(migration, /analytics_redirects/)
  assert.match(renderer, /getPublicRedirect/)
  assert.match(renderer, /res\.setHeader\('Location', redirect\.toPath\)/)
  assert.match(renderer, /res\.status\(redirect\.type\)/)
})

test('ações Google do corretor ficam no servidor, exigem AAL2 e não usam Indexing API genérica', () => {
  const fn = read('supabase/functions/seo-smart-google-actions/index.ts')
  assert.match(fn, /requireAdminAal2/)
  assert.match(fn, /GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON/)
  assert.match(fn, /urlInspection\/index:inspect/)
  assert.match(fn, /submit_sitemap/)
  assert.match(fn, /auth\/webmasters'/)
  assert.doesNotMatch(fn, /indexing\.googleapis\.com/)
})

test('o painel de status só expõe presença das credenciais Google, nunca seus valores', () => {
  const status = read('supabase/functions/admin-config-status/index.ts')
  assert.match(status, /GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON/)
  assert.match(status, /GOOGLE_SEARCH_CONSOLE_SITE_URL/)
  assert.match(status, /secrets\[k\] = !!/)
})
