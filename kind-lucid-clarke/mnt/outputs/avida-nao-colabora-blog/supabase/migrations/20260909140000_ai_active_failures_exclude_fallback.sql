-- ============================================================================
-- "Falhas ativas de IA" deixa de contar FALLBACK como incidente permanente
-- ============================================================================
-- Sintoma relatado: o painel operacional mostrava "Falhas ativas de IA: 12" de
-- forma permanente e o admin não encontrava essas falhas em lugar nenhum.
--
-- Causa: run-emotional-automations grava generation_status = 'fallback' quando
-- a IA não responde e o texto determinístico é aplicado. A chave de incidente
-- desses fluxos é fixada no período (self_care_plan:u:<user>:p:<período>), que
-- nunca terá uma tentativa posterior de sucesso — logo o fallback ficava
-- "ativo" para sempre, mesmo com o usuário tendo recebido o conteúdo.
--
-- Correção: falha ATIVA = a última geração da entidade NÃO produziu resultado
-- (generation_status/status in ('error','failed')). O fallback é degradação
-- graciosa: continua visível em failures_24h como contexto, mas não infla a
-- fila operacional nem dispara o alerta do sino.
--
-- Idempotente: apenas recria a função (sem migração de dados).

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
    -- Uma linha por frente real de geração:
    --   incident_entity_key quando o produtor a definiu, senão o composto
    --   content_type + user + período (compat. com linhas antigas).
    select distinct on (
      coalesce(
        nullif(btrim(incident_entity_key), ''),
        coalesce(content_type, 'generic')
          || ':u:' || coalesce(user_id::text, '-')
          || ':p:' || coalesce(source_period_start::text, '-')
      )
    )
      coalesce(
        nullif(btrim(incident_entity_key), ''),
        coalesce(content_type, 'generic')
          || ':u:' || coalesce(user_id::text, '-')
          || ':p:' || coalesce(source_period_start::text, '-')
      ) as entity_key,
      lower(coalesce(generation_status, status)) as outcome,
      created_at
    from public.ai_generation_logs
    order by
      coalesce(
        nullif(btrim(incident_entity_key), ''),
        coalesce(content_type, 'generic')
          || ':u:' || coalesce(user_id::text, '-')
          || ':p:' || coalesce(source_period_start::text, '-')
      ),
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
      -- Falha ATIVA de IA: a última geração da entidade não retornou resultado.
      -- 'fallback' NÃO entra aqui (o usuário recebeu o texto determinístico) —
      -- fica só em failures_24h como contexto.
      'ai_errors', (select count(*) from latest_ai
        where outcome in ('error','failed') and created_at > v_now - interval '30 days'),
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
  'Admin-only: filas + incidentes ativos. IA agrupada por incident_entity_key (definida pelo produtor), com fallback para content_type+user+período nas linhas antigas. failures_active.ai_errors conta só a ULTIMA geração da entidade com outcome error/failed (fallback fica apenas em failures_24h). Uma falha real só sai de ativa com sucesso posterior da MESMA entidade ou após 30 dias.';
