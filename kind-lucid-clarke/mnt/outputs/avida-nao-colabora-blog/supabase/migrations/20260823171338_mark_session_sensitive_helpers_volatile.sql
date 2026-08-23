
-- Estas funções leem sessão, tabelas ou tempo atual. Marcá-las como VOLATILE
-- impede que o planejador reutilize um resultado que pode variar na consulta.
ALTER FUNCTION public.admin_eligible_plus_users() VOLATILE;
ALTER FUNCTION public.get_user_engagement() VOLATILE;
ALTER FUNCTION public.get_email_stats() VOLATILE;
ALTER FUNCTION public.admin_monthly_care_source(uuid, date, date) VOLATILE;
ALTER FUNCTION public.has_active_unlimited_access(uuid) VOLATILE;
ALTER FUNCTION public.effective_plan_for_user(uuid) VOLATILE;
ALTER FUNCTION public.current_user_has_plan(text) VOLATILE;
ALTER FUNCTION public.can_access_questionnaire(uuid) VOLATILE;
