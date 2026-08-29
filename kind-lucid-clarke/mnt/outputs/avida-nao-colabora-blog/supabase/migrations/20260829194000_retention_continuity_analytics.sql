-- Fase 16 — Analytics de retenção e continuidade.
-- Somente agrega eventos de produto já existentes em analytics_events.
-- Não lê conteúdo do Diário, humor, ansiedade, gatilhos, tags ou respostas.

create or replace function public.get_retention_continuity_analytics(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  with
  params as (
    select
      (now() at time zone 'America/Sao_Paulo')::date as today,
      greatest(30, least(coalesce(p_days, 90), 365))::integer as window_days
  ),
  eligible_profiles as (
    select
      p.user_id,
      (p.created_at at time zone 'America/Sao_Paulo')::date as signup_day
    from public.profiles p
    where coalesce(p.role, 'user') <> 'admin'
  ),
  product_events as (
    select
      e.user_id,
      (e.created_at at time zone 'America/Sao_Paulo')::date as activity_day,
      e.event
    from public.analytics_events e
    join eligible_profiles p on p.user_id = e.user_id
    where e.user_id is not null
      and e.event in (
        'page_view',
        'article_view',
        'questionnaire_start',
        'questionnaire_complete',
        'diary_open',
        'diary_entry',
        'checkin_start',
        'checkin_complete',
        'emotional_map_view',
        'weekly_report_view',
        'monthly_report_view',
        'self_care_plan_view',
        'professional_guidance_view',
        'diary_pattern_view',
        'discovery_view',
        'discovery_open',
        'weekly_focus_saved',
        'weekly_focus_reflected',
        'small_action_accepted',
        'small_action_completed'
      )
  ),
  activity_days as (
    select distinct user_id, activity_day
    from product_events
  ),
  tracking as (
    select min(activity_day) as tracking_since
    from activity_days
  ),
  ordered_activity as (
    select
      user_id,
      activity_day,
      lag(activity_day) over (partition by user_id order by activity_day) as previous_day
    from activity_days
  ),
  active_counts as (
    select
      count(distinct a.user_id) filter (where a.activity_day = p.today)::integer as today,
      count(distinct a.user_id) filter (where a.activity_day between p.today - 6 and p.today)::integer as days_7,
      count(distinct a.user_id) filter (where a.activity_day between p.today - 29 and p.today)::integer as days_30
    from params p
    left join activity_days a on true
    group by p.today
  ),
  repeat_counts as (
    select
      count(*) filter (where days_7 >= 2)::integer as repeat_7,
      count(*) filter (where days_30 >= 4)::integer as repeat_30
    from (
      select
        ep.user_id,
        count(*) filter (where a.activity_day between p.today - 6 and p.today) as days_7,
        count(*) filter (where a.activity_day between p.today - 29 and p.today) as days_30
      from eligible_profiles ep
      cross join params p
      left join activity_days a on a.user_id = ep.user_id
      group by ep.user_id
    ) x
  ),
  pause_returners as (
    select count(distinct o.user_id)::integer as users
    from ordered_activity o
    cross join params p
    where o.activity_day between p.today - 29 and p.today
      and o.previous_day is not null
      and (o.activity_day - o.previous_day) >= 4
  ),
  retention_base as (
    select
      ep.user_id,
      ep.signup_day,
      t.tracking_since,
      p.today
    from eligible_profiles ep
    cross join params p
    cross join tracking t
    where t.tracking_since is not null
      and ep.signup_day >= t.tracking_since
  ),
  retention_d1 as (
    select
      count(*) filter (where signup_day <= today - 1)::integer as eligible,
      count(*) filter (
        where signup_day <= today - 1
          and exists (
            select 1 from activity_days a
            where a.user_id = retention_base.user_id
              and a.activity_day >= retention_base.signup_day + 1
              and a.activity_day <= retention_base.today
          )
      )::integer as returned
    from retention_base
  ),
  retention_d7 as (
    select
      count(*) filter (where signup_day <= today - 7)::integer as eligible,
      count(*) filter (
        where signup_day <= today - 7
          and exists (
            select 1 from activity_days a
            where a.user_id = retention_base.user_id
              and a.activity_day >= retention_base.signup_day + 7
              and a.activity_day <= retention_base.today
          )
      )::integer as returned
    from retention_base
  ),
  retention_d30 as (
    select
      count(*) filter (where signup_day <= today - 30)::integer as eligible,
      count(*) filter (
        where signup_day <= today - 30
          and exists (
            select 1 from activity_days a
            where a.user_id = retention_base.user_id
              and a.activity_day >= retention_base.signup_day + 30
              and a.activity_day <= retention_base.today
          )
      )::integer as returned
    from retention_base
  ),
  daily_series as (
    select
      d.day::date as day,
      count(distinct a.user_id)::integer as active_users
    from params p
    cross join lateral generate_series(p.today - 29, p.today, interval '1 day') d(day)
    left join activity_days a on a.activity_day = d.day::date
    group by d.day
    order by d.day
  ),
  feature_definitions as (
    select * from (values
      ('checkin', 'Check-in', 'checkin_complete', 1),
      ('diary', 'Diário', 'diary_entry', 2),
      ('discovery', 'Descobertas', 'discovery_view', 3),
      ('diary_pattern', 'Recorrência pós-Diário', 'diary_pattern_view', 4),
      ('weekly_focus', 'Foco da Semana', 'weekly_focus_saved', 5),
      ('weekly_focus_reflection', 'Reflexão do Foco', 'weekly_focus_reflected', 6),
      ('small_action', 'Pequena ação concluída', 'small_action_completed', 7)
    ) as f(key, label, event_name, sort_order)
  ),
  feature_usage as (
    select
      f.key,
      f.label,
      f.sort_order,
      count(distinct e.user_id)::integer as users
    from feature_definitions f
    cross join params p
    left join product_events e
      on e.event = f.event_name
      and e.activity_day between p.today - 29 and p.today
    group by f.key, f.label, f.sort_order
  )
  select jsonb_build_object(
    'generated_at', now(),
    'timezone', 'America/Sao_Paulo',
    'window_days', p.window_days,
    'tracking_since', t.tracking_since,
    'active', jsonb_build_object(
      'today', ac.today,
      'days_7', ac.days_7,
      'days_30', ac.days_30,
      'repeat_7', rc.repeat_7,
      'repeat_30', rc.repeat_30,
      'returned_after_pause_30', pr.users
    ),
    'retention', jsonb_build_object(
      'd1', jsonb_build_object(
        'eligible', r1.eligible,
        'returned', r1.returned,
        'rate', case when r1.eligible = 0 then null else round((r1.returned::numeric * 100) / r1.eligible, 1) end
      ),
      'd7', jsonb_build_object(
        'eligible', r7.eligible,
        'returned', r7.returned,
        'rate', case when r7.eligible = 0 then null else round((r7.returned::numeric * 100) / r7.eligible, 1) end
      ),
      'd30', jsonb_build_object(
        'eligible', r30.eligible,
        'returned', r30.returned,
        'rate', case when r30.eligible = 0 then null else round((r30.returned::numeric * 100) / r30.eligible, 1) end
      )
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'active_users', active_users) order by day) from daily_series), '[]'::jsonb),
    'features', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', fu.key,
          'label', fu.label,
          'users', fu.users,
          'rate', case when ac.days_30 = 0 then null else round((fu.users::numeric * 100) / ac.days_30, 1) end
        ) order by fu.sort_order
      )
      from feature_usage fu
    ), '[]'::jsonb)
  ) into result
  from params p
  cross join tracking t
  cross join active_counts ac
  cross join repeat_counts rc
  cross join pause_returners pr
  cross join retention_d1 r1
  cross join retention_d7 r7
  cross join retention_d30 r30;

  return result;
end;
$$;

revoke all on function public.get_retention_continuity_analytics(integer) from public, anon;
grant execute on function public.get_retention_continuity_analytics(integer) to authenticated;
