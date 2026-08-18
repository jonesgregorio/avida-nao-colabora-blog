-- ==========================================================================
-- Endurece helpers de plano efetivo: usuário autenticado só consulta o próprio
-- UUID (ou um admin). service_role/cron continuam podendo consultar qualquer
-- usuário para RLS, triggers e automações internas.
-- ========================================================================== 

CREATE OR REPLACE FUNCTION public.has_active_unlimited_access(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed to inspect another user entitlement';
  END IF;

  RETURN COALESCE((
    SELECT p.unlimited_access = true
       AND (p.unlimited_access_until IS NULL OR p.unlimited_access_until > now())
    FROM public.profiles p
    WHERE p.user_id = p_user_id
    LIMIT 1
  ), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.effective_plan_for_user(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
BEGIN
  IF auth.role() = 'authenticated'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed to inspect another user plan';
  END IF;

  IF public.has_active_unlimited_access(p_user_id) THEN
    RETURN 'plus';
  END IF;

  SELECT CASE p.plan
    WHEN 'therapeutic' THEN 'plus'
    WHEN 'therapeutic-plus' THEN 'plus'
    WHEN 'therapeutic_plus' THEN 'plus'
    ELSE COALESCE(p.plan, 'free')
  END
  INTO v_plan
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  RETURN COALESCE(v_plan, 'free');
END;
$$;

REVOKE ALL ON FUNCTION public.has_active_unlimited_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.effective_plan_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_unlimited_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_plan_for_user(uuid) TO authenticated, service_role;
