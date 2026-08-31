import { supabase } from './supabase'
import { inputToRow, rowToPerfil, type PerfilInput, type PerfilInspiracao } from './estudioInspiration'

// I/O da tabela estudio_perfis_inspiracao (Fase 4a). RLS restringe a admins.

const TABLE = 'estudio_perfis_inspiracao'

export async function listPerfis(): Promise<PerfilInspiracao[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(rowToPerfil)
}

export async function createPerfil(input: PerfilInput): Promise<PerfilInspiracao> {
  const { data, error } = await supabase.from(TABLE).insert(inputToRow(input)).select('*').single()
  if (error) throw new Error(error.message)
  return rowToPerfil(data as Record<string, unknown>)
}

export async function updatePerfil(id: string, input: PerfilInput): Promise<PerfilInspiracao> {
  const { data, error } = await supabase.from(TABLE).update(inputToRow(input)).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  return rowToPerfil(data as Record<string, unknown>)
}

export async function deletePerfil(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
