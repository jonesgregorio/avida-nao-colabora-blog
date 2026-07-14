-- ============================================================================
-- 089 — Estrutura de notificações: colunas de destino/recurso + auditoria
-- ============================================================================
-- Padroniza a tabela `notifications` com destino explícito e referência ao
-- recurso, e cria uma tabela de auditoria de entrega (in-app/e-mail) para não
-- deixar falhas silenciosas.
--
-- Mantém `action_url` (token de navegação já usado pelo App) e espelha em
-- `destination_path`. Nada aqui quebra dados antigos.
-- ============================================================================

-- 1) Colunas novas em notifications -----------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS destination_path     TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_resource_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_resource_id   UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority             TEXT DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at        TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_status         TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by           UUID;

-- Backfill: destino a partir do token de navegação já existente.
UPDATE notifications SET destination_path = action_url
  WHERE destination_path IS NULL AND action_url IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_priority_check') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_priority_check
      CHECK (priority IN ('low', 'normal', 'high'));
  END IF;
END $$;

-- 2) Auditoria de entrega ----------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id  UUID,
  user_id          UUID,
  channel          TEXT NOT NULL DEFAULT 'in_app',
  status           TEXT NOT NULL DEFAULT 'sent',
  error_message    TEXT,
  destination_path TEXT,
  email_to         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ndl_channel_check') THEN
    ALTER TABLE notification_delivery_logs ADD CONSTRAINT ndl_channel_check
      CHECK (channel IN ('in_app', 'email'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ndl_status_check') THEN
    ALTER TABLE notification_delivery_logs ADD CONSTRAINT ndl_status_check
      CHECK (status IN ('pending', 'sent', 'failed', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ndl_user_created ON notification_delivery_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndl_status ON notification_delivery_logs(status);

ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Usuário vê os próprios; admin vê tudo. Inserção por admin (cria p/ outro) ou
-- pelo próprio usuário. Nunca expõe log de terceiros.
DROP POLICY IF EXISTS "ndl_select" ON notification_delivery_logs;
CREATE POLICY "ndl_select" ON notification_delivery_logs
  FOR SELECT USING (is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "ndl_insert" ON notification_delivery_logs;
CREATE POLICY "ndl_insert" ON notification_delivery_logs
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() = user_id);

COMMENT ON TABLE notification_delivery_logs IS 'Auditoria de entrega de notificações in-app/e-mail (089)';
