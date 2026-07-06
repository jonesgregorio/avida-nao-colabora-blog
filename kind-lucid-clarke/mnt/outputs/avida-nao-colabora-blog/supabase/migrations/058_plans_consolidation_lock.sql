-- ============================================================
-- Migration 058: Consolidação FINAL dos planos → free / essential / plus
-- ------------------------------------------------------------
-- Objetivo: eliminar de vez 'therapeutic'/'therapeutic-plus' das tabelas ATIVAS
--   e APERTAR os CHECK constraints para aceitar SOMENTE free/essential/plus.
--
-- Segurança:
--   • 100% idempotente (pode rodar várias vezes).
--   • Migra qualquer resíduo therapeutic*→plus ANTES de apertar o constraint
--     (senão o ADD CONSTRAINT falharia em linhas existentes).
--   • Tabelas de HISTÓRICO/LEGADO (plan_change_history, email_templates) NÃO são
--     restringidas — preservam valores históricos.
--   • Cada bloco é protegido contra tabela/coluna ausente.
--   • NÃO cria policies amplas (FOR ALL USING true).
-- ============================================================

-- ─── 1) profiles.plan ───────────────────────────────────────
DO $$ BEGIN
  UPDATE profiles SET plan = 'plus'
   WHERE plan IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE profiles SET plan = 'free'
   WHERE plan IS NULL OR plan NOT IN ('free', 'essential', 'plus');
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
    CHECK (plan IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 2) articles.plan_required ──────────────────────────────
DO $$ BEGIN
  UPDATE articles SET plan_required = 'plus'
   WHERE plan_required IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE articles SET plan_required = 'free'
   WHERE plan_required IS NULL OR plan_required NOT IN ('free', 'essential', 'plus');
  ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_plan_required_check;
  ALTER TABLE articles ADD CONSTRAINT articles_plan_required_check
    CHECK (plan_required IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 3) guided_meditations.plan_level ───────────────────────
DO $$ BEGIN
  UPDATE guided_meditations SET plan_level = 'plus'
   WHERE plan_level IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE guided_meditations SET plan_level = 'free'
   WHERE plan_level IS NULL OR plan_level NOT IN ('free', 'essential', 'plus');
  ALTER TABLE guided_meditations DROP CONSTRAINT IF EXISTS guided_meditations_plan_level_check;
  ALTER TABLE guided_meditations ADD CONSTRAINT guided_meditations_plan_level_check
    CHECK (plan_level IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 4) mini_challenges.plan_level ──────────────────────────
DO $$ BEGIN
  UPDATE mini_challenges SET plan_level = 'plus'
   WHERE plan_level IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE mini_challenges SET plan_level = 'free'
   WHERE plan_level IS NULL OR plan_level NOT IN ('free', 'essential', 'plus');
  ALTER TABLE mini_challenges DROP CONSTRAINT IF EXISTS mini_challenges_plan_level_check;
  ALTER TABLE mini_challenges ADD CONSTRAINT mini_challenges_plan_level_check
    CHECK (plan_level IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 5) guided_prompts.plan_level (coluna pode não existir) ─
DO $$ BEGIN
  UPDATE guided_prompts SET plan_level = 'plus'
   WHERE plan_level IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE guided_prompts SET plan_level = 'free'
   WHERE plan_level IS NULL OR plan_level NOT IN ('free', 'essential', 'plus');
  ALTER TABLE guided_prompts DROP CONSTRAINT IF EXISTS guided_prompts_plan_level_check;
  ALTER TABLE guided_prompts ADD CONSTRAINT guided_prompts_plan_level_check
    CHECK (plan_level IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 6) automated_contents.plan_required ────────────────────
DO $$ BEGIN
  UPDATE automated_contents SET plan_required = 'plus'
   WHERE plan_required IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE automated_contents SET plan_required = 'free'
   WHERE plan_required IS NULL OR plan_required NOT IN ('free', 'essential', 'plus');
  ALTER TABLE automated_contents DROP CONSTRAINT IF EXISTS automated_contents_plan_required_check;
  ALTER TABLE automated_contents ADD CONSTRAINT automated_contents_plan_required_check
    CHECK (plan_required IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 7) trails.plan_required ────────────────────────────────
DO $$ BEGIN
  UPDATE trails SET plan_required = 'plus'
   WHERE plan_required IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE trails SET plan_required = 'free'
   WHERE plan_required IS NULL OR plan_required NOT IN ('free', 'essential', 'plus');
  ALTER TABLE trails DROP CONSTRAINT IF EXISTS trails_plan_required_check;
  ALTER TABLE trails ADD CONSTRAINT trails_plan_required_check
    CHECK (plan_required IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 8) user_subscriptions.plan_key + pending_plan ──────────
DO $$ BEGIN
  UPDATE user_subscriptions SET plan_key = 'plus'
   WHERE plan_key IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE user_subscriptions SET plan_key = 'free'
   WHERE plan_key IS NULL OR plan_key NOT IN ('free', 'essential', 'plus');
  ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_key_check;
  ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_plan_key_check
    CHECK (plan_key IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  UPDATE user_subscriptions SET pending_plan = 'plus'
   WHERE pending_plan IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE user_subscriptions SET pending_plan = NULL
   WHERE pending_plan IS NOT NULL AND pending_plan NOT IN ('free', 'essential', 'plus');
  ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_pending_plan_check;
  ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_pending_plan_check
    CHECK (pending_plan IS NULL OR pending_plan IN ('free', 'essential', 'plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 9) plan_configs: desativa linhas legadas ───────────────
DO $$ BEGIN
  UPDATE plan_configs SET active = false
   WHERE plan_key IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE plan_configs SET is_recommended = (plan_key = 'essential');
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ─── 10) RPC admin_change_user_plan → aceita só free/essential/plus ─
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
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar planos.';
  END IF;
  IF p_new_plan NOT IN ('free', 'essential', 'plus') THEN
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
  RETURN jsonb_build_object('success', true, 'old_plan', v_old_plan, 'new_plan', p_new_plan);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_change_user_plan TO authenticated;

-- ─── 11) RLS de articles: remove tiers 'therapeutic*', mescla em 'plus' ─
--    Hierarquia: free (público) < essential < plus. Plus enxerga essential.
DO $$ BEGIN
  DROP POLICY IF EXISTS "articles_therapeutic" ON articles;
  DROP POLICY IF EXISTS "articles_therapeutic_plus" ON articles;

  DROP POLICY IF EXISTS "articles_essential" ON articles;
  CREATE POLICY "articles_essential" ON articles
    FOR SELECT TO authenticated
    USING (
      plan_required = 'essential'
      AND (status = 'published'
           OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.plan IN ('essential', 'plus')
          AND (profiles.subscription_status IN ('active', 'trialing')
               OR profiles.unlimited_access = true)
      )
    );

  DROP POLICY IF EXISTS "articles_plus" ON articles;
  CREATE POLICY "articles_plus" ON articles
    FOR SELECT TO authenticated
    USING (
      plan_required = 'plus'
      AND (status = 'published'
           OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.plan = 'plus'
          AND (profiles.subscription_status IN ('active', 'trialing')
               OR profiles.unlimited_access = true)
      )
    );
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- ============================================================
-- FIM 058 — planos travados em free/essential/plus.
-- ============================================================
