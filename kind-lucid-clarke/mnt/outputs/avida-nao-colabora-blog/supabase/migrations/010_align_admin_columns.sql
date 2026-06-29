-- Migration 010: Alinha colunas das tabelas ao que os componentes admin esperam

-- ─────────────────────────────────────────────────────────────
-- 1. TESTIMONIALS
-- Migration 007 criou: author_name, content, is_approved, is_featured
-- AdminSocialProof usa: name, text, role, rating, active
-- ─────────────────────────────────────────────────────────────
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT false;

-- Backfill das colunas novas a partir das antigas (quando existirem dados)
UPDATE testimonials SET
  name   = COALESCE(name, author_name),
  text   = COALESCE(text, content),
  active = COALESCE(active, is_approved)
WHERE name IS NULL OR text IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. SITE_METRICS
-- Migration 007 criou: metric (unique), value
-- AdminSocialProof usa: key, label, value, id, updated_at
-- ─────────────────────────────────────────────────────────────
ALTER TABLE site_metrics ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE site_metrics ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE site_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Remove métricas técnicas da migration 007 (não usadas pelo admin)
DELETE FROM site_metrics WHERE metric IN ('total_pageviews','avg_session_minutes','bounce_rate','new_users_week');

-- Semeia as métricas que o AdminSocialProof espera
INSERT INTO site_metrics (key, label, value, metric, updated_at) VALUES
  ('users_count',    'Usuárias',             '0',   'users_count',    NOW()),
  ('articles_count', 'Artigos publicados',   '0',   'articles_count', NOW()),
  ('diary_entries',  'Entradas de diário',   '0',   'diary_entries',  NOW()),
  ('satisfaction',   'Taxa de satisfação',   '98%', 'satisfaction',   NOW())
ON CONFLICT DO NOTHING;

-- Backfill key a partir de metric para linhas existentes que não tenham key
UPDATE site_metrics SET key = metric WHERE key IS NULL;

-- Índice único em key para upsert futuro
CREATE UNIQUE INDEX IF NOT EXISTS site_metrics_key_idx ON site_metrics(key);

-- ─────────────────────────────────────────────────────────────
-- 3. SCHEDULED_CONTENTS
-- Migration 007 criou: title, body, content_type, scheduled_at, send_at_hour, is_active
-- AdminScheduled usa: title, type, content, plan_required, scheduled_at, recurrence, status
-- ─────────────────────────────────────────────────────────────
ALTER TABLE scheduled_contents ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE scheduled_contents ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE scheduled_contents ADD COLUMN IF NOT EXISTS plan_required TEXT DEFAULT 'free';
ALTER TABLE scheduled_contents ADD COLUMN IF NOT EXISTS recurrence TEXT;
ALTER TABLE scheduled_contents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Backfill type a partir de content_type, content a partir de body
UPDATE scheduled_contents SET
  type    = COALESCE(type, content_type),
  content = COALESCE(content, body)
WHERE type IS NULL OR content IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. NOTIFICATIONS
-- Migration 007 criou: user_id, title, body, type, is_read
-- AdminNotifications usa: title, body, target_plan, type, status, sent_at
-- ─────────────────────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_plan TEXT DEFAULT 'all';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 5. PROFESSIONALS
-- Migration 007 criou: is_active BOOLEAN
-- AdminProfessionals usa: active BOOLEAN
-- ─────────────────────────────────────────────────────────────
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Backfill active a partir de is_active
UPDATE professionals SET active = is_active WHERE active IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. SAVED_ITEMS — adicionar policy de admin para leitura total
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_saved_items" ON saved_items;
CREATE POLICY "admin_read_saved_items" ON saved_items
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 7. ADMIN_LOGS — migration 007 usa target_type/target_id como
--    entity/entity_id; AdminLogs já foi corrigido para usar
--    target_type/target_id (migration 008). Garantir colunas:
-- ─────────────────────────────────────────────────────────────
ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS target_id TEXT;

-- Backfill das colunas antigas (entity → target_type, entity_id → target_id)
UPDATE admin_logs SET
  target_type = COALESCE(target_type, entity),
  target_id   = COALESCE(target_id, entity_id)
WHERE target_type IS NULL;
