-- ============================================================================
-- 086 — Conteúdos Guiados: metadados de recomendação + histórico + catálogo
-- ============================================================================
-- Dá ao motor de recomendação sinais reais para casar registros do usuário
-- (diário, check-in, questionário, perfil emocional) com conteúdos JÁ existentes.
--
-- Nada aqui inventa conteúdo, e o paywall por plano continua nas policies de
-- articles (044/060) — este arquivo só ADICIONA metadados e um catálogo seguro
-- (sem corpo) para montar a vitrine de conteúdos bloqueados.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Metadados de recomendação em articles
--    (content_type já existe desde a 059)
-- ─────────────────────────────────────────────────────────────
-- tags/keywords/emotional_themes precisam ser TEXT[] (o motor casa por arrays e
-- os índices GIN exigem tipo array). Se a coluna já existir como TEXT escalar
-- (legado do editor/SEO), converte "a, b" → ARRAY['a','b'] sem perder dados.
DO $conv$
DECLARE
  col text;
  dt  text;
BEGIN
  FOREACH col IN ARRAY ARRAY['tags','keywords','emotional_themes'] LOOP
    SELECT data_type INTO dt FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'articles' AND column_name = col;
    IF dt IS NULL THEN
      EXECUTE format('ALTER TABLE articles ADD COLUMN %I TEXT[] DEFAULT ''{}''', col);
    ELSIF dt <> 'ARRAY' THEN
      EXECUTE format('ALTER TABLE articles ALTER COLUMN %I DROP DEFAULT', col);
      EXECUTE format(
        'ALTER TABLE articles ALTER COLUMN %1$I TYPE TEXT[] USING '
        || 'CASE WHEN %1$I IS NULL OR btrim(%1$I) = '''' THEN ''{}''::text[] '
        || 'ELSE string_to_array(regexp_replace(%1$I, ''\s*,\s*'', '','', ''g''), '','') END',
        col);
      EXECUTE format('ALTER TABLE articles ALTER COLUMN %I SET DEFAULT ''{}''', col);
    END IF;
  END LOOP;
END $conv$;

ALTER TABLE articles ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_guided_content     BOOLEAN DEFAULT true;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_recommendable      BOOLEAN DEFAULT true;

-- Backfill defensivo (linhas antigas entram no catálogo de conteúdos guiados).
UPDATE articles SET is_guided_content = true  WHERE is_guided_content IS NULL;
UPDATE articles SET is_recommendable  = true  WHERE is_recommendable  IS NULL;
UPDATE articles SET tags             = '{}'   WHERE tags             IS NULL;
UPDATE articles SET keywords         = '{}'   WHERE keywords         IS NULL;
UPDATE articles SET emotional_themes = '{}'   WHERE emotional_themes IS NULL;

-- Backfill de temas emocionais a partir da CATEGORIA existente (não inventa
-- conteúdo; apenas deriva um tema do que já está cadastrado). Só preenche onde
-- ainda está vazio, para o admin poder sobrescrever depois.
UPDATE articles SET emotional_themes = ARRAY['ansiedade']
  WHERE cardinality(emotional_themes) = 0 AND lower(coalesce(category,'')) LIKE '%ansiedad%';
UPDATE articles SET emotional_themes = ARRAY['cansaco','sobrecarga']
  WHERE cardinality(emotional_themes) = 0 AND lower(coalesce(category,'')) LIKE '%cansa%';
UPDATE articles SET emotional_themes = ARRAY['autoestima','autocobranca']
  WHERE cardinality(emotional_themes) = 0 AND lower(coalesce(category,'')) LIKE '%autoestim%';
UPDATE articles SET emotional_themes = ARRAY['sono','rotina']
  WHERE cardinality(emotional_themes) = 0 AND (lower(coalesce(category,'')) LIKE '%sono%' OR lower(coalesce(category,'')) LIKE '%descanso%');
UPDATE articles SET emotional_themes = ARRAY['sobrecarga','limites']
  WHERE cardinality(emotional_themes) = 0 AND (lower(coalesce(category,'')) LIKE '%limit%' OR lower(coalesce(category,'')) LIKE '%rela%');
UPDATE articles SET emotional_themes = ARRAY['rotina']
  WHERE cardinality(emotional_themes) = 0 AND lower(coalesce(category,'')) LIKE '%rotina%';
UPDATE articles SET emotional_themes = ARRAY['tristeza']
  WHERE cardinality(emotional_themes) = 0 AND lower(coalesce(category,'')) LIKE '%pensament%';
UPDATE articles SET emotional_themes = ARRAY['autocuidado']
  WHERE cardinality(emotional_themes) = 0 AND lower(coalesce(category,'')) LIKE '%autocuid%';

-- Índices GIN para futuras buscas por metadados (a pontuação hoje é em JS).
CREATE INDEX IF NOT EXISTS idx_articles_tags             ON articles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_articles_keywords         ON articles USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_articles_emotional_themes ON articles USING GIN (emotional_themes);
CREATE INDEX IF NOT EXISTS idx_articles_is_recommendable ON articles(is_recommendable);

COMMENT ON COLUMN articles.tags IS 'Tags temáticas do conteúdo guiado (086)';
COMMENT ON COLUMN articles.keywords IS 'Palavras-chave para casar com o que o usuário escreve (086)';
COMMENT ON COLUMN articles.emotional_themes IS 'Temas emocionais: ansiedade, sobrecarga, cansaco... (086)';

-- ─────────────────────────────────────────────────────────────
-- 2. Histórico de recomendações (dedupe + analytics futuro)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id       UUID REFERENCES articles(id) ON DELETE CASCADE,
  content_slug     TEXT,
  source           TEXT NOT NULL DEFAULT 'guided_page',
  source_id        UUID,
  score            INTEGER,
  matched_tags     TEXT[] DEFAULT '{}',
  matched_keywords TEXT[] DEFAULT '{}',
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'shown',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_recommendations_source_check') THEN
    ALTER TABLE content_recommendations ADD CONSTRAINT content_recommendations_source_check
      CHECK (source IN ('guided_page','checkin','diary','questionnaire','map','weekly_report','monthly_report','care_plan'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_recommendations_status_check') THEN
    ALTER TABLE content_recommendations ADD CONSTRAINT content_recommendations_status_check
      CHECK (status IN ('shown','clicked','dismissed','completed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_rec_user_created ON content_recommendations(user_id, created_at DESC);

ALTER TABLE content_recommendations ENABLE ROW LEVEL SECURITY;

-- Usuário só enxerga/gera as PRÓPRIAS recomendações (nunca as de outro usuário).
DROP POLICY IF EXISTS "content_rec_own_select" ON content_recommendations;
CREATE POLICY "content_rec_own_select" ON content_recommendations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "content_rec_own_insert" ON content_recommendations;
CREATE POLICY "content_rec_own_insert" ON content_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "content_rec_own_update" ON content_recommendations;
CREATE POLICY "content_rec_own_update" ON content_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "content_rec_admin" ON content_recommendations;
CREATE POLICY "content_rec_admin" ON content_recommendations
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. Catálogo seguro de conteúdos guiados (SEM corpo)
--    Permite montar a "vitrine" de conteúdos bloqueados (título/resumo/plano)
--    sem jamais expor o texto pago. O corpo continua protegido pelo RLS.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_guided_catalog()
RETURNS TABLE (
  id UUID, title TEXT, slug TEXT, summary TEXT, excerpt TEXT, category TEXT,
  tags TEXT[], keywords TEXT[], emotional_themes TEXT[],
  plan_required TEXT, content_type TEXT,
  estimated_time_minutes INTEGER, read_time INTEGER,
  image_url TEXT, is_recommendable BOOLEAN, published_at TIMESTAMPTZ
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
    a.is_recommendable, a.published_at
  FROM articles a
  WHERE a.is_guided_content = true
    AND (a.status = 'published'
         OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= now()))
  ORDER BY a.published_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_guided_catalog() TO anon, authenticated;

-- Força reload do cache de schema do PostgREST (senão as novas colunas dão
-- PGRST204 no INSERT/UPDATE do editor até o cache atualizar).
COMMENT ON COLUMN articles.is_guided_content IS 'Aparece na biblioteca de Conteúdos Guiados (086)';
