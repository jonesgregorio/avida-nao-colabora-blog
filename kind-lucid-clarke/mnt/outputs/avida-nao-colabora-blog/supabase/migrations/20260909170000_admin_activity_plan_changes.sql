-- ============================================================================
-- admin_activity_events — também para MUDANÇAS DE PLANO (upgrade / downgrade /
-- cancelamento), além de novo cadastro e nova assinatura.
-- ============================================================================
-- Recria o trigger de subscription_events para cobrir os tipos "confirmados"
-- pelo webhook Stripe. Sem duplicidade: cada tipo tem idempotency_key própria e
-- só os eventos canônicos (confirmed/completed) entram.
--
-- Tipos de admin_activity_events emitidos:
--   subscription_started   (checkout_completed)      — já existia
--   plan_upgraded          (upgrade_confirmed)
--   plan_downgraded        (downgrade_completed)
--   subscription_cancelled (cancellation_completed)
--
-- Idempotente (só create or replace).

create or replace function public.tg_admin_activity_on_subscription()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_email text;
  v_new_plan text := coalesce(new.new_plan, 'plus');
  v_prev_plan text := new.previous_plan;
  v_new_label text := case v_new_plan
    when 'essential' then 'Essencial' when 'plus' then 'Plus' when 'free' then 'Gratuito'
    else initcap(coalesce(v_new_plan, 'pago')) end;
  v_prev_label text := case v_prev_plan
    when 'essential' then 'Essencial' when 'plus' then 'Plus' when 'free' then 'Gratuito'
    else initcap(coalesce(v_prev_plan, '—')) end;
  v_sub_key text := coalesce(nullif(btrim(new.stripe_subscription_id), ''), new.id::text);
  v_evt_key text := coalesce(nullif(btrim(new.stripe_event_id), ''), new.id::text);
  v_type text;
  v_title text;
  v_message text;
begin
  if new.event_type not in
     ('checkout_completed', 'upgrade_confirmed', 'downgrade_completed', 'cancellation_completed') then
    return new;
  end if;

  select nullif(btrim(coalesce(p.full_name, '')), ''), p.email
    into v_name, v_email
  from public.profiles p
  where p.user_id = new.user_id;

  if new.event_type = 'checkout_completed' then
    update public.profiles
       set first_paid_at = coalesce(first_paid_at, coalesce(new.occurred_at, now()))
     where user_id = new.user_id;
    v_type := 'subscription_started';
    v_title := 'Nova assinatura ' || v_new_label;
    v_message := coalesce(v_name, 'Um usuário') || ' acabou de assinar o Plano ' || v_new_label || '.';
  elsif new.event_type = 'upgrade_confirmed' then
    v_type := 'plan_upgraded';
    v_title := 'Upgrade de plano — ' || v_new_label;
    v_message := coalesce(v_name, 'Um usuário') || ' mudou do ' || v_prev_label || ' para o ' || v_new_label || '.';
  elsif new.event_type = 'downgrade_completed' then
    v_type := 'plan_downgraded';
    v_title := 'Downgrade de plano — ' || v_new_label;
    v_message := coalesce(v_name, 'Um usuário') || ' mudou do ' || v_prev_label || ' para o ' || v_new_label || '.';
  else
    v_type := 'subscription_cancelled';
    v_title := 'Assinatura cancelada';
    v_message := coalesce(v_name, 'Um usuário') || ' cancelou o Plano ' || v_prev_label || '.';
  end if;

  perform public._admin_activity_emit(
    v_type,
    new.user_id,
    v_title,
    v_message,
    jsonb_build_object(
      'plan', v_new_plan,
      'previous_plan', v_prev_plan,
      'subscription_id', new.stripe_subscription_id,
      'customer_id', new.stripe_customer_id,
      'stripe_event_id', new.stripe_event_id,
      'price_id', new.metadata->>'price_id',
      'currency', coalesce(new.currency, 'BRL'),
      'amount', new.amount,
      'email', v_email,
      'created_at', coalesce(new.occurred_at, now())
    ),
    'stripe_webhook',
    new.stripe_event_id,
    case when new.event_type = 'checkout_completed'
      then 'subscription_started:' || v_sub_key
      else v_type || ':' || v_evt_key
    end
  );
  return new;
end;
$$;

revoke all on function public.tg_admin_activity_on_subscription() from public, anon, authenticated;
