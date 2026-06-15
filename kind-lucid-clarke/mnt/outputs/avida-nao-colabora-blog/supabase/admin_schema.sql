-- ╔════════════════════════════════════════════════════════╗
-- ║  Admin Schema — A Vida Não Colabora                    ║
-- ║  Execute no Supabase SQL Editor                        ║
-- ╚════════════════════════════════════════════════════════╝

-- 1. Adicionar coluna role na tabela profiles (se ainda não existe)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT NULL;

-- 2. Definir o usuário admin
UPDATE profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'jonesgregory.jg@gmail.com'
);

-- 3. Tabela de artigos (se ainda não existir)
CREATE TABLE IF NOT EXISTS articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  summary         TEXT,
  content         TEXT,
  cover_image_url TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','archived','scheduled')),
  category        TEXT,
  plan_required   TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan_required IN ('free','essential','therapeutic','therapeutic-plus')),
  seo_title       TEXT,
  seo_description TEXT,
  diary_question  TEXT,
  cta_text        TEXT,
  cta_link        TEXT,
  reading_time_minutes INT DEFAULT 5,
  published_at    TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Storage bucket para imagens (execute no dashboard Supabase > Storage > New bucket)
-- Nome: article-images | Public: true

-- 6. RLS para artigos
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas de artigos publicados
DROP POLICY IF EXISTS "public_read_published" ON articles;
CREATE POLICY "public_read_published"
  ON articles FOR SELECT
  USING (status = 'published');

-- Admin pode tudo
DROP POLICY IF EXISTS "admin_all" ON articles;
CREATE POLICY "admin_all"
  ON articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 7. RLS para categorias
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_cats" ON categories;
CREATE POLICY "public_read_cats"
  ON categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admin_all_cats" ON categories;
CREATE POLICY "admin_all_cats"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 8. RLS para profiles — admin pode ver todos
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles"
  ON profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.user_id = auth.uid() AND p2.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles"
  ON profiles FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.user_id = auth.uid() AND p2.role = 'admin'
    )
  );
