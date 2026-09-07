-- Etapa 9 (Evolução do Admin) — Central de Comunicação: Campanhas.
--
-- Hoje "Nova notificação" insere 1 linha por usuário direto de notifications,
-- sem rascunho, sem agendamento, sem histórico consolidado e sem alvo por
-- segmento. Aqui adicionamos a camada de CAMPANHA:
--
--   admin_communications  = 1 registro por envio (rascunho/agendado/enviado),
--                           com alvo (todos/plano/segmento/usuário) e contadores.
--
-- Entrega in-app: fan-out server-side idempotente (marca cada notificação com
-- action_data->>'campaign' = id da campanha; reenviar não duplica).
-- Agendamento: um cron a cada 5 min processa as campanhas vencidas.
--
-- E-mail em massa NÃO é enviado por aqui — a campanha de e-mail pode ser salva
-- e agendada, mas o disparo continua no pipeline de e-mail existente. A tela
-- deixa isso explícito (nada de métrica inventada).
--
-- Reaproveita admin_segment_match() (Etapa 6) para o alvo por segmento.
-- Idempotente.

create table if not exists public.admin_communications (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null default 'in_app' check (channel in ('in_app','email')),
  title             text not null,
  message           text not null,
  action_url        text,
  target_kind       text not null default 'all' check (target_kind in ('all','plan','segment','user')),
  target_plan       text,
  target_segment_id uuid references public.admin_segments(id) on delete set null,
  target_user_id    uuid references auth.users(id) on delete set null,
  status            text not null default 'draft'
                    check (status in ('draft','scheduled','sending','sent','failed','canceled')),
  scheduled_for     timestamptz,
  sent_at           timestamptz,
  recipients_count  integer,
  sent_count        integer,
  last_error        text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_admin_comm_status_due
  on public.admin_communications (status, scheduled_for)
  where status = 'scheduled';

alter table public.admin_communications enable row level security;
drop policy if exists "admin_communications_all" on public.admin_communications;
create policy "admin_communications_all"
  on public.admin_communications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------
-- Resolve os user_id do alvo de uma campanha.
-- ------------------------------------------------------------------
create or replace function public.admin_communication_targets(
  p_kind       text,
  p_plan       text,
  p_segment_id uuid,
  p_user_id    uuid
)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if p_kind = 'user' then
    return query select p_user_id where p_user_id is not null;
  elsif p_kind = 'plan' then
    return query
      select p.user_id from public.profiles p
      where case
        when p_plan = 'plus' then coalesce(p.plan,'free') in ('plus','therapeutic','therapeutic-plus')
        else coalesce(p.plan,'free') = p_plan
      end;
  elsif p_kind = 'segment' then
    return query
      select m from public.admin_segment_match(
        (select s.filter from public.admin_segments s where s.id = p_segment_id)
      ) m;
  else -- all
    return query select p.user_id from public.profiles p;
  end if;
end;
$$;

-- ------------------------------------------------------------------
-- Contagem de destinatários (mostra antes de enviar).
-- ------------------------------------------------------------------
create or replace function public.admin_communication_estimate(
  p_kind       text,
  p_plan       text default null,
  p_segment_id uuid default null,
  p_user_id    uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  select count(*) into v_count
  from public.admin_communication_targets(p_kind, p_plan, p_segment_id, p_user_id);
  return coalesce(v_count, 0);
end;
$$;

-- ------------------------------------------------------------------
-- Entrega in-app de UMA campanha (idempotente). Uso interno.
-- ------------------------------------------------------------------
create or replace function public._deliver_communication(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  c public.admin_communications%rowtype;
  v_dest text;
  v_sent integer;
begin
  select * into c from public.admin_communications where id = p_id;
  if not found then raise exception 'campanha % não encontrada', p_id; end if;
  if c.channel <> 'in_app' then raise exception 'entrega automática só para in_app'; end if;

  v_dest := coalesce(nullif(btrim(coalesce(c.action_url, '')), ''), 'notifications');

  with alvo as (
    select t as user_id
    from public.admin_communication_targets(c.target_kind, c.target_plan, c.target_segment_id, c.target_user_id) t
  ),
  ins as (
    insert into public.notifications
      (user_id, type, title, message, body, action_url, destination_path, priority, created_by, is_read, action_data)
    select a.user_id, 'admin_message', c.title, c.message, c.message, v_dest, v_dest, 'normal',
           c.created_by, false, jsonb_build_object('campaign', c.id::text)
    from alvo a
    where not exists (
      select 1 from public.notifications n
      where n.user_id = a.user_id
        and n.action_data->>'campaign' = c.id::text
    )
    returning 1
  )
  select count(*) into v_sent from ins;

  update public.admin_communications set
    status = 'sent',
    sent_at = now(),
    sent_count = coalesce(sent_count, 0) + coalesce(v_sent, 0),
    recipients_count = (select count(*) from public.admin_communication_targets(c.target_kind, c.target_plan, c.target_segment_id, c.target_user_id)),
    last_error = null,
    updated_at = now()
  where id = p_id;

  return coalesce(v_sent, 0);
end;
$$;

-- ------------------------------------------------------------------
-- Enviar agora (admin).
-- ------------------------------------------------------------------
create or replace function public.admin_communication_send(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  c public.admin_communications%rowtype;
  v_sent integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into c from public.admin_communications where id = p_id;
  if not found then raise exception 'campanha não encontrada'; end if;
  if c.status not in ('draft','scheduled','failed') then
    raise exception 'campanha no status "%" não pode ser enviada', c.status;
  end if;
  if c.channel = 'email' then
    raise exception 'envio de e-mail em massa passa pelo pipeline de e-mail; aqui só in-app';
  end if;

  v_sent := public._deliver_communication(p_id);
  return jsonb_build_object('sent', v_sent);
end;
$$;

-- ------------------------------------------------------------------
-- Cron: processa campanhas agendadas vencidas (só service_role).
-- ------------------------------------------------------------------
create or replace function public.admin_process_due_communications()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r record;
  v_total integer := 0;
begin
  for r in
    select id from public.admin_communications
    where status = 'scheduled'
      and channel = 'in_app'
      and scheduled_for is not null
      and scheduled_for <= now()
    order by scheduled_for
    limit 20
  loop
    begin
      update public.admin_communications set status = 'sending', updated_at = now() where id = r.id;
      v_total := v_total + public._deliver_communication(r.id);
    exception when others then
      update public.admin_communications set status = 'failed', last_error = SQLERRM, updated_at = now() where id = r.id;
    end;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.admin_communication_targets(text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public._deliver_communication(uuid) from public, anon, authenticated;
revoke all on function public.admin_process_due_communications() from public, anon, authenticated;
grant execute on function public.admin_communication_targets(text, text, uuid, uuid) to service_role;
grant execute on function public._deliver_communication(uuid) to service_role;
grant execute on function public.admin_process_due_communications() to service_role;

revoke all on function public.admin_communication_estimate(text, text, uuid, uuid) from public, anon;
revoke all on function public.admin_communication_send(uuid) from public, anon;
grant execute on function public.admin_communication_estimate(text, text, uuid, uuid) to authenticated;
grant execute on function public.admin_communication_send(uuid) to authenticated;

-- Agenda o processamento das campanhas (a cada 5 min; tolerante se pg_cron não existir).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('process-scheduled-communications', '*/5 * * * *',
    'SELECT public.admin_process_due_communications();');
  raise notice 'cron process-scheduled-communications agendado (*/5 min).';
exception when others then
  raise notice 'pg_cron indisponível (%): agendamento ignorado.', SQLERRM;
end;
$$;
