-- Data de nascimento (opcional) em Minha Conta + idade no Admin + alerta de aniversário.
--
-- 1. profiles.birth_date (date, opcional). Escrita só pelo próprio usuário via
--    update_my_profile (validada) — a RLS continua sem UPDATE direto.
-- 2. Admin: idade calculada no servidor (fuso America/Sao_Paulo) em admin_list_users_v2
--    (Usuários) e em admin_engagement_base / get_user_engagement_page (Engajamento).
-- 3. admin_birthday_alerts(): emite 1 evento por pessoa/ano em admin_activity_events
--    (aparece no sino do Admin). Agendado todo dia às 08:00 de Brasília via pg_cron.
-- Idempotente.

alter table public.profiles add column if not exists birth_date date;
comment on column public.profiles.birth_date is
  'Data de nascimento informada pelo usuário em Minha Conta (opcional). Dado pessoal: só o próprio usuário e o Admin enxergam.';

-- ---------------------------------------------------------------------------
-- 1. update_my_profile ganha p_birth_date / p_clear_birth_date
-- ---------------------------------------------------------------------------
drop function if exists public.update_my_profile(text, text, text, text, text, text);

create or replace function public.update_my_profile(
  p_full_name              text default null,
  p_display_name           text default null,
  p_preferred_name         text default null,
  p_avatar_url             text default null,
  p_status_phrase          text default null,
  p_notification_frequency text default null,
  p_birth_date             date default null,
  p_clear_birth_date       boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;

  if p_birth_date is not null and (p_birth_date > v_today or p_birth_date < date '1900-01-01') then
    raise exception 'Data de nascimento inválida';
  end if;

  update public.profiles
  set
    full_name              = coalesce(p_full_name, full_name),
    display_name           = coalesce(p_display_name, display_name),
    preferred_name         = coalesce(p_preferred_name, preferred_name),
    avatar_url             = coalesce(p_avatar_url, avatar_url),
    status_phrase          = coalesce(p_status_phrase, status_phrase),
    notification_frequency = coalesce(p_notification_frequency, notification_frequency),
    birth_date             = case when p_clear_birth_date then null else coalesce(p_birth_date, birth_date) end,
    updated_at             = now()
  where user_id = auth.uid();
end;
$$;

revoke execute on function public.update_my_profile(text, text, text, text, text, text, date, boolean) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, text, text, date, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2a. Usuários (admin_list_users_v2): birth_date + age
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users_v2(
  p_page integer default 1,
  p_page_size integer default 40,
  p_search text default '',
  p_plan text default 'all',
  p_status text default 'all',
  p_access text default 'all',
  p_signup_from timestamptz default null,
  p_signup_to timestamptz default null,
  p_subscribed_since text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 40), 1), 200);
  normalized_search text := lower(trim(coalesce(p_search, '')));
  v_sub text := nullif(btrim(coalesce(p_subscribed_since, '')), '');
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with filtered as (
    select p.*
    from public.profiles p
    where
      (
        normalized_search = ''
        or lower(coalesce(p.full_name, '')) like '%' || normalized_search || '%'
        or lower(coalesce(p.email, '')) like '%' || normalized_search || '%'
        or lower(p.user_id::text) like '%' || normalized_search || '%'
      )
      and (
        coalesce(p_plan, 'all') = 'all'
        or (p_plan = 'plus' and p.plan in ('plus', 'therapeutic', 'therapeutic-plus'))
        or (p_plan <> 'plus' and coalesce(p.plan, 'free') = p_plan)
      )
      and (
        coalesce(p_status, 'all') = 'all'
        or coalesce(p.account_status, 'active') = p_status
      )
      and (
        coalesce(p_access, 'all') = 'all'
        or (p_access = 'discount' and (coalesce(p.discount_percent, 0) > 0 or coalesce(p.discount_fixed, 0) > 0))
        or (p_access = 'unlimited' and p.unlimited_access is true)
        or (p_access = 'admin' and p.role = 'admin')
        or (
          p_access = 'tickets'
          and exists (
            select 1 from public.support_tickets st
            where st.user_id = p.user_id and st.status not in ('closed', 'resolved')
          )
        )
      )
      and (p_signup_from is null or p.created_at >= p_signup_from)
      and (p_signup_to is null or p.created_at < p_signup_to)
      and (
        v_sub is null
        or (v_sub = 'today' and p.first_paid_at >= date_trunc('day', now()))
        or (v_sub = '7d' and p.first_paid_at >= now() - interval '7 days')
        or (v_sub = 'month' and p.first_paid_at >= date_trunc('month', now()))
      )
  ),
  total as (
    select count(*)::bigint as value from filtered
  ),
  page_rows as (
    select p.*
    from filtered p
    order by p.created_at desc, p.id desc
    offset (safe_page - 1) * safe_page_size
    limit safe_page_size
  ),
  enriched as (
    select
      p.id,
      p.user_id,
      p.full_name,
      p.email,
      coalesce(p.plan, 'free') as plan,
      p.role,
      p.created_at,
      p.account_status,
      p.unlimited_access,
      p.unlimited_access_until,
      p.unlimited_access_reason,
      p.discount_percent,
      p.discount_fixed,
      p.admin_tags,
      p.last_seen_at,
      p.first_paid_at,
      p.birth_date,
      case when p.birth_date is null then null
           else date_part('year', age(v_today, p.birth_date))::int end as age,
      (p.created_at >= now() - interval '7 days') as is_new_user,
      (p.first_paid_at is not null and p.first_paid_at >= now() - interval '7 days') as is_recent_subscriber,
      coalesce(t.open_tickets, 0)::bigint as open_tickets,
      coalesce(n.unread_notifs, 0)::bigint as unread_notifs,
      case
        when p.last_seen_at is null then d.last_diary_at
        when d.last_diary_at is null then p.last_seen_at
        else greatest(p.last_seen_at, d.last_diary_at)
      end as last_activity
    from page_rows p
    left join lateral (
      select count(*) as open_tickets
      from public.support_tickets st
      where st.user_id = p.user_id
        and st.status not in ('closed', 'resolved')
    ) t on true
    left join lateral (
      select count(*) as unread_notifs
      from public.notifications n
      where n.user_id = p.user_id
        and n.is_read is false
    ) n on true
    left join lateral (
      select max(d.created_at) as last_diary_at
      from public.diary_entries d
      where d.user_id = p.user_id
    ) d on true
  )
  select jsonb_build_object(
    'total', (select value from total),
    'items', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id desc) from enriched e), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_list_users_v2(integer, integer, text, text, text, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_list_users_v2(integer, integer, text, text, text, text, timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Engajamento: admin_engagement_base + get_user_engagement_page com birth_date/age
--     (muda o RETURNS TABLE → drop + create; o resumo get_user_engagement_summary só
--      usa colunas existentes e segue valendo).
-- ---------------------------------------------------------------------------
drop function if exists public.get_user_engagement_page(text, text, text, boolean, text, text, int, int);
drop function if exists public.admin_engagement_base();

create or replace function public.admin_engagement_base()
returns table (
  user_id uuid, full_name text, email text, plan text, role text,
  created_at timestamptz, last_seen_at timestamptz,
  last_checkin timestamptz, last_diary timestamptz,
  last_questionnaire timestamptz, last_content timestamptz,
  last_activity timestamptz,
  checkins_30d int, diaries_30d int, questionnaires_30d int, contents_30d int,
  checkins_total int, diaries_total int,
  birth_date date, age int,
  bucket text
)
language sql
stable
security definer
set search_path = public
as $$
  with di as (
    select d.user_id,
      max(d.created_at) filter (where d.entry_type = 'checkin') as last_checkin,
      max(d.created_at) filter (where d.entry_type = 'diary')   as last_diary,
      max(d.created_at)                                         as last_any,
      count(*) filter (where d.entry_type = 'checkin' and d.created_at > now() - interval '30 days') as checkins_30d,
      count(*) filter (where d.entry_type = 'diary'   and d.created_at > now() - interval '30 days') as diaries_30d,
      count(*) filter (where d.entry_type = 'checkin') as checkins_total,
      count(*) filter (where d.entry_type = 'diary')   as diaries_total
    from diary_entries d
    group by d.user_id
  ),
  qr as (
    select q.user_id,
      max(q.created_at) as last_questionnaire,
      count(*) filter (where q.created_at > now() - interval '30 days') as questionnaires_30d
    from questionnaire_responses q
    where q.user_id is not null
    group by q.user_id
  ),
  rh as (
    select r.user_id,
      max(r.created_at) as last_content,
      count(*) filter (where r.created_at > now() - interval '30 days') as contents_30d
    from reading_history r
    group by r.user_id
  ),
  base as (
    select
      p.user_id, p.full_name, p.email, p.plan,
      coalesce(p.role, 'user') as role,
      p.created_at, p.last_seen_at,
      di.last_checkin, di.last_diary, qr.last_questionnaire, rh.last_content,
      greatest(p.last_seen_at, di.last_any, qr.last_questionnaire, rh.last_content) as last_activity,
      coalesce(di.checkins_30d, 0)::int       as checkins_30d,
      coalesce(di.diaries_30d, 0)::int        as diaries_30d,
      coalesce(qr.questionnaires_30d, 0)::int as questionnaires_30d,
      coalesce(rh.contents_30d, 0)::int       as contents_30d,
      coalesce(di.checkins_total, 0)::int     as checkins_total,
      coalesce(di.diaries_total, 0)::int      as diaries_total,
      p.birth_date,
      case when p.birth_date is null then null
           else date_part('year', age((now() at time zone 'America/Sao_Paulo')::date, p.birth_date))::int end as age
    from profiles p
    left join di on di.user_id = p.user_id
    left join qr on qr.user_id = p.user_id
    left join rh on rh.user_id = p.user_id
  )
  select b.*,
    case
      when b.last_activity is null then 'nunca'
      when b.last_activity > now() - interval '4 days'  then 'ativo'
      when b.last_activity > now() - interval '14 days' then 'esfriando'
      else 'inativo'
    end as bucket
  from base b;
$$;

revoke all on function public.admin_engagement_base() from public, anon, authenticated;

create or replace function public.get_user_engagement_page(
  p_search text default null,
  p_plan text default null,
  p_bucket text default null,
  p_hide_admins boolean default true,
  p_sort text default 'last_activity',
  p_dir text default 'desc',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  user_id uuid, full_name text, email text, plan text, role text,
  created_at timestamptz, last_seen_at timestamptz,
  last_checkin timestamptz, last_diary timestamptz,
  last_questionnaire timestamptz, last_content timestamptz,
  last_activity timestamptz,
  checkins_30d int, diaries_30d int, questionnaires_30d int, contents_30d int,
  checkins_total int, diaries_total int,
  birth_date date, age int,
  bucket text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_sort text := lower(coalesce(p_sort, 'last_activity'));
  v_dir text := case when lower(coalesce(p_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  if v_sort not in ('last_activity','created_at','full_name','checkins_30d','diaries_30d','questionnaires_30d','age') then
    v_sort := 'last_activity';
  end if;

  return query execute format($f$
    with f as (
      select b.*, count(*) over() as total_count
      from public.admin_engagement_base() b
      where (not $1 or b.role <> 'admin')
        and ($2 is null or $2 = 'todos' or b.plan = $2)
        and ($3 is null or $3 = 'todos' or b.bucket = $3)
        and ($4 is null or b.full_name ilike '%%' || $4 || '%%' or b.email ilike '%%' || $4 || '%%')
    )
    select
      user_id, full_name, email, plan, role, created_at, last_seen_at,
      last_checkin, last_diary, last_questionnaire, last_content, last_activity,
      checkins_30d, diaries_30d, questionnaires_30d, contents_30d,
      checkins_total, diaries_total, birth_date, age, bucket, total_count
    from f
    order by %I %s nulls last, user_id asc
    limit $5 offset $6
  $f$, v_sort, v_dir)
  using p_hide_admins, nullif(coalesce(p_plan,''),''), nullif(coalesce(p_bucket,''),''), v_q, v_limit, v_offset;
end;
$$;

revoke all on function public.get_user_engagement_page(text, text, text, boolean, text, text, int, int) from public, anon;
grant execute on function public.get_user_engagement_page(text, text, text, boolean, text, text, int, int) to authenticated;

comment on function public.get_user_engagement_page(text, text, text, boolean, text, text, int, int) is
  'Admin-only: página de engajamento por usuário com busca/plano/bucket/ordenação server-side (inclui data de nascimento e idade). total_count é o total do filtro.';

-- ---------------------------------------------------------------------------
-- 3. Alerta de aniversário (1 evento por pessoa/ano, idempotente)
--    Quem nasceu em 29/02 é avisado em 28/02 nos anos não bissextos.
-- ---------------------------------------------------------------------------
create or replace function public.admin_birthday_alerts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_year int := extract(year from v_today)::int;
  v_leap boolean := ((v_year % 4 = 0 and v_year % 100 <> 0) or v_year % 400 = 0);
  r record;
  v_count int := 0;
  v_age int;
  v_name text;
begin
  for r in
    select p.user_id, p.full_name, p.display_name, p.email, p.plan, p.birth_date
    from public.profiles p
    where p.birth_date is not null
      and (
        (extract(month from p.birth_date) = extract(month from v_today)
         and extract(day from p.birth_date) = extract(day from v_today))
        or (not v_leap and extract(month from v_today) = 2 and extract(day from v_today) = 28
            and extract(month from p.birth_date) = 2 and extract(day from p.birth_date) = 29)
      )
  loop
    v_age := v_year - extract(year from r.birth_date)::int;
    v_name := coalesce(nullif(btrim(coalesce(r.full_name, '')), ''), nullif(btrim(coalesce(r.display_name, '')), ''), r.email, 'Usuário');
    perform public._admin_activity_emit(
      'user_birthday',
      r.user_id,
      'Aniversário hoje',
      v_name || ' faz ' || v_age || ' anos hoje.',
      jsonb_build_object('age', v_age, 'birth_date', r.birth_date, 'plan', r.plan, 'email', r.email, 'name', v_name),
      'cron',
      null,
      'user_birthday:' || r.user_id || ':' || v_year
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.admin_birthday_alerts() from public, anon, authenticated;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule('admin-birthday-alerts')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-birthday-alerts');
  -- 11:00 UTC = 08:00 em Brasília.
  PERFORM cron.schedule('admin-birthday-alerts', '0 11 * * *', $cron$ select public.admin_birthday_alerts(); $cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível (%): agendamento ignorado.', SQLERRM;
END;
$$;
