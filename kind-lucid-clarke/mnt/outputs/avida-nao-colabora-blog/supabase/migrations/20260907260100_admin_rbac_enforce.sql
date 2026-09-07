-- Etapa 11 — Aplicação da checagem por papel (admin_can) nas RPCs sensíveis
-- desta evolução. admin_can(m,a) já exige is_admin() por dentro, então:
--   - anônimo / não-admin continua 100% bloqueado;
--   - super_admin (todo admin atual) passa em tudo — nada muda para ninguém;
--   - papéis restritos (content/support/finance/analyst) passam a ser barrados
--     no BACKEND, não só escondidos na tela.
--
-- Só troca a linha do guard; corpo idêntico ao das migrations originais.
-- create or replace preserva os GRANTs existentes. Idempotente.

-- Cortesia / dias adicionais  -> finance:operate
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
  if not public.admin_can('finance','operate') then
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

-- Notificação em massa por segmento  -> users:operate
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
  if not public.admin_can('users','operate') then
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

-- Enviar campanha  -> communication:operate
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
  if not public.admin_can('communication','operate') then
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

-- Restaurar versão de artigo  -> content:operate
create or replace function public.admin_restore_article_version(
  p_article_id uuid,
  p_version    integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_snap    jsonb;
  v_next    integer;
  v_admin   uuid := auth.uid();
begin
  if not public.admin_can('content','operate') then
    raise exception 'not authorized';
  end if;

  select snapshot into v_snap
  from public.content_versions
  where article_id = p_article_id and version = p_version;
  if v_snap is null then
    raise exception 'versão % não encontrada para o artigo', p_version;
  end if;

  update public.articles a set
    title           = coalesce(v_snap->>'title', a.title),
    slug            = coalesce(v_snap->>'slug', a.slug),
    content         = coalesce(v_snap->>'content', a.content),
    summary         = coalesce(v_snap->>'summary', a.summary),
    excerpt         = coalesce(v_snap->>'summary', v_snap->>'excerpt', a.excerpt),
    category        = coalesce(v_snap->>'category', a.category),
    plan_required   = coalesce(v_snap->>'plan_required', a.plan_required),
    image_url       = coalesce(v_snap->>'image_url', a.image_url),
    cover_image     = coalesce(v_snap->>'image_url', a.cover_image),
    cover_image_url = coalesce(v_snap->>'image_url', a.cover_image_url),
    image_alt       = coalesce(v_snap->>'image_alt', a.image_alt),
    seo_title       = coalesce(v_snap->>'seo_title', a.seo_title),
    seo_description = coalesce(v_snap->>'seo_description', a.seo_description),
    diary_question  = coalesce(v_snap->>'diary_question', a.diary_question),
    cta_text        = coalesce(v_snap->>'cta_text', a.cta_text),
    cta_link        = coalesce(v_snap->>'cta_link', a.cta_link),
    updated_at      = now()
  where a.id = p_article_id;

  select coalesce(max(version), 0) + 1 into v_next
  from public.content_versions where article_id = p_article_id;

  insert into public.content_versions (article_id, version, snapshot, source, change_note, created_by)
  select p_article_id, v_next,
    to_jsonb(a) - 'search_vector' - 'tsv',
    'rollback',
    format('Restaurada a partir da versão %s', p_version),
    v_admin
  from public.articles a where a.id = p_article_id;

  return jsonb_build_object('restored_from', p_version, 'new_version', v_next);
end;
$$;

-- Auditoria (leitura)  -> audit:view
create or replace function public.admin_audit_query(
  p_admin   uuid    default null,
  p_module  text    default null,
  p_action  text    default null,
  p_target  text    default null,
  p_from    timestamptz default null,
  p_to      timestamptz default null,
  p_limit   integer default 50,
  p_offset  integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total  integer;
  v_rows   jsonb;
begin
  if not public.admin_can('audit','view') then
    raise exception 'not authorized';
  end if;

  select count(*) into v_total
  from public.admin_logs l
  where (p_admin  is null or l.admin_id = p_admin)
    and (p_module is null or l.target_type = p_module)
    and (p_action is null or l.action = p_action)
    and (p_from   is null or l.created_at >= p_from)
    and (p_to     is null or l.created_at <= p_to)
    and (
      p_target is null or btrim(p_target) = ''
      or l.target_id ilike '%' || p_target || '%'
      or coalesce(l.details::text, '') ilike '%' || p_target || '%'
    );

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      l.id,
      l.admin_id,
      coalesce(p.full_name, '') as admin_name,
      l.action,
      l.target_type,
      l.target_id,
      l.details,
      l.created_at
    from public.admin_logs l
    left join public.profiles p on p.user_id = l.admin_id
    where (p_admin  is null or l.admin_id = p_admin)
      and (p_module is null or l.target_type = p_module)
      and (p_action is null or l.action = p_action)
      and (p_from   is null or l.created_at >= p_from)
      and (p_to     is null or l.created_at <= p_to)
      and (
        p_target is null or btrim(p_target) = ''
        or l.target_id ilike '%' || p_target || '%'
        or coalesce(l.details::text, '') ilike '%' || p_target || '%'
      )
    order by l.created_at desc
    limit v_limit offset v_offset
  ) t;

  return jsonb_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows,
    'filters', jsonb_build_object(
      'admins', coalesce((
        select jsonb_agg(distinct jsonb_build_object('id', l.admin_id, 'name', coalesce(p.full_name, '')))
        from public.admin_logs l
        left join public.profiles p on p.user_id = l.admin_id
        where l.admin_id is not null
      ), '[]'::jsonb),
      'modules', coalesce((
        select jsonb_agg(distinct l.target_type order by l.target_type)
        from public.admin_logs l where l.target_type is not null
      ), '[]'::jsonb),
      'actions', coalesce((
        select jsonb_agg(distinct l.action order by l.action)
        from public.admin_logs l where l.action is not null
      ), '[]'::jsonb)
    )
  );
end;
$$;
