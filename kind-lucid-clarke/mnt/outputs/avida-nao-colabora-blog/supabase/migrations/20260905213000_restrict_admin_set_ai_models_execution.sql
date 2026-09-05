-- Least privilege for the administrative AI-model configuration RPC.
-- The function already validates is_admin(), but anonymous callers should not
-- receive EXECUTE permission on a SECURITY DEFINER administrative function.

REVOKE EXECUTE ON FUNCTION public.admin_set_ai_models(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_ai_models(text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_set_ai_models(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_models(text, text) TO service_role;
