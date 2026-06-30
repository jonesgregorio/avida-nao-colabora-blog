-- ============================================================
-- Migration 013: Corrige sincronização admin ↔ blog público
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. Helper is_admin()
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 1. ARTICLES – colunas faltando + RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

-- Backfill: artigos com status published recebem published_at
UPDATE articles SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

-- Artigos sem status explícito eram públicos
UPDATE articles SET status = 'published'
WHERE status IS NULL;

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Articles are public" ON articles;
CREATE POLICY "Articles are public" ON articles
  FOR SELECT USING (status = 'published' OR is_admin());

DROP POLICY IF EXISTS "Admin escreve artigos" ON articles;
CREATE POLICY "Admin escreve artigos" ON articles
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 2. CATEGORIES – colunas faltando + RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categorias públicas" ON categories;
CREATE POLICY "Categorias públicas" ON categories
  FOR SELECT USING (COALESCE(is_active, true) = true OR is_admin());

DROP POLICY IF EXISTS "Admin gerencia categorias" ON categories;
CREATE POLICY "Admin gerencia categorias" ON categories
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. QUESTIONNAIRES – colunas faltando + RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS allow_anonymous  BOOLEAN DEFAULT true;
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS allow_retake     BOOLEAN DEFAULT true;
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS show_score       BOOLEAN DEFAULT true;
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS show_result      BOOLEAN DEFAULT true;
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS cover_image      TEXT;
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS intro_text       TEXT;
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS completion_text  TEXT;

-- Backfill published_at
UPDATE questionnaires SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Questionários públicos visíveis" ON questionnaires;
CREATE POLICY "Questionários públicos visíveis" ON questionnaires
  FOR SELECT USING (status = 'published' OR COALESCE(active, false) = true OR is_admin());

DROP POLICY IF EXISTS "Admin gerencia questionários" ON questionnaires;
CREATE POLICY "Admin gerencia questionários" ON questionnaires
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. TRAILS – colunas faltando + RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE trails ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE trails ADD COLUMN IF NOT EXISTS category  TEXT;

-- Sincronizar is_active ← active para dados existentes
UPDATE trails SET is_active = COALESCE(active, true) WHERE is_active IS NULL;

ALTER TABLE trails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trilhas públicas visíveis" ON trails;
CREATE POLICY "Trilhas públicas visíveis" ON trails
  FOR SELECT USING (COALESCE(is_active, active, true) = true OR is_admin());

DROP POLICY IF EXISTS "Admin gerencia trilhas" ON trails;
CREATE POLICY "Admin gerencia trilhas" ON trails
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 5. TRAIL_ARTICLES – coluna position (alias de order_index)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE trail_articles ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
UPDATE trail_articles SET position = COALESCE(order_index, 0) WHERE position IS NULL;

ALTER TABLE trail_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Itens de trilha visíveis" ON trail_articles;
CREATE POLICY "Itens de trilha visíveis" ON trail_articles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia itens de trilha" ON trail_articles;
CREATE POLICY "Admin gerencia itens de trilha" ON trail_articles
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 6. AUTOMATED_CONTENTS – colunas faltando + RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE automated_contents ADD COLUMN IF NOT EXISTS active          BOOLEAN DEFAULT true;
ALTER TABLE automated_contents ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE automated_contents ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

UPDATE automated_contents SET active = COALESCE(is_active, true) WHERE active IS NULL;

ALTER TABLE automated_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia conteúdos automáticos" ON automated_contents;
CREATE POLICY "Admin gerencia conteúdos automáticos" ON automated_contents
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Usuários leem conteúdos automáticos ativos" ON automated_contents;
CREATE POLICY "Usuários leem conteúdos automáticos ativos" ON automated_contents
  FOR SELECT USING (COALESCE(is_active, active, false) = true OR is_admin());

-- ─────────────────────────────────────────────────────────────
-- 7. PLAN_CONFIGS – criar tabela (não existe ainda)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_configs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key       TEXT NOT NULL UNIQUE,
  label          TEXT,
  price          TEXT,
  description    TEXT,
  is_recommended BOOLEAN DEFAULT false,
  active         BOOLEAN DEFAULT true,
  stripe_price_id TEXT,
  features       JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_plan_configs" ON plan_configs;
CREATE POLICY "admin_all_plan_configs" ON plan_configs
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "public_read_plan_configs" ON plan_configs;
CREATE POLICY "public_read_plan_configs" ON plan_configs
  FOR SELECT USING (active = true OR is_admin());

-- Seeds iniciais dos planos (para admin poder editar)
INSERT INTO plan_configs (plan_key, label, price, active) VALUES
  ('free',              'Gratuito',          'R$ 0',    true),
  ('essential',         'Essencial',         'R$ 19,90', true),
  ('therapeutic',       'Terapêutico',       'R$ 39,90', true),
  ('therapeutic-plus',  'Terapêutico Plus',  'R$ 79,90', true)
ON CONFLICT (plan_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 8. SCHEDULED_CONTENTS – coluna scheduled_for
-- ─────────────────────────────────────────────────────────────
ALTER TABLE scheduled_contents ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
UPDATE scheduled_contents SET scheduled_for = scheduled_at WHERE scheduled_for IS NULL;

ALTER TABLE scheduled_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia conteúdos agendados" ON scheduled_contents;
CREATE POLICY "Admin gerencia conteúdos agendados" ON scheduled_contents
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 9. SAVED_ITEMS RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_saved_items" ON saved_items;
DROP POLICY IF EXISTS "admin_write_saved_items" ON saved_items;
DROP POLICY IF EXISTS "Admin lê todos os saved_items" ON saved_items;

CREATE POLICY "saved_items_user_access" ON saved_items
  FOR ALL USING (auth.uid() = user_id OR is_admin());

-- ─────────────────────────────────────────────────────────────
-- 10. TESTIMONIALS RLS (usa 'active', não 'is_approved')
-- ─────────────────────────────────────────────────────────────
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Depoimentos aprovados visíveis" ON testimonials;
CREATE POLICY "Depoimentos aprovados visíveis" ON testimonials
  FOR SELECT USING (COALESCE(active, true) = true OR is_admin());

DROP POLICY IF EXISTS "Admin gerencia depoimentos" ON testimonials;
CREATE POLICY "Admin gerencia depoimentos" ON testimonials
  FOR ALL USING (is_admin());
