-- ============================================================================
-- Uso de IA — página + estatísticas server-side
-- ============================================================================
-- AdminAIUsage lia só os últimos 200 logs e calculava tudo (cards, filtros)
-- sobre essa amostra. Estas RPCs paginam de verdade e devolvem estatísticas
-- do PERÍODO/FILTRO inteiro, não da página.

create or replace function public.admin_ai_usage_stats(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_provider text default null,
  p_content_type text default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with f as (
    select
      coalesce(provider, 'desconhecido') as provider,
      lower(coalesce(generation_status, status, 'success')) as outcome,
      coalesce(fallback_used, lower(coalesce(generation_status, status, '')) = 'fallback') as is_fallback
    from public.ai_generation_logs
    where (p_from is null or created_at >= p_from)
      and (p_to is null or created_at <= p_to)
      and (nullif(p_provider,'') is null or p_provider = 'todos' or provider = p_provider)
      and (nullif(p_content_type,'') is null or p_content_type = 'todos' or content_type = p_content_type)
      and (nullif(p_status,'') is null or p_status = 'todos' or lower(coalesce(generation_status, status)) = p_status)
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'success', (select count(*) from f where outcome = 'success'),
    'error', (select count(*) from f where outcome in ('error','failed')),
    'fallback', (select count(*) from f where outcome = 'fallback' or is_fallback),
    'by_provider', coalesce((
      select jsonb_object_agg(provider, n) from (
        select provider, count(*) as n from f group by provider
      ) g
    ), '{}'::jsonb)
  )
  into v;

  return coalesce(v, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_ai_usage_stats(timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.admin_ai_usage_stats(timestamptz, timestamptz, text, text, text) to authenticated;

create or replace function public.admin_ai_usage_page(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_provider text default null,
  p_content_type text default null,
  p_status text default null,
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid, content_type text, provider text, status text, generation_status text,
  fallback_used boolean, user_id uuid, source_period_start date,
  incident_entity_key text, error_msg text, created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with f as (
    select l.*, count(*) over() as total_count
    from public.ai_generation_logs l
    where (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at <= p_to)
      and (nullif(p_provider,'') is null or p_provider = 'todos' or l.provider = p_provider)
      and (nullif(p_content_type,'') is null or p_content_type = 'todos' or l.content_type = p_content_type)
      and (nullif(p_status,'') is null or p_status = 'todos' or lower(coalesce(l.generation_status, l.status)) = p_status)
      and (v_q is null
        or l.content_type ilike '%' || v_q || '%'
        or l.incident_entity_key ilike '%' || v_q || '%'
        or l.error_msg ilike '%' || v_q || '%')
  )
  select
    f.id, f.content_type, f.provider, f.status, f.generation_status,
    f.fallback_used, f.user_id, f.source_period_start, f.incident_entity_key,
    f.error_msg, f.created_at, f.total_count
  from f
  order by f.created_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_ai_usage_page(timestamptz, timestamptz, text, text, text, text, int, int) from public, anon;
grant execute on function public.admin_ai_usage_page(timestamptz, timestamptz, text, text, text, text, int, int) to authenticated;

create index if not exists ai_generation_logs_provider_created
  on public.ai_generation_logs (provider, created_at desc);
