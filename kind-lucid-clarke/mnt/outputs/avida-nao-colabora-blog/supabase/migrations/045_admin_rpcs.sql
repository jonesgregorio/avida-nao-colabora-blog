-- ============================================================
-- Migration 045: RPCs administrativas seguras para gestão
-- de usuários, planos e assinaturas.
-- Todas as funções são SECURITY DEFINER e validam is_admin().
-- ============================================================

-- ─── 1. admin_change_user_plan ─────────────────────────────────────────────────
-- Altera o plano de um usuário, atualiza profiles e registra
-- histórico em plan_change_history.
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
  -- Valida que o solicitante é admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar planos.';
  END IF;

  -- Valida o novo plano
  IF p_new_plan NOT IN ('free', 'essential', 'therapeutic', 'therapeutic-plus') THEN
    RAISE EXCEPTION 'Plano inválido: %', p_new_plan;
  END IF;

  -- Lê plano atual
  SELECT plan INTO v_old_plan FROM profiles WHERE user_id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado: %', p_target_user_id;
  END IF;

  -- Atualiza profiles
  UPDATE profiles
  SET plan       = p_new_plan,
      updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Registra histórico
  INSERT INTO plan_change_history (
    user_id, old_plan, new_plan, change_type,
    amount_charged, effective_at, source, notes
  ) VALUES (
    p_target_user_id, v_old_plan, p_new_plan, 'admin_change',
    0, now(), 'admin', p_notes
  );

  v_result := jsonb_build_object(
    'success', true,
    'old_plan', v_old_plan,
    'new_plan', p_new_plan
  );
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_change_user_plan TO authenticated;

-- ─── 2. admin_update_user_role ─────────────────────────────────────────────────
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_new_role NOT IN ('user', 'admin', 'professional') THEN
    RAISE EXCEPTION 'Role inválido: %', p_new_role;
  END IF;

  UPDATE profiles
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_user_role TO authenticated;

-- ─── 3. admin_record_plan_change ───────────────────────────────────────────────
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO plan_change_history (
    user_id, old_plan, new_plan, change_type,
    amount_charged, effective_at, source, notes
  ) VALUES (
    p_target_user_id, p_old_plan, p_new_plan, p_change_type,
    p_amount, now(), p_source, p_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_record_plan_change TO authenticated;

-- ─── 4. admin_cancel_subscription ─────────────────────────────────────────────
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT plan INTO v_old_plan FROM profiles WHERE user_id = p_target_user_id;

  -- Cancela a assinatura na tabela user_subscriptions (se existir)
  UPDATE user_subscriptions
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_target_user_id AND status NOT IN ('cancelled');

  -- Registra histórico
  INSERT INTO plan_change_history (
    user_id, old_plan, new_plan, change_type,
    amount_charged, effective_at, source, notes
  ) VALUES (
    p_target_user_id, v_old_plan, 'free', 'admin_cancel',
    0, now(), 'admin', p_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_cancel_subscription TO authenticated;

-- ─── 5. admin_set_unlimited_access ────────────────────────────────────────────
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE profiles
  SET unlimited_access = p_enabled, updated_at = now()
  WHERE user_id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_unlimited_access TO authenticated;

-- ─── 6. admin_force_password_change ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_force_password_change(
  p_target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE profiles
  SET must_change_password = true, updated_at = now()
  WHERE user_id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_force_password_change TO authenticated;

-- ─── RLS: garantir que admin pode administrar user_subscriptions ───────────────
DROP POLICY IF EXISTS "admin_subscriptions_all" ON user_subscriptions;
CREATE POLICY "admin_subscriptions_all" ON user_subscriptions
  FOR ALL
  USING (is_admin());

-- ─── RLS: garantir que admin pode administrar plan_change_history ──────────────
-- (policies já criadas em 044, esta é confirmação idempotente)
DROP POLICY IF EXISTS "pch_admin" ON plan_change_history;
CREATE POLICY "pch_admin" ON plan_change_history
  FOR ALL
  USING (is_admin());
