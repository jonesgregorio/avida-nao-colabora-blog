import { supabase } from './supabase'
import { registerRuntimeGardenThemes } from './gardenThemes'
import { themeFromCatalogRow, type CatalogSceneRow } from './gardenSceneConfig'

// Carrega os jardins criados no Admin (scene_config) e os registra para resolveGardenTheme.
// garden_catalog já é legível por usuários autenticados (jardins arquivados só para admin).
// Nunca lança: sem rede ou sem jardins novos, valem os jardins do código.

let loading: Promise<void> | null = null

export function ensureRuntimeGardenThemes(force = false): Promise<void> {
  if (force) loading = null
  if (!loading) {
    loading = (async () => {
      try {
        const { data } = await supabase
          .from('garden_catalog')
          .select('slug,label,stage_images,scene_config')
          .not('scene_config', 'is', null)
          .neq('status', 'archived')
        const themes = ((data ?? []) as CatalogSceneRow[]).map(themeFromCatalogRow).filter((t): t is NonNullable<typeof t> => t !== null)
        registerRuntimeGardenThemes(themes)
      } catch {
        // mantém só os jardins do código
      }
    })()
  }
  return loading
}
