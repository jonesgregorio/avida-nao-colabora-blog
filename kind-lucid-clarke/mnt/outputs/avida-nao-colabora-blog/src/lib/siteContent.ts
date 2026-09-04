import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Conteúdo institucional editável pelo Admin (tabelas site_pages / site_snippets
// / faq_items — migration 20260903120000).
//
// Regra de ouro: o banco é um OVERRIDE. Se a linha não existe, está vazia, ou o
// fetch falha, o componente cai no texto embutido no código (fallback). Assim o
// site nunca quebra por causa do CMS.
// ─────────────────────────────────────────────────────────────────────────────

export interface SitePage {
  slug: string
  title: string
  body_md: string
  updated_at: string
}
export interface FaqItem {
  id: string
  category: string
  question: string
  answer: string
  sort_order: number
  is_active: boolean
}

interface Loaded {
  pages: Record<string, SitePage>
  snippets: Record<string, string>
  faq: FaqItem[]
}

let cache: Loaded | null = null
let inflight: Promise<Loaded> | null = null
const subscribers = new Set<() => void>()

async function fetchAll(): Promise<Loaded> {
  const empty: Loaded = { pages: {}, snippets: {}, faq: [] }
  try {
    const [pagesRes, snipRes, faqRes] = await Promise.all([
      supabase.from('site_pages').select('slug,title,body_md,updated_at'),
      supabase.from('site_snippets').select('key,value'),
      supabase.from('faq_items').select('id,category,question,answer,sort_order,is_active').eq('is_active', true).order('sort_order'),
    ])
    const pages: Record<string, SitePage> = {}
    for (const p of pagesRes.data ?? []) pages[p.slug] = p as SitePage
    const snippets: Record<string, string> = {}
    for (const s of (snipRes.data ?? []) as { key: string; value: string }[]) snippets[s.key] = s.value
    const faq = (faqRes.data ?? []) as FaqItem[]
    return { pages, snippets, faq }
  } catch {
    return empty
  }
}

function ensureLoaded(): Promise<Loaded> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetchAll().then(result => {
      cache = result
      inflight = null
      subscribers.forEach(fn => fn())
      return result
    })
  }
  return inflight
}

/** Recarrega o cache (chamar depois de salvar no Admin). */
export async function refreshSiteContent(): Promise<void> {
  cache = await fetchAll()
  subscribers.forEach(fn => fn())
}

function useLoaded(): Loaded | null {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force(n => n + 1)
    subscribers.add(fn)
    void ensureLoaded()
    return () => { subscribers.delete(fn) }
  }, [])
  return cache
}

/** Texto curto (Hero/Home). Retorna sempre uma string — usa o fallback enquanto carrega ou se não houver valor. */
export function useSiteSnippet(key: string, fallback: string): string {
  const loaded = useLoaded()
  const v = loaded?.snippets[key]
  return v && v.trim() ? v : fallback
}

/** Página longa. `null` enquanto carrega OU quando não há corpo no banco — o componente deve renderizar o texto embutido nesse caso. */
export function useSitePage(slug: string): SitePage | null {
  const loaded = useLoaded()
  const page = loaded?.pages[slug]
  return page && page.body_md && page.body_md.trim() ? page : null
}

/** Lista de FAQ do banco, ou `null` para o componente usar a lista embutida. */
export function useFaqItems(): FaqItem[] | null {
  const loaded = useLoaded()
  if (!loaded) return null
  return loaded.faq.length ? loaded.faq : null
}
