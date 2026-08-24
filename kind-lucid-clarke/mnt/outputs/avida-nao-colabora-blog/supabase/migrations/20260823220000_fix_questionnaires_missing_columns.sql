-- ============================================================
-- Fix: questionnaires.published_at e questionnaires.active nunca
-- foram criadas, mas a migration 013_fix_admin_blog_sync.sql já
-- as referencia (UPDATE ... SET published_at ..., CREATE POLICY
-- ... COALESCE(active, false) ...). Isso quebra qualquer replay
-- completo do histórico de migrations a partir do zero
-- (ex.: `supabase db reset` local). Idempotente e seguro para
-- rodar contra o banco de produção, onde essas colunas já podem
-- ter sido adicionadas manualmente fora do histórico rastreado.
-- ============================================================

ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

UPDATE questionnaires SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

UPDATE questionnaires SET active = COALESCE(is_active, true) WHERE active IS NULL;
