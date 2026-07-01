-- ─── Migration 031: Corrigir status e adicionar colunas de rastreamento ────────

-- Adicionar 'resolved' ao constraint de status das tasks
ALTER TABLE user_personalization_tasks DROP CONSTRAINT IF EXISTS upt_status_check;
ALTER TABLE user_personalization_tasks ADD CONSTRAINT upt_status_check
CHECK (status IN ('pending','generated','draft','sent','resolved','overdue','expired','cancelled','not_applicable'));

-- Adicionar read_at para rastrear leitura pelo usuário
ALTER TABLE personalized_content_deliveries ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Adicionar task_id para ligar delivery à task
ALTER TABLE personalized_content_deliveries ADD COLUMN IF NOT EXISTS task_id UUID;

-- Recriar policy de leitura do usuário (garante que read_at pode ser atualizado)
DROP POLICY IF EXISTS "users_view_own_sent_content" ON personalized_content_deliveries;
CREATE POLICY "users_view_own_sent_content" ON personalized_content_deliveries
  FOR SELECT USING (auth.uid() = user_id AND status = 'sent');

DROP POLICY IF EXISTS "users_mark_read" ON personalized_content_deliveries;
CREATE POLICY "users_mark_read" ON personalized_content_deliveries
  FOR UPDATE USING (auth.uid() = user_id AND status = 'sent')
  WITH CHECK (auth.uid() = user_id);
