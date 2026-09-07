-- Etapa 12 (Evolução do Admin) — Feature flags / controle de funcionalidades.
--
-- Uma flag = uma chave com um MODO:
--   off        -> desligada para todos
--   admins     -> só administradores (is_admin())
--   beta       -> administradores + a lista explícita de user_ids
--   percentage -> uma fatia estável dos usuários (hash do id, sem sorteio por
--                 render/horário) + filtros de plano/lista/ambiente
--   on         -> ligada para todos (respeitando filtros de plano/ambiente)
--
-- PROTEÇÃO: chaves que tocam áreas críticas (auth*, billing*, payment*,
-- data_integrity*, checkout*, webhook*) nascem is_protected=true e NÃO podem ser
-- colocadas em off/admins sem p_force=true — evita "desligar sem querer" login,
-- cobrança ou integridade de dados.
--
-- Avaliação server-side: feature_flag_enabled() / get_active_feature_flags().
-- Escrita só via admin_set_feature_flag (admin_can('system','operate')).
-- Idempotente.

create table if not exists public.feature_flags (
  key          text primary key,
  label        text not null,
  description  text,
  mode         text not null default 'off' check (mode in ('off','admins','beta','percentage','on')),
  percentage   integer not null default 0 check (percentage between 0 and 100),
  plans        text[] not null default '{}',   -- vazio = todos os planos
  user_ids     uuid[] not null default '{}',   -- allow-list (sempre ligada p/ eles)
  environments text[] not null default '{}',   -- vazio = todos os ambientes
  is_protected boolean not null default false,
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.feature_flags enable row level security;
drop policy if exists feature_flags_admin_read on public.feature_flags;
create policy feature_flags_admin_read on public.feature_flags
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.feature_flags from authenticated, anon;

-- Chaves protegidas por padrão (prefixos que tocam áreas críticas).
create or replace function public.feature_flag_is_critical(p_key text)
returns boolean language sql immutable as $$
  select p_key ~* '^(auth|login|mfa|billing|payment|checkout|subscription|webhook|stripe|data_integrity|rls)([_.-]|$)';
$$;

-- Bucket estável 0..99 (FNV-1a) — mesmo usuário, mesmo grupo entre deploys.
create or replace function public.feature_flag_bucket(p_key text, p_user uuid)
returns integer language sql immutable as $$
  select (abs(hashtextextended(p_key || ':' || coalesce(p_user::text, ''), 0)) % 100)::integer;
$$;

-- Avalia UMA flag para o usuário atual.
create or replace function public.feature_flag_enabled(p_key text, p_env text default 'production')
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  f public.feature_flags%rowtype;
  v_uid  uuid := auth.uid();
  v_plan text;
begin
  select * into f from public.feature_flags where key = p_key;
  if not found then return false; end if;

  -- Ambiente: se a flag restringe ambientes e este não está na lista, off.
  if array_length(f.environments, 1) is not null and not (p_env = any(f.environments)) then
    return false;
  end if;

  -- Allow-list vence sempre.
  if v_uid is not null and v_uid = any(f.user_ids) then
    return true;
  end if;

  if f.mode = 'off' then return false; end if;
  if f.mode = 'admins' then return public.is_admin(); end if;
  if f.mode = 'beta' then return public.is_admin(); end if;

  -- Filtro de plano (para 'on' e 'percentage').
  if array_length(f.plans, 1) is not null then
    select case
      when coalesce(p.plan,'free') in ('plus','therapeutic','therapeutic-plus') then 'plus'
      when coalesce(p.plan,'free') = 'essential' then 'essential'
      else 'free' end
    into v_plan
    from public.profiles p where p.user_id = v_uid;
    if v_plan is null or not (v_plan = any(f.plans)) then
      return false;
    end if;
  end if;

  if f.mode = 'on' then return true; end if;
  if f.mode = 'percentage' then
    if f.percentage <= 0 then return false; end if;
    if f.percentage >= 100 then return true; end if;
    if v_uid is null then return false; end if;
    return public.feature_flag_bucket(p_key, v_uid) < f.percentage;
  end if;

  return false;
end;
$$;

-- Todas as flags resolvidas para o usuário atual, num objeto { key: bool }.
create or replace function public.get_active_feature_flags(p_env text default 'production')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  r record;
  result jsonb := '{}'::jsonb;
begin
  for r in select key from public.feature_flags loop
    result := result || jsonb_build_object(r.key, public.feature_flag_enabled(r.key, p_env));
  end loop;
  return result;
end;
$$;

-- Criar / atualizar uma flag (admin com permissão de Sistema).
create or replace function public.admin_set_feature_flag(
  p_key          text,
  p_label        text default null,
  p_description  text default null,
  p_mode         text default null,
  p_percentage   integer default null,
  p_plans        text[] default null,
  p_user_ids     uuid[] default null,
  p_environments text[] default null,
  p_force        boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing public.feature_flags%rowtype;
  v_mode   text;
  v_protected boolean;
begin
  if not public.admin_can('system','operate') then
    raise exception 'not authorized';
  end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'key obrigatória';
  end if;

  select * into existing from public.feature_flags where key = p_key;
  v_mode := coalesce(p_mode, existing.mode, 'off');
  if v_mode not in ('off','admins','beta','percentage','on') then
    raise exception 'modo inválido: %', v_mode;
  end if;

  v_protected := coalesce(existing.is_protected, false) or public.feature_flag_is_critical(p_key);

  -- Guarda-vidas: chave crítica não vai para off/admins sem confirmação forte.
  if v_protected and v_mode in ('off','admins') and not coalesce(p_force, false) then
    raise exception 'flag protegida "%": desligar exige confirmação (p_force). Ela pode controlar login, cobrança ou integridade de dados.', p_key
      using errcode = 'check_violation';
  end if;

  insert into public.feature_flags as ff
    (key, label, description, mode, percentage, plans, user_ids, environments, is_protected, updated_by, updated_at)
  values (
    p_key,
    coalesce(p_label, existing.label, p_key),
    coalesce(p_description, existing.description),
    v_mode,
    coalesce(p_percentage, existing.percentage, 0),
    coalesce(p_plans, existing.plans, '{}'),
    coalesce(p_user_ids, existing.user_ids, '{}'),
    coalesce(p_environments, existing.environments, '{}'),
    v_protected,
    auth.uid(),
    now()
  )
  on conflict (key) do update set
    label = excluded.label,
    description = excluded.description,
    mode = excluded.mode,
    percentage = excluded.percentage,
    plans = excluded.plans,
    user_ids = excluded.user_ids,
    environments = excluded.environments,
    is_protected = ff.is_protected or excluded.is_protected,
    updated_by = excluded.updated_by,
    updated_at = now();

  return jsonb_build_object('key', p_key, 'mode', v_mode, 'protected', v_protected);
end;
$$;

revoke all on function public.admin_set_feature_flag(text, text, text, text, integer, text[], uuid[], text[], boolean) from public, anon;
grant execute on function public.admin_set_feature_flag(text, text, text, text, integer, text[], uuid[], text[], boolean) to authenticated;
grant execute on function public.feature_flag_enabled(text, text) to authenticated, anon;
grant execute on function public.get_active_feature_flags(text) to authenticated, anon;

-- Exemplos não-críticos (não sobrescreve se já existirem).
insert into public.feature_flags (key, label, description, mode, percentage) values
  ('proactive_home_widgets', 'Blocos proativos na Home', 'Cartões de continuidade e sugestão na tela inicial.', 'on', 0),
  ('new_report_layout', 'Novo layout de relatório', 'Versão redesenhada da página de relatório, em avaliação.', 'beta', 0)
on conflict (key) do nothing;
