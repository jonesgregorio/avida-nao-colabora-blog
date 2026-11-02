-- ============================================================================
-- 062 — Campos editoriais/SEO em articles
-- ============================================================================
-- Complementa o editor editorial (Fase 3): palavra-chave, tags, emoção/dor,
-- etapa da jornada, intenção, público, imagem Open Graph, origem (IA/manual)
-- e rastreio da geração por IA (modelo + prompt) + notas internas.
-- Todos opcionais, sem quebrar artigos existentes.
-- ============================================================================

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS keyword            text,
  ADD COLUMN IF NOT EXISTS secondary_keywords text,   -- separadas por vírgula
  ADD COLUMN IF NOT EXISTS tags               text,   -- separadas por vírgula
  ADD COLUMN IF NOT EXISTS emotion            text,   -- emoção/dor principal
  ADD COLUMN IF NOT EXISTS journey_stage      text,   -- descoberta/consideração/decisão
  ADD COLUMN IF NOT EXISTS intent             text,   -- intenção do conteúdo
  ADD COLUMN IF NOT EXISTS audience           text,   -- público-alvo
  ADD COLUMN IF NOT EXISTS og_image           text,   -- imagem Open Graph
  ADD COLUMN IF NOT EXISTS origin             text DEFAULT 'manual', -- ia | manual
  ADD COLUMN IF NOT EXISTS ai_model           text,   -- modelo de IA usado
  ADD COLUMN IF NOT EXISTS ai_prompt          text,   -- prompt usado
  ADD COLUMN IF NOT EXISTS internal_notes     text;   -- observações internas

-- Backfill de origem para artigos já existentes.
UPDATE articles SET origin = 'manual' WHERE origin IS NULL;

-- Força o reload do cache de schema do PostgREST (senão INSERT/PATCH com os
-- campos novos dá PGRST204 até o cache atualizar). DDL real dispara o watch.
COMMENT ON COLUMN articles.keyword IS 'Palavra-chave principal (062)';
COMMENT ON COLUMN articles.origin IS 'Origem do conteúdo: manual | ia (062)';
