begin;

-- Hardening seguro das funções administrativas/trigger apontadas pelo linter.
-- Não altera regras funcionais, dados, Diário ou conteúdo histórico.

alter function public.set_user_history_items_updated_at() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.content_versions_block_mutation() set search_path = public, pg_temp;
alter function public.sync_admin_role() set search_path = public, pg_temp;
alter function public.feature_flag_is_critical(text) set search_path = public, pg_temp;
alter function public.feature_flag_bucket(text, uuid) set search_path = public, pg_temp;

-- As três RPCs abaixo pertencem exclusivamente ao Admin. O grant explícito para
-- authenticated já existia, mas o EXECUTE padrão herdado de PUBLIC mantinha anon
-- capaz de chamá-las. Removemos essa superfície sem mudar a autorização interna.
revoke all on function public.admin_my_role() from public, anon;
revoke all on function public.admin_my_permissions() from public, anon;
revoke all on function public.admin_can(text, text) from public, anon;

grant execute on function public.admin_my_role() to authenticated, service_role;
grant execute on function public.admin_my_permissions() to authenticated, service_role;
grant execute on function public.admin_can(text, text) to authenticated, service_role;

commit;
