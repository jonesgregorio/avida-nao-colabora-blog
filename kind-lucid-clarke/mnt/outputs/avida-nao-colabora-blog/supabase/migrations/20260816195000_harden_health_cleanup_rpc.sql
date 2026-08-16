-- A limpeza de histórico é trabalho interno do agendador e não deve poder ser
-- disparada pela API. Também fixa o search_path para evitar resolução mutável.
ALTER FUNCTION public.cleanup_old_health_checks() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_health_checks() FROM PUBLIC, anon, authenticated;
