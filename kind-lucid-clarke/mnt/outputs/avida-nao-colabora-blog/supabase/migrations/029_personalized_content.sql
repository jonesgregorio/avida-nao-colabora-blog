-- ─── Migration 029: Personalizações por Plano ───────────────────────────────

CREATE TABLE IF NOT EXISTS personalized_content_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_area TEXT,
  data_snapshot JSONB DEFAULT '{}'::jsonb,
  ai_generated BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE personalized_content_deliveries
  ADD CONSTRAINT pcd_status_check
  CHECK (status IN ('draft','sent','archived'));

ALTER TABLE personalized_content_deliveries ENABLE ROW LEVEL SECURITY;

-- Admin: acesso total
DROP POLICY IF EXISTS "admins_manage_personalized_content" ON personalized_content_deliveries;
CREATE POLICY "admins_manage_personalized_content" ON personalized_content_deliveries
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Usuário comum: apenas conteúdos sent para si
DROP POLICY IF EXISTS "users_view_own_sent_content" ON personalized_content_deliveries;
CREATE POLICY "users_view_own_sent_content" ON personalized_content_deliveries
  FOR SELECT USING (auth.uid() = user_id AND status = 'sent');

-- Garantir email em profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
