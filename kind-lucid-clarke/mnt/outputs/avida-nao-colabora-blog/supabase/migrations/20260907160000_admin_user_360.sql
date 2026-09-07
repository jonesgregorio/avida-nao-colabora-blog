-- Etapa 1 (Evolução do Admin) — Ficha 360º do usuário.
--
-- A gaveta do Admin > Usuários mostrava contagens de diary_entries etc. via
-- SELECT direto — mas a RLS dessas tabelas é `auth.uid() = user_id`, então um
-- admin olhando OUTRO usuário recebia sempre 0. Esta RPC roda como SECURITY
-- DEFINER (com is_admin() = role admin + AAL2) e devolve um retrato agregado
-- do usuário: contagens, datas, status e sinais ESTRUTURADOS (tags de humor,
-- contexto, necessidade). NUNCA devolve texto livre de diário nem conteúdo
-- privado — só metadados úteis para o suporte.

create or replace function public.admin_user_360(target_user_id uuid)
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
  if target_user_id is null then
    raise exception 'target_user_id obrigatório';
  end if;

  select jsonb_build_object(
    'generated_at', v_now,

    -- Cabeçalho: pendências que o admin precisa ver de imediato.
    'header', jsonb_build_object(
      'pending_support', (
        select count(*) from public.support_tickets st
        where st.user_id = target_user_id and st.status not in ('closed','resolved')
      ),
      'pending_guidance', (
        select count(*) from public.monthly_guidance_requests g
        where g.user_id = target_user_id and coalesce(g.status,'open') in ('open','pending','in_progress')
      ),
      'pending_payment', (
        select count(*) from public.payment_events pe
        where pe.user_id = target_user_id
          and pe.status in ('failed','requires_action','past_due')
          and pe.created_at > v_now - interval '90 days'
      ),
      'scheduled_cancellation', (
        select coalesce(bool_or(us.cancel_at_period_end), false)
        from public.user_subscriptions us where us.user_id = target_user_id
      ),
      'unread_notifications', (
        select count(*) from public.notifications n
        where n.user_id = target_user_id and n.is_read is false
      ),
      'account_status', (
        select coalesce(p.account_status,'active') from public.profiles p where p.user_id = target_user_id
      ),
      'last_seen_at', (
        select p.last_seen_at from public.profiles p where p.user_id = target_user_id
      )
    ),

    -- Diário (sem texto livre): frequência e sinais estruturados.
    'diary', (
      with d as (
        select * from public.diary_entries
        where user_id = target_user_id and coalesce(entry_type,'diary') = 'diary'
      )
      select jsonb_build_object(
        'total', count(*),
        'first_at', min(coalesce(d.date::timestamptz, d.created_at)),
        'last_at', max(coalesce(d.date::timestamptz, d.created_at)),
        'active_days', count(distinct coalesce(d.date, d.created_at::date)),
        'deepenings', count(*) filter (where d.deepened_at is not null),
        'last_30d', count(*) filter (where coalesce(d.date::timestamptz, d.created_at) > v_now - interval '30 days')
      ) from d
    ),

    -- Check-ins (entry_type = 'checkin').
    'checkins', (
      with c as (
        select * from public.diary_entries
        where user_id = target_user_id and coalesce(entry_type,'diary') = 'checkin'
      )
      select jsonb_build_object(
        'total', count(*),
        'first_at', min(coalesce(c.date::timestamptz, c.created_at)),
        'last_at', max(coalesce(c.date::timestamptz, c.created_at)),
        'active_days', count(distinct coalesce(c.date, c.created_at::date)),
        'last_30d', count(*) filter (where coalesce(c.date::timestamptz, c.created_at) > v_now - interval '30 days')
      ) from c
    ),

    -- Mapa emocional: distribuição estruturada dos últimos 90 dias.
    'mapa', jsonb_build_object(
      'avg_mood_90d', (
        select round(avg(mood)::numeric, 2) from public.diary_entries
        where user_id = target_user_id and mood is not null
          and created_at > v_now - interval '90 days'
      ),
      'top_emotions', (
        select coalesce(jsonb_agg(t), '[]'::jsonb) from (
          select jsonb_build_object('label', tag, 'count', count(*)) as t
          from public.diary_entries de, unnest(coalesce(de.emotional_tags, '{}'::text[])) as tag
          where de.user_id = target_user_id and de.created_at > v_now - interval '180 days'
          group by tag order by count(*) desc limit 6
        ) s
      ),
      'top_contexts', (
        select coalesce(jsonb_agg(t), '[]'::jsonb) from (
          select jsonb_build_object('label', tag, 'count', count(*)) as t
          from public.diary_entries de, unnest(coalesce(de.context_tags, '{}'::text[])) as tag
          where de.user_id = target_user_id and de.created_at > v_now - interval '180 days'
          group by tag order by count(*) desc limit 6
        ) s
      ),
      'top_needs', (
        select coalesce(jsonb_agg(t), '[]'::jsonb) from (
          select jsonb_build_object('label', tag, 'count', count(*)) as t
          from public.diary_entries de, unnest(coalesce(de.need_tags, '{}'::text[])) as tag
          where de.user_id = target_user_id and de.created_at > v_now - interval '180 days'
          group by tag order by count(*) desc limit 6
        ) s
      )
    ),

    -- Questionários.
    'questionnaires', (
      select jsonb_build_object(
        'total', count(*),
        'completed', count(*) filter (where coalesce(status,'') = 'completed' or completed_at is not null),
        'last_at', max(created_at),
        'last_completed_at', max(completed_at)
      ) from public.questionnaire_responses where user_id = target_user_id
    ),

    -- Plano de autocuidado (mensal).
    'care_plans', (
      select jsonb_build_object(
        'total', count(*),
        'generated', count(*) filter (where status = 'generated'),
        'pending', count(*) filter (where status not in ('generated','failed')),
        'failed', count(*) filter (where status = 'failed'),
        'last_generated_at', max(generated_at),
        'last_reviewed_at', max(reviewed_at)
      ) from public.monthly_care_plans where user_id = target_user_id
    ),

    -- Conteúdos guiados: leitura de artigos + trilha de conteúdo automático.
    'content', jsonb_build_object(
      'articles_read', (
        select count(*) from public.reading_history where user_id = target_user_id
      ),
      'last_read_at', (
        select max(created_at) from public.reading_history where user_id = target_user_id
      ),
      'guided_sent', (
        select count(*) from public.user_content_history where user_id = target_user_id
      ),
      'guided_opened', (
        select count(*) from public.user_content_history where user_id = target_user_id and opened_at is not null
      ),
      'guided_completed', (
        select count(*) from public.user_content_history where user_id = target_user_id and completed_at is not null
      )
    ),

    -- Relatórios (semanal / mensal).
    'reports', (
      select jsonb_build_object(
        'total', count(*),
        'weekly', count(*) filter (where report_type = 'weekly'),
        'monthly', count(*) filter (where report_type = 'monthly'),
        'generated', count(*) filter (where status = 'generated'),
        'building', count(*) filter (where status = 'building'),
        'failed', count(*) filter (where status = 'failed'),
        'last_generated_at', max(generated_at)
      ) from public.reports where user_id = target_user_id
    ),

    -- Orientações mensais.
    'guidance', (
      select jsonb_build_object(
        'total', count(*),
        'answered', count(*) filter (where status = 'answered'),
        'open', count(*) filter (where coalesce(status,'open') in ('open','pending','in_progress')),
        'last_request_at', max(created_at),
        'last_answered_at', max(responded_at)
      ) from public.monthly_guidance_requests where user_id = target_user_id
    ),

    -- Assinatura + eventos financeiros (fonte de verdade continua o Stripe).
    'subscription', (
      select jsonb_build_object(
        'plan_key', us.plan_key,
        'status', us.status,
        'current_period_start', us.current_period_start,
        'current_period_end', us.current_period_end,
        'cancel_at_period_end', us.cancel_at_period_end,
        'pending_plan', us.pending_plan,
        'pending_plan_starts_at', us.pending_plan_starts_at,
        'stripe_subscription_id', us.stripe_subscription_id,
        'stripe_customer_id', (select p.stripe_customer_id from public.profiles p where p.user_id = target_user_id)
      ) from public.user_subscriptions us where us.user_id = target_user_id
    ),
    'payment_events', (
      select coalesce(jsonb_agg(t order by (t->>'created_at') desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'type', pe.type, 'status', pe.status, 'amount', pe.amount,
          'currency', pe.currency, 'description', pe.description, 'created_at', pe.created_at
        ) as t
        from public.payment_events pe where pe.user_id = target_user_id
        order by pe.created_at desc limit 12
      ) s
    ),
    'subscription_events', (
      select coalesce(jsonb_agg(t order by (t->>'created_at') desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'event_type', se.event_type, 'previous_plan', se.previous_plan, 'new_plan', se.new_plan,
          'amount', se.amount, 'status', se.status, 'created_at', se.created_at
        ) as t
        from public.subscription_events se where se.user_id = target_user_id
        order by se.created_at desc limit 12
      ) s
    ),
    'plan_history_count', (
      select count(*) from public.plan_change_history where user_id = target_user_id
    ),

    -- Histórico / Minha História.
    'history', (
      select jsonb_build_object(
        'milestones', count(*) filter (where item_type = 'milestone'),
        'highlighted_months', count(*) filter (where item_type = 'highlight_month'),
        'hidden_months', count(*) filter (where item_type = 'hidden_month')
      ) from public.user_history_items where user_id = target_user_id
    )
  )
  into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_user_360(uuid) from public, anon;
grant execute on function public.admin_user_360(uuid) to authenticated;
