-- Central única de ações humanas do Admin.
-- Objetivos:
-- 1) toda ação humana obrigatória entra na mesma fonte de verdade;
-- 2) rascunhos sem prazo NÃO contam como pendência;
-- 3) cancelamentos, editorial em revisão e incidentes ganham prazo operacional;
-- 4) falhas transitórias de IA/e-mail recebem uma janela de 15 min antes de alertar;
-- 5) a listagem paginada (20 por padrão) usa a mesma regra do resumo.

begin;

create or replace function public.admin_action_center_items(
  p_area text default null,
  p_bucket text default 'all',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_limit integer := least(greatest(coalesce(p_limit,20),1),100);
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  with latest_ai as (
    select distinct on (
      coalesce(nullif(btrim(incident_entity_key),''), coalesce(content_type,'generic') || ':u:' || coalesce(user_id::text,'-') || ':p:' || coalesce(source_period_start::text,'-'))
    )
      id::text entity_id,
      user_id::text user_id,
      coalesce(content_type,'Geração por IA') title,
      lower(coalesce(generation_status,status)) outcome,
      created_at
    from public.ai_generation_logs
    order by coalesce(nullif(btrim(incident_entity_key),''), coalesce(content_type,'generic') || ':u:' || coalesce(user_id::text,'-') || ':p:' || coalesce(source_period_start::text,'-')), created_at desc
  ), latest_email as (
    select distinct on (
      coalesce(user_id::text,nullif(to_email,''),nullif(email,''),'unknown'), coalesce(nullif(template_key,''),'generic')
    )
      id::text entity_id,
      user_id::text user_id,
      ('E-mail: ' || coalesce(nullif(template_key,''),'transacional'))::text title,
      status,
      created_at
    from public.email_logs
    order by coalesce(user_id::text,nullif(to_email,''),nullif(email,''),'unknown'), coalesce(nullif(template_key,''),'generic'), created_at desc
  ), work as (
    select 'support'::text area, s.id::text entity_id, s.user_id::text user_id,
      coalesce(nullif(s.subject,''),'Atendimento de suporte')::text title,
      coalesce(s.last_user_message_at,s.created_at) created_at,
      coalesce(s.last_user_message_at,s.created_at) + case lower(coalesce(s.plan_at_creation,'free')) when 'plus' then interval '24 hours' when 'essential' then interval '48 hours' when 'essencial' then interval '48 hours' else interval '72 hours' end due_at,
      'normal'::text severity, 'suporte'::text destination
    from public.support_tickets s where s.status in ('open','in_progress','awaiting_admin')

    union all
    select 'guidance', g.id::text, g.user_id::text, 'Orientação mensal', g.created_at,
      g.created_at + interval '7 days', 'normal', 'guidance-requests'
    from public.monthly_guidance_requests g where coalesce(g.status,'open') in ('open','pending','in_progress','in_review')

    union all
    select 'care', c.id::text, c.user_id::text, 'Plano de Autocuidado', c.created_at,
      coalesce(c.review_due_at::timestamptz,c.created_at + interval '5 days'), 'normal', 'self-care-plans'
    from public.monthly_care_plans c where c.status in ('pending_review','draft','generated')

    union all
    select 'deliveries', t.id::text, t.user_id::text, coalesce(nullif(t.task_title,''),'Entrega personalizada'), t.created_at,
      t.due_at, case when t.status='overdue' then 'high' else 'normal' end, 'personalization'
    from public.user_personalization_tasks t
    where t.status in ('pending','overdue','draft','generated')
      and t.task_key not in ('self_care_plan','monthly_plan_review','monthly_guidance','monthly_guidance_reply','advanced_monthly_report','monthly_summary','weekly_report_suggestion')

    union all
    select 'reports', r.id::text, r.user_id::text, 'Falha na geração de relatório', coalesce(r.updated_at,r.generated_at,r.created_at),
      coalesce(r.updated_at,r.generated_at,r.created_at) + interval '24 hours', 'high', 'pdf'
    from public.reports r where r.status='failed'

    union all
    select 'cancellations', f.id::text, f.user_id::text, 'Pedido de cancelamento', f.requested_at,
      f.requested_at + interval '24 hours', 'high', 'cancelamentos'
    from public.subscription_change_feedback f
    where coalesce(f.change_type,'')='cancellation' and f.admin_handled_at is null and coalesce(f.status,'') <> 'reverted'

    -- Editorial: só conteúdo explicitamente em revisão. Rascunho comum e conteúdo já
    -- agendado/aprovado não viram pendência. Se houver data futura em published_at,
    -- a revisão vence 24h antes; sem data, há uma janela operacional de 3 dias.
    union all
    select 'editorial', a.id::text, null::text, coalesce(nullif(a.title,''),'Conteúdo em revisão'), a.created_at,
      coalesce(a.published_at - interval '24 hours', a.created_at + interval '3 days'), 'normal', 'articles'
    from public.articles a where a.status='review'

    -- Incidentes: uma falha transitória recente tem 15 minutos para se recuperar antes
    -- de virar trabalho humano. Depois disso, IA/webhook são tratados como críticos (4h)
    -- e e-mail/jobs/campanhas como operacionais (24h).
    union all
    select 'incidents', ai.entity_id, ai.user_id, ('IA · ' || ai.title), ai.created_at,
      ai.created_at + interval '4 hours', 'critical', 'uso-ia'
    from latest_ai ai where ai.outcome in ('error','failed') and ai.created_at <= v_now - interval '15 minutes' and ai.created_at > v_now - interval '30 days'

    union all
    select 'incidents', e.entity_id, e.user_id, e.title, e.created_at,
      e.created_at + interval '24 hours', 'high', 'emails'
    from latest_email e where e.status='failed' and e.created_at <= v_now - interval '15 minutes' and e.created_at > v_now - interval '7 days'

    union all
    select 'incidents', j.id::text, null::text, 'Job de conteúdo com falha', j.updated_at,
      j.updated_at + interval '24 hours', 'high', 'system-health'
    from public.content_generation_jobs j where j.status='failed'

    union all
    select 'incidents', w.id::text, null::text, 'Webhook Stripe com falha', w.created_at,
      w.created_at + interval '4 hours', 'critical', 'financeiro'
    from public.stripe_webhook_events w where coalesce(w.status,'')='failed'

    union all
    select 'incidents', w.id::text, null::text, 'Webhook Stripe travado em processamento', w.created_at,
      w.created_at + interval '4 hours', 'critical', 'financeiro'
    from public.stripe_webhook_events w where coalesce(w.status,'processing')='processing' and w.created_at < v_now - interval '1 hour'

    union all
    select 'incidents', c.id::text, null::text, coalesce(nullif(c.title,''),'Campanha com falha'), c.created_at,
      coalesce(c.scheduled_for,c.created_at) + interval '24 hours', 'high', 'comunicacao'
    from public.admin_communications c where c.status='failed'
  ), enriched as (
    select w.*,
      case
        when w.due_at is null then 'no_due'
        when w.due_at < v_now then 'overdue'
        when w.due_at <= v_now + interval '24 hours' then 'today'
        when w.due_at <= v_now + interval '3 days' then 'due_3d'
        else 'later'
      end bucket
    from work w
  ), filtered as (
    select * from enriched
    where (p_area is null or p_area='' or p_area='all' or area=p_area)
      and (coalesce(p_bucket,'all')='all' or bucket=p_bucket)
  ), page as (
    select * from filtered
    order by
      case bucket when 'overdue' then 0 when 'today' then 1 when 'due_3d' then 2 when 'later' then 3 else 4 end,
      case severity when 'critical' then 0 when 'high' then 1 else 2 end,
      due_at nulls last, created_at
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from filtered),
    'limit',v_limit,'offset',v_offset,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'area',area,'id',entity_id,'user_id',user_id,'title',title,'created_at',created_at,
      'due_at',due_at,'bucket',bucket,'severity',severity,'destination',destination
    )) from page),'[]'::jsonb)
  ) into v;
  return v;
end $$;

revoke all on function public.admin_action_center_items(text,text,integer,integer) from public,anon;
grant execute on function public.admin_action_center_items(text,text,integer,integer) to authenticated,service_role;

create or replace function public.admin_action_center_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_now timestamptz:=now(); v jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  with payload as (
    select public.admin_action_center_items('all','all',100,0) value
  ), raw_items as (
    -- Snapshot usa a própria função paginada para manter semântica única. Como o limite
    -- público é 100, complementamos contagens por área com chamadas filtradas.
    select unnest(array['support','guidance','care','deliveries','reports','cancellations','incidents','editorial']) area
  ), counts as (
    select area,
      (public.admin_action_center_items(area,'all',1,0)->>'total')::int total,
      (public.admin_action_center_items(area,'overdue',1,0)->>'total')::int overdue,
      ((public.admin_action_center_items(area,'today',1,0)->>'total')::int + (public.admin_action_center_items(area,'due_3d',1,0)->>'total')::int) due_3d
    from raw_items
  )
  select jsonb_build_object(
    'generated_at',v_now,
    'total',coalesce(sum(total),0),
    'overdue',coalesce(sum(overdue),0),
    'due_today',coalesce(sum((public.admin_action_center_items(area,'today',1,0)->>'total')::int),0),
    'due_3d',coalesce(sum(due_3d),0),
    'areas',coalesce(jsonb_object_agg(area,jsonb_build_object('total',total,'overdue',overdue,'due_3d',due_3d)),'{}'::jsonb)
  ) into v from counts;
  return v;
end $$;

revoke all on function public.admin_action_center_snapshot() from public,anon;
grant execute on function public.admin_action_center_snapshot() to authenticated,service_role;

-- A antiga métrica notifications_draft permanece por compatibilidade de contrato,
-- porém deixa de representar trabalho humano obrigatório. Rascunho sem prazo = 0.
-- Campanhas que realmente falharam passam a ser incidente ativo.
create or replace function public.admin_queues_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare result jsonb; v_now timestamptz:=now();
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  with latest_ai as (
    select distinct on (coalesce(nullif(btrim(incident_entity_key),''),coalesce(content_type,'generic')||':u:'||coalesce(user_id::text,'-')||':p:'||coalesce(source_period_start::text,'-')))
      lower(coalesce(generation_status,status)) outcome, created_at
    from public.ai_generation_logs
    order by coalesce(nullif(btrim(incident_entity_key),''),coalesce(content_type,'generic')||':u:'||coalesce(user_id::text,'-')||':p:'||coalesce(source_period_start::text,'-')),created_at desc
  ), latest_email as (
    select distinct on (coalesce(user_id::text,nullif(to_email,''),nullif(email,''),'unknown'),coalesce(nullif(template_key,''),'generic')) status,created_at
    from public.email_logs
    order by coalesce(user_id::text,nullif(to_email,''),nullif(email,''),'unknown'),coalesce(nullif(template_key,''),'generic'),created_at desc
  )
  select jsonb_build_object(
    'generated_at',v_now,
    'queues',jsonb_build_object(
      'personalization_pending',(select count(*) from public.user_personalization_tasks where status='pending'),
      'personalization_overdue',(select count(*) from public.user_personalization_tasks where status='overdue' and delivery_id is null and generated_at is null),
      'reports_building',(select count(*) from public.reports where status='building'),
      'reports_pending_review',0,
      'care_plans_pending',(select count(*) from public.monthly_care_plans where status in ('pending_generation','generating','pending_review','draft')),
      'notifications_draft',0,
      'guidance_pending',(select count(*) from public.monthly_guidance_requests where coalesce(status,'open') in ('open','pending','in_progress','in_review')),
      'tickets_open',(select count(*) from public.support_tickets where status not in ('closed','resolved')),
      'tickets_stale_7d',(select count(*) from public.support_tickets where status not in ('closed','resolved') and coalesce(updated_at,created_at)<v_now-interval '7 days'),
      'cancellations_to_handle',(select count(*) from public.subscription_change_feedback where coalesce(change_type,'')='cancellation' and admin_handled_at is null and coalesce(status,'')<>'reverted'),
      'content_jobs_running',(select count(*) from public.content_generation_jobs where status in ('pending','running')),
      'webhooks_stuck',(select count(*) from public.stripe_webhook_events where coalesce(status,'processing')='processing' and created_at<v_now-interval '1 hour')
    ),
    'failures_active',jsonb_build_object(
      'ai_errors',(select count(*) from latest_ai where outcome in ('error','failed') and created_at<=v_now-interval '15 minutes' and created_at>v_now-interval '30 days'),
      'emails_failed',(select count(*) from latest_email where status='failed' and created_at<=v_now-interval '15 minutes' and created_at>v_now-interval '7 days'),
      'reports_failed',(select count(*) from public.reports where status='failed'),
      'care_plans_failed',(select count(*) from public.monthly_care_plans where status='failed'),
      'content_jobs_failed',(select count(*) from public.content_generation_jobs where status='failed'),
      'webhooks_failed',(select count(*) from public.stripe_webhook_events where coalesce(status,'')='failed'),
      'campaigns_failed',(select count(*) from public.admin_communications where status='failed')
    ),
    'failures_24h',jsonb_build_object(
      'reports_failed',(select count(*) from public.reports where status='failed' and coalesce(updated_at,generated_at,created_at,v_now)>v_now-interval '24 hours'),
      'care_plans_failed',(select count(*) from public.monthly_care_plans where status='failed' and coalesce(updated_at,generated_at,created_at,v_now)>v_now-interval '24 hours'),
      'emails_failed',(select count(*) from public.email_logs where status='failed' and created_at>v_now-interval '24 hours'),
      'ai_errors',(select count(*) from public.ai_generation_logs where lower(coalesce(generation_status,status)) in ('error','failed','fallback') and created_at>v_now-interval '24 hours'),
      'content_jobs_failed',(select count(*) from public.content_generation_jobs where status='failed' and updated_at>v_now-interval '24 hours'),
      'webhooks_failed',(select count(*) from public.stripe_webhook_events where coalesce(status,'')='failed' and created_at>v_now-interval '24 hours'),
      'campaigns_failed',(select count(*) from public.admin_communications where status='failed' and created_at>v_now-interval '24 hours')
    )
  ) into result;
  return coalesce(result,'{}'::jsonb);
end $$;

revoke all on function public.admin_queues_overview() from public,anon;
grant execute on function public.admin_queues_overview() to authenticated;

comment on function public.admin_action_center_items(text,text,integer,integer) is
  'Fonte única paginada das ações humanas obrigatórias. Rascunhos sem prazo não entram; incidentes transitórios têm grace period de 15 min.';
comment on function public.admin_action_center_snapshot() is
  'Resumo da Central de Ação: atrasadas, vencem hoje/próximos 3 dias e áreas acionáveis.';

notify pgrst,'reload schema';
commit;
