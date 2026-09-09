-- ============================================================================
-- Fronteira clara entre as duas RPCs operacionais
-- ============================================================================
--   admin_queues_overview()      = ESTADO ATUAL (filas, incidentes ativos,
--                                  falhas recentes, atenção agora).
--   admin_operational_dashboard()= MÉTRICAS DE PERÍODO (novos usuários,
--                                  atividade, conversão, volume, tendências).
--
-- O bloco "attention" do admin_operational_dashboard reimplementava a regra de
-- "o que precisa de atenção" com fontes diferentes (ex.: ai_errors_active vinha
-- de get_operational_metrics, não da chave de incidente) — divergência
-- garantida. Agora ele CONSOME admin_queues_overview(): uma única fonte de
-- verdade para o estado atual. O bloco "period" (métricas) segue idêntico.

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
  v_now  timestamptz := now();
  v_snap jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'período inválido';
  end if;

  -- Estado atual: fonte ÚNICA.
  v_snap := public.admin_queues_overview();

  select jsonb_build_object(
    'range', jsonb_build_object('start', p_start, 'end', p_end),

    -- Atividade da plataforma no período (MÉTRICAS — responsabilidade desta RPC).
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

    -- Requer atenção — DERIVADO de admin_queues_overview (fonte única).
    -- Mantém as chaves que a UI já consome, sem regra própria.
    'attention', jsonb_build_object(
      'reports_failed',            coalesce((v_snap #>> '{failures_active,reports_failed}')::int, 0),
      'care_plans_failed',         coalesce((v_snap #>> '{failures_active,care_plans_failed}')::int, 0),
      'care_plans_pending_review', coalesce((v_snap #>> '{queues,care_plans_pending}')::int, 0),
      'guidance_pending',          coalesce((v_snap #>> '{queues,guidance_pending}')::int, 0),
      'tickets_open',              coalesce((v_snap #>> '{queues,tickets_open}')::int, 0),
      'tickets_stale_7d',          coalesce((v_snap #>> '{queues,tickets_stale_7d}')::int, 0),
      'notifications_draft',       coalesce((v_snap #>> '{queues,notifications_draft}')::int, 0),
      'cancellations_to_handle',   coalesce((v_snap #>> '{queues,cancellations_to_handle}')::int, 0),
      'email_failures_7d',         coalesce((v_snap #>> '{failures_active,emails_failed}')::int, 0),
      'ai_errors_active',          coalesce((v_snap #>> '{failures_active,ai_errors}')::int, 0),
      'webhooks_stuck',            coalesce((v_snap #>> '{queues,webhooks_stuck}')::int, 0),
      'payments_failed_30d', (
        select count(*) from public.payment_events
        where status = 'failed' and created_at > v_now - interval '30 days'
      )
    )
  )
  into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_operational_dashboard(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_operational_dashboard(timestamptz, timestamptz) to authenticated;

comment on function public.admin_operational_dashboard(timestamptz, timestamptz) is
  'Admin-only: MÉTRICAS DE PERÍODO (bloco period). O bloco attention é derivado de admin_queues_overview() — não tem regra própria. Estado atual/filas: use admin_queues_overview().';
