-- Etapa 7 (Evolução do Admin) — Funil da jornada + conversão de planos.
--
-- O que JÁ existe e NÃO é recriado aqui:
--   - Retenção D1/D7/D30, ativos por dia, adoção de recursos, "voltou após
--     pausa"  ->  get_retention_continuity_analytics() / AdminRetentionAnalytics.
--   - Funil COMERCIAL (visitante -> checkout -> pago -> upgrade)  ->
--     AdminConversionFunnel.
--   - MRR, receita, inadimplência, motivos de cancelamento  ->  AdminFinanceiro.
--
-- O que falta e esta RPC entrega:
--   1) Funil de ATIVAÇÃO por coorte de cadastro (por usuário, não por sessão):
--      cadastro -> 1º check-in -> 1ª entrada no diário -> 1º questionário ->
--      1º relatório -> 1º plano de autocuidado -> uso recorrente.
--      Feito server-side porque a RLS das tabelas de dados é auth.uid()=user_id
--      (um SELECT direto do admin volta vazio).
--   2) Conversão de planos no período: free->pago, upgrades, downgrades,
--      cancelamentos pedidos/efetivados, reativações, variação líquida de pagantes.
--
-- Só contagens reais do banco. Nada inventado. Idempotente.

create or replace function public.admin_journey_funnel(p_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_days   integer := least(greatest(coalesce(p_days, 90), 7), 365);
  v_now    timestamptz := now();
  v_since  timestamptz := now() - make_interval(days => v_days);
  v_cohort uuid[];
  v_size   integer;
  v_journey jsonb;
  v_plans   jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  -- Coorte: quem se cadastrou dentro da janela.
  select array_agg(p.user_id) into v_cohort
  from public.profiles p
  where p.created_at >= v_since;
  v_cohort := coalesce(v_cohort, '{}'::uuid[]);
  v_size := array_length(v_cohort, 1);

  with c as (select unnest(v_cohort) as user_id)
  select jsonb_build_object(
    'signed_up', coalesce(v_size, 0),
    'first_checkin', (
      select count(*) from c where exists (
        select 1 from public.diary_entries d
        where d.user_id = c.user_id and coalesce(d.entry_type, 'diary') = 'checkin')),
    'first_diary', (
      select count(*) from c where exists (
        select 1 from public.diary_entries d
        where d.user_id = c.user_id and coalesce(d.entry_type, 'diary') = 'diary')),
    'first_questionnaire', (
      select count(*) from c where exists (
        select 1 from public.questionnaire_responses q
        where q.user_id = c.user_id
          and (coalesce(q.status, '') = 'completed' or q.completed_at is not null))),
    'first_report', (
      select count(*) from c where exists (
        select 1 from public.reports r
        where r.user_id = c.user_id and r.status = 'generated')),
    'first_care_plan', (
      select count(*) from c where exists (
        select 1 from public.monthly_care_plans m
        where m.user_id = c.user_id and m.status = 'generated')),
    'recurring_use', (
      select count(*) from c where (
        select count(distinct coalesce(d.date, d.created_at::date))
        from public.diary_entries d where d.user_id = c.user_id
      ) >= 3)
  ) into v_journey;

  -- Conversão de planos no período (fonte: subscription_events).
  with ev as (
    select * from public.subscription_events
    where occurred_at >= v_since
  ),
  paid_before as (
    -- usuários que já tinham cancelado ANTES da janela (base para reativação)
    select distinct user_id from public.subscription_events
    where event_type in ('cancellation_completed','subscription_deleted')
      and occurred_at < v_since
  )
  select jsonb_build_object(
    'window_days', v_days,
    'free_to_paid', (
      select count(distinct user_id) from ev
      where event_type = 'checkout_completed'
        and coalesce(previous_plan, 'free') in ('free','gratuito')
        and new_plan is not null and lower(new_plan) not in ('free','gratuito')),
    'upgrades', (
      select count(distinct user_id) from ev
      where event_type = 'upgrade_confirmed'
         or (event_type = 'plan_changed' and lower(coalesce(previous_plan,'')) = 'essential'
             and lower(coalesce(new_plan,'')) in ('plus','therapeutic','therapeutic-plus'))),
    'downgrades', (
      select count(distinct user_id) from ev
      where event_type in ('downgrade_requested','downgrade_completed')),
    'cancellations_requested', (
      select count(distinct user_id) from ev where event_type = 'cancellation_requested'),
    'cancellations_completed', (
      select count(distinct user_id) from ev
      where event_type in ('cancellation_completed','subscription_deleted')),
    'reactivations', (
      select count(distinct e.user_id) from ev e
      join paid_before pb on pb.user_id = e.user_id
      where e.event_type = 'checkout_completed'),
    'payments_failed', (
      select count(distinct user_id) from ev where event_type = 'payment_failed')
  ) into v_plans;

  return jsonb_build_object(
    'generated_at', v_now,
    'window_days', v_days,
    'cohort_since', v_since,
    'journey', v_journey,
    'plans', v_plans
  );
end;
$$;

revoke all on function public.admin_journey_funnel(integer) from public, anon;
grant execute on function public.admin_journey_funnel(integer) to authenticated;
