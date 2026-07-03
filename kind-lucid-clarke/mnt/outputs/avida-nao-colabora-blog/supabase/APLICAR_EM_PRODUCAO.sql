-- ═══════════════════════════════════════════════════════════════════════════
-- APLICAR_EM_PRODUCAO.sql
-- ───────────────────────────────────────────────────────────────────────────
-- Arquivo de conveniência: concatena as migrations desta auditoria
-- (003_z_prereqs + 044 + 045 + 046) em UM ÚNICO bloco, para colar de uma vez
-- no SQL Editor do Supabase.
--
-- 100% IDEMPOTENTE — pode ser executado várias vezes sem erro nem duplicação.
-- Não recria dados, não apaga nada. Apenas garante colunas, tabelas, policies
-- e RPCs que faltam. Seguro para banco de produção já existente.
--
-- COMO USAR:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Cole TODO este arquivo
--   3. Run
--   4. Deve terminar sem erro (mensagem "Success")
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 1 — PRÉ-REQUISITOS (colunas, tabelas base, is_admin)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ─── profiles ─────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role              TEXT         DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT       DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_access  BOOLEAN      DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_status    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_end         TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_name    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_phrase     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS communication_preference TEXT DEFAULT 'email';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_frequency  TEXT DEFAULT 'weekly';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN  DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN   DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT now();

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'essential', 'therapeutic', 'therapeutic-plus'));

-- ─── articles ─────────────────────────────────────────────────────────────────
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url          TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_alt          TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image_url    TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image        TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary            TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS status             TEXT DEFAULT 'published';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS plan_required      TEXT DEFAULT 'free';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_title          TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_description    TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS diary_question     TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cta_text           TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cta_link           TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author             TEXT DEFAULT 'A Vida Não Colabora';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS read_time          INTEGER DEFAULT 5;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published          BOOLEAN DEFAULT true;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS related_slugs      TEXT[];
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at       TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at       TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT now();
ALTER TABLE articles ADD COLUMN IF NOT EXISTS category           TEXT DEFAULT 'Geral';

-- ─── guided_meditations / mini_challenges ────────────────────────────────────
ALTER TABLE guided_meditations ADD COLUMN IF NOT EXISTS plan_level TEXT DEFAULT 'free';
ALTER TABLE mini_challenges    ADD COLUMN IF NOT EXISTS plan_level TEXT DEFAULT 'free';

-- ─── automated_contents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automated_contents (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN (
    'article_recommendation', 'guided_meditation', 'emotional_exercise',
    'weekly_challenge', 'monthly_challenge', 'weekly_evaluation',
    'monthly_report', 'self_care_plan', 'session_preparation', 'reminder'
  )),
  category     TEXT,
  plan_required TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_required IN ('free', 'essential', 'therapeutic', 'therapeutic-plus')),
  frequency    TEXT DEFAULT 'weekly',
  content      TEXT,
  image_url    TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE automated_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active contents" ON automated_contents;
CREATE POLICY "Public can read active contents"
  ON automated_contents FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "admin_automated_contents" ON automated_contents;
CREATE POLICY "admin_automated_contents"
  ON automated_contents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ─── is_admin() helper ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  );
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 2 — ENDURECIMENTO RLS / PAYWALL (migration 044, blindada)            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 1. ARTICLES — paywall real por plan_required
DROP POLICY IF EXISTS "Articles are public"   ON articles;
DROP POLICY IF EXISTS "Admin escreve artigos" ON articles;

DROP POLICY IF EXISTS "articles_admin_all" ON articles;
CREATE POLICY "articles_admin_all" ON articles
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "articles_public_free" ON articles;
CREATE POLICY "articles_public_free" ON articles
  FOR SELECT
  TO public
  USING (
    plan_required = 'free'
    AND (
      status = 'published'
      OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now())
    )
  );

DROP POLICY IF EXISTS "articles_essential" ON articles;
CREATE POLICY "articles_essential" ON articles
  FOR SELECT
  TO authenticated
  USING (
    plan_required = 'essential'
    AND (
      status = 'published'
      OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now())
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.plan IN ('essential', 'therapeutic', 'therapeutic-plus')
        AND (
          profiles.subscription_status IN ('active', 'trialing')
          OR profiles.unlimited_access = true
        )
    )
  );

DROP POLICY IF EXISTS "articles_therapeutic" ON articles;
CREATE POLICY "articles_therapeutic" ON articles
  FOR SELECT
  TO authenticated
  USING (
    plan_required = 'therapeutic'
    AND (
      status = 'published'
      OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now())
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.plan IN ('therapeutic', 'therapeutic-plus')
        AND (
          profiles.subscription_status IN ('active', 'trialing')
          OR profiles.unlimited_access = true
        )
    )
  );

DROP POLICY IF EXISTS "articles_therapeutic_plus" ON articles;
CREATE POLICY "articles_therapeutic_plus" ON articles
  FOR SELECT
  TO authenticated
  USING (
    plan_required = 'therapeutic-plus'
    AND (
      status = 'published'
      OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now())
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.plan = 'therapeutic-plus'
        AND (
          profiles.subscription_status IN ('active', 'trialing')
          OR profiles.unlimited_access = true
        )
    )
  );

-- 2. USER_SUBSCRIPTIONS — só leitura para usuário; escrita via service_role
DROP POLICY IF EXISTS "sub_insert_own"  ON user_subscriptions;
DROP POLICY IF EXISTS "sub_update_own"  ON user_subscriptions;

-- 3. PLAN_CHANGE_HISTORY — remover INSERT por usuário comum
DROP POLICY IF EXISTS "pch_insert" ON plan_change_history;

-- 4. Colunas usadas no paywall + backfill
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_access BOOLEAN DEFAULT false;

UPDATE profiles
SET subscription_status = 'active'
WHERE subscription_status IS NULL;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 3 — TABELAS AUXILIARES CONSOLIDADAS (migration 046)                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- user_content_history
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

-- user_notification_preferences
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

-- categories
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

-- trails
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

-- trail_articles
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

-- saved_items
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

-- plan_change_history
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
DROP POLICY IF EXISTS "pch_own" ON plan_change_history;
CREATE POLICY "pch_own" ON plan_change_history
  FOR SELECT USING (auth.uid() = user_id);

-- user_subscriptions
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
DROP POLICY IF EXISTS "sub_own" ON user_subscriptions;
CREATE POLICY "sub_own" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "sub_admin" ON user_subscriptions;
CREATE POLICY "sub_admin" ON user_subscriptions
  FOR ALL USING (is_admin());

-- notifications
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

-- monthly_reports
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

-- support_tickets
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

-- ticket_messages
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

-- Backfill de imagens
UPDATE articles
SET image_url = COALESCE(cover_image_url, cover_image)
WHERE image_url IS NULL
  AND (cover_image_url IS NOT NULL OR cover_image IS NOT NULL);

-- Índices
CREATE INDEX IF NOT EXISTS idx_articles_status       ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_plan_req     ON articles(plan_required);
CREATE INDEX IF NOT EXISTS idx_articles_scheduled    ON articles(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_user  ON monthly_reports(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_saved_items_user      ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_trail_articles_trail  ON trail_articles(trail_id, order_index);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PARTE 4 — RPCs ADMINISTRATIVAS SEGURAS (migration 045)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION admin_change_user_plan(
  p_target_user_id UUID,
  p_new_plan        TEXT,
  p_notes           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan TEXT;
  v_result   JSONB;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar planos.';
  END IF;
  IF p_new_plan NOT IN ('free', 'essential', 'therapeutic', 'therapeutic-plus') THEN
    RAISE EXCEPTION 'Plano inválido: %', p_new_plan;
  END IF;
  SELECT plan INTO v_old_plan FROM profiles WHERE user_id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', p_target_user_id;
  END IF;
  UPDATE profiles SET plan = p_new_plan, updated_at = now() WHERE user_id = p_target_user_id;
  INSERT INTO plan_change_history (
    user_id, old_plan, new_plan, change_type, amount_charged, effective_at, source, notes
  ) VALUES (
    p_target_user_id, v_old_plan, p_new_plan, 'admin_change', 0, now(), 'admin', p_notes
  );
  v_result := jsonb_build_object('success', true, 'old_plan', v_old_plan, 'new_plan', p_new_plan);
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_change_user_plan TO authenticated;

CREATE OR REPLACE FUNCTION admin_update_user_role(
  p_target_user_id UUID,
  p_new_role        TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_new_role NOT IN ('user', 'admin', 'professional') THEN
    RAISE EXCEPTION 'Role inválido: %', p_new_role;
  END IF;
  UPDATE profiles SET role = p_new_role, updated_at = now() WHERE user_id = p_target_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_user_role TO authenticated;

CREATE OR REPLACE FUNCTION admin_record_plan_change(
  p_target_user_id UUID,
  p_old_plan        TEXT,
  p_new_plan        TEXT,
  p_change_type     TEXT,
  p_amount          NUMERIC DEFAULT 0,
  p_source          TEXT    DEFAULT 'admin',
  p_notes           TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  INSERT INTO plan_change_history (
    user_id, old_plan, new_plan, change_type, amount_charged, effective_at, source, notes
  ) VALUES (
    p_target_user_id, p_old_plan, p_new_plan, p_change_type, p_amount, now(), p_source, p_notes
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_record_plan_change TO authenticated;

CREATE OR REPLACE FUNCTION admin_cancel_subscription(
  p_target_user_id UUID,
  p_notes           TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT plan INTO v_old_plan FROM profiles WHERE user_id = p_target_user_id;
  UPDATE user_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_target_user_id AND status NOT IN ('cancelled');
  INSERT INTO plan_change_history (
    user_id, old_plan, new_plan, change_type, amount_charged, effective_at, source, notes
  ) VALUES (
    p_target_user_id, v_old_plan, 'free', 'admin_cancel', 0, now(), 'admin', p_notes
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_cancel_subscription TO authenticated;

CREATE OR REPLACE FUNCTION admin_set_unlimited_access(
  p_target_user_id UUID,
  p_enabled         BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE profiles SET unlimited_access = p_enabled, updated_at = now() WHERE user_id = p_target_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_set_unlimited_access TO authenticated;

CREATE OR REPLACE FUNCTION admin_force_password_change(
  p_target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE profiles SET must_change_password = true, updated_at = now() WHERE user_id = p_target_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_force_password_change TO authenticated;

-- RLS de confirmação para admin
DROP POLICY IF EXISTS "admin_subscriptions_all" ON user_subscriptions;
CREATE POLICY "admin_subscriptions_all" ON user_subscriptions
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "pch_admin" ON plan_change_history;
CREATE POLICY "pch_admin" ON plan_change_history
  FOR ALL USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- FIM — se chegou aqui sem erro, o schema de produção está atualizado.
-- ═══════════════════════════════════════════════════════════════════════════
