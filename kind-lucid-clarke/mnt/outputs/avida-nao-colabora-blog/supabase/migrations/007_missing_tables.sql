-- ============================================================
-- Migration 007: Cria todas as tabelas referenciadas pelo
--                frontend mas ausentes nas migrations anteriores
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. QUESTIONÁRIOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questionnaires (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  plan_required TEXT DEFAULT 'free'
    CHECK (plan_required IN ('free', 'essential', 'therapeutic', 'therapeutic-plus')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questionnaire_questions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  text             TEXT NOT NULL,
  order_index      INTEGER DEFAULT 0,
  question_type    TEXT DEFAULT 'multiple_choice'
    CHECK (question_type IN ('multiple_choice', 'scale', 'text', 'boolean')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questionnaire_options (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questionnaire_questions(id) ON DELETE CASCADE NOT NULL,
  text        TEXT NOT NULL,
  value       INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questionnaire_results (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  min_score        INTEGER NOT NULL,
  max_score        INTEGER NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  recommendation   TEXT
);

CREATE TABLE IF NOT EXISTS questionnaire_answers (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID REFERENCES questionnaire_responses(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questionnaire_questions(id) ON DELETE CASCADE NOT NULL,
  option_id   UUID REFERENCES questionnaire_options(id) ON DELETE SET NULL,
  text_answer TEXT,
  value       INTEGER
);

-- Índices questionários
CREATE INDEX IF NOT EXISTS idx_qq_questionnaire ON questionnaire_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_qo_question ON questionnaire_options(question_id);
CREATE INDEX IF NOT EXISTS idx_qr_questionnaire ON questionnaire_results(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_qa_response ON questionnaire_answers(response_id);

-- RLS questionários
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questionários públicos visíveis" ON questionnaires FOR SELECT USING (is_active = true);
CREATE POLICY "Admin gerencia questionários" ON questionnaires FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE questionnaire_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perguntas visíveis" ON questionnaire_questions FOR SELECT USING (true);
CREATE POLICY "Admin gerencia perguntas" ON questionnaire_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE questionnaire_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Opções visíveis" ON questionnaire_options FOR SELECT USING (true);
CREATE POLICY "Admin gerencia opções" ON questionnaire_options FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE questionnaire_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Resultados visíveis" ON questionnaire_results FOR SELECT USING (true);
CREATE POLICY "Admin gerencia resultados" ON questionnaire_results FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE questionnaire_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê próprias respostas" ON questionnaire_answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM questionnaire_responses r WHERE r.id = response_id AND r.user_id = auth.uid()));
CREATE POLICY "Usuário insere respostas" ON questionnaire_answers FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 2. TRILHAS DE CONTEÚDO
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trails (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT,
  plan_required TEXT DEFAULT 'free'
    CHECK (plan_required IN ('free', 'essential', 'therapeutic', 'therapeutic-plus')),
  is_active    BOOLEAN DEFAULT true,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trail_articles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trail_id    UUID REFERENCES trails(id) ON DELETE CASCADE NOT NULL,
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trail_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_ta_trail ON trail_articles(trail_id);
CREATE INDEX IF NOT EXISTS idx_ta_article ON trail_articles(article_id);

ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trilhas públicas visíveis" ON trails FOR SELECT USING (is_active = true);
CREATE POLICY "Admin gerencia trilhas" ON trails FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE trail_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itens de trilha visíveis" ON trail_articles FOR SELECT USING (true);
CREATE POLICY "Admin gerencia itens de trilha" ON trail_articles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 3. NOTIFICAÇÕES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT DEFAULT 'info' CHECK (type IN ('info', 'alert', 'promo', 'system')),
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê próprias notificações" ON notifications FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Usuário atualiza notificações" ON notifications FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "Admin gerencia notificações" ON notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 4. SUPORTE / TICKETS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  priority    TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  admin_notes TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qualquer um pode abrir ticket" ON support_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Usuário vê próprios tickets" ON support_tickets FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Admin gerencia tickets" ON support_tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 5. DEPOIMENTOS / PROVA SOCIAL
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_approved BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Depoimentos aprovados visíveis" ON testimonials FOR SELECT
  USING (is_approved = true);
CREATE POLICY "Usuário envia depoimento" ON testimonials FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin gerencia depoimentos" ON testimonials FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 6. PROFISSIONAIS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professionals (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  specialty   TEXT,
  bio         TEXT,
  email       TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profissionais ativos visíveis" ON professionals FOR SELECT
  USING (is_active = true);
CREATE POLICY "Admin gerencia profissionais" ON professionals FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 7. LOGS ADMIN
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin lê logs" ON admin_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Sistema insere logs" ON admin_logs FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 8. CONTEÚDOS AGENDADOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_contents (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  content_type TEXT DEFAULT 'tip' CHECK (content_type IN ('tip', 'exercise', 'reflection', 'challenge')),
  scheduled_at TIMESTAMPTZ,
  send_at_hour INTEGER DEFAULT 8 CHECK (send_at_hour BETWEEN 0 AND 23),
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scheduled_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia conteúdos agendados" ON scheduled_contents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 9. MÉTRICAS DO SITE (para AdminDashboard)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_metrics (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric     TEXT NOT NULL UNIQUE,
  value      NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_metrics (metric, value) VALUES
  ('total_pageviews', 0),
  ('avg_session_minutes', 0),
  ('bounce_rate', 0),
  ('new_users_week', 0)
ON CONFLICT (metric) DO NOTHING;

ALTER TABLE site_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin lê métricas" ON site_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Sistema atualiza métricas" ON site_metrics FOR ALL WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 10. Corrigir RLS analytics_events
--     profiles.id → profiles.user_id (consistente com restante)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin lê todos os eventos" ON analytics_events;

CREATE POLICY "Admin lê todos os eventos"
  ON analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
