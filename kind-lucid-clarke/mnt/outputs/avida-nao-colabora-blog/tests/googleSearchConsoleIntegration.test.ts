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

test('cron do Search Console dá tempo para a inspeção real terminar', () => {
  const migration = read('supabase/migrations/20260914021500_fix_seo_control_center_cron_timeout.sql')
  assert.match(migration, /timeout_milliseconds\s*:=\s*120000/)
  assert.match(migration, /seo-control-center-daily/)
  assert.match(migration, /automation_token/)
})

test('autoteste 12/12 é server-side, não destrutivo e executa diariamente', () => {
  const fn = read('supabase/functions/seo-control-selftest/index.ts')
  const migration = read('supabase/migrations/20260914024000_seo_control_center_selftest.sql')
  const config = read('supabase/config.toml')
  for (const key of [
    'google_credentials', 'google_oauth', 'search_analytics', 'sitemaps_api', 'url_inspection',
    'public_sitemap', 'robots', 'seo_database', 'ai_provider', 'corrector_schema', 'redirect_contract', 'automation',
  ]) assert.match(fn, new RegExp(key))
  assert.match(fn, /total:\s*checks\.length/)
  assert.match(fn, /seo_self_test_runs/)
  assert.match(fn, /get_public_redirect/)
  assert.match(fn, /seo_self_test_runtime_snapshot/)
  assert.doesNotMatch(fn, /\.update\(['"]articles['"]|from\(['"]articles['"]\)\.update/)
  assert.match(migration, /create table if not exists public\.seo_self_test_runs/)
  assert.match(migration, /seo-control-center-self-test-daily/)
  assert.match(migration, /40 6 \* \* \*/)
  assert.match(migration, /timeout_milliseconds\s*:=\s*60000/)
  assert.match(config, /\[functions\.seo-control-selftest\]\s*verify_jwt\s*=\s*false/s)
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
  const wrapper = read('src/components/admin/AdminSEOCockpitWithSelfTest.tsx')
  for (const label of ['Visão Geral', 'Indexação', 'Performance', 'Palavras-chave', 'Páginas', 'Oportunidades', 'Sitemap', 'Alertas', 'Auditoria técnica', 'Configurações']) {
    assert.match(cockpit, new RegExp(label))
  }
  assert.match(cockpit, /Analisar tudo agora/)
  assert.match(cockpit, /Corrigir problemas automaticamente/)
  assert.match(wrapper, /Autoteste do SEO Control Center/)
  assert.match(wrapper, /Executar autoteste agora/)
  assert.match(wrapper, /\$\{latest\.passed\}\/\$\{latest\.total\} testes aprovados/)
  assert.match(wrapper, /latest\?\.total === 12/)
  assert.match(wrapper, /seo-control-selftest/)
  assert.match(cockpit, /O que isso significa:/)
  assert.match(cockpit, /O que fazer:/)
  assert.match(cockpit, /Nenhuma ferramenta pode obrigar o Google a indexar uma página/)
  assert.match(cockpit, /uma página pode estar indexada e ainda ter zero aparições/i)
  assert.doesNotMatch(`${cockpit}\n${wrapper}`, /private_key|client_email|Deno\.env/)
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


test('P3 prioriza oportunidades orgânicas por evidência sem automatizar publicação', () => {
  const fn = read('supabase/functions/google-search-console/index.ts')
  const cockpit = read('src/components/admin/AdminSEOCockpit.tsx')
  assert.match(fn, /function opportunityScore/)
  assert.match(fn, /b\.score - a\.score/)
  assert.match(fn, /row\.impressions >= 20 && row\.ctr < 0\.03/)
  assert.match(fn, /row\.position >= 8 && row\.position <= 20/)
  assert.match(cockpit, /Prioridade por evidência:/)
  assert.match(cockpit, /'alta'.*'média'.*'acompanhar'/s)
  assert.doesNotMatch(fn, /from\(['"]articles['"]\)\.update/)
})


test('P3 compara períodos equivalentes e mostra tendência sem tratar pouco dado como queda', () => {
  const fn = read('supabase/functions/google-search-console/index.ts')
  const cockpit = read('src/components/admin/AdminSEOCockpit.tsx')
  assert.match(fn, /function trendState/)
  assert.match(fn, /current\.impressions < 10 && previous\.impressions < 10/)
  assert.match(fn, /change >= 0\.25/)
  assert.match(fn, /change <= -0\.25/)
  assert.match(fn, /previousQueries/)
  assert.match(fn, /previousPages/)
  assert.match(cockpit, /📈 Crescendo/)
  assert.match(cockpit, /📉 Caindo/)
  assert.match(cockpit, /Dados insuficientes/)
})


test('P3 detecta sobreposição somente com evidência consulta+página e mantém decisão editorial humana', () => {
  const fn = read('supabase/functions/google-search-console/index.ts')
  const cockpit = read('src/components/admin/AdminSEOCockpit.tsx')
  const migration = read('supabase/migrations/20260920182500_seo_p3_query_page_dimension.sql')
  assert.match(fn, /\['date', 'query', 'page'\]/)
  assert.match(fn, /dimension: 'query_page'/)
  assert.match(fn, /function detectCannibalization/)
  assert.match(fn, /m\.impressions >= 5/)
  assert.match(migration, /'query_page'/)
  assert.match(cockpit, /Possível sobreposição de conteúdo/)
  assert.match(cockpit, /não uma ordem para excluir ou redirecionar conteúdo/)
})

test('documentação e fallback SSR usam os seis guias e o slug canônico de Relações', () => {
  const docs = read('docs/SEO_OPERACAO.md')
  const page = read('api/page.js')
  assert.match(docs, /seis guias temáticos/)
  assert.doesNotMatch(docs, /oito artigos-pilar|os oito pilares/)
  assert.match(page, /como-conversar-sobre-os-seus-limites-sem-transformar-tudo-em/)
  assert.doesNotMatch(page, /como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito/)
})
