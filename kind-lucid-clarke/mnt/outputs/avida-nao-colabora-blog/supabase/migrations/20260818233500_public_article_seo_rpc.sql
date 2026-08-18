-- P0 SEO: expose somente metadados publicos de artigos publicados.
-- As funcoes sao SECURITY DEFINER para que o HTML server-side e o sitemap
-- funcionem mesmo quando o corpo do artigo estiver protegido por plano/RLS.
-- Nenhum conteudo sensivel, ai_prompt, internal_notes ou corpo do artigo e exposto.

create or replace function public.get_public_article_seo(p_slug text)
returns table (
  slug text,
  title text,
  seo_title text,
  seo_description text,
  summary text,
  excerpt text,
  category text,
  og_image text,
  image_url text,
  cover_image_url text,
  cover_image text,
  image_alt text,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    a.slug,
    a.title,
    a.seo_title,
    a.seo_description,
    a.summary,
    a.excerpt,
    a.category,
    a.og_image,
    a.image_url,
    a.cover_image_url,
    a.cover_image,
    a.image_alt,
    coalesce(a.published_at, a.created_at) as published_at,
    coalesce(a.updated_at, a.published_at, a.created_at) as updated_at
  from public.articles a
  where a.slug = p_slug
    and a.published = true
  limit 1;
$function$;

create or replace function public.list_public_article_sitemap()
returns table (
  slug text,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    a.slug,
    coalesce(a.published_at, a.created_at) as published_at,
    coalesce(a.updated_at, a.published_at, a.created_at) as updated_at
  from public.articles a
  where a.published = true
    and nullif(trim(a.slug), '') is not null
  order by coalesce(a.updated_at, a.published_at, a.created_at) desc;
$function$;

revoke all on function public.get_public_article_seo(text) from public;
revoke all on function public.list_public_article_sitemap() from public;
grant execute on function public.get_public_article_seo(text) to anon, authenticated;
grant execute on function public.list_public_article_sitemap() to anon, authenticated;

comment on function public.get_public_article_seo(text) is
'Public, non-sensitive metadata for server-rendered article SEO. Never returns article body or internal fields.';

comment on function public.list_public_article_sitemap() is
'Published article slugs and timestamps for the dynamic public sitemap.';
