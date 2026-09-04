import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8')

const sql = read('supabase/migrations/20260903120000_site_content_cms.sql')
const lib = read('src/lib/siteContent.ts')
const admin = read('src/components/admin/AdminSiteContent.tsx')
const comunicacao = read('src/components/admin/AdminAreaComunicacao.tsx')

test('migration cria as tabelas do CMS e a de revisões', () => {
  for (const t of ['site_pages', 'site_snippets', 'faq_items', 'site_content_revisions']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${t}\\b`, 'i'))
    assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security`, 'i'))
  }
})

test('leitura pública do conteúdo, escrita só admin (is_admin)', () => {
  assert.match(sql, /create policy site_pages_read on public\.site_pages\s+for select to anon, authenticated/i)
  assert.match(sql, /faq_items_read[\s\S]*using \(is_active or public\.is_admin\(\)\)/i)
  // as 3 tabelas de conteúdo + revisões têm policy de escrita amarrada a is_admin()
  assert.ok([...sql.matchAll(/using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/gi)].length >= 4)
  assert.match(sql, /revoke all on public\.site_content_revisions from anon/i)
})

test('trigger versiona a linha anterior sem referência de coluna cruzada', () => {
  assert.match(sql, /create or replace function public\.site_content_snapshot\(\)/i)
  assert.match(sql, /to_jsonb\(old\) ->> 'slug'/i)
  assert.match(sql, /if tg_op = 'UPDATE' then/i)
  assert.match(sql, /insert into public\.site_content_revisions/i)
  for (const t of ['site_pages', 'site_snippets', 'faq_items']) {
    assert.match(sql, new RegExp(`create trigger trg_${t}_snapshot before insert or update on public\\.${t}`, 'i'))
  }
})

test('migration semeia o texto atual do Hero, das páginas e da FAQ', () => {
  assert.match(sql, /insert into public\.site_snippets[\s\S]*hero_title/i)
  assert.match(sql, /insert into public\.site_pages[\s\S]*'sobre'[\s\S]*'termos'[\s\S]*'privacidade'[\s\S]*'aviso-responsabilidade'/i)
  assert.match(sql, /insert into public\.faq_items[\s\S]*Como crio minha conta\?/i)
  // dollar-quoting balanceado
  assert.equal((sql.match(/\$md\$/g) ?? []).length % 2, 0)
})

test('o front trata o banco como override e nunca lança em falha', () => {
  assert.match(lib, /export function useSiteSnippet\(key: string, fallback: string\): string/)
  assert.match(lib, /export function useSitePage\(slug: string\): SitePage \| null/)
  assert.match(lib, /export function useFaqItems\(\): FaqItem\[\] \| null/)
  assert.match(lib, /catch \{\s*return empty\s*\}/)
  assert.match(lib, /export async function refreshSiteContent/)
})

test('páginas públicas usam o CMS com fallback para o texto embutido', () => {
  for (const [file, slug] of [
    ['src/components/AboutPage.tsx', 'sobre'],
    ['src/components/TermsPage.tsx', 'termos'],
    ['src/components/PrivacyPage.tsx', 'privacidade'],
    ['src/components/ResponsibilityPage.tsx', 'aviso-responsabilidade'],
  ] as const) {
    const src = read(file)
    assert.match(src, new RegExp(`useSitePage\\('${slug}'\\)`))
    assert.match(src, /if \(cms\) return <CmsPage/)
  }
  const hero = read('src/components/Hero.tsx')
  assert.match(hero, /useSiteSnippet\('hero_title'/)
  const faq = read('src/components/FAQPage.tsx')
  assert.match(faq, /const dbFaqs = useFaqItems\(\)/)
  assert.match(faq, /: FAQS/)
})

test('o editor está no admin (aba de Comunicação) e recarrega o cache ao salvar', () => {
  assert.match(admin, /export default function AdminSiteContent/)
  assert.match(admin, /refreshSiteContent\(\)/)
  assert.match(admin, /Histórico de versões/)
  assert.match(admin, /restaurar/i)
  assert.match(comunicacao, /import AdminSiteContent/)
  assert.match(comunicacao, /id: 'site'/)
  assert.match(comunicacao, /tab === 'site'\s*&& <div[\s\S]*<AdminSiteContent \/>/)
})
