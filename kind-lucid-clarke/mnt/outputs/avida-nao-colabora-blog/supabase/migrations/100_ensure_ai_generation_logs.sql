-- ============================================================================
-- 100 — Garante a tabela ai_generation_logs (histórico "Uso de IA")
-- ============================================================================
-- A tabela foi definida na migration 026, mas NÃO existe no banco de produção
-- (nunca aplicada / removida). Efeito: a Edge Function generate-content tenta
-- gravar cada geração nela e o insert falha em silêncio — por isso o histórico
-- de "Uso de IA" ficava vazio e a aba dava PGRST205 (tabela não encontrada).
-- Esta migration recria a tabela + RLS de forma idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type   TEXT        NOT NULL,
  prompt_preview TEXT,
  result_preview TEXT,
  provider       TEXT        NOT NULL DEFAULT 'gemini',
  status         TEXT        NOT NULL DEFAULT 'success',
  error_msg      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- Só admin lê/grava (a Edge Function grava via service role, que ignora RLS).
DROP POLICY IF EXISTS "admins_manage_ai_logs" ON ai_generation_logs;
CREATE POLICY "admins_manage_ai_logs" ON ai_generation_logs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_ai_logs_content_type ON ai_generation_logs (content_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at   ON ai_generation_logs (created_at DESC);

-- Recarrega o cache de schema do PostgREST para a tabela aparecer na API na hora.
NOTIFY pgrst, 'reload schema';
