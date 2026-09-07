-- Reset de verificação em duas etapas (2FA/TOTP) de um usuário, pelo Admin.
--
-- Motivo: o app usa MFA por aplicativo autenticador (TOTP). Quem ativa o 2FA e
-- depois perde o app (troca de celular, desinstala) fica trancado na tela
-- "Confirme que é você" sem forma de recuperar — não há código por e-mail.
-- Até aqui só dava para resolver removendo o fator no painel do Supabase.
--
-- Segue exatamente o padrão de 018_admin_user_auth_ops.sql:
--   SECURITY DEFINER + is_admin() (que já exige role=admin E sessão AAL2).
-- Remove os fatores TOTP do usuário; auth.mfa_challenges tem FK ON DELETE
-- CASCADE, então os desafios pendentes somem junto. Sessões existentes não são
-- tocadas — o usuário travado não tem sessão ativa, é por isso que está travado.

create or replace function public.admin_reset_user_mfa(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not is_admin() then
    raise exception 'Unauthorized';
  end if;
  if target_user_id is null then
    raise exception 'target_user_id obrigatório';
  end if;

  delete from auth.mfa_factors where user_id = target_user_id;
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke execute on function public.admin_reset_user_mfa(uuid) from public;
revoke execute on function public.admin_reset_user_mfa(uuid) from anon;
grant execute on function public.admin_reset_user_mfa(uuid) to authenticated;
