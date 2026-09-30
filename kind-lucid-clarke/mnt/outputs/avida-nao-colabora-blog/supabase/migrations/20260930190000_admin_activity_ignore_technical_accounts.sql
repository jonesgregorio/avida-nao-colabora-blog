-- Contas técnicas do smoke de produção (prod-smoke-*@example.com, criadas e removidas a
-- cada deploy pelo workflow production-smoke) não devem gerar "Novos usuários" nas
-- notificações do Admin.
--
-- 1) O emissor central passa a ignorar eventos dessas contas (cadastro, assinatura etc.).
-- 2) Remove do histórico os eventos técnicos já gravados. O filtro é restrito ao padrão
--    prod-smoke-*@example.com no e-mail do evento; nenhum usuário real é afetado.
-- Contas reais continuam gerando eventos normalmente.

create or replace function public._admin_activity_emit(
  p_event_type      text,
  p_user_id         uuid,
  p_title           text,
  p_message         text,
  p_metadata        jsonb,
  p_source          text,
  p_source_event_id text,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(p_metadata->>'email', '')) like 'prod-smoke-%@example.com'
     or (p_user_id is not null and exists (
       select 1 from auth.users u
       where u.id = p_user_id and lower(coalesce(u.email, '')) like 'prod-smoke-%@example.com'
     ))
  then
    return;
  end if;

  insert into public.admin_activity_events
    (event_type, user_id, title, message, metadata, source, source_event_id, idempotency_key)
  values
    (p_event_type, p_user_id, p_title, coalesce(p_message, ''), coalesce(p_metadata, '{}'::jsonb),
     p_source, p_source_event_id, p_idempotency_key)
  on conflict (idempotency_key) do nothing;
end;
$$;

delete from public.admin_activity_events
where lower(coalesce(metadata->>'email', '')) like 'prod-smoke-%@example.com';
