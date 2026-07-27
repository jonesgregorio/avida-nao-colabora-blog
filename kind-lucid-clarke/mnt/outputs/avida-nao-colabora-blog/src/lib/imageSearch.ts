import { supabase } from './supabase'
import { generateCoverImageQuery } from './aiContent'

// ─── Busca de capa relacionada ao tema (Pexels via Edge Function) ─────────────
// Orquestra: a IA gera uma expressão de busca visual em inglês (melhor
// relevância) e a Edge Function `image-search` (chave protegida) devolve a foto.
// Nunca lança: em falha, retorna null e o chamador mantém a capa atual.

export interface CoverImage {
  url: string
  alt: string
  credit?: string
}

export async function searchCoverImage(topic: string, category?: string): Promise<CoverImage | null> {
  const base = (topic || '').trim()
  if (!base) return null

  // 1) Expressão de busca visual (IA). Se falhar, usa o próprio título.
  let query = base
  try {
    const q = await generateCoverImageQuery(base, category)
    if (q && q.trim()) query = q.trim()
  } catch { /* usa o título como busca */ }

  // 2) Foto real via Pexels (Edge Function).
  try {
    const { data, error } = await supabase.functions.invoke('image-search', { body: { query } })
    const out = data as { url?: string; alt?: string; credit?: string; error?: string } | null
    if (error || !out?.url) return null
    return { url: out.url, alt: (out.alt || base).slice(0, 300), credit: out.credit }
  } catch {
    return null
  }
}
