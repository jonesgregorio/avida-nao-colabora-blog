-- Migration 115: Índice em diary_entries(user_id, created_at)
-- diary_entries é a tabela mais consultada do app (diário, evolução, trigger
-- de limite mensal, RPC de engajamento, cron de e-mails de ciclo de vida) e
-- não tinha nenhum índice além da PK — todas essas consultas faziam scan
-- sequencial.

CREATE INDEX IF NOT EXISTS idx_diary_entries_user_created
  ON diary_entries (user_id, created_at DESC);
