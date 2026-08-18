-- Corrige o indicador operacional de IA para separar histórico de incidente ativo.
--
-- Antes, ai_generation_errors_30d contava todos os eventos de erro dos últimos
-- 30 dias. Isso fazia o painel permanecer em Atenção mesmo depois de uma geração
-- bem-sucedida corrigir o incidente. O histórico continua preservado em
-- ai_generation_errors_history_30d, enquanto ai_generation_errors_30d passa a
-- representar fluxos de conteúdo cujo evento MAIS RECENTE nos últimos 30 dias
-- ainda é erro/failed.

create or replace function public.get_operational_metrics()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reports_generated_30d integer := 0;
  v_reports_fallback_30d integer := 0;
  v_care_pending_review integer := 0;
  v_guidance_pending integer := 0;
  v_editorial_rules_with_error integer := 0;
  v_articles_blocked_30d integer := 0;
  v_ai_errors_30d integer := 0;
  v_ai_errors_history_30d integer := 0;
  v_ai_last_success_at timestamptz := null;
  v_ai_last_error_at timestamptz := null;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  select count(*)::int,
         count(*) filter (where fallback_used = true)::int
  into v_reports_generated_30d, v_reports_fallback_30d
  from public.reports
  where status = 'generated'
    and coalesce(generated_at, created_at) >= now() - interval '30 days';

  select count(*)::int into v_care_pending_review
  from public.monthly_care_plans
  where status = 'pending_review';

  select count(*)::int into v_guidance_pending
  from public.monthly_guidance_requests
  where coalesce(status, 'open') not in ('answered', 'sent', 'closed', 'resolved');

  select count(*)::int into v_editorial_rules_with_error
  from public.content_automations
  where status = 'active' and nullif(trim(last_error), '') is not null;

  select count(*)::int into v_articles_blocked_30d
  from public.articles
  where created_at >= now() - interval '30 days'
    and status = 'draft'
    and internal_notes ilike 'Auto-publicação bloqueada%';

  -- Histórico bruto: preserva todos os erros para auditoria.
  select count(*)::int,
         max(created_at) filter (
           where lower(coalesce(status, '')) in ('error', 'failed')
              or lower(coalesce(generation_status, '')) in ('error', 'failed')
         ),
         max(created_at) filter (
           where lower(coalesce(status, '')) = 'success'
              or lower(coalesce(generation_status, '')) = 'success'
         )
  into v_ai_errors_history_30d, v_ai_last_error_at, v_ai_last_success_at
  from public.ai_generation_logs
  where created_at >= now() - interval '30 days';

  -- Saúde atual: para cada tipo de conteúdo, considera somente o evento mais
  -- recente. Se houve sucesso depois do erro, o incidente daquele fluxo está
  -- recuperado e não deve manter o painel em Atenção.
  with latest_by_content as (
    select distinct on (coalesce(content_type, 'generic'))
      coalesce(content_type, 'generic') as content_type,
      lower(coalesce(nullif(generation_status, ''), nullif(status, ''), '')) as latest_status,
      created_at
    from public.ai_generation_logs
    where created_at >= now() - interval '30 days'
    order by coalesce(content_type, 'generic'), created_at desc
  )
  select count(*)::int
  into v_ai_errors_30d
  from latest_by_content
  where latest_status in ('error', 'failed');

  return jsonb_build_object(
    'reports_generated_30d', v_reports_generated_30d,
    'reports_fallback_30d', v_reports_fallback_30d,
    'care_plans_pending_review', v_care_pending_review,
    'guidance_pending_review', v_guidance_pending,
    'editorial_rules_with_error', v_editorial_rules_with_error,
    'articles_auto_publish_blocked_30d', v_articles_blocked_30d,
    -- Mantido por compatibilidade com o frontend: agora representa incidentes
    -- não recuperados, e não o total histórico bruto.
    'ai_generation_errors_30d', v_ai_errors_30d,
    'ai_generation_active_flows_with_error', v_ai_errors_30d,
    'ai_generation_errors_history_30d', v_ai_errors_history_30d,
    'ai_generation_last_error_at', v_ai_last_error_at,
    'ai_generation_last_success_at', v_ai_last_success_at,
    'checked_at', now()
  );
end;
$function$;

comment on function public.get_operational_metrics() is
'Operational health for admin. ai_generation_errors_30d reports unrecovered AI content flows; ai_generation_errors_history_30d preserves the raw 30-day error count.';
