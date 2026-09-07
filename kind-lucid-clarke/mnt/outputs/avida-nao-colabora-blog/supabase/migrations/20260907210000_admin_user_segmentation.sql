-- Etapa 6 (Evolução do Admin) — Segmentação avançada de usuários.
--
-- Reaproveita profiles / user_subscriptions / diary_entries / support_tickets /
-- notifications. Nada de tabela de usuário nova. O único armazenamento novo é
-- admin_segments: a definição de um "público" salvo para reutilizar.
--
-- Um único filtro (jsonb) é interpretado por public.admin_segment_match(), e
-- todas as RPCs (preview, lista, etiqueta em massa, notificação em massa) usam
-- essa mesma função — sem duplicar a lógica de filtro.
--
-- Segurança: toda RPC exige public.is_admin(); nada exposto a anon. As ações de
-- massa (etiqueta / notificação) são idempotentes e devolvem a contagem afetada
-- para a tela auditar.
-- Idempotente.

-- ------------------------------------------------------------------
-- Público salvo
-- ------------------------------------------------------------------
create table if not exists public.admin_segments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  filter      jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.admin_segments enable row level security;
drop policy if exists "admin_segments_all" on public.admin_segments;
create policy "admin_segments_all"
  on public.admin_segments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------
-- Núcleo do filtro: devolve os user_id que casam com a definição.
-- ------------------------------------------------------------------
create or replace function public.admin_segment_match(p_filter jsonb)
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  with f as (
    select
      coalesce(p_filter, '{}'::jsonb) as j
  ),
  base as (
    select
      p.user_id,
      coalesce(p.plan, 'free') as plan,
      coalesce(p.account_status, 'active') as status,
      p.role,
      coalesce(p.discount_percent, 0) as disc_pct,
      coalesce(p.discount_fixed, 0) as disc_fix,
      p.unlimited_access,
      coalesce(p.admin_tags, '{}'::text[]) as tags,
      p.created_at,
      greatest(
        coalesce(p.last_seen_at, 'epoch'::timestamptz),
        coalesce((select max(d.created_at) from public.diary_entries d where d.user_id = p.user_id), 'epoch'::timestamptz)
      ) as last_activity
    from public.profiles p
  )
  select b.user_id
  from base b, f
  where
    -- planos
    (
      not (f.j ? 'plans') or jsonb_array_length(f.j->'plans') = 0
      or (
        (b.plan = any(array(select jsonb_array_elements_text(f.j->'plans'))))
        or (
          f.j->'plans' ? 'plus'
          and b.plan in ('plus', 'therapeutic', 'therapeutic-plus')
        )
      )
    )
    -- situação da conta
    and (
      not (f.j ? 'statuses') or jsonb_array_length(f.j->'statuses') = 0
      or b.status = any(array(select jsonb_array_elements_text(f.j->'statuses')))
    )
    -- acesso / sinais
    and (
      not (f.j ? 'access') or jsonb_array_length(f.j->'access') = 0
      or (
        ('discount'     = any(array(select jsonb_array_elements_text(f.j->'access'))) and (b.disc_pct > 0 or b.disc_fix > 0))
        or ('unlimited'  = any(array(select jsonb_array_elements_text(f.j->'access'))) and b.unlimited_access is true)
        or ('admin'      = any(array(select jsonb_array_elements_text(f.j->'access'))) and b.role = 'admin')
        or ('open_ticket'= any(array(select jsonb_array_elements_text(f.j->'access')))
            and exists (select 1 from public.support_tickets st where st.user_id = b.user_id and st.status not in ('closed','resolved')))
        or ('unread_notif' = any(array(select jsonb_array_elements_text(f.j->'access')))
            and exists (select 1 from public.notifications n where n.user_id = b.user_id and n.is_read is false))
      )
    )
    -- etiquetas
    and (
      not (f.j ? 'tags') or jsonb_array_length(f.j->'tags') = 0
      or (
        case when coalesce(f.j->>'tags_mode', 'any') = 'all'
          then b.tags @> array(select jsonb_array_elements_text(f.j->'tags'))
          else b.tags && array(select jsonb_array_elements_text(f.j->'tags'))
        end
      )
    )
    -- data de cadastro
    and (f.j->>'signup_from' is null or b.created_at >= (f.j->>'signup_from')::timestamptz)
    and (f.j->>'signup_to'   is null or b.created_at <  ((f.j->>'signup_to')::date + 1))
    -- inatividade / atividade recente
    and (
      f.j->>'inactive_days' is null
      or b.last_activity < now() - make_interval(days => (f.j->>'inactive_days')::int)
    )
    and (
      f.j->>'active_within_days' is null
      or b.last_activity >= now() - make_interval(days => (f.j->>'active_within_days')::int)
    )
    -- assinatura (fonte: user_subscriptions)
    and (
      f.j->>'subscription' is null
      or (
        case f.j->>'subscription'
          when 'active' then exists (
            select 1 from public.user_subscriptions s
            where s.user_id = b.user_id and s.status in ('active','trialing')
              and coalesce(s.cancel_at_period_end, false) is false
          )
          when 'canceling' then exists (
            select 1 from public.user_subscriptions s
            where s.user_id = b.user_id and s.status in ('active','trialing')
              and coalesce(s.cancel_at_period_end, false) is true
          )
          when 'none' then not exists (
            select 1 from public.user_subscriptions s
            where s.user_id = b.user_id and s.status in ('active','trialing')
          )
          else true
        end
      )
    );
$$;

-- ------------------------------------------------------------------
-- Prévia: contagem + amostra de 25.
-- ------------------------------------------------------------------
create or replace function public.admin_segment_preview(p_filter jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_ids uuid[];
  v_sample jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select array_agg(m) into v_ids from public.admin_segment_match(p_filter) m;
  v_ids := coalesce(v_ids, '{}'::uuid[]);

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_sample
  from (
    select p.user_id, p.full_name, p.email, coalesce(p.plan,'free') as plan,
           coalesce(p.account_status,'active') as account_status
    from public.profiles p
    where p.user_id = any(v_ids)
    order by p.created_at desc
    limit 25
  ) t;

  return jsonb_build_object('count', array_length(v_ids, 1), 'sample', v_sample);
end;
$$;

-- ------------------------------------------------------------------
-- Lista paginada (visualizar / exportar).
-- ------------------------------------------------------------------
create or replace function public.admin_segment_list(
  p_filter jsonb,
  p_limit  integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 100), 1), 1000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_ids uuid[];
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select array_agg(m) into v_ids from public.admin_segment_match(p_filter) m;
  v_ids := coalesce(v_ids, '{}'::uuid[]);

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select p.user_id, p.full_name, p.email, coalesce(p.plan,'free') as plan,
           coalesce(p.account_status,'active') as account_status,
           coalesce(p.admin_tags, '{}'::text[]) as admin_tags,
           p.created_at, p.last_seen_at
    from public.profiles p
    where p.user_id = any(v_ids)
    order by p.created_at desc
    offset v_offset limit v_limit
  ) t;

  return jsonb_build_object('total', array_length(v_ids, 1), 'rows', v_rows);
end;
$$;

-- ------------------------------------------------------------------
-- Ação em massa: adicionar etiqueta (idempotente).
-- ------------------------------------------------------------------
create or replace function public.admin_segment_apply_tag(p_filter jsonb, p_tag text)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tag text := btrim(coalesce(p_tag, ''));
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if v_tag = '' then
    raise exception 'etiqueta obrigatória';
  end if;

  with alvo as (
    select m from public.admin_segment_match(p_filter) m
  ),
  upd as (
    update public.profiles p
      set admin_tags = array_append(coalesce(p.admin_tags, '{}'::text[]), v_tag)
    where p.user_id in (select m from alvo)
      and not (coalesce(p.admin_tags, '{}'::text[]) @> array[v_tag])
    returning p.user_id
  )
  select count(*) into v_count from upd;

  return coalesce(v_count, 0);
end;
$$;

-- ------------------------------------------------------------------
-- Ação em massa: notificação in-app (idempotente por título nas últimas 24h).
-- ------------------------------------------------------------------
create or replace function public.admin_segment_notify(
  p_filter      jsonb,
  p_title       text,
  p_message     text,
  p_destination text default 'notifications'
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_msg   text := btrim(coalesce(p_message, ''));
  v_dest  text := coalesce(nullif(btrim(p_destination), ''), 'notifications');
  v_admin uuid := auth.uid();
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if v_title = '' or v_msg = '' then
    raise exception 'título e mensagem obrigatórios';
  end if;

  with alvo as (
    select m as user_id from public.admin_segment_match(p_filter) m
  ),
  ins as (
    insert into public.notifications (user_id, type, title, message, action_url, destination_path, priority, created_by, is_read)
    select a.user_id, 'admin_message', v_title, v_msg, v_dest, v_dest, 'normal', v_admin, false
    from alvo a
    where not exists (
      select 1 from public.notifications n
      where n.user_id = a.user_id
        and n.title = v_title
        and n.created_at > now() - interval '24 hours'
    )
    returning user_id
  )
  select count(*) into v_count from ins;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.admin_segment_match(jsonb) from public, anon;
revoke all on function public.admin_segment_preview(jsonb) from public, anon;
revoke all on function public.admin_segment_list(jsonb, integer, integer) from public, anon;
revoke all on function public.admin_segment_apply_tag(jsonb, text) from public, anon;
revoke all on function public.admin_segment_notify(jsonb, text, text, text) from public, anon;
grant execute on function public.admin_segment_match(jsonb) to authenticated;
grant execute on function public.admin_segment_preview(jsonb) to authenticated;
grant execute on function public.admin_segment_list(jsonb, integer, integer) to authenticated;
grant execute on function public.admin_segment_apply_tag(jsonb, text) to authenticated;
grant execute on function public.admin_segment_notify(jsonb, text, text, text) to authenticated;
