-- Hotfix Etapa 2 — admin_operational_dashboard: a coluna notifications.status
-- não existe em produção (010/069 não aplicaram por lá). A métrica
-- "notifications_draft" (Notificações não enviadas) passa a contar as
-- CAMPANHAS em rascunho (admin_communications), que é o conceito real de
-- "comunicação ainda não enviada" no produto. Recria a função idêntica,
-- só com essa sub-consulta corrigida. Idempotente.

create or replace function public.admin_operational_dashboard(
  p_start timestamptz,
  p_end   timestamptz
)
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
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'período inválido';
  end if;

  select jsonb_build_object(
    'range', jsonb_build_object('start', p_start, 'end', p_end),

    -- Atividade da plataforma no período.
    'period', jsonb_build_object(
      'new_users', (
        select count(*) from public.profiles where created_at >= p_start and created_at < p_end
      ),
      'active_users', (
        select count(distinct uid) from (
          select user_id as uid from public.diary_entries where created_at >= p_start and created_at < p_end
          union
          select user_id from public.questionnaire_responses where created_at >= p_start and created_at < p_end
          union
          select user_id from public.reports where generated_at >= p_start and generated_at < p_end
          union
          select user_id from public.profiles where last_seen_at >= p_start and last_seen_at < p_end
        ) s where uid is not null
      ),
      'checkins', (
        select count(*) from public.diary_entries
        where coalesce(entry_type,'diary') = 'checkin' and created_at >= p_start and created_at < p_end
      ),
      'diary_entries', (
        select count(*) from public.diary_entries
        where coalesce(entry_type,'diary') = 'diary' and created_at >= p_start and created_at < p_end
      ),
      'questionnaires_completed', (
        select count(*) from public.questionnaire_responses
        where coalesce(status,'') = 'completed' and completed_at >= p_start and completed_at < p_end
      ),
      'care_plans_generated', (
        select count(*) from public.monthly_care_plans
        where status = 'generated' and generated_at >= p_start and generated_at < p_end
      ),
      'reports_generated', (
        select count(*) from public.reports
        where status = 'generated' and generated_at >= p_start and generated_at < p_end
      ),
      'articles_read', (
        select count(*) from public.reading_history where created_at >= p_start and created_at < p_end
      ),
      'guided_completed', (
        select count(*) from public.user_content_history where completed_at >= p_start and completed_at < p_end
      ),
      'tickets_opened', (
        select count(*) from public.support_tickets where created_at >= p_start and created_at < p_end
      ),
      'guidance_requests', (
        select count(*) from public.monthly_guidance_requests where created_at >= p_start and created_at < p_end
      ),
      'new_subscriptions', (
        select count(*) from public.subscription_events
        where event_type in ('subscription_created','checkout_completed') and created_at >= p_start and created_at < p_end
      ),
      'cancellations', (
        select count(*) from public.subscription_events
        where event_type in ('cancellation_requested','cancellation_completed','subscription_deleted') and created_at >= p_start and created_at < p_end
      ),
      'payments_failed', (
        select count(*) from public.payment_events
        where status = 'failed' and created_at >= p_start and created_at < p_end
      ),
      'plan_upgrades', (
        select count(*) from public.plan_change_history
        where coalesce(change_type,'') in ('upgrade','admin_change') and created_at >= p_start and created_at < p_end
      ),
      'plan_downgrades', (
        select count(*) from public.plan_change_history
        where coalesce(change_type,'') = 'downgrade' and created_at >= p_start and created_at < p_end
      )
    ),

    -- Requer atenção — estado atual, sempre visível.
    'attention', jsonb_build_object(
      'reports_failed', (
        select count(*) from public.reports where status = 'failed'
      ),
      'care_plans_failed', (
        select count(*) from public.monthly_care_plans where status = 'failed'
      ),
      'email_failures_7d', (
        select count(*) from public.email_logs where status = 'failed' and created_at > v_now - interval '7 days'
      ),
      'ai_errors_active', (
        select coalesce((public.get_operational_metrics() ->> 'ai_generation_errors_30d')::int, 0)
      ),
      'payments_failed_30d', (
        select count(*) from public.payment_events
        where status = 'failed' and created_at > v_now - interval '30 days'
      ),
      'guidance_pending', (
        select count(*) from public.monthly_guidance_requests
        where coalesce(status,'open') in ('open','pending','in_progress')
      ),
      'tickets_open', (
        select count(*) from public.support_tickets where status not in ('closed','resolved')
      ),
      'tickets_stale_7d', (
        select count(*) from public.support_tickets
        where status not in ('closed','resolved') and coalesce(updated_at, created_at) < v_now - interval '7 days'
      ),
      'notifications_draft', (
        select count(*) from public.admin_communications where status = 'draft'
      ),
      'care_plans_pending_review', (
        select count(*) from public.monthly_care_plans where status in ('pending_review','draft')
      ),
      'cancellations_to_handle', (
        select count(*) from public.subscription_change_feedback
        where coalesce(change_type,'') = 'cancellation' and admin_handled_at is null and coalesce(status,'') <> 'reverted'
      )
    )
  )
  into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_operational_dashboard(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_operational_dashboard(timestamptz, timestamptz) to authenticated;
