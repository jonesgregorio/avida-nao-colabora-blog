-- Funções administrativas validam is_admin() internamente, mas não devem ser
-- invocáveis por sessões anônimas. Mantém o Admin autenticado funcional e
-- remove a superfície pública das RPCs sensíveis.
REVOKE EXECUTE ON FUNCTION public.admin_autofix_all_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_autofix_health_check(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_subscription(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_change_user_email(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_change_user_plan(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_eligible_plus_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_force_password_change(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_email(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_monthly_care_source(uuid, date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_record_plan_change(uuid, text, text, text, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_ai_provider(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_unlimited_access(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_password(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_autofix_all_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_autofix_health_check(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_plan(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_eligible_plus_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_password_change(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_monthly_care_source(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_plan_change(uuid, text, text, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_provider(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_unlimited_access(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;

-- Rotinas de manutenção são chamadas pelo servidor/agendador; não devem estar
-- expostas via API pública, nem para usuários autenticados comuns.
REVOKE EXECUTE ON FUNCTION public.publish_due_scheduled() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_old_analytics_events() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
