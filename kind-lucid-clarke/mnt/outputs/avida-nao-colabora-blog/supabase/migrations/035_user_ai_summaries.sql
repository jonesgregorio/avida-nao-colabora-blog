-- ============================================================
-- Migration 035: Tabela user_ai_summaries
-- ============================================================
-- Armazena resumos de perfil gerados por IA para cada usuário.
-- Referenciada em AdminUsers.tsx mas sem migration prévia.

CREATE TABLE IF NOT EXISTS user_ai_summaries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary_type   TEXT DEFAULT 'profile_summary',
  summary        TEXT NOT NULL,
  data_snapshot  JSONB DEFAULT '{}'::jsonb,
  provider       TEXT,
  status         TEXT DEFAULT 'generated',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_ai_summaries_status_check CHECK (status IN ('generated', 'saved', 'archived', 'error')),
  CONSTRAINT user_ai_summaries_type_check CHECK (summary_type IN (
    'profile_summary', 'self_care_plan', 'admin_note',
    'personalization_summary'
  ))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_ai_summaries_user_id ON user_ai_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_summaries_status  ON user_ai_summaries(status);

-- RLS
ALTER TABLE user_ai_summaries ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
DROP POLICY IF EXISTS "admin_all_ai_summaries" ON user_ai_summaries;
CREATE POLICY "admin_all_ai_summaries" ON user_ai_summaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

-- Usuário comum não acessa sumários administrativos (sem policy de SELECT para usuário)
