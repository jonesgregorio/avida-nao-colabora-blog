-- ============================================================
-- Migration 003_z: Pré-requisitos para instalação limpa
-- Garante que colunas e tabelas usadas pelas migrations 004+
-- existam antes de serem referenciadas por FK ou policies.
-- Arquivo nomeado 003_z_... para ordenar após 003_articles_...
-- e antes de 004_....
-- ============================================================

-- ─── profiles: colunas necessárias antes de 004/005/007/008 ───────────────────
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

-- Atualiza CHECK constraint de plan para incluir therapeutic-plus
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'essential', 'therapeutic', 'therapeutic-plus'));

-- ─── articles: colunas essenciais antes de 004+ ───────────────────────────────
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url          TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_alt          TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image_url    TEXT;
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

-- ─── guided_meditations: plan_level antes de 006 ─────────────────────────────
ALTER TABLE guided_meditations ADD COLUMN IF NOT EXISTS plan_level TEXT DEFAULT 'free';

-- ─── mini_challenges: plan_level antes de 006 ────────────────────────────────
ALTER TABLE mini_challenges ADD COLUMN IF NOT EXISTS plan_level TEXT DEFAULT 'free';

-- ─── automated_contents: criada antes de 004 (que tem FK para ela) ────────────
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

-- Admin acessa tudo
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

-- ─── is_admin() helper function (usada em várias policies) ───────────────────
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
