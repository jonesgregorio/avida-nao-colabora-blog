import { supabase } from './supabase'

// Modo de entrega do Meu Jardim (Admin → Gestão de Jardins → Regras): global, free ou hybrid.
// O servidor decide tudo (get_my_garden_choice / choose_my_garden); aqui só lemos e enviamos.

export interface GardenChoiceOption {
  slug: string
  label: string
  description: string
  cover_image: string | null
}

export interface GardenChoice {
  mode: 'global' | 'free' | 'hybrid'
  cycle: number
  current_slug: string | null
  locked_by_admin: boolean
  needs_choice: boolean
  can_switch: boolean
  options: GardenChoiceOption[]
}

/** Nunca lança: sem resposta válida, o jardim segue a fila como sempre. */
export async function loadMyGardenChoice(): Promise<GardenChoice | null> {
  try {
    const { data, error } = await supabase.rpc('get_my_garden_choice')
    if (error || !data || typeof data !== 'object') return null
    const raw = data as Partial<GardenChoice>
    const mode = raw.mode === 'free' || raw.mode === 'hybrid' ? raw.mode : 'global'
    return {
      mode,
      cycle: Number(raw.cycle) || 0,
      current_slug: typeof raw.current_slug === 'string' ? raw.current_slug : null,
      locked_by_admin: raw.locked_by_admin === true,
      needs_choice: raw.needs_choice === true,
      can_switch: raw.can_switch === true,
      options: Array.isArray(raw.options)
        ? raw.options.filter((o): o is GardenChoiceOption => Boolean(o) && typeof o.slug === 'string' && typeof o.label === 'string')
        : [],
    }
  } catch {
    return null
  }
}

export async function chooseMyGarden(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await supabase.rpc('choose_my_garden', { p_slug: slug })
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Não foi possível salvar a escolha.' }
  }
}
