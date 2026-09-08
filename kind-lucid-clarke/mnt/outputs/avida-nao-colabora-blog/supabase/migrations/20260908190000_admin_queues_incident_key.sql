-- Admin: corrige duas regressões em admin_queues_overview().
--
-- 1. notifications_draft voltou a consultar public.notifications.status — coluna
--    que NÃO existe em produção (ver 20260907290000). A fonte correta de
--    "comunicação não enviada" é public.admin_communications WHERE status='draft',
--    já usada por admin_operational_dashboard().
--
-- 2. Incidente de IA era agrupado só por content_type. Isso deixava o sucesso do
--    plano do usuário B "resolver" a falha do plano do usuário A. A chave de
--    incidente passa a considerar a ENTIDADE real da operação:
--        (content_type, user_id, source_period_start)
--    Uma falha só deixa de ser ativa quando a MESMA frente (mesmo usuário /
--    período) tem uma execução posterior bem-sucedida. Fallback determinístico
--    conta como incidente ativo (a IA externa não entregou) até um sucesso real.

create or replace function public.admin_queues_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
  v_now timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with latest_ai as (
    -- Uma linha por frente real de geração (tipo + usuário + período de origem).
    select distinct on (
      coalesce(content_type, 'generic'),
      coalesce(user_id::text, 'none'),
      coalesce(source_period_start::text, 'none')
    )
      coalesce(content_type, 'generic')          as content_type,
      coalesce(user_id::text, 'none')             as user_key,
      coalesce(source_period_start::text, 'none') as period_key,
      lower(coalesce(generation_status, status))  as outcome,
      created_at
    from public.ai_generation_logs
    order by
      coalesce(content_type, 'generic'),
      coalesce(user_id::text, 'none'),
      coalesce(source_period_start::text, 'none'),
      created_at desc
  ),
  latest_email as (
    select distinct on (
      coalesce(user_id::text, nullif(to_email, ''), nullif(email, ''), 'unknown'),
      coalesce(nullif(template_key, ''), 'generic')
    )
      coalesce(user_id::text, nullif(to_email, ''), nullif(email, ''), 'unknown') as recipient_key,
      coalesce(nullif(template_key, ''), 'generic') as template_key_norm,
      status,
      created_at
    from public.email_logs
    order by
      coalesce(user_id::text, nullif(to_email, ''), nullif(email, ''), 'unknown'),
      coalesce(nullif(template_key, ''), 'generic'),
      created_at desc
  )
  select jsonb_build_object(
    'generated_at', v_now,
    'queues', jsonb_build_object(
      'personalization_pending', (select count(*) from public.user_personalization_tasks where status = 'pending'),
      'personalization_overdue', (select count(*) from public.user_personalization_tasks
        where status = 'overdue' and delivery_id is null and generated_at is null),
      'reports_building', (select count(*) from public.reports where status = 'building'),
      'reports_pending_review', (select count(*) from public.reports where status in ('draft','generated','pending_review')),
      'care_plans_pending', (select count(*) from public.monthly_care_plans where status in ('pending_generation','generating','pending_review','draft')),
      -- CORRIGIDO: comunicação não enviada vem de admin_communications, não de notifications.status.
      'notifications_draft', (select count(*) from public.admin_communications where status = 'draft'),
      'guidance_pending', (select count(*) from public.monthly_guidance_requests
        where coalesce(status,'open') in ('open','pending','in_progress')),
      'tickets_open', (select count(*) from public.support_tickets where status not in ('closed','resolved')),
      'tickets_stale_7d', (select count(*) from public.support_tickets
        where status not in ('closed','resolved') and coalesce(updated_at, created_at) < v_now - interval '7 days'),
      'cancellations_to_handle', (select count(*) from public.subscription_change_feedback
        where coalesce(change_type,'') = 'cancellation' and admin_handled_at is null and coalesce(status,'') <> 'reverted'),
      'content_jobs_running', (select count(*) from public.content_generation_jobs where status in ('pending','running')),
      'webhooks_stuck', (select count(*) from public.stripe_webhook_events
        where coalesce(status,'processing') = 'processing' and created_at < v_now - interval '1 hour')
    ),
    'failures_active', jsonb_build_object(
      -- Só permanece ativo se a ÚLTIMA execução daquela frente (tipo+usuário+período)
      -- ainda falhou/caiu em fallback. Um sucesso posterior da MESMA frente resolve.
      'ai_errors', (select count(*) from latest_ai
        where outcome in ('error','failed','fallback') and created_at > v_now - interval '30 days'),
      'emails_failed', (select count(*) from latest_email
        where status = 'failed' and created_at > v_now - interval '7 days'),
      'reports_failed', (select count(*) from public.reports where status = 'failed'),
      'care_plans_failed', (select count(*) from public.monthly_care_plans where status = 'failed'),
      'content_jobs_failed', (select count(*) from public.content_generation_jobs where status = 'failed'),
      'webhooks_failed', (select count(*) from public.stripe_webhook_events where coalesce(status,'') = 'failed')
    ),
    'failures_24h', jsonb_build_object(
      'reports_failed', (select count(*) from public.reports where status = 'failed' and coalesce(updated_at, generated_at, created_at, v_now) > v_now - interval '24 hours'),
      'care_plans_failed', (select count(*) from public.monthly_care_plans where status = 'failed' and coalesce(updated_at, generated_at, created_at, v_now) > v_now - interval '24 hours'),
      'emails_failed', (select count(*) from public.email_logs where status = 'failed' and created_at > v_now - interval '24 hours'),
      'ai_errors', (select count(*) from public.ai_generation_logs where lower(coalesce(generation_status, status)) in ('error','failed','fallback') and created_at > v_now - interval '24 hours'),
      'content_jobs_failed', (select count(*) from public.content_generation_jobs where status = 'failed' and updated_at > v_now - interval '24 hours'),
      'webhooks_failed', (select count(*) from public.stripe_webhook_events where coalesce(status,'') = 'failed' and created_at > v_now - interval '24 hours')
    ),
    'failures_total', jsonb_build_object(
      'reports_failed', (select count(*) from public.reports where status = 'failed'),
      'care_plans_failed', (select count(*) from public.monthly_care_plans where status = 'failed'),
      'content_jobs_failed', (select count(*) from public.content_generation_jobs where status = 'failed')
    )
  ) into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_queues_overview() from public, anon;
grant execute on function public.admin_queues_overview() to authenticated;

comment on function public.admin_queues_overview() is
  'Admin-only: filas, falhas recentes e incidentes ativos. IA é agrupada por (content_type, user_id, source_period_start): uma falha/fallback só deixa de ser ativa quando a MESMA frente tem sucesso posterior. notifications_draft vem de admin_communications.status=draft.';

-- Índice para a leitura por frente (distinct on ... order by ... created_at desc).
create index if not exists ai_generation_logs_incident_key
  on public.ai_generation_logs (content_type, user_id, source_period_start, created_at desc);
