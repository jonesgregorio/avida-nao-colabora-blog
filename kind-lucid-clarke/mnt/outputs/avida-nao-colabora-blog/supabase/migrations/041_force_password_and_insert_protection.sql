-- ============================================================
-- Migration 041: RPC clear_must_change_password + INSERT seguro em profiles
-- ============================================================

-- 1. RPC para limpar o flag must_change_password
--    Chamada pelo próprio usuário após troca de senha.
--    SECURITY DEFINER: bypass RLS — só atualiza a linha do próprio usuário.
DROP FUNCTION IF EXISTS clear_must_change_password();

CREATE FUNCTION clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  UPDATE profiles
  SET must_change_password = false,
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION clear_must_change_password TO authenticated;

-- 2. Fortalecer policy de INSERT em profiles
--    Impede usuário de criar perfil com plan ou role privilegiados.
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;

CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(plan, 'free') = 'free'
    AND COALESCE(role, 'user') = 'user'
  );
