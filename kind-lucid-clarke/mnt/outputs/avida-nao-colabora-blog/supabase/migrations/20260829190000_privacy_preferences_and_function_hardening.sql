-- Fase 15 — controles de privacidade + hardening de funções internas.
-- Esta migration é aditiva: não altera Auth, Stripe, preços ou entitlements.

create table if not exists public.user_privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  history_personalization_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_privacy_preferences enable row level security;

revoke all on table public.user_privacy_preferences from anon;
revoke all on table public.user_privacy_preferences from authenticated;
grant select, insert, update on table public.user_privacy_preferences to authenticated;

drop policy if exists "privacy_preferences_own_select" on public.user_privacy_preferences;
create policy "privacy_preferences_own_select"
on public.user_privacy_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "privacy_preferences_own_insert" on public.user_privacy_preferences;
create policy "privacy_preferences_own_insert"
on public.user_privacy_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "privacy_preferences_own_update" on public.user_privacy_preferences;
create policy "privacy_preferences_own_update"
on public.user_privacy_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Reutiliza o callback genérico já existente, agora com search_path fixo.
drop trigger if exists user_privacy_preferences_set_updated_at on public.user_privacy_preferences;
create trigger user_privacy_preferences_set_updated_at
before update on public.user_privacy_preferences
for each row execute function public.set_updated_at();

-- Callbacks de trigger não são RPCs. Remove execução direta pelos papéis expostos
-- sem impedir que os triggers já registrados continuem executando normalmente.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
  end loop;
end
$$;

-- Funções utilitárias usadas por triggers: search_path explícito evita resolução
-- de objetos por schemas inesperados.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.update_support_updated_at() set search_path = public, pg_temp;
alter function public.set_user_subscription_plan_activated_at() set search_path = public, pg_temp;

-- Estas RPCs são recursos de conta autenticada. O acesso anônimo não é necessário;
-- authenticated permanece com EXECUTE para preservar o frontend existente.
revoke execute on function public.clear_must_change_password() from anon;
revoke execute on function public.mark_personalized_content_as_read(uuid) from anon;
revoke execute on function public.touch_last_seen() from anon;
revoke execute on function public.update_my_profile(text, text, text, text, text, text) from anon;
