-- Etapa 5 (Evolução do Admin) — Auditoria administrativa.
--
-- 1) Imutabilidade: a policy legada "admin_logs_admin" era FOR ALL, ou seja
--    permitia que um admin fizesse UPDATE/DELETE nos próprios registros de
--    auditoria. A regra do produto é "a auditoria não pode ser editada
--    manualmente". Aqui trocamos por SELECT + INSERT (admin) e adicionamos
--    um gatilho BEFORE UPDATE/DELETE que sempre levanta exceção (defesa em
--    profundidade, vale inclusive para o dono da tabela via SQL direto).
--
-- 2) Valor anterior / valor novo: log_admin_change() passa a gravar, no UPDATE,
--    apenas os campos que realmente mudaram, como { campo: {de, para} } —
--    sem despejar a linha inteira e sem colunas ruidosas/sensíveis.
--
-- 3) admin_audit_query(): leitura filtrada + paginada + nome do admin já
--    resolvido + listas de valores distintos para os filtros da tela.
--
-- Não recria a tabela admin_logs (migration 007) nem remove dados.
-- Idempotente.

-- ------------------------------------------------------------------
-- 1) Imutabilidade
-- ------------------------------------------------------------------
alter table public.admin_logs enable row level security;

drop policy if exists "admin_logs_admin" on public.admin_logs;
drop policy if exists "admin_logs_select_admin" on public.admin_logs;
create policy "admin_logs_select_admin"
  on public.admin_logs
  for select
  to authenticated
  using (public.is_admin());

-- INSERT continua permitido só para admin (recria de forma explícita).
drop policy if exists "admin_logs_insert_admin" on public.admin_logs;
create policy "admin_logs_insert_admin"
  on public.admin_logs
  for insert
  to authenticated
  with check (public.is_admin());

-- Sem policy de UPDATE/DELETE: RLS já barra. O gatilho abaixo barra também
-- quem tenta por fora do RLS (owner/definer).
create or replace function public.admin_logs_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_logs é somente-anexar: % não é permitido', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists trg_admin_logs_immutable on public.admin_logs;
create trigger trg_admin_logs_immutable
  before update or delete on public.admin_logs
  for each row execute function public.admin_logs_block_mutation();

-- ------------------------------------------------------------------
-- 2) Diff de valor anterior/novo no gatilho de auditoria
-- ------------------------------------------------------------------
create or replace function log_admin_change() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_row     jsonb;
  v_action  text;
  v_old     jsonb;
  v_new     jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key     text;
  -- Colunas ruidosas ou sensíveis que nunca entram no diff.
  v_skip    text[] := array[
    'updated_at','created_at','last_edited_at','search_vector','tsv',
    'embedding','content','body','body_md','raw','html'
  ];
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old); v_action := 'delete';
  elsif tg_op = 'INSERT' then
    v_row := to_jsonb(new); v_action := 'create';
  else
    v_row := to_jsonb(new); v_action := 'update';
  end if;

  if tg_table_name = 'articles' and tg_op <> 'DELETE' and (v_row->>'status') = 'published' then
    v_action := 'publish';
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key = any(v_skip) then continue; end if;
      if (v_old->v_key) is distinct from (v_new->v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object('de', v_old->v_key, 'para', v_new->v_key)
        );
      end if;
    end loop;
  end if;

  begin
    insert into admin_logs (admin_id, action, target_type, target_id, details)
    values (
      auth.uid(),
      v_action,
      tg_table_name,
      v_row->>'id',
      jsonb_strip_nulls(jsonb_build_object(
        'title',    v_row->'title',
        'name',     v_row->'name',
        'slug',     v_row->'slug',
        'status',   v_row->'status',
        'label',    v_row->'label',
        'plan_key', v_row->'plan_key',
        'role',     v_row->'role',
        'changes',  case when v_changes = '{}'::jsonb then null else v_changes end
      ))
    );
  exception when others then
    null; -- auditoria nunca deve interromper a ação principal
  end;

  return coalesce(new, old);
end;
$fn$;

-- ------------------------------------------------------------------
-- 3) Leitura filtrada + paginada para a tela de Auditoria
-- ------------------------------------------------------------------
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
  if not public.is_admin() then
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

revoke all on function public.admin_audit_query(uuid, text, text, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.admin_audit_query(uuid, text, text, text, timestamptz, timestamptz, integer, integer) to authenticated;
