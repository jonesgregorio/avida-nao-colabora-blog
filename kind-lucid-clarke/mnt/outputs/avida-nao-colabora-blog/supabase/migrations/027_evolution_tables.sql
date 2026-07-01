-- ─── Tabelas para central Minha Evolução ─────────────────────────────────────

-- Relatórios mensais
CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'simple',
  title TEXT,
  summary TEXT,
  data_json JSONB DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  status TEXT DEFAULT 'generated',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_key, report_type)
);
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_reports" ON monthly_reports
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_manage_reports" ON monthly_reports
  USING (is_admin()) WITH CHECK (is_admin());

-- Orientações mensais por mensagem
CREATE TABLE IF NOT EXISTS monthly_guidance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT,
  expected_help TEXT,
  response TEXT,
  status TEXT DEFAULT 'open',
  responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_key)
);
ALTER TABLE monthly_guidance_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_guidance" ON monthly_guidance_requests
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_manage_guidance" ON monthly_guidance_requests
  USING (is_admin()) WITH CHECK (is_admin());

-- Revisões mensais do plano de autocuidado
CREATE TABLE IF NOT EXISTS self_care_plan_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID,
  month_key TEXT NOT NULL,
  summary TEXT,
  suggested_adjustments TEXT,
  next_focus TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_key)
);
ALTER TABLE self_care_plan_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_view_own_reviews" ON self_care_plan_reviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_manage_reviews" ON self_care_plan_reviews
  USING (is_admin()) WITH CHECK (is_admin());

-- Sessões Plus (mensais com Psicanalista)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID,
  month_key TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'available',
  notes TEXT,
  professional_name TEXT,
  meeting_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_view_own_sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins_manage_sessions" ON user_sessions
  USING (is_admin()) WITH CHECK (is_admin());
