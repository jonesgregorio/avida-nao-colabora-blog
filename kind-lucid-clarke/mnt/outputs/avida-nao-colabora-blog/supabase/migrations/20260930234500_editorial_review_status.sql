-- O editor e o fluxo editorial já conhecem o status `review`, porém a constraint
-- histórica de articles ainda aceitava apenas draft/published/archived/scheduled.
-- Sem esta correção, selecionar "Em revisão" no Admin falha no banco e a Central
-- de Ação nunca recebe a pendência editorial.

begin;

alter table public.articles
  drop constraint if exists articles_status_check;

alter table public.articles
  add constraint articles_status_check
  check (status in ('published','draft','review','archived','scheduled'));

comment on column public.articles.status is
  'Fluxo editorial: draft = rascunho sem obrigação; review = aguarda revisão humana; scheduled = aprovado/agendado; published = publicado; archived = arquivado.';

commit;
