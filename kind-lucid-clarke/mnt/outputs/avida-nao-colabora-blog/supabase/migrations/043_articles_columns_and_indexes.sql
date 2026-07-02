-- ============================================================
-- Migration 043: Garantir todas as colunas da tabela articles
--                e padronizar campo de imagem para image_url
-- ============================================================

-- 1. Adicionar colunas que podem não existir
ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary         TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url       TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_alt       TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image     TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_title       TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS diary_question  TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cta_text        TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cta_link        TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS plan_required   TEXT NOT NULL DEFAULT 'free';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS read_time       INTEGER DEFAULT 5;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author          TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at    TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS category        TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- 2. Garantir valores padrão seguros nas colunas já existentes
ALTER TABLE articles ALTER COLUMN status       SET DEFAULT 'published';
ALTER TABLE articles ALTER COLUMN plan_required SET DEFAULT 'free';
ALTER TABLE articles ALTER COLUMN read_time    SET DEFAULT 5;

-- 3. Constraints de valores permitidos (idempotente)
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles ADD CONSTRAINT articles_status_check
  CHECK (status IN ('published', 'draft', 'archived', 'scheduled'));

ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_plan_required_check;
ALTER TABLE articles ADD CONSTRAINT articles_plan_required_check
  CHECK (plan_required IN ('free', 'essential', 'therapeutic', 'therapeutic-plus'));

-- 4. Migrar artigos antigos: status NULL → published
UPDATE articles SET status = 'published' WHERE status IS NULL;

-- 5. Migrar published_at NULL → created_at para artigos publicados
UPDATE articles
SET published_at = created_at
WHERE published_at IS NULL
  AND status = 'published'
  AND created_at IS NOT NULL;

-- 6. Padronizar imagem: se image_url estiver vazio, preencher com cover_image_url ou cover_image
UPDATE articles
SET image_url = COALESCE(cover_image_url, cover_image)
WHERE (image_url IS NULL OR image_url = '')
  AND (cover_image_url IS NOT NULL OR cover_image IS NOT NULL);

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_articles_slug         ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status       ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category     ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_plan_required ON articles(plan_required);
