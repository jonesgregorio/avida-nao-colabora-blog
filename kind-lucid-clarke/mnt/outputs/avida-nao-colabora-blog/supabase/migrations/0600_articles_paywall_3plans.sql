-- ============================================================================
-- 060 — Paywall de artigos alinhado ao modelo de 3 planos (free/essential/plus)
-- ============================================================================
-- A migration 044 endureceu o RLS, mas só conhecia os planos legados
-- (therapeutic/therapeutic-plus). No modelo novo:
--   • não havia policy para plan_required = 'plus';
--   • usuário plan='plus' não conseguia ler artigos 'essential';
--   • o CHECK proibia 'plus' (o editor quebraria ao salvar).
-- Esta migration corrige tudo isso, mantendo compatibilidade com planos legados.
-- ============================================================================

-- 1. Migrar artigos legados para o novo rótulo
UPDATE articles SET plan_required = 'plus'
  WHERE plan_required IN ('therapeutic', 'therapeutic-plus');
UPDATE articles SET plan_required = 'free' WHERE plan_required IS NULL;

-- 2. CHECK: apenas free/essential/plus
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_plan_required_check;
ALTER TABLE articles ADD CONSTRAINT articles_plan_required_check
  CHECK (plan_required IN ('free', 'essential', 'plus'));

-- 3. RLS: recriar policies no modelo de 3 planos
DROP POLICY IF EXISTS "articles_public_free"      ON articles;
DROP POLICY IF EXISTS "articles_essential"        ON articles;
DROP POLICY IF EXISTS "articles_therapeutic"      ON articles;
DROP POLICY IF EXISTS "articles_therapeutic_plus" ON articles;
-- "articles_admin_all" (044) permanece.

-- Visível = publicado, ou agendado já vencido.
CREATE POLICY "articles_public_free" ON articles
  FOR SELECT TO public
  USING (
    plan_required = 'free'
    AND (status = 'published'
         OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
  );

-- Essencial: liberado para essential e plus (e legados pagantes ativos).
CREATE POLICY "articles_essential" ON articles
  FOR SELECT TO authenticated
  USING (
    plan_required = 'essential'
    AND (status = 'published'
         OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.plan IN ('essential', 'plus', 'therapeutic', 'therapeutic-plus')
        AND (profiles.subscription_status IN ('active', 'trialing') OR profiles.unlimited_access = true)
    )
  );

-- Plus: liberado para plus (e legados pagantes ativos).
CREATE POLICY "articles_plus" ON articles
  FOR SELECT TO authenticated
  USING (
    plan_required = 'plus'
    AND (status = 'published'
         OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.plan IN ('plus', 'therapeutic', 'therapeutic-plus')
        AND (profiles.subscription_status IN ('active', 'trialing') OR profiles.unlimited_access = true)
    )
  );

-- 4. Teaser público para paywall: título/resumo/plano de artigos publicados,
--    SEM o conteúdo. Nunca expõe rascunho nem agendado futuro. Permite ao
--    ArticleView mostrar "conteúdo exclusivo → Ver planos" em vez de "não
--    encontrado" quando o usuário não tem acesso ao corpo do artigo.
CREATE OR REPLACE FUNCTION public.get_article_teaser(p_slug text)
RETURNS TABLE (
  title text, summary text, excerpt text, category text,
  plan_required text, image_url text, read_time int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.title, a.summary, a.excerpt, a.category, a.plan_required,
    COALESCE(a.image_url, a.cover_image_url, a.cover_image),
    a.read_time
  FROM articles a
  WHERE a.slug = p_slug
    AND (a.status = 'published'
         OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= now()))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_article_teaser(text) TO anon, authenticated;
