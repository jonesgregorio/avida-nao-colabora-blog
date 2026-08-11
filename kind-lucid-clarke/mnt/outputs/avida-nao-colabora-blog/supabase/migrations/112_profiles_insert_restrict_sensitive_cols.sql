-- Migration 112: Restringe INSERT em profiles para impedir escalada de privilégio
-- Um cliente com a anon key não pode criar perfil com plan != 'free' ou role != 'user'.

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;

CREATE POLICY "users_insert_own_profile"
  ON profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (plan = 'free' OR plan IS NULL)
    AND (role = 'user' OR role IS NULL)
  );
