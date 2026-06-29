-- ============================================================
-- Migration 008: Corrige mismatches de colunas entre código e banco
--               Execute no Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. QUESTIONNAIRES — adicionar colunas que o admin usa
-- ─────────────────────────────────────────────────────────────
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS type            TEXT DEFAULT 'autoavaliacao',
  ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','published','scheduled','inactive','archived')),
  ADD COLUMN IF NOT EXISTS question_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_time  INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS emotional_category TEXT,
  ADD COLUMN IF NOT EXISTS show_on_questionnaires_page BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tags            JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS questions       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS results         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- RLS: admin pode ver todos (publicados e rascunhos)
DROP POLICY IF EXISTS "Questionários públicos visíveis" ON questionnaires;
CREATE POLICY "Questionários públicos visíveis"
  ON questionnaires FOR SELECT
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. NOTIFICATIONS — adicionar colunas admin
-- ─────────────────────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS target_plan TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','sent')),
  ADD COLUMN IF NOT EXISTS sent_at     TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 3. SCHEDULED_CONTENTS — adicionar colunas admin
-- ─────────────────────────────────────────────────────────────
ALTER TABLE scheduled_contents
  ADD COLUMN IF NOT EXISTS type         TEXT DEFAULT 'Artigo',
  ADD COLUMN IF NOT EXISTS content      TEXT,
  ADD COLUMN IF NOT EXISTS plan_required TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS recurrence   TEXT,
  ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','sent','cancelled'));

-- ─────────────────────────────────────────────────────────────
-- 4. TESTIMONIALS — adicionar colunas role + corrigir RLS para admin ver tudo
-- ─────────────────────────────────────────────────────────────
ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS role TEXT;

-- Admin deve ver todos os depoimentos (inclusive não aprovados)
DROP POLICY IF EXISTS "Depoimentos aprovados visíveis" ON testimonials;
CREATE POLICY "Depoimentos aprovados visíveis"
  ON testimonials FOR SELECT
  USING (
    is_approved = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. SITE_METRICS — adicionar colunas label e value como TEXT
-- ─────────────────────────────────────────────────────────────
ALTER TABLE site_metrics
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS value TEXT DEFAULT '0';

-- Renomear coluna metric → já existe; garantir que value (NUMERIC) coexiste com value (TEXT)
-- Na prática só adicionamos a coluna TEXT; o componente usa a TEXT
-- Atualizar RLS para admin poder escrever
DROP POLICY IF EXISTS "Sistema atualiza métricas" ON site_metrics;
CREATE POLICY "Sistema atualiza métricas"
  ON site_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin lê métricas" ON site_metrics;
CREATE POLICY "Admin lê métricas"
  ON site_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 6. SAVED_ITEMS — adicionar RLS para admin ver todos
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin lê todos os saved_items" ON saved_items;
CREATE POLICY "Admin lê todos os saved_items"
  ON saved_items FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. SUPPORT_TICKETS — admin ver todos
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin gerencia tickets" ON support_tickets;
CREATE POLICY "Admin gerencia tickets"
  ON support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 8. PROFESSIONALS — adicionar coluna active como alias de is_active
--    (componente foi corrigido para usar is_active, mas garantimos compatibilidade)
-- ─────────────────────────────────────────────────────────────
-- Já corrigido no componente (is_active), sem alteração no schema necessária.

-- ─────────────────────────────────────────────────────────────
-- 9. ADMIN_LOGS — garantir coluna admin_id aponta para profiles via user_id
--    (componente foi corrigido para usar entity/entity_id)
-- ─────────────────────────────────────────────────────────────
-- Sem mudança no schema; join corrigido no componente.

-- ─────────────────────────────────────────────────────────────
-- 10. Verificar que o usuário admin existe
-- ─────────────────────────────────────────────────────────────
-- UPDATE profiles SET role = 'admin' WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'jonlesjonles30@gmail.com'
-- );
-- Descomente a linha acima se precisar reconfigurar o admin.
