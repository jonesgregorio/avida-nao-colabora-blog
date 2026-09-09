-- ============================================================================
-- Novos Usuários e Novas Assinaturas — eventos administrativos + alert center
-- ============================================================================
-- Tabela dedicada de eventos administrativos, alimentada por TRIGGERS de banco
-- (nunca pelo frontend). Dois eventos iniciais:
--   user_signup          — profile efetivamente criado (trigger em profiles)
--   subscription_started  — assinatura paga confirmada de verdade
--                           (trigger em subscription_events, tipo checkout_completed,
--                            que é o ponto canônico do webhook Stripe: nasce só do
--                            checkout.session.completed, nunca de subscription.created)
--
-- Idempotência: coluna idempotency_key UNIQUE + ON CONFLICT DO NOTHING.
--   user_signup:<user_id>
--   subscription_started:<stripe_subscription_id>
--
-- Segurança: RLS restritiva. SELECT só para is_admin(). Nenhum INSERT/UPDATE/DELETE
-- via API (frontend/anon/authenticated) — só triggers SECURITY DEFINER e service_role.
--
-- Expansível: event_type é texto livre; tipos futuros (subscription_cancelled,
-- payment_failed, ai_failure, ...) entram sem mudança de schema.
--
-- Idempotente (create table if not exists / create or replace / drop policy if exists).

-- ---------------------------------------------------------------------------
-- 1. profiles.first_paid_at — carimbo da PRIMEIRA ativação paga (para badges).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists first_paid_at timestamptz;

comment on column public.profiles.first_paid_at is
  'Primeira ativação paga confirmada (checkout.session.completed). Nunca sobrescrito depois.';

-- ---------------------------------------------------------------------------
-- 2. Tabela de eventos administrativos.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_activity_events (
  id               uuid primary key default gen_random_uuid(),
  event_type       text not null,
  user_id          uuid references auth.users(id) on delete set null,
  title            text not null,
  message          text not null default '',
  metadata         jsonb not null default '{}'::jsonb,
  source           text,
  source_event_id  text,
  idempotency_key  text unique,
  created_at       timestamptz not null default now(),
  read_at          timestamptz,
  acknowledged_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_admin_activity_created   on public.admin_activity_events (created_at desc);
create index if not exists idx_admin_activity_type       on public.admin_activity_events (event_type, created_at desc);
create index if not exists idx_admin_activity_user       on public.admin_activity_events (user_id);
create index if not exists idx_admin_activity_unread     on public.admin_activity_events (read_at) where read_at is null;

alter table public.admin_activity_events enable row level security;

-- Leitura só para administradores. Escrita: nenhuma policy → só definer/service_role.
drop policy if exists "admin_activity_events_admin_read" on public.admin_activity_events;
create policy "admin_activity_events_admin_read"
  on public.admin_activity_events
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Emissor central (SECURITY DEFINER, idempotente).
-- ---------------------------------------------------------------------------
create or replace function public._admin_activity_emit(
  p_event_type      text,
  p_user_id         uuid,
  p_title           text,
  p_message         text,
  p_metadata        jsonb,
  p_source          text,
  p_source_event_id text,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.admin_activity_events
    (event_type, user_id, title, message, metadata, source, source_event_id, idempotency_key)
  values
    (p_event_type, p_user_id, p_title, coalesce(p_message, ''), coalesce(p_metadata, '{}'::jsonb),
     p_source, p_source_event_id, p_idempotency_key)
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public._admin_activity_emit(text, uuid, text, text, jsonb, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Trigger: novo cadastro (profile criado).
-- ---------------------------------------------------------------------------
create or replace function public.tg_admin_activity_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := nullif(btrim(coalesce(new.full_name, '')), '');
  v_plan text := coalesce(new.plan, 'free');
  v_plan_label text := case v_plan
    when 'free' then 'Gratuita'
    when 'essential' then 'Essencial'
    when 'plus' then 'Plus'
    else initcap(v_plan)
  end;
begin
  perform public._admin_activity_emit(
    'user_signup',
    new.user_id,
    'Novo usuário cadastrado',
    coalesce(v_name, 'Um novo usuário') || ' acabou de criar uma conta ' || v_plan_label || '.',
    jsonb_build_object(
      'plan', v_plan,
      'email', new.email,
      'created_at', coalesce(new.created_at, now()),
      'account_status', coalesce(new.account_status, 'active')
    ),
    'profiles_trigger',
    new.user_id::text,
    'user_signup:' || new.user_id::text
  );
  return new;
end;
$$;

revoke all on function public.tg_admin_activity_on_signup() from public, anon, authenticated;

drop trigger if exists trg_admin_activity_on_signup on public.profiles;
create trigger trg_admin_activity_on_signup
  after insert on public.profiles
  for each row execute function public.tg_admin_activity_on_signup();

-- ---------------------------------------------------------------------------
-- 5. Trigger: nova assinatura (checkout confirmado).
--    Fonte canônica: subscription_events.event_type = 'checkout_completed'
--    (o webhook só o registra em checkout.session.completed). subscription.created
--    grava 'subscription_created' e NÃO dispara este alerta → sem duplicidade.
--    Segunda barreira: idempotency_key por stripe_subscription_id.
-- ---------------------------------------------------------------------------
create or replace function public.tg_admin_activity_on_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_email text;
  v_plan text := coalesce(new.new_plan, 'plus');
  v_plan_label text := case v_plan
    when 'essential' then 'Essencial'
    when 'plus' then 'Plus'
    else initcap(coalesce(v_plan, 'pago'))
  end;
  v_sub_key text := coalesce(nullif(btrim(new.stripe_subscription_id), ''), new.id::text);
begin
  if new.event_type <> 'checkout_completed' then
    return new;
  end if;

  select nullif(btrim(coalesce(p.full_name, '')), ''), p.email
    into v_name, v_email
  from public.profiles p
  where p.user_id = new.user_id;

  -- Carimba a primeira ativação paga (nunca sobrescreve).
  update public.profiles
     set first_paid_at = coalesce(first_paid_at, coalesce(new.occurred_at, now()))
   where user_id = new.user_id;

  perform public._admin_activity_emit(
    'subscription_started',
    new.user_id,
    'Nova assinatura ' || v_plan_label,
    coalesce(v_name, 'Um usuário') || ' acabou de assinar o Plano ' || v_plan_label || '.',
    jsonb_build_object(
      'plan', v_plan,
      'subscription_id', new.stripe_subscription_id,
      'customer_id', new.stripe_customer_id,
      'stripe_event_id', new.stripe_event_id,
      'price_id', new.metadata->>'price_id',
      'currency', coalesce(new.currency, 'BRL'),
      'amount', new.amount,
      'email', v_email,
      'created_at', coalesce(new.occurred_at, now())
    ),
    'stripe_webhook',
    new.stripe_event_id,
    'subscription_started:' || v_sub_key
  );
  return new;
end;
$$;

revoke all on function public.tg_admin_activity_on_subscription() from public, anon, authenticated;

drop trigger if exists trg_admin_activity_on_subscription on public.subscription_events;
create trigger trg_admin_activity_on_subscription
  after insert on public.subscription_events
  for each row execute function public.tg_admin_activity_on_subscription();

-- ---------------------------------------------------------------------------
-- 6. RPCs de leitura/consumo do alert center (admin-only).
-- ---------------------------------------------------------------------------
create or replace function public.admin_activity_events_unread_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when public.is_admin()
    then (select count(*)::int from public.admin_activity_events where read_at is null)
    else 0
  end;
$$;

create or replace function public.admin_activity_events_list(
  p_filter     text default 'all',   -- all | user_signup | subscription_started | unread
  p_limit      int  default 20,
  p_offset     int  default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_filter text := coalesce(nullif(btrim(p_filter), ''), 'all');
  v_rows   jsonb;
  v_total  bigint;
  v_unread bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select count(*) into v_total
  from public.admin_activity_events e
  where (v_filter = 'all'
      or (v_filter = 'unread' and e.read_at is null)
      or (v_filter not in ('all','unread') and e.event_type = v_filter));

  select count(*) into v_unread from public.admin_activity_events where read_at is null;

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb) into v_rows
  from (
    select e.id, e.event_type, e.user_id, e.title, e.message, e.metadata,
           e.created_at, e.read_at,
           p.full_name as user_name, p.email as user_email, coalesce(p.plan, 'free') as user_plan
    from public.admin_activity_events e
    left join public.profiles p on p.user_id = e.user_id
    where (v_filter = 'all'
        or (v_filter = 'unread' and e.read_at is null)
        or (v_filter not in ('all','unread') and e.event_type = v_filter))
    order by e.created_at desc
    offset v_offset limit v_limit
  ) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total, 'unread', v_unread);
end;
$$;

create or replace function public.admin_activity_events_mark_read(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.admin_activity_events
     set read_at = coalesce(read_at, now()), acknowledged_by = auth.uid()
   where id = p_id and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.admin_activity_events_mark_all_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.admin_activity_events
     set read_at = now(), acknowledged_by = auth.uid()
   where read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Cards operacionais + taxa de conversão recente (agregação SQL).
--    Conversão = cadastros dos últimos 30 dias com first_paid_at preenchido
--                dividido pelo total de cadastros dos últimos 30 dias.
-- ---------------------------------------------------------------------------
create or replace function public.admin_new_users_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_now  timestamptz := now();
  v_day  timestamptz := date_trunc('day', v_now);
  v_month timestamptz := date_trunc('month', v_now);
  v_signups_30d int;
  v_converted_30d int;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select count(*) filter (where created_at >= v_now - interval '30 days')
       , count(*) filter (where created_at >= v_now - interval '30 days' and first_paid_at is not null)
    into v_signups_30d, v_converted_30d
  from public.profiles;

  select jsonb_build_object(
    'new_users_today',     (select count(*) from public.profiles where created_at >= v_day),
    'new_users_7d',        (select count(*) from public.profiles where created_at >= v_now - interval '7 days'),
    'new_users_month',     (select count(*) from public.profiles where created_at >= v_month),
    'new_subs_today',      (select count(*) from public.profiles where first_paid_at >= v_day),
    'new_subs_7d',         (select count(*) from public.profiles where first_paid_at >= v_now - interval '7 days'),
    'new_subs_month',      (select count(*) from public.profiles where first_paid_at >= v_month),
    'conversion_30d', jsonb_build_object(
      'signups', v_signups_30d,
      'converted', v_converted_30d,
      'rate', case when v_signups_30d > 0
                then round((v_converted_30d::numeric / v_signups_30d) * 100, 1)
                else 0 end
    ),
    'generated_at', v_now
  ) into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_activity_events_unread_count() from public, anon;
revoke all on function public.admin_activity_events_list(text, int, int) from public, anon;
revoke all on function public.admin_activity_events_mark_read(uuid) from public, anon;
revoke all on function public.admin_activity_events_mark_all_read() from public, anon;
revoke all on function public.admin_new_users_overview() from public, anon;

grant execute on function public.admin_activity_events_unread_count() to authenticated;
grant execute on function public.admin_activity_events_list(text, int, int) to authenticated;
grant execute on function public.admin_activity_events_mark_read(uuid) to authenticated;
grant execute on function public.admin_activity_events_mark_all_read() to authenticated;
grant execute on function public.admin_new_users_overview() to authenticated;

-- Realtime: o alert center escuta INSERT em admin_activity_events. A RLS de SELECT
-- (is_admin()) também vale para o stream, então só admins recebem.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.admin_activity_events;
    exception when others then
      -- publicação FOR ALL TABLES, tabela já incluída, ou permissão: o alert
      -- center cai no polling leve. Nunca aborta a migration por isso.
      raise notice 'realtime: admin_activity_events não adicionada à publicação (%).', sqlerrm;
    end;
  end if;
end $$;
