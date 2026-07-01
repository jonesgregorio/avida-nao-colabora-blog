-- ─── Migration 030: Fila de pendências de personalização ────────────────────

CREATE TABLE IF NOT EXISTS user_personalization_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_key TEXT NOT NULL,
  task_key TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT,
  content_type TEXT NOT NULL,
  target_area TEXT,
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  related_report_id UUID,
  related_guidance_id UUID,
  related_session_id UUID,
  delivery_id UUID,
  data_snapshot JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, task_key, period_key)
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'upt_status_check'
  ) THEN
    ALTER TABLE user_personalization_tasks
    ADD CONSTRAINT upt_status_check
    CHECK (status IN ('pending','generated','draft','sent','expired','overdue','cancelled','not_applicable'));
  END IF;
END $$;

ALTER TABLE user_personalization_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_personalization_tasks" ON user_personalization_tasks;
CREATE POLICY "admins_manage_personalization_tasks" ON user_personalization_tasks
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "users_view_own_tasks" ON user_personalization_tasks;
CREATE POLICY "users_view_own_tasks" ON user_personalization_tasks
  FOR SELECT USING (auth.uid() = user_id);
