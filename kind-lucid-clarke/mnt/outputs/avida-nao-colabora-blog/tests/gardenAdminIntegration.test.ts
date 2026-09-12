import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GARDEN_THEMES, gardenThemeBySlug, resolveGardenTheme } from '../src/lib/gardenThemes.ts'

const garden = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8')
const adminPanel = readFileSync(new URL('../src/components/admin/AdminGardenManagement.tsx', import.meta.url), 'utf8')
const fixMigration = readFileSync(new URL('../supabase/migrations/20260912000000_garden_admin_operational_fixes.sql', import.meta.url), 'utf8')
const ctaMigration = readFileSync(new URL('../supabase/migrations/20260912010000_garden_campaign_cta_url.sql', import.meta.url), 'utf8')

// "Gestão de Jardins" (Admin) só consegue administrar "Meu Jardim" (blog) se o garden_slug que
// a RPC resolve (fila/override do admin) realmente decidir qual tema aparece na tela do usuário.

test('gardenThemeBySlug resolve um tema real pelo slug do catálogo administrável, e undefined pra slug desconhecido', () => {
  for (const t of GARDEN_THEMES) assert.equal(gardenThemeBySlug(t.slug), t)
  assert.equal(gardenThemeBySlug('jardim-que-nao-existe'), undefined)
  assert.equal(gardenThemeBySlug(null), undefined)
  assert.equal(gardenThemeBySlug(undefined), undefined)
})

test('resolveGardenTheme prioriza o slug autoritativo e só cai pro índice quando não há slug (ou é desconhecido)', () => {
  const bySlug = resolveGardenTheme('nordico', 0) // índice diria "japones" (0%8) — slug deve vencer
  assert.equal(bySlug.slug, 'nordico')
  const fallbackNull = resolveGardenTheme(null, 3)
  assert.equal(fallbackNull.slug, GARDEN_THEMES[3].slug) // sem slug (1º load) → aproxima pelo índice
  const fallbackUnknown = resolveGardenTheme('jardim-novo-do-admin-sem-config', 3)
  assert.equal(fallbackUnknown.slug, GARDEN_THEMES[3].slug) // slug de catálogo sem engine aqui → não quebra, aproxima
})

test('MyGardenPage usa garden_slug (não só o índice) pra escolher o tema e pra celebração', () => {
  assert.match(garden, /const theme=resolveGardenTheme\(state\.garden_slug,gardenIndex\)/)
  // guarda o slug anterior (não só o índice) — reordenar a fila do admin não deve confundir
  // "qual jardim acabou de virar" na hora de celebrar.
  assert.match(garden, /LAST_GARDEN_SLUG_KEY_PREFIX/)
  assert.match(garden, /setCelebrateTheme\(prevSlug\?resolveGardenTheme\(prevSlug,nextIndex-1\):themeFor\(nextIndex-1\)\)/)
})

test('Meu Jardim busca e exibe a campanha ativa vinda do Admin (antes não existia nenhuma leitura)', () => {
  assert.match(garden, /get_my_garden_campaign/)
  assert.match(garden, /type GardenCampaign/)
  assert.match(garden, /\{campaign&&<div/) // banner só renderiza quando alguma campanha bate
  assert.match(garden, /\{campaign\.headline\}/)
})

test('admin_garden_users() para de ignorar garden_settings (pontos por ciclo e marcos visuais)', () => {
  // o bug: cyc/gp fixos em 60, thresholds fixos no CASE — sumiram
  assert.doesNotMatch(fixMigration, /floor\(growth\/60\.0\)::int cyc,\(growth%60\)::int gp/)
  assert.doesNotMatch(fixMigration, /WHEN c\.gp<3 THEN 0 WHEN c\.gp<10 THEN 1/)
  // a correção: lê garden_settings dinamicamente, mesma normalização 0..59 de get_my_garden_state()
  assert.match(fixMigration, /FROM qualified q CROSS JOIN conf c/)
  assert.match(fixMigration, /COALESCE\(points_per_cycle,60\)::int ppc,COALESCE\(stage_thresholds/)
  assert.match(fixMigration, /WHEN c\.gp < COALESCE\(\(c\.thresholds->>0\)::int,3\) THEN 0/)
})

test('get_my_garden_campaign() existe, é restrita a authenticated, e casa audience com o estado real do usuário chamando', () => {
  assert.match(fixMigration, /CREATE OR REPLACE FUNCTION public\.get_my_garden_campaign\(\)/)
  assert.match(fixMigration, /SECURITY DEFINER/)
  assert.match(fixMigration, /REVOKE ALL ON FUNCTION public\.get_my_garden_campaign\(\) FROM PUBLIC, anon/)
  assert.match(fixMigration, /GRANT EXECUTE ON FUNCTION public\.get_my_garden_campaign\(\) TO authenticated/)
  // reaproveita get_my_garden_state() em vez de duplicar a fórmula de crescimento pela 3ª vez
  assert.match(fixMigration, /v_state := public\.get_my_garden_state\(\)/)
  for (const audience of ["c.audience = 'all'", "c.audience = 'completed_one'", "c.audience = 'at_100'", "c.audience = 'inactive'", "c.audience = 'new_users'", "c.audience = 'garden_users'"]) {
    assert.ok(fixMigration.includes(audience), `público-alvo não tratado: ${audience}`)
  }
})

test('painel admin avisa que "Limite diário" ainda não é aplicado, em vez de fingir que funciona', () => {
  assert.match(adminPanel, /Limite diário/)
  assert.match(adminPanel, /Ainda não aplicado no cálculo/)
})

test('admin consegue cadastrar um jardim novo no Catálogo (linha no banco) — com aviso claro do que isso NÃO resolve sozinho', () => {
  assert.match(adminPanel, /async function createGarden/)
  assert.match(adminPanel, /supabase\.from\('garden_catalog'\)\.insert/)
  assert.match(adminPanel, /status: 'draft'/) // nunca nasce visível pra usuários sem o admin promover
  assert.match(adminPanel, /onCreate:\(g:\{slug:string;label:string;description:string;theme_index:number;cover_image:string;stage_images:string\[\]\}\)/)
  assert.match(adminPanel, /Novo jardim/)
  // avisa explicitamente que fotos+engine continuam sendo trabalho à parte
  assert.match(adminPanel, /a configuração de água\/fauna\/luz continuam sendo um trabalho à parte/)
})

test('Memórias do Jardim usa o garden_slug REAL de cada ciclo passado (garden_user_cycles), não só o índice aproximado', () => {
  assert.match(garden, /supabase\.from\('garden_user_cycles'\)\.select\('cycle_number,garden_slug'\)\.eq\('user_id',userId\)/)
  assert.match(garden, /const \[cycleSlugs,setCycleSlugs\]=useState<Record<number,string>>\(\{\}\)/)
  assert.match(garden, /<MemoryCard key=\{index\} index=\{index\} slug=\{cycleSlugs\[index\]\}\/>/)
  assert.match(garden, /function MemoryCard\(\{index,slug\}:\{index:number;slug\?:string\}\)\{const t=resolveGardenTheme\(slug,index\)/)
})

test('a dica "faltam N sinais" usa os Marcos visuais REAIS configurados pelo admin (garden_settings), com o padrão fixo só como reserva', () => {
  assert.match(garden, /supabase\.from\('garden_settings'\)\.select\('stage_thresholds'\)\.eq\('id',true\)\.maybeSingle\(\)/)
  assert.match(garden, /const \[stageThresholds,setStageThresholds\]=useState<number\[\]\|null>\(null\)/)
  assert.match(garden, /const nextThreshold=next\?\(stageThresholds\?\.\[next\.stage-1\]\?\?STAGE_THRESHOLDS\[next\.stage\]\):0/)
})

test('botão de campanha vira link de verdade quando tem cta_url — sem link, continua só selo (não finge ser clicável)', () => {
  assert.match(ctaMigration, /ALTER TABLE public\.garden_campaigns ADD COLUMN IF NOT EXISTS cta_url text/)
  assert.match(ctaMigration, /'cta_url', c\.cta_url/) // get_my_garden_campaign() devolve o campo novo
  assert.match(garden, /cta_url\?:string\|null/)
  assert.match(garden, /campaign\.cta_url\?<a href=\{campaign\.cta_url\}/)
  assert.match(garden, /target="_blank" rel="noopener noreferrer"/)
  assert.match(garden, /:<span className="shrink-0 self-start rounded-2xl bg-forest-900\/90/) // fallback sem link continua span, não <a>
})

test('admin consegue definir texto e link do botão da campanha; "Desbloqueio temporário" continua avisado como não aplicado (não mexi em plano/acesso)', () => {
  assert.match(adminPanel, /cta_label: string\s*\n\s*cta_url: string \| null/)
  assert.match(adminPanel, /Input label="Texto do botão"/)
  assert.match(adminPanel, /Input label="Link do botão/)
  assert.match(adminPanel, /Ainda não aplicado — fica salvo, mas nenhuma tela hoje libera acesso com base nisso\./)
})
