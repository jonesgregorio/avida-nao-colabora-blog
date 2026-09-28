-- ============================================================================
-- Uso de IA — corrige percentual "gerações (N% do total)" por provedor
-- ============================================================================
-- admin_ai_usage_stats.by_provider contava TODAS as tentativas de cada
-- provedor (sucesso + erro + fallback), enquanto a tela (AdminAIUsage.tsx)
-- divide esse número por `success` (só sucessos, somado entre provedores)
-- para montar "gerações (N% do total)". Numerador e denominador usavam
-- universos diferentes, então os percentuais não fechavam em 100% — ex.:
-- Google Gemini aparecia como 101% do total. Corrige by_provider para
-- contar só outcome = 'success', igual ao total que already é dividido por.

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
        select provider, count(*) as n from f where outcome = 'success' group by provider
      ) g
    ), '{}'::jsonb)
  )
  into v;

  return coalesce(v, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_ai_usage_stats(timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.admin_ai_usage_stats(timestamptz, timestamptz, text, text, text) to authenticated;
