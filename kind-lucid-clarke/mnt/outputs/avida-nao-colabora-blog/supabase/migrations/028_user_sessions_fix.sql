-- ─── Migration 028: Corrigir tabela user_sessions ───────────────────────────

-- Adicionar colunas ausentes
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS preferred_slots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_notes TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Renomear coluna notes para admin_notes se ainda não foi feito
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'notes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE user_sessions RENAME COLUMN notes TO admin_notes;
  END IF;
END $$;

-- Adicionar UNIQUE(user_id, month_key) se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_sessions_user_id_month_key_key'
      AND conrelid = 'user_sessions'::regclass
  ) THEN
    ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_user_id_month_key_key UNIQUE (user_id, month_key);
  END IF;
END $$;

-- Adicionar CHECK de status
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_status_check;
ALTER TABLE user_sessions
  ADD CONSTRAINT user_sessions_status_check
  CHECK (status IN ('available','requested','scheduled','completed','rescheduled','cancelled','used'));

-- ─── RLS: Políticas para usuário comum ────────────────────────────────────────

-- Usuário pode inserir sua própria sessão
DROP POLICY IF EXISTS "users_insert_own_sessions" ON user_sessions;
CREATE POLICY "users_insert_own_sessions" ON user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuário pode atualizar apenas preferred_slots e user_notes (status = requested)
DROP POLICY IF EXISTS "users_update_own_sessions" ON user_sessions;
CREATE POLICY "users_update_own_sessions" ON user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('available', 'requested'))
  WITH CHECK (auth.uid() = user_id);

-- Garantir que SELECT policy existe
DROP POLICY IF EXISTS "users_view_own_sessions" ON user_sessions;
CREATE POLICY "users_view_own_sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin mantém acesso total (DROP e recria para garantir)
DROP POLICY IF EXISTS "admins_manage_sessions" ON user_sessions;
CREATE POLICY "admins_manage_sessions" ON user_sessions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ─── Garantir coluna action_view e action_label em notifications ─────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_view TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_label TEXT;
