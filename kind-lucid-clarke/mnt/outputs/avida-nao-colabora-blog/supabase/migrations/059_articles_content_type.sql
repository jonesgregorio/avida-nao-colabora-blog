-- =============================================================================
-- 059 — content_type em articles (Artigos / Práticas / Meditações)
-- =============================================================================
-- Dá suporte às abas de "Conteúdos guiados" do admin (contrato: admin-mockup).
-- Tipos: 'article' (texto), 'practice' (prática guiada), 'meditation' (meditação).
-- Trilhas ficam em tabela própria; recomendações de IA em personalização.
-- =============================================================================

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'article';

-- Backfill defensivo (linhas antigas ficam como 'article').
UPDATE articles SET content_type = 'article' WHERE content_type IS NULL;

-- Trava os valores permitidos (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_content_type_check'
  ) THEN
    ALTER TABLE articles
      ADD CONSTRAINT articles_content_type_check
      CHECK (content_type IN ('article', 'practice', 'meditation'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type);
