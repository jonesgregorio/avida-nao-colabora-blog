-- Corrige a visão geral de Assinaturas no Admin para o schema real de
-- public.user_subscriptions. O identificador persistido da assinatura é
-- provider_subscription_id (não stripe_subscription_id).

create or replace function public.admin_subscriptions_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
  v_now timestamptz := now();
  v_30d timestamptz := now() - interval '30 days';
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with prof as (
    select
      p.user_id,
      lower(coalesce(p.plan, 'free')) as plan_norm
    from public.profiles p
  ),
  sub as (
    select
      s.user_id,
      lower(coalesce(s.payment_status, s.status, '')) as pay,
      lower(coalesce(s.plan_key, '')) as sub_plan,
      s.cancel_at_period_end,
      s.canceled_at,
      s.provider_subscription_id
    from public.user_subscriptions s
  ),
  joined as (
    select
      pr.user_id,
      pr.plan_norm,
      pr.plan_norm in ('essential','plus','therapeutic','therapeutic-plus','therapeutic_plus') as profile_paid,
      su.pay,
      su.sub_plan,
      coalesce(su.cancel_at_period_end, false) as cape,
      su.canceled_at,
      su.provider_subscription_id,
      (nullif(btrim(coalesce(su.provider_subscription_id, '')), '') is not null) as has_stripe,
      (su.pay in ('active','trialing')) as stripe_active
    from prof pr
    left join sub su on su.user_id = pr.user_id
  )
  select jsonb_build_object(
    'generated_at', v_now,
    'users_by_plan', jsonb_build_object(
      'free',      (select count(*) from joined where plan_norm = 'free'),
      'essential', (select count(*) from joined where plan_norm = 'essential'),
      'plus',      (select count(*) from joined where plan_norm in ('plus','therapeutic','therapeutic-plus','therapeutic_plus'))
    ),
    'stripe', jsonb_build_object(
      'active',                (select count(*) from joined where pay = 'active'),
      'trialing',              (select count(*) from joined where pay = 'trialing'),
      'past_due',              (select count(*) from joined where pay in ('past_due','unpaid')),
      'incomplete',            (select count(*) from joined where pay = 'incomplete'),
      'cancel_at_period_end',  (select count(*) from joined where cape and stripe_active),
      'canceled',              (select count(*) from joined where pay = 'canceled' or (canceled_at is not null and not stripe_active)),
      'no_stripe_sub',         (select count(*) from joined where not has_stripe)
    ),
    'divergences', jsonb_build_object(
      'paid_profile_no_active_stripe', (select count(*) from joined where profile_paid and not stripe_active),
      'free_profile_active_stripe',    (select count(*) from joined where not profile_paid and stripe_active),
      'plan_mismatch', (select count(*) from joined
        where stripe_active and sub_plan <> '' and sub_plan <> plan_norm
          and not (sub_plan in ('therapeutic','therapeutic-plus','therapeutic_plus') and plan_norm = 'plus'))
    ),
    'movement_30d', jsonb_build_object(
      'upgrades',   (select count(*) from public.plan_change_history where change_type in ('upgrade','upgrade_intent') and created_at >= v_30d),
      'downgrades', (select count(*) from public.plan_change_history where change_type in ('downgrade','downgrade_intent') and created_at >= v_30d),
      'reactivations', (select count(*) from public.plan_change_history where change_type = 'reactivate' and created_at >= v_30d),
      'cancellations_requested', (select count(*) from public.subscription_change_feedback
        where change_type = 'cancellation' and requested_at >= v_30d),
      'cancellations_handled', (select count(*) from public.subscription_change_feedback
        where change_type = 'cancellation' and admin_handled_at is not null and admin_handled_at >= v_30d),
      'payment_failures', (select count(*) from public.subscription_events
        where event_type = 'payment_failed' and occurred_at >= v_30d)
    ),
    'attention', jsonb_build_object(
      'cancellations_to_handle', (select count(*) from public.subscription_change_feedback
        where change_type = 'cancellation' and admin_handled_at is null and coalesce(status,'') <> 'reverted'),
      'past_due', (select count(*) from joined where pay in ('past_due','unpaid')),
      'divergences_total', (
        (select count(*) from joined where profile_paid and not stripe_active)
        + (select count(*) from joined where not profile_paid and stripe_active)
      )
    )
  ) into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_subscriptions_overview() from public, anon;
grant execute on function public.admin_subscriptions_overview() to authenticated;

comment on function public.admin_subscriptions_overview() is
  'Admin-only: visão geral de assinaturas usando user_subscriptions.provider_subscription_id como identificador persistido da assinatura do provedor.';
