-- ============================================================================
-- Segmentação — critérios de "novos usuários" e "conversão recente"
-- ============================================================================
-- Estende public.admin_segment_match() (o núcleo único usado por preview / lista /
-- etiqueta / notificação / exportação) com novas chaves no filtro jsonb:
--   recent_signup_days        int   — cadastrado nos últimos N dias
--   recent_subscription_days  int   — primeira ativação paga nos últimos N dias
--   subscribed_from / _to      date  — janela de first_paid_at
--   converted                 text  — 'converted' (first_paid_at not null)
--                                     | 'not_converted' (first_paid_at is null)
--
-- Toda a filtragem continua server-side. Recria só a função (sem tocar tabela).
-- Idempotente.

create or replace function public.admin_segment_match(p_filter jsonb)
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  with f as (
    select coalesce(p_filter, '{}'::jsonb) as j
  ),
  base as (
    select
      p.user_id,
      coalesce(p.plan, 'free') as plan,
      coalesce(p.account_status, 'active') as status,
      p.role,
      coalesce(p.discount_percent, 0) as disc_pct,
      coalesce(p.discount_fixed, 0) as disc_fix,
      p.unlimited_access,
      coalesce(p.admin_tags, '{}'::text[]) as tags,
      p.created_at,
      p.first_paid_at,
      greatest(
        coalesce(p.last_seen_at, 'epoch'::timestamptz),
        coalesce((select max(d.created_at) from public.diary_entries d where d.user_id = p.user_id), 'epoch'::timestamptz)
      ) as last_activity
    from public.profiles p
  )
  select b.user_id
  from base b, f
  where
    (
      not (f.j ? 'plans') or jsonb_array_length(f.j->'plans') = 0
      or (
        (b.plan = any(array(select jsonb_array_elements_text(f.j->'plans'))))
        or (
          f.j->'plans' ? 'plus'
          and b.plan in ('plus', 'therapeutic', 'therapeutic-plus')
        )
      )
    )
    and (
      not (f.j ? 'statuses') or jsonb_array_length(f.j->'statuses') = 0
      or b.status = any(array(select jsonb_array_elements_text(f.j->'statuses')))
    )
    and (
      not (f.j ? 'access') or jsonb_array_length(f.j->'access') = 0
      or (
        ('discount'     = any(array(select jsonb_array_elements_text(f.j->'access'))) and (b.disc_pct > 0 or b.disc_fix > 0))
        or ('unlimited'  = any(array(select jsonb_array_elements_text(f.j->'access'))) and b.unlimited_access is true)
        or ('admin'      = any(array(select jsonb_array_elements_text(f.j->'access'))) and b.role = 'admin')
        or ('open_ticket'= any(array(select jsonb_array_elements_text(f.j->'access')))
            and exists (select 1 from public.support_tickets st where st.user_id = b.user_id and st.status not in ('closed','resolved')))
        or ('unread_notif' = any(array(select jsonb_array_elements_text(f.j->'access')))
            and exists (select 1 from public.notifications n where n.user_id = b.user_id and n.is_read is false))
      )
    )
    and (
      not (f.j ? 'tags') or jsonb_array_length(f.j->'tags') = 0
      or (
        case when coalesce(f.j->>'tags_mode', 'any') = 'all'
          then b.tags @> array(select jsonb_array_elements_text(f.j->'tags'))
          else b.tags && array(select jsonb_array_elements_text(f.j->'tags'))
        end
      )
    )
    and (f.j->>'signup_from' is null or b.created_at >= (f.j->>'signup_from')::timestamptz)
    and (f.j->>'signup_to'   is null or b.created_at <  ((f.j->>'signup_to')::date + 1))
    -- novos: cadastro nos últimos N dias
    and (
      f.j->>'recent_signup_days' is null
      or b.created_at >= now() - make_interval(days => (f.j->>'recent_signup_days')::int)
    )
    -- assinatura recente: primeira ativação paga nos últimos N dias
    and (
      f.j->>'recent_subscription_days' is null
      or (b.first_paid_at is not null
          and b.first_paid_at >= now() - make_interval(days => (f.j->>'recent_subscription_days')::int))
    )
    and (f.j->>'subscribed_from' is null or (b.first_paid_at is not null and b.first_paid_at >= (f.j->>'subscribed_from')::timestamptz))
    and (f.j->>'subscribed_to'   is null or (b.first_paid_at is not null and b.first_paid_at <  ((f.j->>'subscribed_to')::date + 1)))
    -- converteu / ainda não converteu
    and (
      f.j->>'converted' is null
      or (f.j->>'converted' = 'converted'     and b.first_paid_at is not null)
      or (f.j->>'converted' = 'not_converted' and b.first_paid_at is null)
    )
    and (
      f.j->>'inactive_days' is null
      or b.last_activity < now() - make_interval(days => (f.j->>'inactive_days')::int)
    )
    and (
      f.j->>'active_within_days' is null
      or b.last_activity >= now() - make_interval(days => (f.j->>'active_within_days')::int)
    )
    and (
      f.j->>'subscription' is null
      or (
        case f.j->>'subscription'
          when 'active' then exists (
            select 1 from public.user_subscriptions s
            where s.user_id = b.user_id and s.status in ('active','trialing')
              and coalesce(s.cancel_at_period_end, false) is false
          )
          when 'canceling' then exists (
            select 1 from public.user_subscriptions s
            where s.user_id = b.user_id and s.status in ('active','trialing')
              and coalesce(s.cancel_at_period_end, false) is true
          )
          when 'none' then not exists (
            select 1 from public.user_subscriptions s
            where s.user_id = b.user_id and s.status in ('active','trialing')
          )
          else true
        end
      )
    );
$$;

revoke all on function public.admin_segment_match(jsonb) from public, anon;
grant execute on function public.admin_segment_match(jsonb) to authenticated;
