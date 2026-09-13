-- SEO público: entrega HTML rastreável sem expor conteúdos fechados ou dados pessoais.
-- Mantém a RPC anterior de metadados para compatibilidade e cria contratos
-- específicos para o renderizador server-side, índice do blog e sitemap.

-- URLs legíveis e permanentes substituem sufixos aleatórios antigos. O deploy
-- mantém redirects 308 das URLs anteriores para não perder links existentes.
update public.articles a
set slug = 'como-dizer-nao-sem-culpa-e-preservar-sua-energia', updated_at = now()
where a.slug = 'como-dizer-nao-sem-culpa-e-preservar-sua-energia-btcpl-ifq'
  and not exists (
    select 1 from public.articles b
    where b.slug = 'como-dizer-nao-sem-culpa-e-preservar-sua-energia'
  );

update public.articles a
set slug = 'como-se-acalmar-durante-uma-crise-de-ansiedade', updated_at = now()
where a.slug = 'como-acalmar-uma-crise-de-ansiedade-no-instante-m6nec-fj7'
  and not exists (
    select 1 from public.articles b
    where b.slug = 'como-se-acalmar-durante-uma-crise-de-ansiedade'
  );

update public.articles
set related_slugs = array_replace(related_slugs, 'como-dizer-nao-sem-culpa-e-preservar-sua-energia-btcpl-ifq', 'como-dizer-nao-sem-culpa-e-preservar-sua-energia')
where related_slugs @> array['como-dizer-nao-sem-culpa-e-preservar-sua-energia-btcpl-ifq'];

update public.articles
set related_slugs = array_replace(related_slugs, 'como-acalmar-uma-crise-de-ansiedade-no-instante-m6nec-fj7', 'como-se-acalmar-durante-uma-crise-de-ansiedade')
where related_slugs @> array['como-acalmar-uma-crise-de-ansiedade-no-instante-m6nec-fj7'];

-- Autoria institucional explícita para o acervo legado. Não inventa nome ou
-- credencial profissional; revisões especializadas continuam sendo registradas
-- pelo fluxo editorial existente.
update public.articles
set author = 'Equipe editorial A Vida Não Colabora', updated_at = now()
where nullif(trim(author), '') is null;

-- Ligações dos oito pilares para conteúdos complementares já publicados.
with pillar_links(slug, links) as (
  values
    ('como-comecar-um-diario-emocional-sem-saber-o-que-escrever', array['faca-seu-primeiro-check-in-emocional','como-registrar-seu-dia-em-uma-frase','como-usar-o-diario-para-entender-gatilhos-do-dia-a-dia']::text[]),
    ('faca-seu-primeiro-check-in-emocional', array['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','perguntas-simples-para-entender-como-voce-esta-hoje','3-perguntas-para-fechar-o-dia-com-mais-clareza']::text[]),
    ('como-identificar-padroes-nos-seus-registros-emocionais', array['como-perceber-ciclos-que-se-repetem-ao-longo-do-mes','como-usar-o-diario-para-entender-gatilhos-do-dia-a-dia','como-ler-seu-mes-emocional-com-mais-profundidade']::text[]),
    ('o-que-e-autocuidado-emocional-na-vida-real', array['como-transformar-seus-registros-em-um-plano-de-autocuidado','autocuidado-nao-precisa-ser-bonito-para-funcionar','5-sinais-de-que-voce-precisa-desacelerar']::text[]),
    ('como-perceber-se-hoje-foi-um-dia-de-sobrecarga', array['como-lidar-com-dias-em-que-tudo-parece-pesado','o-que-observar-quando-a-cabeca-esta-cheia','um-exercicio-de-pausa-para-dias-pesados']::text[]),
    ('como-dizer-nao-sem-culpa-e-preservar-sua-energia', array['como-perceber-se-hoje-foi-um-dia-de-sobrecarga','o-que-e-autocuidado-emocional-na-vida-real']::text[]),
    ('como-relacionar-ansiedade-sono-e-rotina', array['como-as-telas-atrapalham-o-sono-e-o-que-mudar-gxmen-y7n','o-que-sua-energia-da-semana-pode-estar-tentando-mostrar','5-sinais-de-que-voce-precisa-desacelerar']::text[]),
    ('como-transformar-seus-registros-em-um-plano-de-autocuidado', array['o-que-observar-antes-de-definir-prioridades-para-o-proximo-mes','como-ler-seu-mes-emocional-com-mais-profundidade','o-que-e-autocuidado-emocional-na-vida-real']::text[])
)
update public.articles a
set related_slugs = (
  select array_agg(distinct candidate)
  from unnest(coalesce(a.related_slugs, '{}'::text[]) || p.links) candidate
  where candidate <> a.slug
), updated_at = now()
from pillar_links p
where a.slug = p.slug;

create or replace function public.get_public_article_document(p_slug text)
returns table (
  slug text,
  title text,
  seo_title text,
  seo_description text,
  summary text,
  excerpt text,
  content text,
  author text,
  category text,
  plan_required text,
  related_slugs text[],
  og_image text,
  image_url text,
  cover_image_url text,
  cover_image text,
  image_alt text,
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    a.slug,
    a.title,
    a.seo_title,
    a.seo_description,
    a.summary,
    a.excerpt,
    case
      when coalesce(a.plan_required, 'free') = 'free' then a.content
      else null
    end as content,
    coalesce(nullif(trim(a.author), ''), 'Equipe editorial A Vida Não Colabora') as author,
    a.category,
    coalesce(a.plan_required, 'free') as plan_required,
    a.related_slugs,
    a.og_image,
    a.image_url,
    a.cover_image_url,
    a.cover_image,
    a.image_alt,
    a.reviewed_at,
    coalesce(a.published_at, a.created_at) as published_at,
    coalesce(a.updated_at, a.published_at, a.created_at) as updated_at
  from public.articles a
  where a.slug = p_slug
    and a.published = true
  limit 1;
$function$;

create or replace function public.list_public_article_index()
returns table (
  slug text,
  title text,
  excerpt text,
  category text,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    a.slug,
    a.title,
    coalesce(nullif(trim(a.summary), ''), nullif(trim(a.excerpt), ''), nullif(trim(a.seo_description), '')) as excerpt,
    a.category,
    coalesce(a.published_at, a.created_at) as published_at,
    coalesce(a.updated_at, a.published_at, a.created_at) as updated_at
  from public.articles a
  where a.published = true
    and coalesce(a.plan_required, 'free') = 'free'
    and nullif(trim(a.slug), '') is not null
  order by coalesce(a.published_at, a.created_at) desc;
$function$;

create or replace function public.list_public_article_sitemap()
returns table (
  slug text,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    a.slug,
    coalesce(a.published_at, a.created_at) as published_at,
    coalesce(a.updated_at, a.published_at, a.created_at) as updated_at
  from public.articles a
  where a.published = true
    and coalesce(a.plan_required, 'free') = 'free'
    and nullif(trim(a.slug), '') is not null
  order by coalesce(a.updated_at, a.published_at, a.created_at) desc;
$function$;

revoke all on function public.get_public_article_document(text) from public;
revoke all on function public.list_public_article_index() from public;
revoke all on function public.list_public_article_sitemap() from public;
grant execute on function public.get_public_article_document(text) to anon, authenticated;
grant execute on function public.list_public_article_index() to anon, authenticated;
grant execute on function public.list_public_article_sitemap() to anon, authenticated;

comment on function public.get_public_article_document(text) is
'Public SEO document for a published article. The body is returned only for free content; paid content exposes metadata only.';

comment on function public.list_public_article_index() is
'Public, free article titles and excerpts used by the server-rendered blog index.';

comment on function public.list_public_article_sitemap() is
'Public, free article slugs and meaningful timestamps for the dynamic sitemap.';
