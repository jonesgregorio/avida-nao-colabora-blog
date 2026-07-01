-- Migration 026: Histórico de geração de conteúdo por IA

CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT       NOT NULL,
  prompt_preview TEXT,
  result_preview TEXT,
  provider    TEXT        NOT NULL DEFAULT 'pollinations',
  status      TEXT        NOT NULL DEFAULT 'success',
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Somente admins podem ver e inserir
ALTER TABLE ai_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_ai_logs"
  ON ai_generation_logs
  USING (is_admin())
  WITH CHECK (is_admin());

-- Índice para consultas por tipo e data
CREATE INDEX IF NOT EXISTS idx_ai_logs_content_type ON ai_generation_logs (content_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at   ON ai_generation_logs (created_at DESC);
