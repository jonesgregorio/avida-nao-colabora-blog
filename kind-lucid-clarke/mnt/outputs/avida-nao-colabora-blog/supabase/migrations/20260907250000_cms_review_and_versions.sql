-- Etapa 10 (Evolução do Admin) — CMS editorial: revisão + versões protegidas.
--
-- O que JÁ existe e NÃO é recriado:
--   - content_versions (snapshot por save) + botão "Restaurar" no editor;
--   - editorial_calendar com status ideia/em_revisao/aprovado/agendado/
--     publicado/arquivado/precisa_atualizar;
--   - editor com slug, SEO title/description, tags, categoria, agendamento,
--     preview e checklist de publicação.
--
-- O que esta etapa adiciona:
--   1) Fluxo de REVISÃO no artigo: colunas reviewed_by / reviewed_at /
--      review_notes (o status 'review' é só um valor da coluna TEXT existente).
--   2) content_versions vira APPEND-ONLY: gatilho que bloqueia UPDATE/DELETE
--      ("nunca excluir versões importantes silenciosamente").
--   3) admin_restore_article_version(): restauração de 1 clique, server-side,
--      que grava o estado antigo de volta no artigo E registra uma NOVA versão
--      com source='rollback' — nada é perdido.
-- Idempotente.

-- 1) Colunas de revisão -------------------------------------------------------
alter table public.articles add column if not exists reviewed_by  uuid references auth.users(id) on delete set null;
alter table public.articles add column if not exists reviewed_at  timestamptz;
alter table public.articles add column if not exists review_notes text;
alter table public.articles add column if not exists related_slugs text[];

-- 2) content_versions append-only -------------------------------------------
create or replace function public.content_versions_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'content_versions é somente-anexar: % não é permitido', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists trg_content_versions_immutable on public.content_versions;
create trigger trg_content_versions_immutable
  before update or delete on public.content_versions
  for each row execute function public.content_versions_block_mutation();

-- 3) Restauração de versão (1 clique, audita a própria volta) ----------------
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
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select snapshot into v_snap
  from public.content_versions
  where article_id = p_article_id and version = p_version;
  if v_snap is null then
    raise exception 'versão % não encontrada para o artigo', p_version;
  end if;

  -- Grava de volta só os campos de conteúdo/apresentação (nada de status de
  -- publicação nem métricas). O artigo NÃO é publicado por uma restauração.
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

revoke all on function public.admin_restore_article_version(uuid, integer) from public, anon;
grant execute on function public.admin_restore_article_version(uuid, integer) to authenticated;
