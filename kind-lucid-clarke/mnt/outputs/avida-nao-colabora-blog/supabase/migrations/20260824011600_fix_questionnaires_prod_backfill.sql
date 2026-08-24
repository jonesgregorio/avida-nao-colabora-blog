-- Correção da migration 20260823220000_fix_questionnaires_missing_columns.sql.
-- Em produção, questionnaires já possui `active` e `published_at`, mas não
-- possui a coluna legada `is_active`. A migration anterior tentou ler
-- `is_active` no backfill e falhou. Não alteramos a migration histórica:
-- este arquivo aplica somente o estado final desejado de forma idempotente.

ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

UPDATE questionnaires
SET published_at = created_at
WHERE status = 'published'
  AND published_at IS NULL;

UPDATE questionnaires
SET active = true
WHERE active IS NULL;
