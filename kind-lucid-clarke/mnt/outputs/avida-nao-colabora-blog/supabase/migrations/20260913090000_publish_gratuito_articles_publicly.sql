-- Publicação editorial: "Gratuito" (com conta) passa a "Público" (sem conta)
-- exclusivamente para os artigos já publicados. Conteúdos Essencial e Plus
-- permanecem fechados. Rascunhos continuam fora de qualquer superfície pública.

UPDATE public.articles
SET
  plan_required = 'free',
  updated_at = now()
WHERE plan_required = 'account'
  AND published = true
  AND status = 'published';

-- A superfície SEO deve obedecer ao mesmo estado editorial da interface.
-- Um rascunho marcado por engano com published=true não pode entrar no sitemap,
-- no índice público nem no HTML de artigo rastreável.
CREATE OR REPLACE FUNCTION public.get_public_article_document(p_slug text)
RETURNS TABLE (
  slug text,
  title text,
  seo_title text,
  seo_description text,
  summary text,
  excerpt text,
  content text,
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
    a.slug, a.title, a.seo_title, a.seo_description, a.summary, a.excerpt,
    CASE WHEN COALESCE(a.plan_required, 'free') = 'free' THEN a.content ELSE NULL END,
    COALESCE(NULLIF(TRIM(a.author), ''), 'Equipe editorial A Vida Não Colabora'),
    a.category, COALESCE(a.plan_required, 'fre'), a.related_slugs,
    a.og_image, a.image_url, a.cover_image_url, a.cover_image, a.image_alt,
    a.reviewed_at, COALESCE(a.published_at, a.created_at),
    COALESCE(a.updated_at, a.published_at, a.now())
  FROM public.articles a
  WHERE a.slug = p_slug
    AND a.published = true
    AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at <= now()))
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.list_public_article_index()
RETURNS TABLE (slug text, title text, excerpt text, category text, published_at timestamptz, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
  SELECT
    a.slug, a.title,
    COALESCE(NULLIF(TRIM(a.summary), ''), NULLIF(TRIM(a.excerpt), ''), NULLIF(TRIM(a.seo_description), '')),
    a.category, COALESCE(a.published_at, a.created_at),
    COALESCE(a.updated_at, a.published_at, a.created_at)
  FROM public.articles a
  WHERE a.published = true
    AND COALESCE(a.plan_required, 'free') = 'free'
    AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at <= now()))
    AND NULLIF(TRIM(j.slug), '') IS NOT NULL
  ORDER BY COALESCE(a.updated_at, a.published_at, a.now()) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.list_public_article_sitemap()
RETURNS TABLE (slug text, published_at timestamptz, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
  SELECT
    a.slug, COALESCE(a.published_at, a.created_at),
    COALESCE(a.updated_at, a.published_at, a.created_at)
  FROM public.articles a
  WHERE a.published = true
    AND COALESCE(a.plan_required, 'free') = 'free'
    AND (a.status = 'published' OR (a.scheduled_at <= now()))
    AND NULLIF(TRIM(a.slug), '') IS NOT NULL
  ORDER BY COALESCE(a.updated_at, a.published_at, a.created_at) DESC;
$function$;

DO $$
DECLARE
  public_count integer;
BEGIN
  SELECT count(*) INTO public_count
  FROM public.articles
  WHERE plan_required = 'free' AND published = true AND status = 'published';

  IF public_count < 20 THEN
    RAISE EXCEPTION 'Expected at least 20 published public articles, found %', public_count;
  END IF;
END;
$$;
