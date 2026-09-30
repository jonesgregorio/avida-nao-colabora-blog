import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GARDEN_THEMES, gardenThemeBySlug, registerRuntimeGardenThemes, resolveGardenTheme } from '../src/lib/gardenThemes.ts'
import { DEFAULT_SCENE, sanitizeSceneConfig, sceneOf, themeFromCatalogRow } from '../src/lib/gardenSceneConfig.ts'

const IMAGES = Array.from({ length: 6 }, (_, i) => `https://x.supabase.co/storage/v1/object/public/garden-images/inverno/${i + 1}.webp`)

test('todo jardim do código sobrevive ao saneador sem perder nenhum recurso (100% de paridade)', () => {
  for (const theme of GARDEN_THEMES) {
    const scene = sanitizeSceneConfig(sceneOf(theme))
    const keys = Object.keys(sceneOf(theme)).sort()
    const got = Object.keys(scene).sort()
    for (const key of keys) assert.ok(got.includes(key), `${theme.slug}: recurso "${key}" foi perdido`)
    assert.deepEqual(scene.water, sanitizeSceneConfig({ water: theme.water }).water)
    assert.equal(scene.fall.emitters.length, theme.fall.emitters.length, `${theme.slug}: emissores de queda`)
    assert.equal(scene.light.glow.length, theme.light.glow.length, `${theme.slug}: brilhos`)
  }
})

test('saneador limita quantidades, cores e coordenadas vindas do banco', () => {
  const s = sanitizeSceneConfig({
    water: { kind: 'pond', poly: [[0, 0], [5, 5], [0.5, 9]], tint: 'javascript:alert(1)', drip: 9999 },
    fall: { count: 100000, emitters: [{ kind: 'lava', weight: 5, colors: ['red'], zone: [0, 0, 1, 1] }, { kind: 'snow', weight: 5, colors: ['#ffffff', 'x'], zone: [0.9, 0.9, 0.1, 0.1] }] },
    flyers: { butterflies: 999, fireflies: -4, bees: 'muitas' },
    birds: { kind: 'swallows', count: 500 },
    light: { sun: [9, -9], ray: 'azul', rayAmt: 50, glow: Array.from({ length: 30 }, () => [0.5, 0.5, 999, '999,0,0']) },
    stars: Array.from({ length: 500 }, () => [0.5, 0.5, 1]),
    hawk: { center: [0.5, 0.1], r: [9, 9], sp: 99 },
  })
  assert.equal(s.water.kind, 'pond')
  assert.ok((s.water.poly?.length ?? 0) >= 3)
  for (const [x, y] of s.water.poly ?? []) { assert.ok(x >= -0.1 && x <= 1.1 && y >= -0.1 && y <= 1.1) }
  assert.match(s.water.tint, /^#[0-9a-f]{6}$/i)
  assert.ok((s.water.drip ?? 0) <= 30)
  assert.equal(s.fall.emitters.length, 1) // "lava" é descartado
  assert.ok(s.fall.count <= 80)
  assert.deepEqual(s.fall.emitters[0].zone, [0.1, 0.1, 0.9, 0.9]) // zona reordenada
  assert.ok((s.flyers.butterflies ?? 0) <= 12)
  assert.equal(s.flyers.fireflies, undefined)
  assert.equal(s.flyers.bees, undefined)
  assert.ok((s.birds.count ?? 0) <= 10)
  assert.match(s.light.ray, /^#[0-9a-f]{6}$/i)
  assert.ok(s.light.rayAmt <= 0.4)
  assert.ok(s.light.glow.length <= 8)
  for (const g of s.light.glow) { assert.ok(g[2] <= 80); assert.match(g[3], /^\d{1,3},\d{1,3},\d{1,3}$/); assert.ok(g[3].split(',').every((n) => Number(n) <= 255)) }
  assert.ok((s.stars?.length ?? 0) <= 60)
  assert.ok((s.hawk?.r[0] ?? 0) <= 0.6 && (s.hawk?.sp ?? 0) <= 0.4)
})

test('lixo ou nulo vira cena padrão segura (sem água visível, sem queda)', () => {
  for (const bad of [null, undefined, 'x', 42, [], { water: 'lago' }]) {
    const s = sanitizeSceneConfig(bad)
    assert.equal(s.fall.count, 0)
    assert.equal(s.birds.kind, 'none')
    assert.ok((s.water.rx ?? 0) < 0.001)
  }
  assert.deepEqual(sanitizeSceneConfig(null), DEFAULT_SCENE)
})

test('jardim do catálogo só vira tema com slug válido, nome, 4 ou 6 imagens seguras e cena', () => {
  const ok = themeFromCatalogRow({ slug: 'inverno', label: 'Inverno', stage_images: IMAGES, scene_config: { fall: { count: 10, emitters: [{ kind: 'snow', weight: 1, colors: ['#ffffff'], zone: [0, 0, 1, 0.2] }] } } })
  assert.ok(ok)
  assert.equal(ok?.stages.length, 6)
  assert.equal(themeFromCatalogRow({ slug: 'Inverno!', label: 'x', stage_images: IMAGES, scene_config: {} }), null)
  assert.equal(themeFromCatalogRow({ slug: 'inverno', label: '', stage_images: IMAGES, scene_config: {} }), null)
  assert.equal(themeFromCatalogRow({ slug: 'inverno', label: 'x', stage_images: IMAGES.slice(0, 5), scene_config: {} }), null)
  assert.equal(themeFromCatalogRow({ slug: 'inverno', label: 'x', stage_images: ['javascript:alert(1)', ...IMAGES.slice(1)], scene_config: {} }), null)
  assert.equal(themeFromCatalogRow({ slug: 'inverno', label: 'x', stage_images: IMAGES, scene_config: null }), null)
})

test('jardim criado no Admin é resolvido por slug; o código nunca é sobrescrito', () => {
  const novo = themeFromCatalogRow({ slug: 'inverno', label: 'Inverno', stage_images: IMAGES, scene_config: {} })!
  const impostor = themeFromCatalogRow({ slug: 'japones', label: 'Falso', stage_images: IMAGES, scene_config: {} })!
  registerRuntimeGardenThemes([novo, impostor])
  assert.equal(gardenThemeBySlug('inverno')?.label, 'Inverno')
  assert.equal(resolveGardenTheme('inverno', 0).slug, 'inverno')
  assert.equal(gardenThemeBySlug('japones')?.label, GARDEN_THEMES.find((t) => t.slug === 'japones')?.label)
  registerRuntimeGardenThemes([])
  assert.equal(gardenThemeBySlug('inverno'), undefined)
})

test('MyGardenPage espera os jardins criados no Admin antes de resolver o tema, e o banco guarda cena e imagens', () => {
  const page = readFileSync(new URL('../src/components/MyGardenPage.tsx', import.meta.url), 'utf8')
  assert.match(page, /await ensureRuntimeGardenThemes\(\)\s*\n\s*const \{data\}=await supabase\.rpc\('get_my_garden_state'\)/)
  const sql = readFileSync(new URL('../supabase/migrations/20260930220000_garden_scene_config_and_images_bucket.sql', import.meta.url), 'utf8')
  assert.match(sql, /add column if not exists scene_config jsonb/)
  assert.match(sql, /'garden-images'/)
  assert.match(sql, /bucket_id = 'garden-images' and public\.is_admin\(\)/)
  assert.doesNotMatch(sql, /for (insert|update|delete)[^;]*to anon/i)
})
