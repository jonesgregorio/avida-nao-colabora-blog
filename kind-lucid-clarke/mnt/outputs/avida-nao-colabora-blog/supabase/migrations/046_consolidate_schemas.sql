-- ============================================================
-- Migration 046: Consolidação dos schemas soltos
-- Garante que todas as tabelas dos arquivos legacy
-- (admin_schema.sql, interactive_schema.sql,
--  new_features_schema.sql, update_article_images.sql)
-- existam nas migrations oficiais.
-- Todas as operações são idempotentes (IF NOT EXISTS).
-- ============================================================

-- ─── user_content_history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_content_history (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id   UUID REFERENCES automated_contents(id) ON DELETE SET NULL,
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  opened_at    TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  feedback     TEXT,
  skipped      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_content_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own history" ON user_content_history;
CREATE POLICY "Users manage own history"
  ON user_content_history FOR ALL
  USING (auth.uid() = user_id);

-- ─── user_notification_preferences ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled   BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  push_enabled    BOOLEAN DEFAULT false,
  preferred_days  TEXT[]  DEFAULT ARRAY['monday', 'thursday'],
  preferred_time  TEXT    DEFAULT '09:00',
  max_frequency   TEXT    DEFAULT 'weekly',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own preferences" ON user_notification_preferences;
CREATE POLICY "Users manage own preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- ─── categories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT,
  description TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_admin_all" ON categories;
CREATE POLICY "categories_admin_all" ON categories FOR ALL USING (is_admin());

-- ─── trails ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trails (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  plan_required TEXT DEFAULT 'free'
    CHECK (plan_required IN ('free', 'essential', 'therapeutic', 'therapeutic-plus')),
  is_active    BOOLEAN DEFAULT true,
  active       BOOLEAN DEFAULT true,
  category     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trails_public" ON trails;
CREATE POLICY "trails_public" ON trails FOR SELECT USING (is_active = true OR active = true);

DROP POLICY IF EXISTS "trails_admin" ON trails;
CREATE POLICY "trails_admin" ON trails FOR ALL USING (is_admin());

-- ─── trail_articles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trail_articles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trail_id     UUID REFERENCES trails(id) ON DELETE CASCADE NOT NULL,
  article_id   UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  order_index  INTEGER DEFAULT 0,
  position     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trail_id, article_id)
);

ALTER TABLE trail_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trail_articles_public" ON trail_articles;
CREATE POLICY "trail_articles_public" ON trail_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "trail_articles_admin" ON trail_articles;
CREATE POLICY "trail_articles_admin" ON trail_articles FOR ALL USING (is_admin());

-- ─── saved_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_items (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_type    TEXT NOT NULL DEFAULT 'article',
  item_id      UUID,
  article_slug TEXT,
  title        TEXT,
  description  TEXT,
  image_url    TEXT,
  category     TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_items_own" ON saved_items;
CREATE POLICY "saved_items_own" ON saved_items FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_items_admin" ON saved_items;
CREATE POLICY "saved_items_admin" ON saved_items FOR ALL USING (is_admin());

-- ─── plan_change_history (garante existência) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_change_history (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  old_plan       TEXT,
  new_plan       TEXT,
  change_type    TEXT,
  amount_charged NUMERIC DEFAULT 0,
  effective_at   TIMESTAMPTZ,
  source         TEXT DEFAULT 'system',
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plan_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pch_own_read" ON plan_change_history;
CREATE POLICY "pch_own_read" ON plan_change_history
  FOR SELECT USING (auth.uid() = user_id);

-- ─── user_subscriptions (garante existência) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_key              TEXT DEFAULT 'free',
  status                TEXT DEFAULT 'active',
  stripe_subscription_id TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,
  pending_plan          TEXT,
  pending_plan_starts_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário só lê sua própria assinatura
DROP POLICY IF EXISTS "sub_own" ON user_subscriptions;
CREATE POLICY "sub_own" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin acessa tudo
DROP POLICY IF EXISTS "sub_admin" ON user_subscriptions;
CREATE POLICY "sub_admin" ON user_subscriptions
  FOR ALL USING (is_admin());

-- ─── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT DEFAULT 'info',
  is_read      BOOLEAN DEFAULT false,
  action_url   TEXT,
  action_data  JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_admin" ON notifications;
CREATE POLICY "notifications_admin" ON notifications
  FOR ALL USING (is_admin());

-- ─── monthly_reports ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_reports (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_key   TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'simple',
  title       TEXT,
  summary     TEXT,
  data_json   JSONB,
  status      TEXT DEFAULT 'draft',
  pdf_url     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_key, report_type)
);

ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_reports_own" ON monthly_reports;
CREATE POLICY "monthly_reports_own" ON monthly_reports
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "monthly_reports_admin" ON monthly_reports;
CREATE POLICY "monthly_reports_admin" ON monthly_reports
  FOR ALL USING (is_admin());

-- ─── support_tickets (garante existência) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_number     SERIAL,
  subject           TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT,
  priority          TEXT DEFAULT 'medium',
  status            TEXT DEFAULT 'open',
  source            TEXT DEFAULT 'contact_page',
  plan_at_creation  TEXT,
  unread_for_admin  BOOLEAN DEFAULT true,
  unread_for_user   BOOLEAN DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_own" ON support_tickets;
CREATE POLICY "tickets_own" ON support_tickets
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tickets_admin" ON support_tickets;
CREATE POLICY "tickets_admin" ON support_tickets
  FOR ALL USING (is_admin());

-- ─── ticket_messages (garante existência) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id   UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT DEFAULT 'user' CHECK (sender_role IN ('user', 'admin')),
  sender_name TEXT,
  content     TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_messages_own" ON ticket_messages;
CREATE POLICY "ticket_messages_own" ON ticket_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
        AND support_tickets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ticket_messages_admin" ON ticket_messages;
CREATE POLICY "ticket_messages_admin" ON ticket_messages
  FOR ALL USING (is_admin());

-- ─── Backfill: preencher image_url com cover_image_url ou cover_image ──────────
UPDATE articles
SET image_url = COALESCE(cover_image_url, cover_image)
WHERE image_url IS NULL
  AND (cover_image_url IS NOT NULL OR cover_image IS NOT NULL);

-- ─── Índices úteis ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_articles_status       ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_plan_req     ON articles(plan_required);
CREATE INDEX IF NOT EXISTS idx_articles_scheduled    ON articles(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_user  ON monthly_reports(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_saved_items_user      ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_trail_articles_trail  ON trail_articles(trail_id, order_index);
