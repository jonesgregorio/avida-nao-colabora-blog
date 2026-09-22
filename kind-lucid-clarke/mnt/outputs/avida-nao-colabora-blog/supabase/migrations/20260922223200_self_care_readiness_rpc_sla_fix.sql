-- Corrige a assinatura da RPC de prontidão após a migration de SLA.
-- PostgreSQL exige DROP + CREATE quando o row type de OUT parameters muda.
begin;
drop function if exists public.get_my_care_plan_readiness();
create function public.get_my_care_plan_readiness()
returns table (
  id uuid, month_reference date, period_start date, period_end date,
  status text, readiness jsonb, review_due_at date
)
language sql stable security definer set search_path = public
as $$
  select p.id,p.month_reference,p.period_start,p.period_end,p.status,p.readiness,p.review_due_at
  from public.monthly_care_plans p
  where p.user_id=(select auth.uid())
    and ((p.status='skipped' and coalesce(p.readiness->>'reason_code','')='insufficient_activity')
      or p.status in ('pending_generation','generating','draft','pending_review','approved','failed'))
  order by p.month_reference desc limit 120;
$$;
revoke all on function public.get_my_care_plan_readiness() from public, anon;
grant execute on function public.get_my_care_plan_readiness() to authenticated;
notify pgrst, 'reload schema';
commit;
