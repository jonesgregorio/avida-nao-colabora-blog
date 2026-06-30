-- Allow admins to read all profiles (fixes new users not appearing in AdminUsers panel)
-- Also allow admins to update any profile (for blocking, plan changes, etc.)

-- Drop potentially conflicting policy if it exists
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;

-- Admin read: admins can SELECT all profile rows
CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Admin update: admins can UPDATE any profile row
CREATE POLICY "Admin can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- Ensure every new user gets a profile row immediately on sign-up
-- (belt-and-suspenders: the upsert in useAuth.ts should handle this,
--  but a trigger guarantees it even if the client-side code fails)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, plan, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'free',
    'user',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users if not already present
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
