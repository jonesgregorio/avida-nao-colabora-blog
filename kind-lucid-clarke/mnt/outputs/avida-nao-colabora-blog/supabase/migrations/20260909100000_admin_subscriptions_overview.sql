-- ============================================================================
-- Visão geral de Assinaturas — agregação segura server-side
-- ============================================================================
-- A tela AdminAssinaturasOverview somava profiles.plan e chamava isso de
-- "Assinaturas pagas" — o que confunde "usuário em plano pago" (profile) com
-- "assinatura Stripe ativa" (user_subscriptions.payment_status). Esta RPC
-- separa os dois conceitos e expõe divergências, sem nenhuma chamada Stripe
-- por usuário no frontend.
--
-- Fontes:
--   profiles.plan                         → usuário em plano (o que ele TEM)
--   user_subscriptions.payment_status     → status bruto no Stripe
--   user_subscriptions.status             → status interno
--   user_subscriptions.cancel_at_period_end / canceled_at
--   plan_change_history                   → upgrades/downgrades recentes
--   subscription_change_feedback          → cancelamentos (pending/handled)
--   subscription_events                   → falhas de pagamento recentes
--
-- SECURITY DEFINER + guarda is_admin() (expõe volume, não dado individual).

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
      s.stripe_subscription_id
    from public.user_subscriptions s
  ),
  joined as (
    select
      pr.user_id,
      pr.plan_norm,
      -- "pago" pelo profile = essential/plus (nomes históricos incluídos)
      pr.plan_norm in ('essential','plus','therapeutic','therapeutic-plus','therapeutic_plus') as profile_paid,
      su.pay,
      su.sub_plan,
      coalesce(su.cancel_at_period_end, false) as cape,
      su.canceled_at,
      su.stripe_subscription_id,
      (su.stripe_subscription_id is not null) as has_stripe,
      (su.pay in ('active','trialing')) as stripe_active
    from prof pr
    left join sub su on su.user_id = pr.user_id
  )
  select jsonb_build_object(
    'generated_at', v_now,
    -- A) usuários por plano (o que a pessoa TEM no profile)
    'users_by_plan', jsonb_build_object(
      'free',      (select count(*) from joined where plan_norm = 'free'),
      'essential', (select count(*) from joined where plan_norm = 'essential'),
      'plus',      (select count(*) from joined where plan_norm in ('plus','therapeutic','therapeutic-plus','therapeutic_plus'))
    ),
    -- B) situação real das assinaturas Stripe
    'stripe', jsonb_build_object(
      'active',                (select count(*) from joined where pay = 'active'),
      'trialing',              (select count(*) from joined where pay = 'trialing'),
      'past_due',              (select count(*) from joined where pay in ('past_due','unpaid')),
      'incomplete',            (select count(*) from joined where pay = 'incomplete'),
      'cancel_at_period_end',  (select count(*) from joined where cape and stripe_active),
      'canceled',              (select count(*) from joined where pay = 'canceled' or (canceled_at is not null and not stripe_active)),
      'no_stripe_sub',         (select count(*) from joined where not has_stripe)
    ),
    -- C) divergências profile x Stripe
    'divergences', jsonb_build_object(
      'paid_profile_no_active_stripe', (select count(*) from joined where profile_paid and not stripe_active),
      'free_profile_active_stripe',    (select count(*) from joined where not profile_paid and stripe_active),
      'plan_mismatch', (select count(*) from joined
        where stripe_active and sub_plan <> '' and sub_plan <> plan_norm
          and not (sub_plan in ('therapeutic','therapeutic-plus','therapeutic_plus') and plan_norm = 'plus'))
    ),
    -- D) movimento recente (30 dias)
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
    -- E) atenção agora
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
  'Admin-only: visão geral de assinaturas. Separa "usuários em plano" (profiles.plan) de "assinaturas Stripe ativas" (user_subscriptions.payment_status) e expõe divergências. Sem chamada Stripe por usuário.';

-- Lista os usuários de uma divergência específica (para o CTA "investigar").
create or replace function public.admin_subscription_divergences(p_kind text, p_limit int default 100)
returns table (user_id uuid, full_name text, email text, profile_plan text, stripe_status text, stripe_plan text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with j as (
    select
      p.user_id, p.full_name, p.email,
      lower(coalesce(p.plan,'free')) as plan_norm,
      p.plan as profile_plan_raw,
      lower(coalesce(s.payment_status, s.status, '')) as pay,
      s.plan_key as sub_plan,
      (lower(coalesce(s.payment_status, s.status, '')) in ('active','trialing')) as stripe_active,
      lower(coalesce(p.plan,'free')) in ('essential','plus','therapeutic','therapeutic-plus','therapeutic_plus') as profile_paid
    from public.profiles p
    left join public.user_subscriptions s on s.user_id = p.user_id
  )
  select j.user_id, j.full_name, j.email, j.profile_plan_raw, j.pay, j.sub_plan
  from j
  where case p_kind
    when 'paid_profile_no_active_stripe' then j.profile_paid and not j.stripe_active
    when 'free_profile_active_stripe'    then not j.profile_paid and j.stripe_active
    when 'plan_mismatch'                 then j.stripe_active and coalesce(j.sub_plan,'') <> '' and lower(j.sub_plan) <> j.plan_norm
    else false
  end
  order by j.email
  limit v_limit;
end;
$$;

revoke all on function public.admin_subscription_divergences(text, int) from public, anon;
grant execute on function public.admin_subscription_divergences(text, int) to authenticated;
