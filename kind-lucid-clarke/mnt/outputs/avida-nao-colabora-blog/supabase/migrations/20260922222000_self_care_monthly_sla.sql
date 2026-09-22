-- Plano de Autocuidado: SLA operacional até o dia 5 do mês seguinte.
-- O mês de referência permanece fechado e os requisitos continuam 12 registros / 8 dias ativos.
begin;

alter table public.monthly_care_plans
  add column if not exists review_due_at date;

update public.monthly_care_plans
set review_due_at = (date_trunc('month', month_reference) + interval '1 month 4 days')::date
where review_due_at is null;

alter table public.monthly_care_plans
  alter column review_due_at set default null;

create or replace function public.set_monthly_care_plan_review_due_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.review_due_at := (date_trunc('month', new.month_reference) + interval '1 month 4 days')::date;
  return new;
end $$;

drop trigger if exists trg_monthly_care_plan_review_due_at on public.monthly_care_plans;
create trigger trg_monthly_care_plan_review_due_at
before insert or update of month_reference on public.monthly_care_plans
for each row execute function public.set_monthly_care_plan_review_due_at();

drop function if exists public.get_my_care_plan_readiness();
create function public.get_my_care_plan_readiness()
returns table (
  id uuid,
  month_reference date,
  period_start date,
  period_end date,
  status text,
  readiness jsonb,
  review_due_at date
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.month_reference, p.period_start, p.period_end, p.status, p.readiness, p.review_due_at
  from public.monthly_care_plans p
  where p.user_id = (select auth.uid())
    and (
      (p.status = 'skipped' and coalesce(p.readiness->>'reason_code','') = 'insufficient_activity')
      or p.status in ('pending_generation','generating','draft','pending_review','approved','failed')
    )
  order by p.month_reference desc
  limit 120;
$$;

revoke all on function public.get_my_care_plan_readiness() from public, anon;
grant execute on function public.get_my_care_plan_readiness() to authenticated;

create or replace function public.admin_care_plan_dashboard(p_month date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := coalesce(p_month, date_trunc('month', current_date - interval '1 month')::date);
  v jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    'month_reference', v_month,
    'total', count(*),
    'ready', count(*) filter (where readiness->>'reason_code'='ready'),
    'insufficient_activity', count(*) filter (where readiness->>'reason_code'='insufficient_activity'),
    'pending_review', count(*) filter (where status in ('draft','pending_review')),
    'overdue_review', count(*) filter (
      where status in ('pending_generation','generating','draft','pending_review','approved','failed')
        and coalesce(review_due_at, (date_trunc('month', month_reference) + interval '1 month 4 days')::date) < current_date
    ),
    'sent', count(*) filter (where status='sent'),
    'failed', count(*) filter (where status='failed'),
    'review_due_at', (date_trunc('month', v_month) + interval '1 month 4 days')::date
  ) into v
  from public.monthly_care_plans
  where month_reference=v_month;

  return coalesce(v,'{}'::jsonb) || jsonb_build_object(
    'actions', coalesce((
      select jsonb_build_object(
        'active', count(*) filter (where s.state='active'),
        'paused', count(*) filter (where s.state='paused'),
        'removed', count(*) filter (where s.state='removed'),
        'helped', count(*) filter (where s.outcome='helped'),
        'neutral', count(*) filter (where s.outcome='neutral'),
        'could_not', count(*) filter (where s.outcome='could_not'),
        'adapt_requests', count(*) filter (where s.outcome='adapt'),
        'not_for_me', count(*) filter (where s.outcome='not_for_me')
      )
      from public.care_plan_action_state s
      join public.monthly_care_plans p on p.id=s.care_plan_id
      where p.month_reference=v_month
    ), '{}'::jsonb)
  );
end $$;

revoke all on function public.admin_care_plan_dashboard(date) from public, anon;
grant execute on function public.admin_care_plan_dashboard(date) to authenticated;

update public.plan_features
set feature_description = 'Plano mensal baseado no mês-calendário encerrado. Requer ao menos 12 registros distribuídos em 8 dias ativos; quando elegível, passa por revisão humana e deve ser liberado até o dia 5 do mês seguinte.',
    presentation_revision = extract(epoch from now())::bigint * 1000
where feature_key = 'personalized_self_care_plan';

comment on column public.monthly_care_plans.review_due_at is
  'SLA operacional: data-limite de revisão/liberação, dia 5 do mês seguinte ao mês de referência.';

notify pgrst, 'reload schema';
commit;
