-- Plano de Autocuidado: contagem multifuente e visão agregada para o Admin.
begin;

create or replace function public.admin_care_plan_activity_summary(p_user uuid,p_start date,p_end date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if not public.is_admin() then raise exception 'not authorized'; end if;
 with events as (
   select 'checkins' source, d.id::text key, coalesce(d.date,d.created_at::date) day from diary_entries d where d.user_id=p_user and d.entry_type='checkin' and coalesce(d.date,d.created_at::date) between p_start and p_end
   union all select 'diaries',d.id::text,coalesce(d.date,d.created_at::date) from diary_entries d where d.user_id=p_user and d.entry_type='diary' and coalesce(d.date,d.created_at::date) between p_start and p_end
   union all select 'questionnaires',q.id::text,coalesce(q.completed_at,q.created_at)::date from questionnaire_responses q where q.user_id=p_user and q.status='completed' and coalesce(q.completed_at,q.created_at)::date between p_start and p_end
   union all select 'suggested_content',c.id::text,c.created_at::date from content_recommendations c where c.user_id=p_user and c.created_at::date between p_start and p_end
   union all select 'viewed_content',r.id::text,r.created_at::date from reading_history r where r.user_id=p_user and r.created_at::date between p_start and p_end
   union all select 'guided_content',g.id::text,coalesce(g.completed_at,g.started_at,g.updated_at)::date from guided_content_progress g where g.user_id=p_user and coalesce(g.completed_at,g.started_at,g.updated_at)::date between p_start and p_end
   union all select 'personalized_content',p.id::text,coalesce(p.read_at,p.sent_at,p.created_at)::date from personalized_content_deliveries p where p.user_id=p_user and coalesce(p.read_at,p.sent_at,p.created_at)::date between p_start and p_end
   union all select 'care_plan_feedback',s.id::text,s.updated_at::date from care_plan_action_state s where s.user_id=p_user and s.updated_at::date between p_start and p_end
 ), counts as (select source,count(*) n from events group by source)
 select jsonb_build_object(
  'total_entries',(select count(*) from events),
  'active_days',(select count(distinct day) from events),
  'source_counts',coalesce((select jsonb_object_agg(source,n) from counts),'{}'::jsonb),
  'min_entries',12,'min_active_days',8
 ) into v;
 return v;
end $$;
revoke all on function public.admin_care_plan_activity_summary(uuid,date,date) from public,anon;
grant execute on function public.admin_care_plan_activity_summary(uuid,date,date) to authenticated;
comment on function public.admin_care_plan_activity_summary(uuid,date,date) is 'Agrega apenas contagens e dias das fontes válidas do Plano de Autocuidado; não expõe textos íntimos.';
commit;
