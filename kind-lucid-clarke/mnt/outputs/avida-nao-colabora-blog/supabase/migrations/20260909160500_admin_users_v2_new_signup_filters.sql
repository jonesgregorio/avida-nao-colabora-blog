-- ============================================================================
-- admin_list_users_v2 — filtros de "novos cadastros" e "assinatura recente"
-- ============================================================================
-- Adiciona à RPC paginada (server-side, is_admin()):
--   p_signup_from / p_signup_to  — janela de data de cadastro (hoje, 24h, 7d, mês, período)
--   p_subscribed_since           — 'today' | '7d' | 'month' (primeira ativação paga)
-- e enriquece cada linha com:
--   first_paid_at, is_new_user (cadastro <= 7d), is_recent_subscriber (1ª ativação <= 7d)
--
-- Combina com os filtros já existentes (busca, plano, status, acesso). A antiga
-- assinatura de 6 args é substituída (drop + recreate) por uma de 9 args.
-- Idempotente.

drop function if exists public.admin_list_users_v2(integer, integer, text, text, text, text);

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
