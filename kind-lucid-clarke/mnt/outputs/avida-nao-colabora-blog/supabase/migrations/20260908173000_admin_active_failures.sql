-- Admin: separa incidente ATIVO de erro histórico.
-- Mantém failures_24h para diagnóstico temporal, mas o Dashboard e o sino
-- passam a usar failures_active quando disponível.

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
    select distinct on (coalesce(content_type, 'generic'))
      coalesce(content_type, 'generic') as incident_key,
      status,
      created_at
    from public.ai_generation_logs
    order by coalesce(content_type, 'generic'), created_at desc
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
      'care_plans_pending', (select count(*) from public.monthly_care_plans where status in ('pending_generation','generating','pending_review','draft')),
      'notifications_draft', (select count(*) from public.notifications where coalesce(status,'draft') <> 'sent' and user_id is null),
      'content_jobs_running', (select count(*) from public.content_generation_jobs where status in ('pending','running')),
      'webhooks_stuck', (select count(*) from public.stripe_webhook_events
        where coalesce(status,'processing') = 'processing' and created_at < v_now - interval '1 hour')
    ),
    'failures_active', jsonb_build_object(
      -- Só permanece ativo se a ÚLTIMA tentativa daquela frente ainda falhou.
      -- Uma execução posterior com sucesso resolve automaticamente o alerta.
      'ai_errors', (select count(*) from latest_ai
        where status in ('error','failed') and created_at > v_now - interval '24 hours'),
      'emails_failed', (select count(*) from latest_email
        where status = 'failed' and created_at > v_now - interval '24 hours'),
      -- Os demais recursos possuem status mutável na própria entidade; portanto
      -- status=failed já representa estado ainda não reprocessado/resolvido.
      'reports_failed', (select count(*) from public.reports where status = 'failed'),
      'care_plans_failed', (select count(*) from public.monthly_care_plans where status = 'failed'),
      'content_jobs_failed', (select count(*) from public.content_generation_jobs where status = 'failed'),
      'webhooks_failed', (select count(*) from public.stripe_webhook_events where coalesce(status,'') = 'failed')
    ),
    'failures_24h', jsonb_build_object(
      'reports_failed', (select count(*) from public.reports where status = 'failed' and coalesce(updated_at, generated_at, created_at, v_now) > v_now - interval '24 hours'),
      'care_plans_failed', (select count(*) from public.monthly_care_plans where status = 'failed' and coalesce(updated_at, generated_at, created_at, v_now) > v_now - interval '24 hours'),
      'emails_failed', (select count(*) from public.email_logs where status = 'failed' and created_at > v_now - interval '24 hours'),
      'ai_errors', (select count(*) from public.ai_generation_logs where status in ('error','failed') and created_at > v_now - interval '24 hours'),
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
  'Admin-only: filas, falhas recentes e incidentes ativos. IA/e-mail são considerados ativos somente quando a tentativa mais recente da mesma frente ainda falhou.';
