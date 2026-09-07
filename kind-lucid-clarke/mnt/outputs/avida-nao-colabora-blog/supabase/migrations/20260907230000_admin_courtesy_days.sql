-- Etapa 8 (Evolução do Admin) — Gestão avançada de assinaturas.
--
-- "Conceder dias adicionais" de forma segura: estende o ACESSO DE CORTESIA
-- (profiles.unlimited_access / unlimited_access_until), que já é a mecânica de
-- cortesia do produto. Não toca no Stripe, não cria cobrança, não altera o
-- plano comercial (profiles.plan). É a forma sem risco de dar mais tempo de
-- acesso a alguém — pagante ou não.
--
-- As demais ações da etapa (alterar plano, conceder cortesia liga/desliga,
-- cancelar ao fim do ciclo, reativar, sincronizar, consultar Stripe) já existem
-- ou vão pela Edge Function admin-subscription (admin AAL2).
--
-- Idempotente no sentido de segurança: cada chamada ADICIONA os dias pedidos a
-- partir do maior entre "agora" e a data de cortesia vigente — a confirmação na
-- tela evita repetição acidental.

create or replace function public.admin_grant_courtesy_days(
  target_user_id uuid,
  p_days integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_days  integer := least(greatest(coalesce(p_days, 0), 1), 365);
  v_base  timestamptz;
  v_until timestamptz;
  v_prev  timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.profiles where user_id = target_user_id) then
    raise exception 'usuário não encontrado';
  end if;

  select unlimited_access_until into v_prev
  from public.profiles where user_id = target_user_id;

  v_base  := greatest(now(), coalesce(v_prev, now()));
  v_until := v_base + make_interval(days => v_days);

  update public.profiles set
    unlimited_access = true,
    unlimited_access_until = v_until,
    unlimited_access_reason = coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      unlimited_access_reason,
      'dias de cortesia concedidos pelo admin'
    ),
    updated_at = now()
  where user_id = target_user_id;

  return jsonb_build_object(
    'days_added', v_days,
    'previous_until', v_prev,
    'new_until', v_until
  );
end;
$$;

revoke all on function public.admin_grant_courtesy_days(uuid, integer, text) from public, anon;
grant execute on function public.admin_grant_courtesy_days(uuid, integer, text) to authenticated;
