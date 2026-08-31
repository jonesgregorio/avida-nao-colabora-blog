import { supabase } from './supabase'
import type { BlogContext, CategoryCoverage } from './estudioPlan'

// I/O do contexto do blog para o planejamento da semana (Fase 2b):
// quais temas estão sendo lidos e quais estão há tempo sem post.
// Só leitura, só agregado — nada de dados de usuário nem do Diário.

export type { BlogContext, CategoryCoverage } from './estudioPlan'

interface ArticleRow {
  slug: string | null
  category: string | null
  status: string | null
  published_at: string | null
  created_at: string | null
}

const DAY = 86_400_000

export async function fetchBlogContext(): Promise<BlogContext> {
  const [catRes, artRes, viewRes] = await Promise.all([
    supabase.from('categories').select('name, is_active').eq('is_active', true),
    supabase.from('articles').select('slug, category, status, published_at, created_at').limit(2000),
    supabase.from('analytics_events').select('entity_id').eq('event', 'article_view').limit(50_000),
  ])

  const categorias = ((catRes.data as { name: string }[]) ?? []).map(c => c.name)
  const artigos = ((artRes.data as ArticleRow[]) ?? []).filter(a => (a.status ?? 'published') === 'published')

  const viewsPorSlug = new Map<string, number>()
  for (const r of (viewRes.data as { entity_id: string | null }[]) ?? []) {
    if (r.entity_id) viewsPorSlug.set(r.entity_id, (viewsPorSlug.get(r.entity_id) ?? 0) + 1)
  }

  const now = Date.now()
  const porCategoria = new Map<string, CategoryCoverage>()
  const ensure = (cat: string) =>
    porCategoria.get(cat) ??
    porCategoria.set(cat, { categoria: cat, artigos: 0, views: 0, ultimoPost: null, diasSemPost: null }).get(cat)!

  for (const cat of categorias) ensure(cat)

  for (const a of artigos) {
    const cat = a.category?.trim()
    if (!cat) continue
    const c = ensure(cat)
    c.artigos += 1
    c.views += viewsPorSlug.get(a.slug ?? '') ?? 0
    const dt = a.published_at ?? a.created_at
    if (dt && (!c.ultimoPost || dt > c.ultimoPost)) c.ultimoPost = dt
  }

  for (const c of porCategoria.values()) {
    c.diasSemPost = c.ultimoPost ? Math.floor((now - new Date(c.ultimoPost).getTime()) / DAY) : null
  }

  const cobertura = [...porCategoria.values()].sort((a, b) => b.views - a.views)
  return { cobertura, geradoEm: new Date().toISOString() }
}
