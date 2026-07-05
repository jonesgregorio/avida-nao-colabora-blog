-- ============================================================
-- Migration 056: Tabelas que o código usa mas não existiam no banco
--   Detectadas em auditoria pré-launch (retornavam 404 PGRST205):
--     - article_feedback   -> ArticleView "esse conteúdo ajudou?" (upsert)
--     - reading_history     -> TrailsPage progresso de leitura das trilhas
--     - diary_plan_configs  -> AdminDiaryConfig (definida na 011, mas a 011
--                              nunca foi aplicada NESTE banco)
--   Aditiva e idempotente: só CREATE ... IF NOT EXISTS e (re)cria policies.
--   Não altera nenhuma tabela/coluna existente.
-- ============================================================

-- ── 1. article_feedback ─────────────────────────────────────
-- Código (ArticleView): upsert { user_id, article_slug, article_id, feedback_type }
--                       onConflict 'user_id,article_slug'
CREATE TABLE IF NOT EXISTS article_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_slug  TEXT NOT NULL,
  article_id    UUID,
  feedback_type TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, article_slug)
);
CREATE INDEX IF NOT EXISTS idx_article_feedback_slug ON article_feedback(article_slug);

ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "af_own" ON article_feedback;
CREATE POLICY "af_own" ON article_feedback
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "af_admin_read" ON article_feedback;
CREATE POLICY "af_admin_read" ON article_feedback
  FOR SELECT USING (is_admin());

-- ── 2. reading_history ──────────────────────────────────────
-- Código (TrailsPage): lê { article_slug } por user para calcular progresso.
-- (Obs: hoje só há leitura no código; a gravação do "lido" ainda não está
--  implementada — a tabela fica pronta para quando for.)
CREATE TABLE IF NOT EXISTS reading_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_slug  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, article_slug)
);
CREATE INDEX IF NOT EXISTS idx_reading_history_user ON reading_history(user_id);

ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_own" ON reading_history;
CREATE POLICY "rh_own" ON reading_history
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 3. diary_plan_configs (conteúdo da 011, nunca aplicada aqui) ──
-- Código (AdminDiaryConfig): select * ; upsert { plan_key, config, updated_at }
--                            onConflict 'plan_key'
CREATE TABLE IF NOT EXISTS diary_plan_configs (
  plan_key   TEXT PRIMARY KEY,
  config     JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE diary_plan_configs ENABLE ROW LEVEL SECURITY;

-- policy antiga da 011 usava profiles.id (errado) — recriamos com is_admin().
DROP POLICY IF EXISTS "admin_all_diary_plan_configs" ON diary_plan_configs;
DROP POLICY IF EXISTS "dpc_admin_all" ON diary_plan_configs;
CREATE POLICY "dpc_admin_all" ON diary_plan_configs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- leitura liberada a autenticados (config não é sensível; o diário do usuário
-- poderá respeitá-la no futuro sem novo ajuste de RLS).
DROP POLICY IF EXISTS "dpc_auth_read" ON diary_plan_configs;
CREATE POLICY "dpc_auth_read" ON diary_plan_configs
  FOR SELECT USING (auth.uid() IS NOT NULL);
