-- Etapa 11 (Evolução do Admin) — Permissões administrativas (papéis).
--
-- NÃO altera public.is_admin() (usada por dezenas de RPCs e políticas RLS).
-- Continua valendo: admin = role='admin' + sessão AAL2 (MFA). Ninguém perde
-- acesso: todo admin atual vira 'super_admin' (acesso total).
--
-- Camada nova, POR CIMA do is_admin():
--   profiles.admin_role  -> super_admin | content | support | finance | analyst
--   admin_permissions    -> matriz (papel, módulo, ação) => permitido?
--   public.admin_can(m,a) -> is_admin() AND (super_admin OU linha permitida)
--
-- admin_can() é aplicada nas RPCs sensíveis desta evolução (ver mais abaixo).
-- Como todo admin atual é super_admin, o comportamento não muda para ninguém.
-- Idempotente.

-- 1) Papel administrativo -----------------------------------------------------
alter table public.profiles add column if not exists admin_role text;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'profiles' and constraint_name = 'profiles_admin_role_check'
  ) then
    alter table public.profiles add constraint profiles_admin_role_check
      check (admin_role is null or admin_role in ('super_admin','content','support','finance','analyst'));
  end if;
end $$;

-- Todo admin existente vira super_admin; quem não é admin não tem papel.
update public.profiles set admin_role = 'super_admin'
  where role = 'admin' and admin_role is null;
update public.profiles set admin_role = null
  where role <> 'admin' and admin_role is not null;

-- Ao promover/rebaixar admin, mantém admin_role coerente.
create or replace function public.sync_admin_role()
returns trigger language plpgsql as $$
begin
  if new.role = 'admin' and coalesce(new.admin_role, '') = '' then
    new.admin_role := 'super_admin';
  elsif new.role <> 'admin' then
    new.admin_role := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_admin_role on public.profiles;
create trigger trg_sync_admin_role
  before insert or update of role, admin_role on public.profiles
  for each row execute function public.sync_admin_role();

-- 2) Matriz de permissões ---------------------------------------------------
create table if not exists public.admin_permissions (
  admin_role text not null,
  module     text not null,
  action     text not null default 'view',
  allowed    boolean not null default false,
  primary key (admin_role, module, action)
);

alter table public.admin_permissions enable row level security;
drop policy if exists admin_permissions_read on public.admin_permissions;
create policy admin_permissions_read on public.admin_permissions
  for select to authenticated using (public.is_admin());
-- Escrita só via RPC (SECURITY DEFINER); nada de UPDATE direto do cliente.
revoke insert, update, delete on public.admin_permissions from authenticated, anon;

-- Seed do padrão (não sobrescreve ajustes já feitos).
insert into public.admin_permissions (admin_role, module, action, allowed) values
  ('content','overview','view',true),
  ('content','content','view',true),   ('content','content','operate',true),
  ('content','communication','view',true), ('content','communication','operate',true),
  ('content','analytics','view',true),

  ('support','overview','view',true),
  ('support','users','view',true),     ('support','users','operate',true),
  ('support','communication','view',true), ('support','communication','operate',true),
  ('support','audit','view',true),

  ('finance','overview','view',true),
  ('finance','users','view',true),
  ('finance','finance','view',true),   ('finance','finance','operate',true),
  ('finance','analytics','view',true),
  ('finance','audit','view',true),

  ('analyst','overview','view',true),
  ('analyst','users','view',true),
  ('analyst','content','view',true),
  ('analyst','analytics','view',true),
  ('analyst','audit','view',true)
on conflict (admin_role, module, action) do nothing;

-- 3) Funções de checagem ---------------------------------------------------
create or replace function public.admin_my_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select admin_role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.admin_can(p_module text, p_action text default 'view')
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin() and (
    coalesce((select admin_role from public.profiles where user_id = auth.uid()), '') = 'super_admin'
    or exists (
      select 1 from public.admin_permissions ap
      where ap.admin_role = (select admin_role from public.profiles where user_id = auth.uid())
        and ap.module = p_module and ap.action = p_action and ap.allowed
    )
  );
$$;

-- Módulos que o admin atual pode ver (para o menu). Qualquer admin pode
-- consultar as PRÓPRIAS permissões.
create or replace function public.admin_my_permissions()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when not public.is_admin() then '[]'::jsonb
    when coalesce((select admin_role from public.profiles where user_id = auth.uid()), '') = 'super_admin'
      then '["*"]'::jsonb
    else coalesce((
      select jsonb_agg(distinct module)
      from public.admin_permissions
      where admin_role = (select admin_role from public.profiles where user_id = auth.uid())
        and action = 'view' and allowed
    ), '[]'::jsonb)
  end;
$$;

-- 4) Trocar o papel de um admin (só quem gerencia permissões) --------------
create or replace function public.admin_set_admin_role(target_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_prev text;
begin
  if not public.admin_can('permissions','manage') then
    raise exception 'not authorized';
  end if;
  if p_role not in ('super_admin','content','support','finance','analyst') then
    raise exception 'papel inválido: %', p_role;
  end if;
  if not exists (select 1 from public.profiles where user_id = target_user_id and role = 'admin') then
    raise exception 'usuário não é administrador';
  end if;

  select admin_role into v_prev from public.profiles where user_id = target_user_id;

  if v_prev = 'super_admin' and p_role <> 'super_admin'
     and (select count(*) from public.profiles where role = 'admin' and admin_role = 'super_admin') <= 1 then
    raise exception 'não é possível rebaixar o último super admin';
  end if;

  update public.profiles set admin_role = p_role, updated_at = now() where user_id = target_user_id;
  return jsonb_build_object('previous', v_prev, 'new', p_role);
end;
$$;

-- 5) Matriz completa para a tela -----------------------------------------
create or replace function public.admin_rbac_matrix()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.admin_can('permissions','view') then
    raise exception 'not authorized';
  end if;
  return jsonb_build_object(
    'roles', jsonb_build_array('super_admin','content','support','finance','analyst'),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'admin_role', admin_role, 'module', module, 'action', action, 'allowed', allowed))
      from public.admin_permissions), '[]'::jsonb),
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'name', coalesce(p.full_name, ''), 'admin_role', coalesce(p.admin_role, 'super_admin')))
      from public.profiles p where p.role = 'admin'), '[]'::jsonb)
  );
end;
$$;

-- super_admin sempre pode gerenciar permissões (admin_can devolve true p/ ele).
grant execute on function public.admin_my_role() to authenticated;
grant execute on function public.admin_my_permissions() to authenticated;
grant execute on function public.admin_can(text, text) to authenticated;
revoke all on function public.admin_set_admin_role(uuid, text) from public, anon;
grant execute on function public.admin_set_admin_role(uuid, text) to authenticated;
revoke all on function public.admin_rbac_matrix() from public, anon;
grant execute on function public.admin_rbac_matrix() to authenticated;
