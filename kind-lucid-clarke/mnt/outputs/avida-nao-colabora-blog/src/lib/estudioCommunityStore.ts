import { supabase } from './supabase'
import {
  inputToRow, rowToInteracao,
  type Interacao, type InteracaoInput, type InteracaoStatus,
} from './estudioCommunity'

// I/O da tabela estudio_comunidade_interacoes (Fase 4b). RLS restringe a admins.

const TABLE = 'estudio_comunidade_interacoes'

export async function listInteracoes(): Promise<Interacao[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(rowToInteracao)
}

export async function createInteracao(input: InteracaoInput): Promise<Interacao> {
  const { data, error } = await supabase.from(TABLE).insert(inputToRow(input)).select('*').single()
  if (error) throw new Error(error.message)
  return rowToInteracao(data as Record<string, unknown>)
}

export async function setInteracaoStatus(id: string, status: InteracaoStatus): Promise<void> {
  const patch: Record<string, unknown> = { status }
  patch.feito_em = status === 'sugerido' ? null : new Date().toISOString()
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteInteracao(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
