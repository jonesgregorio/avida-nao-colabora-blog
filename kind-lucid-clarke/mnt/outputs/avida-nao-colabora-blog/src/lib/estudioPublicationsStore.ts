import { supabase } from './supabase'
import {
  inputToRow,
  metricsToRow,
  rowToPublicacao,
  type Publicacao,
  type PublicacaoInput,
  type PublicacaoMetrics,
  type PublicacaoStatus,
} from './estudioPublications'

// I/O da tabela estudio_publicacoes (Fase 2a). RLS já restringe a admins.

const TABLE = 'estudio_publicacoes'

export async function listPublicacoes(): Promise<Publicacao[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(rowToPublicacao)
}

export async function createPublicacao(input: PublicacaoInput): Promise<Publicacao> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(inputToRow(input))
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToPublicacao(data as Record<string, unknown>)
}

export async function updatePublicacao(id: string, input: PublicacaoInput): Promise<Publicacao> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(inputToRow(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToPublicacao(data as Record<string, unknown>)
}

export async function setPublicacaoStatus(id: string, status: PublicacaoStatus): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'publicado') patch.published_at = new Date().toISOString()
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function savePublicacaoMetrics(id: string, metrics: PublicacaoMetrics): Promise<void> {
  const { error } = await supabase.from(TABLE).update(metricsToRow(metrics)).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePublicacao(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
