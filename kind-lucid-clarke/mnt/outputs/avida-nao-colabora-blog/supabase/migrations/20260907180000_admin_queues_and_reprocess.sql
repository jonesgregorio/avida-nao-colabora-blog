-- Etapa 3 (Evolução do Admin) — Filas e Falhas.
--
-- admin_queues_overview(): profundidade das filas + falhas nas últimas 24h,
-- consolidado num lugar só. admin_requeue_overdue_personalization(): ação
-- segura e idempotente — devolve tarefas de personalização "overdue" (sem
-- rascunho/entrega) para 'pending', que é o que o worker consome. Mesma
-- lógica do cron 20260820002500; não envia nada, não duplica.
--
-- Ambas admin-only (is_admin = role admin + AAL2). Não altera automações,
-- Stripe nem get_operational_metrics().

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
    'failures_24h', jsonb_build_object(
      'reports_failed', (select count(*) from public.reports where status = 'failed' and coalesce(generated_at, v_now) > v_now - interval '24 hours'),
      'care_plans_failed', (select count(*) from public.monthly_care_plans where status = 'failed' and coalesce(generated_at, v_now) > v_now - interval '24 hours'),
      'emails_failed', (select count(*) from public.email_logs where status = 'failed' and created_at > v_now - interval '24 hours'),
      'ai_errors', (select count(*) from public.ai_generation_logs where status in ('error','failed') and created_at > v_now - interval '24 hours'),
      'content_jobs_failed', (select count(*) from public.content_generation_jobs where status = 'failed' and updated_at > v_now - interval '24 hours'),
      'webhooks_failed', (select count(*) from public.stripe_webhook_events where coalesce(status,'') = 'failed' and created_at > v_now - interval '24 hours')
    ),
    -- Totais de longo prazo, pra não "esconder" incidentes com mais de 24h.
    'failures_total', jsonb_build_object(
      'reports_failed', (select count(*) from public.reports where status = 'failed'),
      'care_plans_failed', (select count(*) from public.monthly_care_plans where status = 'failed'),
      'content_jobs_failed', (select count(*) from public.content_generation_jobs where status = 'failed')
    )
  )
  into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

-- Ação segura: só mexe em 'overdue' sem rascunho/entrega → 'pending'.
create or replace function public.admin_requeue_overdue_personalization()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with requeued as (
    update public.user_personalization_tasks
       set status = 'pending', updated_at = now()
     where status = 'overdue'
       and delivery_id is null
       and generated_at is null
    returning id
  )
  select count(*) from requeued into v_count;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.admin_queues_overview() from public, anon;
revoke all on function public.admin_requeue_overdue_personalization() from public, anon;
grant execute on function public.admin_queues_overview() to authenticated;
grant execute on function public.admin_requeue_overdue_personalization() to authenticated;
