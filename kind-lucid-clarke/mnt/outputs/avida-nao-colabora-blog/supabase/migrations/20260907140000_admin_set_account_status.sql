-- Bloqueio/suspensão de conta com efeito REAL (não só um rótulo).
--
-- Antes: o Admin marcava profiles.account_status = 'blocked'/'suspended', mas
-- nada verificava isso — a pessoa continuava logando e usando a API.
-- O gate no App.tsx (AccountBlockedGate) resolve o navegador; esta migration
-- adiciona a camada de verdade: bane o usuário no GoTrue (auth.users.banned_until),
-- o que invalida o login e os tokens já emitidos.
--
-- Segue o padrão de 018_admin_user_auth_ops.sql: SECURITY DEFINER + is_admin()
-- (que já exige role=admin E sessão AAL2). O service_role das automações não é
-- afetado (ban só vale para tokens de usuário).

create or replace function public.admin_set_account_status(
  target_user_id uuid,
  new_status text,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;
  if target_user_id is null then
    raise exception 'target_user_id obrigatório';
  end if;
  if new_status not in ('active', 'blocked', 'suspended') then
    raise exception 'Status inválido: %', new_status;
  end if;
  if target_user_id = auth.uid() and new_status <> 'active' then
    raise exception 'Um admin não pode bloquear ou suspender a própria conta.';
  end if;

  update public.profiles
  set
    account_status = new_status,
    blocked_at     = case when new_status = 'active' then null else now() end,
    blocked_by     = case when new_status = 'active' then null else auth.uid() end,
    blocked_reason = case when new_status = 'active' then null
                          else nullif(btrim(coalesce(reason, '')), '') end,
    updated_at = now()
  where user_id = target_user_id;

  -- Camada de verdade: GoTrue rejeita login e tokens ativos enquanto banned_until
  -- estiver no futuro. Data distante = "sem prazo"; volta a NULL ao reativar.
  update auth.users
  set
    banned_until = case when new_status = 'active' then null
                        else timestamptz '2999-12-31 00:00:00+00' end,
    updated_at = now()
  where id = target_user_id;
end;
$$;

revoke execute on function public.admin_set_account_status(uuid, text, text) from public;
revoke execute on function public.admin_set_account_status(uuid, text, text) from anon;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
