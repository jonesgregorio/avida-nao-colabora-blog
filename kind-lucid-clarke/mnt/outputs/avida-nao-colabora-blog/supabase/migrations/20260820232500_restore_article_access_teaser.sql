-- Go-live: restaura o teaser seguro usado pelo ArticleView quando o RLS
-- bloqueia o corpo de um artigo por autenticação/plano.
--
-- Sem esta RPC, um artigo existente de nível account/essential/plus pode ser
-- confundido com 404 no frontend. A função devolve somente metadados de
-- paywall e nunca o conteúdo completo.
--
-- Modelo atual de acesso dos artigos:
--   free      -> público
--   account   -> qualquer usuário autenticado
--   essential -> Essencial ou Plus ativos
--   plus      -> Plus ativo

CREATE OR REPLACE FUNCTION public.get_article_teaser(p_slug text)
RETURNS TABLE (
  title text,
  summary text,
  excerpt text,
  category text,
  plan_required text,
  image_url text,
  read_time int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.title,
    a.summary,
    a.excerpt,
    a.category,
    a.plan_required,
    COALESCE(a.image_url, a.cover_image_url, a.cover_image),
    a.read_time
  FROM public.articles a
  WHERE a.slug = p_slug
    AND (
      a.status = 'published'
      OR (
        a.status = 'scheduled'
        AND a.scheduled_at IS NOT NULL
        AND a.scheduled_at <= now()
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_article_teaser(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_article_teaser(text) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_article_teaser'
      AND p.pronargs = 1
  ) THEN
    RAISE EXCEPTION 'get_article_teaser(text) was not created';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_article_teaser('__definitely_not_a_real_article_slug__')
  ) THEN
    RAISE EXCEPTION 'article teaser must not invent rows';
  END IF;
END;
$$;
