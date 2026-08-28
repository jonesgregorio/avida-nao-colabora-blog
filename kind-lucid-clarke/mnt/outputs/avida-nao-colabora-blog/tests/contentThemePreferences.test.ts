import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('migration cria user_muted_content_themes com RLS restrita ao próprio usuário e sem exclusão permanente de conteúdo', () => {
  const mig = read('supabase/migrations/20260828040000_content_theme_preferences.sql')
  assert.match(mig, /CREATE TABLE IF NOT EXISTS public\.user_muted_content_themes/)
  assert.match(mig, /ENABLE ROW LEVEL SECURITY/)
  assert.match(mig, /REVOKE ALL ON public\.user_muted_content_themes FROM anon, authenticated/)
  assert.match(mig, /GRANT SELECT, INSERT, DELETE ON public\.user_muted_content_themes TO authenticated/)
  assert.match(mig, /USING \(auth\.uid\(\) = user_id\)/)
  assert.doesNotMatch(mig, /DELETE FROM (guided_contents|content)/i, 'não deve apagar nenhum conteúdo — só a preferência do usuário')
})

test('scoreCatalog filtra temas silenciados sem exigir tabela nova de conteúdo', () => {
  const src = read('src/lib/contentRecommendation.ts')
  assert.match(src, /mutedThemes\?: Set<Theme>/)
  assert.match(src, /topThemes\(sig, 5\)\.filter\(th => !mutedThemes\.has\(th\)\)/)
  assert.match(src, /export async function fetchMutedThemes/)
  assert.match(src, /export async function muteContentTheme/)
  assert.match(src, /export async function unmuteContentTheme/)
})

test('RecommendedContent oferece "Mostrar menos conteúdos assim" e some o card na hora, sem esperar recarregar', () => {
  const src = read('src/components/RecommendedContent.tsx')
  assert.match(src, /Mostrar menos conteúdos assim/)
  assert.match(src, /setScored\(prev => \(prev \?\? \[\]\)\.filter\(x => x\.item\.id !== s\.item\.id\)\)/)
})

test('Perfil tem "Temas reduzidos" reversível ("Voltar a mostrar"), sem exclusão permanente', () => {
  const src = read('src/components/ContentThemePreferences.tsx')
  assert.match(src, /Temas reduzidos/)
  assert.match(src, /Voltar a mostrar/)
  assert.match(src, /unmuteContentTheme/)

  const profile = read('src/components/Profile.tsx')
  assert.match(profile, /ContentThemePreferences/)
})
