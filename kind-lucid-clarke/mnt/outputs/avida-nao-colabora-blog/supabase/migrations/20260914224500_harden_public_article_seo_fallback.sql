-- Hardens the compatibility SEO fallback so publication state is consistent
-- across every public article surface, and exposes a dedicated safe fallback
-- contract that includes plan_required without ever returning article content.

CREATE OR REPLACE FUNCTION public.get_public_article_seo(p_slug text)
RETURNS TABLE(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
  SELECT
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
    COALESCE(a.published_at, a.created_at),
    COALESCE(a.updated_at, a.published_at, a.created_at)
  FROM public.articles a
  WHERE a.slug = p_slug
    AND a.published = true
    AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at <= now()))
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_article_seo_safe(p_slug text)
RETURNS TABLE(
  slug text,
  title text,
  seo_title text,
  seo_description text,
  summary text,
  excerpt text,
  author text,
  category text,
  plan_required text,
  related_slugs text[],
  og_image text,
  image_url text,
  cover_image_url text,
  cover_image text,
  image_alt text,
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
  SELECT
    a.slug,
    a.title,
    a.seo_title,
    a.seo_description,
    a.summary,
    a.excerpt,
    COALESCE(NULLIF(TRIM(a.author), ''), 'Equipe editorial A Vida Não Colabora'),
    a.category,
    COALESCE(a.plan_required, 'free'),
    a.related_slugs,
    a.og_image,
    a.image_url,
    a.cover_image_url,
    a.cover_image,
    a.image_alt,
    a.reviewed_at,
    COALESCE(a.published_at, a.created_at),
    COALESCE(a.updated_at, a.published_at, a.created_at)
  FROM public.articles a
  WHERE a.slug = p_slug
    AND a.published = true
    AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at <= now()))
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_article_seo_safe(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_article_seo_safe(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_article_seo(text) IS
'Legacy public article SEO metadata. Respects publication status and schedule; retained for compatibility.';

COMMENT ON FUNCTION public.get_public_article_seo_safe(text) IS
'Fail-safe public article SEO metadata including plan_required and editorial state enforcement; never returns article body.';
