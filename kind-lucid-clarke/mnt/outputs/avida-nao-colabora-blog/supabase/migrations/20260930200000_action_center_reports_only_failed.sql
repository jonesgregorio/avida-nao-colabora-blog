-- Badge "Atendimentos & Entregas" mostrava 52 pendências que não existem na tela.
-- Causa: a fila de relatórios contava todo relatório com status 'generated' (44 semanais
-- + 8 mensais). Em reports o ciclo é building → generated → archived | failed
-- (084_reports_cycles): 'generated' é o estado FINAL, já entregue ao usuário, e não há fluxo
-- de revisão do admin. Os status 'draft'/'pending_review' nem existem na constraint.
-- Agora só 'failed' (relatório que não gerou e exige ação) entra na fila do administrador.
-- O restante da função é idêntico à 20260923160000.

begin;

-- Snapshot único para o que depende da ação do administrador.
create or replace function public.admin_action_center_snapshot()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_now timestamptz:=now(); v jsonb;
begin
 if not public.is_admin() then raise exception 'not authorized'; end if;
 with support as (
   select id,status,coalesce(last_user_message_at,created_at) base_at,
          coalesce(last_user_message_at,created_at) +
            case lower(coalesce(plan_at_creation,'free'))
              when 'plus' then interval '24 hours'
              when 'essencial' then interval '48 hours'
              when 'essential' then interval '48 hours'
              else interval '72 hours' end due_at
   from support_tickets
   where status in ('open','in_progress','awaiting_admin')
 ), guidance as (
   select id,created_at + interval '7 days' due_at
   from monthly_guidance_requests where coalesce(status,'open') in ('open','pending','in_progress')
 ), care as (
   select id,coalesce(review_due_at::timestamptz,created_at + interval '5 days') due_at
   from monthly_care_plans where status in ('pending_review','draft','generated')
 ), deliveries as (
   select id,due_at from user_personalization_tasks
   where status in ('pending','overdue','draft','generated')
     and task_key not in ('self_care_plan','monthly_plan_review','monthly_guidance','monthly_guidance_reply','advanced_monthly_report','monthly_summary','weekly_report_suggestion')
 ), reports_q as (
   select id,coalesce(updated_at,generated_at,created_at) + interval '5 days' due_at
   from reports where status = 'failed'
 ), items as (
   select 'support' area,id,due_at from support union all
   select 'guidance',id,due_at from guidance union all
   select 'care',id,due_at from care union all
   select 'deliveries',id,due_at from deliveries union all
   select 'reports',id,due_at from reports_q
 ), by_area as (
   select area,count(*) total,
     count(*) filter(where due_at < v_now) overdue,
     count(*) filter(where due_at >= v_now and due_at <= v_now+interval '3 days') due_3d
   from items group by area
 )
 select jsonb_build_object(
   'generated_at',v_now,
   'total',(select count(*) from items),
   'overdue',(select count(*) from items where due_at<v_now),
   'due_3d',(select count(*) from items where due_at>=v_now and due_at<=v_now+interval '3 days'),
   'areas',coalesce((select jsonb_object_agg(area,jsonb_build_object('total',total,'overdue',overdue,'due_3d',due_3d)) from by_area),'{}'::jsonb)
 ) into v;
 return v;
end $$;
revoke all on function public.admin_action_center_snapshot() from public,anon;
grant execute on function public.admin_action_center_snapshot() to authenticated,service_role;

commit;
