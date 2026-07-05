import { supabase } from './supabase'

// Histórico de leitura / progresso de trilhas.
// Uma linha por (user, artigo). Idempotente: relê não duplica nem altera a
// data do primeiro acesso. Nunca interrompe a navegação (fire-and-forget).
export async function markArticleRead(userId?: string | null, articleSlug?: string | null): Promise<void> {
  if (!userId || !articleSlug) return
  try {
    await supabase
      .from('reading_history')
      .upsert(
        { user_id: userId, article_slug: articleSlug },
        { onConflict: 'user_id,article_slug', ignoreDuplicates: true },
      )
  } catch {
    /* leitura nunca deve falhar por causa do histórico */
  }
}

// Conjunto de slugs já lidos pelo usuário (para marcar progresso na UI).
export async function fetchReadSlugs(userId?: string | null): Promise<Set<string>> {
  if (!userId) return new Set()
  try {
    const { data } = await supabase
      .from('reading_history')
      .select('article_slug')
      .eq('user_id', userId)
    return new Set((data ?? []).map((r: { article_slug: string }) => r.article_slug))
  } catch {
    return new Set()
  }
}
