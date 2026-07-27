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

export async function searchCoverImage(topic: string, category?: string, content?: string): Promise<CoverImage | null> {
  const base = (topic || '').trim()
  const body = (content || '').trim()
  // Precisa de ALGO para se basear — título OU conteúdo.
  if (!base && !body) return null

  // 1) Expressão de busca visual (IA), a partir do título e/ou do conteúdo.
  // Se falhar, usa o título (ou um termo acolhedor genérico) como busca.
  let query = base || 'calm wellness nature'
  try {
    const q = await generateCoverImageQuery(base, category, body)
    if (q && q.trim()) query = q.trim()
  } catch { /* usa o fallback acima */ }

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
