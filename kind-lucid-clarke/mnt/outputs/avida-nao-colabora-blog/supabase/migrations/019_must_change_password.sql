-- Flag users to change their password on next login (set by admin when defining a temporary password)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;

-- Recreate admin_set_user_password to also set the flag
CREATE OR REPLACE FUNCTION admin_set_user_password(target_user_id uuid, new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF new_password IS NULL OR length(trim(new_password)) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at = NOW()
  WHERE id = target_user_id;
  UPDATE profiles SET must_change_password = true WHERE user_id = target_user_id;
END;
$$;
