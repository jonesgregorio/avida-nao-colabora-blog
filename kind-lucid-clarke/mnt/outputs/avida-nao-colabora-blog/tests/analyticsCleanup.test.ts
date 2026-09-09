import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const legacy = read('src/components/admin/AnalyticsPageLegacy.tsx')
const page = read('src/components/admin/AnalyticsPage.tsx')

test('abas mortas do Analytics foram removidas (events / ai / settings / seo)', () => {
  const tabs = legacy.match(/const TABS = \[([\s\S]*?)\] as const/)?.[1] ?? ''
  for (const dead of ["'events'", "'ai'", "'settings'", "'seo'"]) {
    assert.doesNotMatch(tabs, new RegExp(`id: ${dead}`), `aba morta ainda em TABS: ${dead}`)
  }
  // e os componentes internos que só elas usavam saíram do arquivo
  assert.doesNotMatch(legacy, /function AnalyticsSettingsPanel/)
  assert.doesNotMatch(legacy, /function RedirectsManager/)
  assert.doesNotMatch(legacy, /function AiReportsHistory/)
  assert.doesNotMatch(legacy, /from '\.\.\/\.\.\/lib\/aiContent'/)
})

test('Configurações e Redirecionamentos migraram para Sistema e Conteúdo', () => {
  const settings = read('src/components/admin/AdminAnalyticsSettings.tsx')
  assert.match(settings, /export default function AdminAnalyticsSettings/)
  assert.match(settings, /from\('analytics_settings'\)/)
  const redirects = read('src/components/admin/AdminRedirects.tsx')
  assert.match(redirects, /export default function AdminRedirects/)
  assert.match(redirects, /from\('analytics_redirects'\)/)

  const sistema = read('src/components/admin/AdminAreaSistema.tsx')
  assert.match(sistema, /id: 'configuracoes'/)
  assert.match(sistema, /Component: AdminAnalyticsSettings/)
  const conteudo = read('src/components/admin/AdminAreaConteudo.tsx')
  assert.match(conteudo, /id: 'redirects'/)
  assert.match(conteudo, /<AdminRedirects \/>/)

  const index = read('src/components/admin/index.tsx')
  assert.match(index, /'analytics-settings': \{ area: 'sistema'/)
  assert.match(index, /redirects: \{ area: 'conteudos'/)
})

test('AnalyticsPage é composto por áreas nomeadas; só a ativa é montada', () => {
  for (const name of ['AnalyticsOverview', 'AnalyticsAcquisition', 'AnalyticsContent', 'AnalyticsConversion', 'AnalyticsRetention']) {
    assert.match(page, new RegExp(`function ${name}\\(`))
  }
  assert.match(page, /\{area === 'aquisicao' && <AnalyticsAcquisition/)
  // nenhum dataset de área inativa é buscado no mount
  assert.doesNotMatch(page, /useEffect\([\s\S]{0,60}supabase\./)
})

test('nenhuma migration deletou tabelas de analytics', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url)
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.sql')) continue
    const sql = readFileSync(new URL(f, dir), 'utf8').toLowerCase()
    assert.doesNotMatch(sql, /drop table[^;]*analytics_(events|settings|redirects|custom_events|ai_reports)/,
      `migration ${f} apaga tabela de analytics`)
  }
})
