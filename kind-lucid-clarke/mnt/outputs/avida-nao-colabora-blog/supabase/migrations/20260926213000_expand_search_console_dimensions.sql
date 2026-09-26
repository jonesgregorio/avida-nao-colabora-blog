-- Amplia o histórico do SEO Control Center com dimensões oficiais adicionais do Search Console.
alter table public.seo_search_performance_daily
  drop constraint if exists seo_search_performance_daily_dimension_check;

alter table public.seo_search_performance_daily
  add constraint seo_search_performance_daily_dimension_check
  check (dimension in (
    'total',
    'query',
    'page',
    'query_page',
    'device',
    'country',
    'search_appearance',
    'search_type'
  ));

comment on column public.seo_search_performance_daily.dimension is
  'Dimensão agregada do Search Console: total, query, page, query_page, device, country, search_appearance ou search_type.';
