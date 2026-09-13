-- ============================================================================
-- Conteúdos Guiados: player por etapas (objetivo, intensidade, etapas,
-- iniciar/pausar/retomar/concluir, reflexão final).
--
-- Estritamente aditivo: nenhuma coluna existente é alterada ou removida.
-- Um artigo sem linhas em guided_content_steps continua sendo lido exatamente
-- como hoje (o frontend só troca pro player quando existem etapas cadastradas).
-- O corpo do artigo (articles.content) permanece a fonte de verdade e a mesma
-- proteção por plano (RLS de 044/058/060/20260817190000) não muda em nada.
-- ============================================================================

-- 1. Metadados novos no artigo — objetivo curto e intensidade da prática.
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS intensity TEXT;
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_intensity_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_intensity_check
  CHECK (intensity IS NULL OR intensity IN ('leve', 'moderada', 'intensa'));
COMMENT ON COLUMN public.articles.objective IS 'Objetivo curto da prática guiada (player por etapas).';
COMMENT ON COLUMN public.articles.intensity IS 'leve/moderada/intensa — só usado quando o conteúdo tem etapas.';

-- 2. Etapas de um conteúdo guiado. A ordem é feita por step_order; o corpo de
--    cada etapa é curto (instrução prática), nunca o texto completo do artigo.
CREATE TABLE IF NOT EXISTS public.guided_content_steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id       UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  step_order       INTEGER NOT NULL,
  title            TEXT NOT NULL,
  instruction      TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_guided_content_steps_article ON public.guided_content_steps(article_id, step_order);

ALTER TABLE public.guided_content_steps ENABLE ROW LEVEL SECURITY;

-- Leitura de etapas segue exatamente a mesma regra de acesso do corpo do artigo
-- (mesmo plan_required, mesmo status published/scheduled) — nunca mais permissivo
-- do que ler o artigo em si.
DROP POLICY IF EXISTS "guided_steps_read" ON public.guided_content_steps;
CREATE POLICY "guided_steps_read" ON public.guided_content_steps
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.articles a
    WHERE a.id = guided_content_steps.article_id
      AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= now()))
      AND public.current_user_has_plan(COALESCE(a.plan_required, 'free'))
  )
);

DROP POLICY IF EXISTS "guided_steps_admin" ON public.guided_content_steps;
CREATE POLICY "guided_steps_admin" ON public.guided_content_steps
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3. Progresso de cada pessoa em cada conteúdo guiado — dado próprio, nunca
--    visível a outro usuário. Admin só LÊ (analytics), nunca escreve por outrem.
CREATE TABLE IF NOT EXISTS public.guided_content_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id         UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'not_started',
  current_step_order INTEGER NOT NULL DEFAULT 0,
  reflection_text    TEXT,
  started_at         TIMESTAMPTZ,
  paused_at          TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);
ALTER TABLE public.guided_content_progress DROP CONSTRAINT IF EXISTS guided_content_progress_status_check;
ALTER TABLE public.guided_content_progress ADD CONSTRAINT guided_content_progress_status_check
  CHECK (status IN ('not_started', 'in_progress', 'paused', 'completed'));
CREATE INDEX IF NOT EXISTS idx_guided_content_progress_user ON public.guided_content_progress(user_id, article_id);

ALTER TABLE public.guided_content_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guided_progress_own" ON public.guided_content_progress;
CREATE POLICY "guided_progress_own" ON public.guided_content_progress
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "guided_progress_admin_read" ON public.guided_content_progress;
CREATE POLICY "guided_progress_admin_read" ON public.guided_content_progress
FOR SELECT TO authenticated
USING (public.is_admin());

-- 4. Catálogo público (get_guided_catalog, 086) passa a expor objetivo,
--    intensidade e se o conteúdo tem etapas — sem expor o corpo das etapas.
CREATE OR REPLACE FUNCTION public.get_guided_catalog()
RETURNS TABLE (
  id UUID, title TEXT, slug TEXT, summary TEXT, excerpt TEXT, category TEXT,
  tags TEXT[], keywords TEXT[], emotional_themes TEXT[],
  plan_required TEXT, content_type TEXT,
  estimated_time_minutes INTEGER, read_time INTEGER,
  image_url TEXT, is_recommendable BOOLEAN, published_at TIMESTAMPTZ,
  objective TEXT, intensity TEXT, has_steps BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id, a.title, a.slug, a.summary, a.excerpt, a.category,
    a.tags, a.keywords, a.emotional_themes,
    a.plan_required, a.content_type,
    a.estimated_time_minutes, a.read_time,
    COALESCE(a.image_url, a.cover_image_url, a.cover_image),
    a.is_recommendable, a.published_at,
    a.objective, a.intensity,
    EXISTS (SELECT 1 FROM public.guided_content_steps s WHERE s.article_id = a.id)
  FROM articles a
  WHERE a.is_guided_content = true
    AND (a.status = 'published'
         OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= now()))
  ORDER BY a.published_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_guided_catalog() TO anon, authenticated;
