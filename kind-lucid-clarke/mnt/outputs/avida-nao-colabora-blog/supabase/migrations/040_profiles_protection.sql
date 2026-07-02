-- ============================================================
-- Migration 040: proteção de profiles contra UPDATE sensível
-- ============================================================
-- Problema: a policy "Users manage own profile" (migration 001)
-- usa WITH CHECK (auth.uid() = user_id) que permite ao usuário
-- atualizar qualquer coluna, incluindo plan, role, is_admin, etc.
--
-- Solução:
-- 1. Adicionar colunas seguras de perfil (se ainda não existirem)
-- 2. Criar RPC SECURITY DEFINER update_my_profile() que só atualiza
--    campos seguros
-- 3. Remover a policy de UPDATE ampla do usuário
-- 4. Adicionar policy de INSERT segura (apenas campos seguros via upsert)
-- 5. Manter SELECT para o próprio usuário
-- 6. Admin continua com acesso total via policy separada (migration 017)

-- 1. Adicionar colunas seguras de perfil do usuário
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_phrase TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'weekly';

-- 2. RPC segura para atualização de perfil pelo próprio usuário
CREATE OR REPLACE FUNCTION update_my_profile(
  p_full_name          TEXT DEFAULT NULL,
  p_display_name       TEXT DEFAULT NULL,
  p_preferred_name     TEXT DEFAULT NULL,
  p_avatar_url         TEXT DEFAULT NULL,
  p_status_phrase      TEXT DEFAULT NULL,
  p_notification_frequency TEXT DEFAULT NULL
)
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
  SET
    full_name            = COALESCE(p_full_name, full_name),
    display_name         = COALESCE(p_display_name, display_name),
    preferred_name       = COALESCE(p_preferred_name, preferred_name),
    avatar_url           = COALESCE(p_avatar_url, avatar_url),
    status_phrase        = COALESCE(p_status_phrase, status_phrase),
    notification_frequency = COALESCE(p_notification_frequency, notification_frequency),
    updated_at           = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Permite que qualquer usuário autenticado chame a RPC
GRANT EXECUTE ON FUNCTION update_my_profile TO authenticated;

-- 3. Remover a policy ampla (SELECT + UPDATE) do migration 001
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;

-- 4. Re-criar: SELECT — usuário vê apenas seu próprio perfil
CREATE POLICY "users_select_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 5. INSERT seguro — usuário pode criar seu próprio perfil inicial
--    (colunas sensíveis têm DEFAULT seguro: plan='free', role='user')
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE direto pelo usuário REMOVIDO — use update_my_profile() RPC
-- (Admin continua com UPDATE via "Admin can update all profiles" de migration 017)
