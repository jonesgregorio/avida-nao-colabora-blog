-- ============================================================
-- Migration 052: Observabilidade + polish pré-lançamento
--   A) email_logs.created_at — a UI admin ordena por created_at, mas a
--      coluna não existia (a tabela usa sent_at/updated_at); a query
--      falhava e a aba "E-mails transacionais" mostrava 0. Adiciona a
--      coluna + backfill. (A tabela e os logs JÁ EXISTEM — não recriar.)
--   C) rótulo da métrica pública "Usuárias" -> "Usuários".
-- Idempotente.
-- ============================================================

-- A) Coluna created_at nos logs de e-mail
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
UPDATE email_logs SET created_at = COALESCE(sent_at, updated_at, now()) WHERE created_at IS NULL;

-- C) Métrica pública "Usuárias" -> "Usuários" (contador; plural)
UPDATE site_metrics SET label = 'Usuários' WHERE label = 'Usuárias';
