-- ============================================================
-- Migration 003: Garante coluna articles.status antes de migration 013 usá-la
-- Esta migration preenche o gap 001→013 para instalações limpas.
-- Em bancos existentes é no-op graças a IF NOT EXISTS.
-- ============================================================

ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
