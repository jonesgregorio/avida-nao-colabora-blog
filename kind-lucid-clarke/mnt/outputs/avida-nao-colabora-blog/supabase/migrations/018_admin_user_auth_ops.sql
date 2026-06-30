-- Admin operations on auth.users (email change, password reset)
-- All functions check is_admin() before executing.

-- 1. Get a user's email (needed to send password reset)
CREATE OR REPLACE FUNCTION admin_get_user_email(target_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = target_user_id;
  RETURN v_email;
END;
$$;

-- 2. Change a user's email
CREATE OR REPLACE FUNCTION admin_change_user_email(target_user_id uuid, new_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF new_email IS NULL OR trim(new_email) = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;
  UPDATE auth.users
  SET
    email = trim(new_email),
    email_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = target_user_id;
END;
$$;

-- 3. Set a user's password directly (admin sets temporary password)
CREATE OR REPLACE FUNCTION admin_set_user_password(target_user_id uuid, new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF new_password IS NULL OR length(trim(new_password)) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = target_user_id;
END;
$$;

-- Grant execute to authenticated users (RLS/is_admin() check is inside each function)
GRANT EXECUTE ON FUNCTION admin_get_user_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_change_user_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_password(uuid, text) TO authenticated;
