-- Alguns deploys legados criaram grants explícitos para anon. Este reforço
-- remove esses grants sem retirar o service_role usado pelas automações.
REVOKE EXECUTE ON FUNCTION public.admin_autofix_all_health() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_autofix_health_check(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_subscription(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_change_user_email(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_change_user_plan(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_eligible_plus_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_force_password_change(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_email(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_monthly_care_source(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_record_plan_change(uuid, text, text, text, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_ai_provider(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_unlimited_access(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_password(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.publish_due_scheduled() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_analytics_events() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
