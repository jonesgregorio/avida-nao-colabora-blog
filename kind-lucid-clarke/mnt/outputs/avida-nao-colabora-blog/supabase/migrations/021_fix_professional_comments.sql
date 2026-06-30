-- Migration 021: Corrige tabela professional_comments para bater com o código

ALTER TABLE professional_comments
  ADD COLUMN IF NOT EXISTS comment_text TEXT,
  ADD COLUMN IF NOT EXISTS professional_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Migra dados existentes da coluna 'comment' para 'comment_text'
UPDATE professional_comments SET comment_text = comment WHERE comment_text IS NULL AND comment IS NOT NULL;

-- Torna comment_text NOT NULL com default vazio para novos registros
ALTER TABLE professional_comments ALTER COLUMN comment_text SET DEFAULT '';
