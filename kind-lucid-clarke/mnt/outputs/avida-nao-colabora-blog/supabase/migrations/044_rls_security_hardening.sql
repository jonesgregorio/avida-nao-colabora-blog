-- ============================================================
-- Migration 044: Endurecimento de segurança RLS
--   1. articles — paywall por plan_required + artigos agendados
--   2. user_subscriptions — remover INSERT/UPDATE por usuário comum
--   3. plan_change_history — remover INSERT por usuário comum
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ARTICLES — RLS com paywall real por plan_required
-- ─────────────────────────────────────────────────────────────

-- Remove policies antigas (sem paywall)
DROP POLICY IF EXISTS "Articles are public"   ON articles;
DROP POLICY IF EXISTS "Admin escreve artigos" ON articles;

-- Helper: artigo está "visível" (publicado ou agendado já vencido)
-- Admin sempre vê tudo
CREATE POLICY "articles_admin_all" ON articles
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Visitante anônimo e usuário free: somente free + publicado/agendado
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

-- Usuário essential (e acima): pode ler artigos essential
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

-- Usuário therapeutic (e acima): pode ler artigos therapeutic
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

-- Usuário therapeutic-plus: pode ler artigos therapeutic-plus
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

-- ─────────────────────────────────────────────────────────────
-- 2. USER_SUBSCRIPTIONS — apenas leitura para usuário comum
--    Escrita apenas por service_role (webhooks/Edge Functions)
-- ─────────────────────────────────────────────────────────────

-- Remove políticas que permitiam INSERT/UPDATE pelo próprio usuário
DROP POLICY IF EXISTS "sub_insert_own"  ON user_subscriptions;
DROP POLICY IF EXISTS "sub_update_own"  ON user_subscriptions;

-- Mantém apenas leitura (sub_own e sub_admin já existem)
-- Confirma existência da policy de leitura
DROP POLICY IF EXISTS "sub_own" ON user_subscriptions;
CREATE POLICY "sub_own" ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin mantém acesso total (já existe como "sub_admin", reconfirma)
DROP POLICY IF EXISTS "sub_admin" ON user_subscriptions;
CREATE POLICY "sub_admin" ON user_subscriptions
  FOR ALL
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. PLAN_CHANGE_HISTORY — remover INSERT por usuário comum
--    Histórico só pode ser criado por admin/webhook (service_role)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "pch_insert" ON plan_change_history;

-- Usuário pode apenas ler seu próprio histórico
DROP POLICY IF EXISTS "pch_own" ON plan_change_history;
CREATE POLICY "pch_own" ON plan_change_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin mantém acesso total
DROP POLICY IF EXISTS "pch_admin" ON plan_change_history;
CREATE POLICY "pch_admin" ON plan_change_history
  FOR ALL
  USING (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. Garantir coluna subscription_status em profiles (usada no paywall)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_access BOOLEAN DEFAULT false;

-- Backfill: usuários com plano pago têm subscription_status active por padrão
UPDATE profiles
SET subscription_status = 'active'
WHERE subscription_status IS NULL;
