-- SEO smart corrector: expõe somente o destino/tipo de redirects ativos para o renderer público.
-- Não expõe hits, IDs, metadados de admin ou redirects inativos.

create or replace function public.get_public_redirect(p_path text)
returns table(to_path text, type integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.to_path, r.type
  from public.analytics_redirects r
  where r.from_path = p_path
    and r.is_active = true
    and r.type in (301, 302)
  limit 1;
$$;

revoke all on function public.get_public_redirect(text) from public;
grant execute on function public.get_public_redirect(text) to anon, authenticated, service_role;
