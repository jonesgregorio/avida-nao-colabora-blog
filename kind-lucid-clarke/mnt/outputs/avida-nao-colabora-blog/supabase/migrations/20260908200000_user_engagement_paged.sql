-- ============================================================================
-- Engajamento — versão paginada / filtrada / com resumo (server-side)
-- ============================================================================
-- get_user_engagement() (migration 101) devolve TODOS os usuários e o Admin
-- filtrava/paginava/ordenava no navegador. Em escala isso trava a tela.
--
-- Thresholds do bucket (documentados; iguais aos que a UI usava):
--   ativo      = última atividade há <= 3 dias
--   esfriando  = entre 4 e 13 dias
--   inativo    = >= 14 dias
--   nunca      = nunca teve atividade (sem last_activity)
--
-- "última atividade" = GREATEST(last_seen_at, último diário/check-in,
--   última resposta de questionário, último conteúdo lido) — igual à 101.
--
-- Ambas as funções: SECURITY DEFINER + guarda is_admin() (expõem e-mails).
-- ============================================================================

-- Sinais base, reaproveitados pelas duas funções.
create or replace function public.admin_engagement_base()
returns table (
  user_id uuid, full_name text, email text, plan text, role text,
  created_at timestamptz, last_seen_at timestamptz,
  last_checkin timestamptz, last_diary timestamptz,
  last_questionnaire timestamptz, last_content timestamptz,
  last_activity timestamptz,
  checkins_30d int, diaries_30d int, questionnaires_30d int, contents_30d int,
  checkins_total int, diaries_total int,
  bucket text
)
language sql
stable
security definer
set search_path = public
as $$
  with di as (
    select d.user_id,
      max(d.created_at) filter (where d.entry_type = 'checkin') as last_checkin,
      max(d.created_at) filter (where d.entry_type = 'diary')   as last_diary,
      max(d.created_at)                                         as last_any,
      count(*) filter (where d.entry_type = 'checkin' and d.created_at > now() - interval '30 days') as checkins_30d,
      count(*) filter (where d.entry_type = 'diary'   and d.created_at > now() - interval '30 days') as diaries_30d,
      count(*) filter (where d.entry_type = 'checkin') as checkins_total,
      count(*) filter (where d.entry_type = 'diary')   as diaries_total
    from diary_entries d
    group by d.user_id
  ),
  qr as (
    select q.user_id,
      max(q.created_at) as last_questionnaire,
      count(*) filter (where q.created_at > now() - interval '30 days') as questionnaires_30d
    from questionnaire_responses q
    where q.user_id is not null
    group by q.user_id
  ),
  rh as (
    select r.user_id,
      max(r.created_at) as last_content,
      count(*) filter (where r.created_at > now() - interval '30 days') as contents_30d
    from reading_history r
    group by r.user_id
  ),
  base as (
    select
      p.user_id, p.full_name, p.email, p.plan,
      coalesce(p.role, 'user') as role,
      p.created_at, p.last_seen_at,
      di.last_checkin, di.last_diary, qr.last_questionnaire, rh.last_content,
      greatest(p.last_seen_at, di.last_any, qr.last_questionnaire, rh.last_content) as last_activity,
      coalesce(di.checkins_30d, 0)::int       as checkins_30d,
      coalesce(di.diaries_30d, 0)::int        as diaries_30d,
      coalesce(qr.questionnaires_30d, 0)::int as questionnaires_30d,
      coalesce(rh.contents_30d, 0)::int       as contents_30d,
      coalesce(di.checkins_total, 0)::int     as checkins_total,
      coalesce(di.diaries_total, 0)::int      as diaries_total
    from profiles p
    left join di on di.user_id = p.user_id
    left join qr on qr.user_id = p.user_id
    left join rh on rh.user_id = p.user_id
  )
  select b.*,
    case
      when b.last_activity is null then 'nunca'
      when b.last_activity > now() - interval '4 days'  then 'ativo'
      when b.last_activity > now() - interval '14 days' then 'esfriando'
      else 'inativo'
    end as bucket
  from base b;
$$;

revoke all on function public.admin_engagement_base() from public, anon, authenticated;

-- Resumo (contagem por bucket) — respeita busca / plano / hide_admins.
create or replace function public.get_user_engagement_summary(
  p_search text default null,
  p_plan text default null,
  p_hide_admins boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  select jsonb_build_object(
    'total',     count(*),
    'ativo',     count(*) filter (where bucket = 'ativo'),
    'esfriando', count(*) filter (where bucket = 'esfriando'),
    'inativo',   count(*) filter (where bucket = 'inativo'),
    'nunca',     count(*) filter (where bucket = 'nunca')
  )
  into v
  from public.admin_engagement_base() b
  where (not p_hide_admins or b.role <> 'admin')
    and (nullif(coalesce(p_plan, ''), '') is null or p_plan = 'todos' or b.plan = p_plan)
    and (v_q is null or b.full_name ilike '%' || v_q || '%' or b.email ilike '%' || v_q || '%');

  return coalesce(v, '{}'::jsonb);
end;
$$;

revoke all on function public.get_user_engagement_summary(text, text, boolean) from public, anon;
grant execute on function public.get_user_engagement_summary(text, text, boolean) to authenticated;

-- Página filtrada + ordenada. total_count = total do filtro (via window).
create or replace function public.get_user_engagement_page(
  p_search text default null,
  p_plan text default null,
  p_bucket text default null,
  p_hide_admins boolean default true,
  p_sort text default 'last_activity',
  p_dir text default 'desc',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  user_id uuid, full_name text, email text, plan text, role text,
  created_at timestamptz, last_seen_at timestamptz,
  last_checkin timestamptz, last_diary timestamptz,
  last_questionnaire timestamptz, last_content timestamptz,
  last_activity timestamptz,
  checkins_30d int, diaries_30d int, questionnaires_30d int, contents_30d int,
  checkins_total int, diaries_total int,
  bucket text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_sort text := lower(coalesce(p_sort, 'last_activity'));
  v_dir text := case when lower(coalesce(p_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  if v_sort not in ('last_activity','created_at','full_name','checkins_30d','diaries_30d','questionnaires_30d') then
    v_sort := 'last_activity';
  end if;

  return query execute format($f$
    with f as (
      select b.*, count(*) over() as total_count
      from public.admin_engagement_base() b
      where (not $1 or b.role <> 'admin')
        and ($2 is null or $2 = 'todos' or b.plan = $2)
        and ($3 is null or $3 = 'todos' or b.bucket = $3)
        and ($4 is null or b.full_name ilike '%%' || $4 || '%%' or b.email ilike '%%' || $4 || '%%')
    )
    select
      user_id, full_name, email, plan, role, created_at, last_seen_at,
      last_checkin, last_diary, last_questionnaire, last_content, last_activity,
      checkins_30d, diaries_30d, questionnaires_30d, contents_30d,
      checkins_total, diaries_total, bucket, total_count
    from f
    order by %I %s nulls last, user_id asc
    limit $5 offset $6
  $f$, v_sort, v_dir)
  using p_hide_admins, nullif(coalesce(p_plan,''),''), nullif(coalesce(p_bucket,''),''), v_q, v_limit, v_offset;
end;
$$;

revoke all on function public.get_user_engagement_page(text, text, text, boolean, text, text, int, int) from public, anon;
grant execute on function public.get_user_engagement_page(text, text, text, boolean, text, text, int, int) to authenticated;

comment on function public.get_user_engagement_page(text, text, text, boolean, text, text, int, int) is
  'Admin-only: página de engajamento por usuário com busca/plano/bucket/ordenação server-side. total_count é o total do filtro.';

-- Índices de apoio (as agregações varrem diary_entries por user_id + created_at).
create index if not exists diary_entries_user_type_created
  on public.diary_entries (user_id, entry_type, created_at desc);
create index if not exists questionnaire_responses_user_created
  on public.questionnaire_responses (user_id, created_at desc);
create index if not exists reading_history_user_created
  on public.reading_history (user_id, created_at desc);
