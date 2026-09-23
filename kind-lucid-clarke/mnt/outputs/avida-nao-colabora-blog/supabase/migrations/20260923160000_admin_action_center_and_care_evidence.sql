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
              when 'plus' then interval '12 hours'
              when 'essencial' then interval '24 hours'
              when 'essential' then interval '24 hours'
              else interval '48 hours' end due_at
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
   from reports where status in ('draft','generated','pending_review')
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

-- Evidência do Plano: conteúdo sugerido continua contando, mas não pode sozinho
-- satisfazer elegibilidade. Entregas personalizadas só entram na elegibilidade após envio/leitura.
create or replace function public.care_plan_activity_summary(p_user uuid,p_start date,p_end date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' and not public.is_admin() then raise exception 'not authorized'; end if;
 with raw_events as (
   select 'checkins' source,d.id::text key,coalesce(d.date,d.created_at::date) event_day from diary_entries d where d.user_id=p_user and d.entry_type='checkin' and coalesce(d.date,d.created_at::date) between p_start and p_end
   union all select 'diaries',d.id::text,coalesce(d.date,d.created_at::date) from diary_entries d where d.user_id=p_user and d.entry_type='diary' and coalesce(d.date,d.created_at::date) between p_start and p_end
   union all select 'questionnaires',q.id::text,coalesce(q.completed_at,q.created_at)::date from questionnaire_responses q where q.user_id=p_user and q.status='completed' and coalesce(q.completed_at,q.created_at)::date between p_start and p_end
   union all select 'suggested_content',c.id::text,c.created_at::date from content_recommendations c where c.user_id=p_user and c.created_at::date between p_start and p_end
   union all select 'viewed_content',r.id::text,r.created_at::date from reading_history r where r.user_id=p_user and r.created_at::date between p_start and p_end
   union all select 'guided_content',g.id::text,coalesce(g.completed_at,g.started_at,g.updated_at)::date from guided_content_progress g where g.user_id=p_user and coalesce(g.completed_at,g.started_at,g.updated_at)::date between p_start and p_end
   union all select 'personalized_content',p.id::text,coalesce(p.read_at,p.sent_at)::date from personalized_content_deliveries p where p.user_id=p_user and coalesce(p.read_at,p.sent_at)::date between p_start and p_end
   union all select 'care_plan_feedback',s.id::text,s.updated_at::date from care_plan_action_state s where s.user_id=p_user and s.updated_at::date between p_start and p_end
 ), suggested_eligible as (
   select source,key,event_day from (
     select r.*,row_number() over(order by event_day,key) rn from raw_events r where source='suggested_content'
   ) x where rn<=2
 ), eligible_events as (
   select * from raw_events where source<>'suggested_content'
   union all select * from suggested_eligible
 ), raw_counts as (select source,count(*) n from raw_events group by source),
 eligible_counts as (select source,count(*) n from eligible_events group by source),
 signals as (
   select content_slug signal from content_recommendations where user_id=p_user and created_at::date between p_start and p_end and content_slug is not null
   union select article_slug from reading_history where user_id=p_user and created_at::date between p_start and p_end and article_slug is not null
   union select title from personalized_content_deliveries where user_id=p_user and coalesce(read_at,sent_at)::date between p_start and p_end and title is not null
   union select result_title from questionnaire_responses where user_id=p_user and status='completed' and coalesce(completed_at,created_at)::date between p_start and p_end and result_title is not null
   union select generated_tags from questionnaire_responses where user_id=p_user and status='completed' and coalesce(completed_at,created_at)::date between p_start and p_end and generated_tags is not null
   union select 'guided:'||article_id::text from guided_content_progress where user_id=p_user and coalesce(completed_at,started_at,updated_at)::date between p_start and p_end and article_id is not null
   union select outcome from care_plan_action_state where user_id=p_user and updated_at::date between p_start and p_end and outcome is not null
 )
 select jsonb_build_object(
   'total_entries',(select count(*) from eligible_events),
   'active_days',(select count(distinct event_day) from eligible_events),
   'source_counts',coalesce((select jsonb_object_agg(source,n) from raw_counts),'{}'::jsonb),
   'eligibility_source_counts',coalesce((select jsonb_object_agg(source,n) from eligible_counts),'{}'::jsonb),
   'min_entries',12,'min_active_days',8,
   'eligibility_note','Conteúdo sugerido conta no máximo 2 vezes; entrega personalizada só conta após envio/leitura.',
   'content_signals',coalesce((select jsonb_agg(signal) from (select distinct signal from signals where btrim(signal)<>'' limit 40) x),'[]'::jsonb),
   'questionnaire_signals',coalesce((select jsonb_agg(jsonb_build_object('questionnaire_id',q.questionnaire_id,'result_title',q.result_title,'total_score',q.total_score,'generated_tags',q.generated_tags,'completed_at',coalesce(q.completed_at,q.created_at))) from questionnaire_responses q where q.user_id=p_user and q.status='completed' and coalesce(q.completed_at,q.created_at)::date between p_start and p_end),'[]'::jsonb)
 ) into v;
 return v;
end $$;
revoke all on function public.care_plan_activity_summary(uuid,date,date) from public,anon;
grant execute on function public.care_plan_activity_summary(uuid,date,date) to authenticated,service_role;
commit;